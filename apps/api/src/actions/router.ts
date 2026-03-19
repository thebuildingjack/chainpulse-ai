// apps/api/src/actions/router.ts
import { Router, Response } from "express";
import { prisma } from "../db/client";
import { AuthenticatedRequest } from "../middleware/auth";
import { checkPolicy, canAutoExecute } from "@chainpulse/shared";
import { executeJupiterSwap } from "../tools/jupiterExecute";

export const actionsRouter = Router();

const SOL_MINT = "So11111111111111111111111111111111111111112";

// ─── GET /actions?sessId=&status= ────────────────────────────────────────────

actionsRouter.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const { sessId, status, limit = "50" } = req.query;

  const actions = await prisma.agentAction.findMany({
    where: {
      session: { userId: req.user!.userId },
      ...(sessId ? { sessionId: String(sessId) } : {}),
      ...(status ? { status: String(status) } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(limit), 200),
  });

  return res.json(
    actions.map((a) => ({
      ...a,
      params: safeJsonParse(a.params, {}),
      policyDecision: safeJsonParse(a.policyDecision, null),
    }))
  );
});

// ─── POST /actions/:id/approve ────────────────────────────────────────────────

actionsRouter.post("/:id/approve", async (req: AuthenticatedRequest, res: Response) => {
  const action = await prisma.agentAction.findFirst({
    where: {
      id: req.params.id,
      session: { userId: req.user!.userId },
      status: "PENDING_APPROVAL",
    },
    include: { session: true },
  });

  if (!action) return res.status(404).json({ error: "Action not found or not pending approval" });

  await prisma.agentAction.update({
    where: { id: req.params.id },
    data: { status: "APPROVED" },
  });

  return res.json({ success: true, actionId: action.id, status: "APPROVED" });
});

// ─── POST /actions/:id/reject ─────────────────────────────────────────────────

actionsRouter.post("/:id/reject", async (req: AuthenticatedRequest, res: Response) => {
  const action = await prisma.agentAction.findFirst({
    where: {
      id: req.params.id,
      session: { userId: req.user!.userId },
      status: { in: ["PENDING_APPROVAL", "APPROVED"] },
    },
  });

  if (!action) return res.status(404).json({ error: "Action not found" });

  await prisma.agentAction.update({
    where: { id: req.params.id },
    data: { status: "REJECTED", failureReason: "Rejected by user" },
  });

  return res.json({ success: true, actionId: action.id, status: "REJECTED" });
});

// ─── POST /actions/:id/execute ────────────────────────────────────────────────
// Execute a PENDING_APPROVAL or APPROVED action (after human sign-off)

actionsRouter.post("/:id/execute", async (req: AuthenticatedRequest, res: Response) => {
  const action = await prisma.agentAction.findFirst({
    where: {
      id: req.params.id,
      session: { userId: req.user!.userId },
      status: { in: ["PENDING_APPROVAL", "APPROVED"] },
    },
    include: { session: true },
  });

  if (!action) return res.status(404).json({ error: "Action not found or not approvable" });

  const session = action.session;
  const guardrails = safeJsonParse(session.guardrails, {});
  const params = safeJsonParse(action.params, {});

  // Re-run policy check before execution (defense in depth)
  const today = new Date().toISOString().slice(0, 10);
  const dailySpend = await prisma.dailySpend.findUnique({
    where: { sessionId_date: { sessionId: session.id, date: today } },
  });

  const policy = checkPolicy({
    session: {
      id: session.id,
      userId: session.userId,
      walletAddress: session.walletAddress,
      watchlistMints: safeJsonParse(session.watchlistMints, []),
      watchlistPrograms: safeJsonParse(session.watchlistPrograms, []),
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
    action: { actionType: action.actionType, params },
    dailySpendSolSoFar: dailySpend?.spentSol || 0,
  });

  if (!policy.approved) {
    return res.status(403).json({
      error: "Policy check failed",
      reasons: policy.reasons,
    });
  }

  // Execute
  if (action.actionType === "JUPITER_SWAP") {
    const execResult = await executeJupiterSwap({
      inputMint: params.inputMint || SOL_MINT,
      outputMint: params.outputMint,
      amountLamports: params.amountLamports,
      slippageBps: params.slippageBps || guardrails.slippageBpsMax || 300,
      userPublicKey: session.walletAddress,
    });

    if (execResult.success) {
      // Track spend
      const spentSol = params.amountLamports / 1e9;
      await prisma.dailySpend.upsert({
        where: { sessionId_date: { sessionId: session.id, date: today } },
        update: { spentSol: { increment: spentSol } },
        create: { sessionId: session.id, date: today, spentSol },
      });

      await prisma.agentAction.update({
        where: { id: action.id },
        data: {
          status: "EXECUTED",
          txSignature: execResult.txSignature,
          explorerLink: execResult.explorerLink,
          policyDecision: JSON.stringify(policy),
        },
      });

      return res.json({
        success: true,
        txSignature: execResult.txSignature,
        explorerLink: execResult.explorerLink,
      });
    } else {
      await prisma.agentAction.update({
        where: { id: action.id },
        data: {
          status: execResult.error?.includes("No route") ? "SKIPPED_NO_ROUTE" : "FAILED",
          failureReason: execResult.error,
        },
      });
      return res.status(500).json({ error: execResult.error });
    }
  } else if (action.actionType === "NOTIFY") {
    await prisma.agentAction.update({
      where: { id: action.id },
      data: { status: "EXECUTED" },
    });
    return res.json({ success: true, message: "Notification executed" });
  }

  return res.status(400).json({ error: `Execution not supported for action type: ${action.actionType}` });
});

function safeJsonParse(val: string | null | undefined, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
