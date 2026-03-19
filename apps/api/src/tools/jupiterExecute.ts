// apps/api/src/tools/jupiterExecute.ts
// Jupiter swap execution (two-phase: quote → serialize → sign → send)
// ONLY called after policy approval. Operates on devnet.

import {
  Connection,
  Keypair,
  VersionedTransaction,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import bs58 from "bs58";
import { getJupiterQuote } from "./solanaTools";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const JUPITER_BASE = process.env.JUPITER_BASE_URL || "https://quote-api.jup.ag/v6";

export interface SwapExecutionResult {
  success: boolean;
  txSignature?: string;
  explorerLink?: string;
  inAmount?: string;
  outAmount?: string;
  error?: string;
}

export async function executeJupiterSwap(params: {
  inputMint: string;
  outputMint: string;
  amountLamports: number;
  slippageBps: number;
  userPublicKey: string;
  // NOTE: In a real deployment, the private key would come from a user-controlled
  // wallet session or a secure HSM. NEVER store plaintext private keys in DB.
  // For MVP/demo: uses an env-var devnet wallet. In production: require user to sign.
  signerPrivateKeyBase58?: string;
}): Promise<SwapExecutionResult> {
  const conn = new Connection(RPC_URL, "confirmed");

  // ── Step 1: Get fresh quote ──────────────────────────────────────────────────
  const quote = await getJupiterQuote(
    params.inputMint,
    params.outputMint,
    params.amountLamports,
    params.slippageBps
  );

  if (!quote.available) {
    return {
      success: false,
      error: `No route available: ${quote.error || "unknown"}`,
    };
  }

  // ── Step 2: Build swap transaction via Jupiter ────────────────────────────────
  const swapResp = await fetch(`${JUPITER_BASE}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: params.userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!swapResp.ok) {
    const errText = await swapResp.text();
    return { success: false, error: `Jupiter swap serialization failed: ${errText}` };
  }

  const { swapTransaction } = await swapResp.json();

  // ── Step 3: Deserialize + sign ────────────────────────────────────────────────
  const txBuffer = Buffer.from(swapTransaction, "base64");
  const transaction = VersionedTransaction.deserialize(txBuffer);

  // Load signer
  // SECURITY NOTE: In production, signing should happen in the user's browser wallet
  // or via a secure server-side key management system. This demo uses an env-var key.
  const signerKey = params.signerPrivateKeyBase58 || process.env.DEMO_SIGNER_PRIVATE_KEY;
  if (!signerKey) {
    return {
      success: false,
      error:
        "No signer key available. In production, user signs via wallet. Set DEMO_SIGNER_PRIVATE_KEY for devnet demo.",
    };
  }

  let keypair: Keypair;
  try {
    keypair = Keypair.fromSecretKey(bs58.decode(signerKey));
  } catch {
    return { success: false, error: "Invalid signer key format" };
  }

  // Verify the public key matches
  if (keypair.publicKey.toBase58() !== params.userPublicKey) {
    return {
      success: false,
      error: "Signer key does not match wallet address — aborting for safety",
    };
  }

  transaction.sign([keypair]);

  // ── Step 4: Send + confirm ────────────────────────────────────────────────────
  let txSignature: string;
  try {
    txSignature = await conn.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
  } catch (err: any) {
    return { success: false, error: `Send failed: ${err.message}` };
  }

  // Wait for confirmation (with timeout)
  try {
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
    await conn.confirmTransaction(
      { signature: txSignature, blockhash, lastValidBlockHeight },
      "confirmed"
    );
  } catch (err: any) {
    // Transaction may have landed even if confirmation timed out
    console.warn("[Jupiter] Confirmation warning:", err.message);
  }

  const explorerCluster = RPC_URL.includes("devnet") ? "?cluster=devnet" : "";
  const explorerLink = `https://solscan.io/tx/${txSignature}${explorerCluster}`;

  return {
    success: true,
    txSignature,
    explorerLink,
    inAmount: quote.inAmount,
    outAmount: quote.outAmount,
  };
}
