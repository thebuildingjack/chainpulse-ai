// apps/api/src/agent/agentLoop.ts
// The autonomous agent loop — runs on schedule, fetches data, calls AI, stores results.
// This is the "brain" of ChainPulse AI.

import { prisma } from "../db/client";
import { runAgentInference } from "./aiPipeline";
import {
  getWalletBalances,
  getRecentTransactions,
  getJupiterQuote,
  computeSignals,
} from "../tools/solanaTools";
import { checkPolicy, canAutoExecute } from "@chainpulse/shared";
import { executeJupiterSwap } from "../tools/jupiterExecute";
import type { ToolCallLog } from "@chainpulse/shared";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_DEVNET = process.env.JUPITER_OUTPUT_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// ─── Run one agent loop iteration for a session ───────────────────────────────

export async function runAgentLoop(sessionId: string): Promise<{ runId: string; success: boolean }> {
  const toolCallLog: ToolCallLog[] = [];

  // ── Load session ─────────────────────────────────────────────────────────────
  const session = await prisma.agentSession.findUnique({ where: { id: sessionId } });
  if (!session || !session.isActive) {
    throw new Error(`Session ${sessionId} not found or inactive`);
  }

  const guardrails = JSON.parse(session.guardrails || "{}");
  const watchlistMints: string[] = JSON.parse(session.watchlistMints || "[]");

  // ── Create run record ─────────────────────────────────────────────────────────
  const run = await prisma.agentRun.create({
    data: { sessionId, status: "RUNNING" },
  });

  const logTool = (tool: string, params: object, result?: object, error?: string) => {
    const entry: ToolCallLog = {
      tool,
      params,
      result,
      error,
      calledAt: new Date().toISOString(),
    };
    toolCallLog.push(entry);
  };

  try {
    // ── Step 1: Fetch on-chain snapshot ─────────────────────────────────────────
    let walletData;
    try {
      walletData = await getWalletBalances(session.walletAddress);
      logTool("getWalletBalances", { pubkey: session.walletAddress }, walletData);
    } catch (err: any) {
      logTool("getWalletBalances", { pubkey: session.walletAddress }, undefined, err.message);
      // Use cached snapshot if available
      const cached = await prisma.snapshotCache.findUnique({ where: { sessionId } });
      if (cached) {
        walletData = JSON.parse(cached.snapshotJson);
        logTool("getWalletBalances", { source: "cache" }, walletData);
      } else {
        throw new Error(`RPC failed and no cached snapshot: ${err.message}`);
      }
    }

    let recentTxs;
    try {
      recentTxs = await getRecentTransactions(session.walletAddress, 15);
      logTool("getRecentTransactions", { pubkey: session.walletAddress, limit: 15 }, recentTxs);
    } catch (err: any) {
      logTool("getRecentTransactions", { pubkey: session.walletAddress }, undefined, err.message);
      recentTxs = { walletAddress: session.walletAddress, transactions: [], totalFetched: 0 };
    }

    // ── Step 2: Get Jupiter quotes for watchlist tokens ──────────────────────────
    const mintsToQuote = [
      ...new Set([
        ...(guardrails.allowedOutputMints || []),
        ...watchlistMints,
        USDC_DEVNET,
      ]),
    ].slice(0, 4); // Limit API calls

    const jupiterQuotes = [];
    for (const outputMint of mintsToQuote) {
      if (outputMint === SOL_MINT) continue;
      try {
        const quote = await getJupiterQuote(
          SOL_MINT,
          outputMint,
          Math.floor(0.01 * 1e9), // probe with 0.01 SOL
          guardrails.slippageBpsMax || 300
        );
        logTool("getJupiterQuote", { inputMint: SOL_MINT, outputMint }, quote);
        jupiterQuotes.push(quote);
      } catch (err: any) {
        logTool("getJupiterQuote", { outputMint }, undefined, err.message);
        jupiterQuotes.push({
          available: false,
          inputMint: SOL_MINT,
          outputMint,
          inAmount: "0",
          outAmount: "0",
          priceImpactPct: 0,
          routeCount: 0,
          slippageBps: guardrails.slippageBpsMax || 300,
          error: err.message,
        });
      }
    }

    // ── Step 3: Load previous snapshot ──────────────────────────────────────────
    const prevCache = await prisma.snapshotCache.findUnique({ where: { sessionId } });
    const previousSnapshot = prevCache ? JSON.parse(prevCache.snapshotJson) : null;

    // ── Step 4: Compute signals ──────────────────────────────────────────────────
    const signals = computeSignals({
      current: walletData,
      previous: previousSnapshot,
      recentTxs,
      jupiterQuotes,
      watchlistMints,
      timeframe: session.timeframe,
      riskLevel: session.riskLevel,
    });
    logTool("computeSignals", { sessionId }, signals);

    // ── Step 5: Load previous insights for deduplication ────────────────────────
    const prevInsights = await prisma.insight.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { title: true },
    });

    // ── Step 6: Run AI inference ─────────────────────────────────────────────────
    const aiResult = await runAgentInference({
      walletAddress: session.walletAddress,
      solBalanceUi: walletData.solBalanceUi,
      tokenAccounts: walletData.tokenAccounts,
      recentTxCount: recentTxs.transactions.length,
      largestTransferSol: signals.summary.largestTransferSol,
      signals: signals.signals,
      signalSummary: signals.summary,
      jupiterQuotes: jupiterQuotes.map((q) => ({
        inputMint: q.inputMint,
        outputMint: q.outputMint,
        available: q.available,
        priceImpactPct: q.priceImpactPct,
      })),
      watchlistMints,
      timeframe: session.timeframe,
      riskLevel: session.riskLevel,
      permissionsMode: session.permissionsMode,
      guardrails: {
        maxSwapSolPerTx: guardrails.maxSwapSolPerTx || 0.1,
        slippageBpsMax: guardrails.slippageBpsMax || 300,
        allowedOutputMints: guardrails.allowedOutputMints || [],
        approvalThresholdSol: guardrails.approvalThresholdSol || 0.5,
      },
      previousInsightTitles: prevInsights.map((i) => i.title),
    });

    // ── Step 7: Persist insights ─────────────────────────────────────────────────
    for (const insight of aiResult.output.insights) {
      await prisma.insight.create({
        data: {
          sessionId,
          runId: run.id,
          title: insight.title,
          type: insight.type,
          severity: insight.severity,
          confidence: insight.confidence,
          summary: insight.summary,
          evidence: JSON.stringify(insight.evidence),
          recommendedNext: insight.recommendedNext,
        },
      });
    }

    // ── Step 8: Get daily spend ──────────────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    const dailySpend = await prisma.dailySpend.findUnique({
      where: { sessionId_date: { sessionId, date: today } },
    });
    const dailySpendSol = dailySpend?.spentSol || 0;

    // ── Step 9: Process recommended actions through policy engine ────────────────
    let executedCount = 0; // At most 1 auto-execution per loop

    for (const actionRec of aiResult.output.recommendedActions) {
      const policyCtx = {
        session: {
          id: sessionId,
          userId: session.userId,
          walletAddress: session.walletAddress,
          watchlistMints,
          watchlistPrograms: JSON.parse(session.watchlistPrograms || "[]"),
          timeframe: session.timeframe as any,
          riskLevel: session.riskLevel as any,
          permissionsMode: session.permissionsMode as any,
          guardrails: {
            maxSpendSolPerDay: guardrails.maxSpendSolPerDay || 1.0,
            maxSwapSolPerTx: guardrails.maxSwapSolPerTx || 0.1,
            allowedOutputMints: guardrails.allowedOutputMints || [],
            slippageBpsMax: guardrails.slippageBpsMax || 300,
            approvalThresholdSol: guardrails.approvalThresholdSol || 0.5,
            allowedDestinationAddresses: guardrails.allowedDestinationAddresses || [],
          },
          isActive: session.isActive,
          loopIntervalMinutes: session.loopIntervalMinutes,
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString(),
        },
        action: {
          actionType: actionRec.actionType,
          params: actionRec.params,
          risk: actionRec.risk,
        },
        dailySpendSolSoFar: dailySpendSol,
      };

      const policy = checkPolicy(policyCtx);

      let status: string;
      let txSignature: string | undefined;
      let explorerLink: string | undefined;
      let failureReason: string | undefined;

      if (!policy.approved) {
        status = "SKIPPED_POLICY";
        failureReason = policy.reasons.join("; ");
      } else if (policy.requiresHumanApproval) {
        status = "PENDING_APPROVAL";
      } else if (canAutoExecute(policy, policyCtx.session as any) && executedCount === 0) {
        // ── Execute the action ─────────────────────────────────────────────────
        if (actionRec.actionType === "JUPITER_SWAP") {
          const swapParams = actionRec.params as any;
          const execResult = await executeJupiterSwap({
            inputMint: swapParams.inputMint || SOL_MINT,
            outputMint: swapParams.outputMint || USDC_DEVNET,
            amountLamports: swapParams.amountLamports,
            slippageBps: swapParams.slippageBps || guardrails.slippageBpsMax || 300,
            userPublicKey: session.walletAddress,
          });

          if (execResult.success) {
            status = "EXECUTED";
            txSignature = execResult.txSignature;
            explorerLink = execResult.explorerLink;
            executedCount++;

            // Track spend
            const spentSol = swapParams.amountLamports / 1e9;
            await prisma.dailySpend.upsert({
              where: { sessionId_date: { sessionId, date: today } },
              update: { spentSol: { increment: spentSol } },
              create: { sessionId, date: today, spentSol },
            });
          } else {
            status = execResult.error?.includes("No route") ? "SKIPPED_NO_ROUTE" : "FAILED";
            failureReason = execResult.error;
          }
        } else if (actionRec.actionType === "NOTIFY") {
          status = "EXECUTED"; // NOTIFY is always "executed" (just persisted)
        } else {
          status = "PENDING_APPROVAL"; // TRANSFER always needs human approval
        }
      } else if (session.permissionsMode === "READ_ONLY" && actionRec.actionType !== "NOTIFY") {
        status = "SKIPPED_POLICY";
        failureReason = "Session is READ_ONLY";
      } else {
        status = "PENDING_APPROVAL";
      }

      await prisma.agentAction.create({
        data: {
          sessionId,
          runId: run.id,
          actionType: actionRec.actionType,
          risk: actionRec.risk,
          params: JSON.stringify(actionRec.params),
          reason: actionRec.reason,
          status,
          policyDecision: JSON.stringify(policy),
          txSignature,
          explorerLink,
          failureReason,
        },
      });
    }

    // ── Step 10: Update snapshot cache ───────────────────────────────────────────
    await prisma.snapshotCache.upsert({
      where: { sessionId },
      update: {
        snapshotJson: JSON.stringify(walletData),
        capturedAt: new Date(),
      },
      create: {
        sessionId,
        snapshotJson: JSON.stringify(walletData),
        capturedAt: new Date(),
      },
    });

    // ── Step 11: Update session timing ───────────────────────────────────────────
    const nextRun = new Date(
      Date.now() + aiResult.output.nextCheckInMinutes * 60 * 1000
    );
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { lastRunAt: new Date(), nextRunAt: nextRun },
    });

    // ── Step 12: Finalize run record ─────────────────────────────────────────────
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        snapshotData: JSON.stringify(walletData),
        aiOutputRaw: aiResult.rawResponse,
        toolCallLog: JSON.stringify(toolCallLog),
      },
    });

    return { runId: run.id, success: true };
  } catch (err: any) {
    console.error(`[AgentLoop] Session ${sessionId} failed:`, err.message);

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: err.message,
        toolCallLog: JSON.stringify(toolCallLog),
      },
    });

    await prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        lastRunAt: new Date(),
        nextRunAt: new Date(Date.now() + 5 * 60 * 1000), // retry in 5 min
      },
    });

    return { runId: run.id, success: false };
  }
}
