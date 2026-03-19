// apps/api/src/agent/tokenGate.ts
// DeAura token gating — mock mode for MVP, plug in real on-chain check post-launch.
//
// Tiers:
//   BASE      (0 DeAura)    → READ_ONLY, every 15 min
//   PREMIUM   (≥100 DeAura) → READ_ONLY + advanced signals, every 3 min
//   EXECUTION (≥500 DeAura) → EXECUTE_LIMITED + all features, every 3 min
//
// DeAura token link: [DEAURA_TOKEN_LINK] — replace with real mint address post-launch

import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const DEAURA_MINT = process.env.DEAURA_MINT_ADDRESS || "PLACEHOLDER_DEAURA_MINT";
const PREMIUM_THRESHOLD = Number(process.env.DEAURA_PREMIUM_THRESHOLD || 100);
const EXECUTION_THRESHOLD = Number(process.env.DEAURA_EXECUTION_THRESHOLD || 500);
const MOCK_MODE = process.env.TOKEN_GATE_MOCK === "true" || DEAURA_MINT === "PLACEHOLDER_DEAURA_MINT";

export interface TokenGateResult {
  tier: "BASE" | "PREMIUM" | "EXECUTION";
  loopIntervalMinutes: number;
  canExecute: boolean;
  deauraBalance: number;
  requiredForPremium: number;
  requiredForExecution: number;
  deauraLink: string;
  mockMode: boolean;
}

export async function getTokenGate(walletAddress: string): Promise<TokenGateResult> {
  const deauraLink = process.env.DEAURA_TOKEN_LINK || "[DEAURA_TOKEN_LINK]";

  let deauraBalance = 0;

  if (!MOCK_MODE) {
    try {
      const conn = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com");
      const pk = new PublicKey(walletAddress);
      const tokenAccounts = await conn.getParsedTokenAccountsByOwner(pk, {
        programId: TOKEN_PROGRAM_ID,
      });
      const deauraAccount = tokenAccounts.value.find(
        (ta) => ta.account.data.parsed.info.mint === DEAURA_MINT
      );
      if (deauraAccount) {
        deauraBalance = deauraAccount.account.data.parsed.info.tokenAmount.uiAmount || 0;
      }
    } catch (err) {
      console.warn("[TokenGate] Failed to fetch DeAura balance:", (err as Error).message);
      // Fail open to BASE tier rather than crashing
    }
  } else {
    // Mock: demo wallets get PREMIUM, others get BASE
    // In production, remove this block
    deauraBalance = 0; // All users get BASE in mock mode by default
  }

  let tier: "BASE" | "PREMIUM" | "EXECUTION" = "BASE";
  if (deauraBalance >= EXECUTION_THRESHOLD) {
    tier = "EXECUTION";
  } else if (deauraBalance >= PREMIUM_THRESHOLD) {
    tier = "PREMIUM";
  }

  return {
    tier,
    loopIntervalMinutes: tier === "BASE" ? 15 : 3,
    canExecute: tier === "EXECUTION",
    deauraBalance,
    requiredForPremium: PREMIUM_THRESHOLD,
    requiredForExecution: EXECUTION_THRESHOLD,
    deauraLink,
    mockMode: MOCK_MODE,
  };
}
