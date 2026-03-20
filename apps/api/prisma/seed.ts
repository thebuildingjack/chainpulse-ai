// apps/api/prisma/seed.ts
// Seeds a demo session with a public devnet wallet for hackathon demo

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_WALLET = process.env.DEMO_WALLET_ADDRESS || "11111111111111111111111111111111";
const USDC_DEVNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL_MINT = "So11111111111111111111111111111111111111112";

async function main() {
  console.log("🌱 Seeding ChainPulse AI demo data...");

  // Create demo user
  const user = await prisma.user.upsert({
    where: { walletAddress: DEMO_WALLET },
    update: {},
    create: { walletAddress: DEMO_WALLET },
  });

  // Create demo agent session
  const session = await prisma.agentSession.upsert({
    where: { id: "demo-session-001" },
    update: {},
    create: {
      id: "demo-session-001",
      userId: user.id,
      walletAddress: DEMO_WALLET,
      watchlistMints: JSON.stringify([USDC_DEVNET]),
      watchlistPrograms: JSON.stringify([]),
      timeframe: "medium",
      riskLevel: "low",
      permissionsMode: "READ_ONLY",
      guardrails: JSON.stringify({
        maxSpendSolPerDay: 0.5,
        maxSwapSolPerTx: 0.05,
        allowedOutputMints: [USDC_DEVNET],
        slippageBpsMax: 300,
        approvalThresholdSol: 0.1,
        allowedDestinationAddresses: [],
      }),
      isActive: true,
      loopIntervalMinutes: 15,
    },
  });

  // Create demo run
  const run = await prisma.agentRun.create({
    data: {
      sessionId: session.id,
      status: "COMPLETED",
      completedAt: new Date(),
      snapshotData: JSON.stringify({ walletAddress: DEMO_WALLET, solBalanceLamports: 2_000_000_000 }),
      aiOutputRaw: '{"insights":[],"recommendedActions":[],"nextCheckInMinutes":15}',
      toolCallLog: JSON.stringify([
        {
          tool: "getWalletBalances",
          params: { pubkey: DEMO_WALLET },
          result: { solBalanceUi: 2.0 },
          calledAt: new Date().toISOString(),
        },
      ]),
    },
  });

  // Seed demo insights
  const demoInsights = [
    {
      title: "SOL Balance Momentum Detected",
      type: "MOMENTUM",
      severity: "MED",
      confidence: 0.72,
      summary: "Wallet balance increased 12.5% in the last monitoring window, suggesting active inflow.",
      evidence: JSON.stringify([
        "SOL balance changed by +12.50%",
        "Current: 2.0000 SOL",
        "Previous: 1.7778 SOL",
      ]),
      recommendedNext: "Monitor for continued momentum; consider watching USDC route quality.",
    },
    {
      title: "USDC Route Available with Low Impact",
      type: "ROUTE_QUALITY",
      severity: "LOW",
      confidence: 0.85,
      summary: "Jupiter swap route for SOL→USDC is available with minimal price impact, indicating healthy liquidity.",
      evidence: JSON.stringify([
        "1/1 swap routes available",
        "Average price impact: 0.012%",
        "Route: Orca via CLMM pool",
      ]),
      recommendedNext: "Route conditions are favorable for a small swap if needed.",
    },
    {
      title: "Transaction Volume Spike",
      type: "VOLUME_SPIKE",
      severity: "HIGH",
      confidence: 0.65,
      summary: "Detected 15 transactions in the recent window — 3x above baseline — suggesting increased activity.",
      evidence: JSON.stringify([
        "15 recent transactions detected",
        "2 failed transactions",
        "Total fees: 0.000315 SOL",
      ]),
      recommendedNext: "Review transaction history for unusual counterparties.",
    },
  ];

  for (const insight of demoInsights) {
    await prisma.insight.create({
      data: { sessionId: session.id, runId: run.id, ...insight },
    });
  }

  // Seed demo actions
  await prisma.agentAction.create({
    data: {
      sessionId: session.id,
      runId: run.id,
      actionType: "NOTIFY",
      risk: "LOW",
      params: JSON.stringify({
        message: "SOL balance momentum detected — +12.5% change. Monitor route quality.",
        severity: "MED",
      }),
      reason: "Notify user of significant balance change for awareness",
      status: "EXECUTED",
      policyDecision: JSON.stringify({
        approved: true,
        requiresHumanApproval: false,
        reasons: ["All guardrails passed"],
        checkedAt: new Date().toISOString(),
      }),
    },
  });

  await prisma.agentAction.create({
    data: {
      sessionId: session.id,
      runId: run.id,
      actionType: "JUPITER_SWAP",
      risk: "LOW",
      params: JSON.stringify({
        inputMint: SOL_MINT,
        outputMint: USDC_DEVNET,
        amountLamports: 50_000_000, // 0.05 SOL
        slippageBps: 300,
      }),
      reason: "Favorable SOL→USDC route with <0.02% price impact; diversify small amount",
      status: "PENDING_APPROVAL",
      policyDecision: JSON.stringify({
        approved: true,
        requiresHumanApproval: true,
        reasons: ["Amount 0.05 SOL is near approval threshold — routing to human approval"],
        checkedAt: new Date().toISOString(),
      }),
    },
  });

  console.log("✅ Seed complete!");
  console.log(`   Demo session: ${session.id}`);
  console.log(`   Demo wallet: ${DEMO_WALLET}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
