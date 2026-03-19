// apps/api/src/tools/solanaTools.ts
// All on-chain data fetching tools.
// These are called by the agent loop and logged in the audit trail.

import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  ParsedTransactionWithMeta,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

function getConnection() {
  return new Connection(RPC_URL, "confirmed");
}

// ─── Tool: getWalletBalances ──────────────────────────────────────────────────

export interface WalletBalancesResult {
  walletAddress: string;
  solBalanceLamports: number;
  solBalanceUi: number;
  tokenAccounts: {
    mint: string;
    amount: string;
    decimals: number;
    uiAmount: number;
  }[];
  capturedAt: string;
}

export async function getWalletBalances(pubkey: string): Promise<WalletBalancesResult> {
  const conn = getConnection();
  const pk = new PublicKey(pubkey);

  const solBalance = await conn.getBalance(pk);

  const tokenAccountsResp = await conn.getParsedTokenAccountsByOwner(pk, {
    programId: TOKEN_PROGRAM_ID,
  });

  const tokenAccounts = tokenAccountsResp.value.map((ta) => {
    const info = ta.account.data.parsed.info;
    return {
      mint: info.mint as string,
      amount: info.tokenAmount.amount as string,
      decimals: info.tokenAmount.decimals as number,
      uiAmount: (info.tokenAmount.uiAmount as number) || 0,
    };
  });

  return {
    walletAddress: pubkey,
    solBalanceLamports: solBalance,
    solBalanceUi: solBalance / LAMPORTS_PER_SOL,
    tokenAccounts,
    capturedAt: new Date().toISOString(),
  };
}

// ─── Tool: getRecentTransactions ─────────────────────────────────────────────

export interface RecentTransactionsResult {
  walletAddress: string;
  transactions: {
    signature: string;
    blockTime?: number;
    fee: number;
    status: string;
    involvedMints: string[];
    transferAmountSol?: number;
  }[];
  totalFetched: number;
}

export async function getRecentTransactions(
  pubkey: string,
  limit: number = 20
): Promise<RecentTransactionsResult> {
  const conn = getConnection();
  const pk = new PublicKey(pubkey);

  const sigs = await conn.getSignaturesForAddress(pk, { limit });
  const results = [];

  for (const sigInfo of sigs.slice(0, Math.min(limit, 10))) {
    // Limit RPC calls for rate limit safety
    try {
      const tx = await conn.getParsedTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      });

      const involvedMints = extractMintsFromTx(tx);
      const transferAmountSol = extractSolTransfer(tx, pubkey);

      results.push({
        signature: sigInfo.signature,
        blockTime: sigInfo.blockTime || undefined,
        fee: tx?.meta?.fee || 0,
        status: sigInfo.err ? "failed" : "confirmed",
        involvedMints,
        transferAmountSol,
      });
    } catch {
      results.push({
        signature: sigInfo.signature,
        blockTime: sigInfo.blockTime || undefined,
        fee: 0,
        status: "unknown",
        involvedMints: [],
      });
    }
  }

  return { walletAddress: pubkey, transactions: results, totalFetched: sigs.length };
}

// ─── Tool: getTokenAccounts ───────────────────────────────────────────────────

export async function getTokenAccounts(pubkey: string) {
  const conn = getConnection();
  const pk = new PublicKey(pubkey);

  const tokenAccountsResp = await conn.getParsedTokenAccountsByOwner(pk, {
    programId: TOKEN_PROGRAM_ID,
  });

  return tokenAccountsResp.value.map((ta) => {
    const info = ta.account.data.parsed.info;
    return {
      address: ta.pubkey.toBase58(),
      mint: info.mint as string,
      owner: info.owner as string,
      amount: info.tokenAmount.amount as string,
      decimals: info.tokenAmount.decimals as number,
      uiAmount: (info.tokenAmount.uiAmount as number) || 0,
      isNative: info.isNative as boolean,
    };
  });
}

// ─── Tool: getJupiterQuote ────────────────────────────────────────────────────

export interface JupiterQuoteResult {
  available: boolean;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  routeCount: number;
  slippageBps: number;
  marketInfos?: { label: string; notEnoughLiquidity: boolean }[];
  error?: string;
}

export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps: number = 300
): Promise<JupiterQuoteResult> {
  const JUPITER_BASE = process.env.JUPITER_BASE_URL || "https://quote-api.jup.ag/v6";

  try {
    const url = new URL(`${JUPITER_BASE}/quote`);
    url.searchParams.set("inputMint", inputMint);
    url.searchParams.set("outputMint", outputMint);
    url.searchParams.set("amount", amountLamports.toString());
    url.searchParams.set("slippageBps", slippageBps.toString());

    const resp = await fetch(url.toString(), {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      return {
        available: false,
        inputMint,
        outputMint,
        inAmount: amountLamports.toString(),
        outAmount: "0",
        priceImpactPct: 0,
        routeCount: 0,
        slippageBps,
        error: `Jupiter API error: ${resp.status}`,
      };
    }

    const data = await resp.json();
    return {
      available: true,
      inputMint,
      outputMint,
      inAmount: data.inAmount || amountLamports.toString(),
      outAmount: data.outAmount || "0",
      priceImpactPct: parseFloat(data.priceImpactPct || "0"),
      routeCount: data.routePlan?.length || 0,
      slippageBps,
      marketInfos: data.routePlan?.map((r: any) => ({
        label: r.swapInfo?.label || "unknown",
        notEnoughLiquidity: r.swapInfo?.notEnoughLiquidity || false,
      })),
    };
  } catch (err: any) {
    return {
      available: false,
      inputMint,
      outputMint,
      inAmount: amountLamports.toString(),
      outAmount: "0",
      priceImpactPct: 0,
      routeCount: 0,
      slippageBps,
      error: err.message || "Failed to fetch Jupiter quote",
    };
  }
}

// ─── Tool: getTokenMetadata ───────────────────────────────────────────────────

export async function getTokenMetadata(mint: string) {
  try {
    // Use Jupiter token list for metadata (public, no auth required)
    const resp = await fetch(
      `https://token.jup.ag/strict`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!resp.ok) throw new Error("Token list fetch failed");
    const tokens = await resp.json();
    const token = tokens.find((t: any) => t.address === mint);
    if (token) {
      return {
        mint,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.logoURI,
        source: "jupiter_strict",
      };
    }
    return { mint, symbol: "UNKNOWN", name: "Unknown Token", decimals: 6, source: "not_found" };
  } catch {
    return { mint, symbol: "UNKNOWN", name: "Unknown Token", decimals: 6, source: "error" };
  }
}

// ─── Tool: computeSignals ─────────────────────────────────────────────────────

export interface SignalComputeInput {
  current: WalletBalancesResult;
  previous?: WalletBalancesResult | null;
  recentTxs: RecentTransactionsResult;
  jupiterQuotes: JupiterQuoteResult[];
  watchlistMints: string[];
  timeframe: string;
  riskLevel: string;
}

export interface ComputedSignals {
  signals: {
    type: string;
    score: number;       // 0-1
    confidence: number;  // 0-1
    evidence: string[];
  }[];
  summary: {
    solBalanceChangePct: number;
    txCountLast10: number;
    largestTransferSol: number;
    routesAvailable: number;
    whaleDetected: boolean;
    newMintsDetected: string[];
  };
}

export function computeSignals(input: SignalComputeInput): ComputedSignals {
  const signals = [];
  const { current, previous, recentTxs, jupiterQuotes, watchlistMints } = input;

  // ── Signal 1: SOL balance momentum ──────────────────────────────────────────
  let solChangePct = 0;
  if (previous) {
    const prev = previous.solBalanceLamports;
    const curr = current.solBalanceLamports;
    solChangePct = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
  }
  const momentumScore = Math.min(Math.abs(solChangePct) / 20, 1);
  if (Math.abs(solChangePct) > 1) {
    signals.push({
      type: "MOMENTUM",
      score: momentumScore,
      confidence: previous ? 0.75 : 0.3,
      evidence: [
        `SOL balance changed by ${solChangePct.toFixed(2)}%`,
        `Current: ${(current.solBalanceLamports / 1e9).toFixed(4)} SOL`,
        previous
          ? `Previous: ${(previous.solBalanceLamports / 1e9).toFixed(4)} SOL`
          : "No previous snapshot for comparison",
      ],
    });
  }

  // ── Signal 2: Volume/tx spike ────────────────────────────────────────────────
  const txCount = recentTxs.transactions.length;
  const failedTxs = recentTxs.transactions.filter((t) => t.status === "failed").length;
  const txScore = Math.min(txCount / 20, 1);
  if (txCount > 3) {
    signals.push({
      type: "VOLUME_SPIKE",
      score: txScore,
      confidence: 0.65,
      evidence: [
        `${txCount} recent transactions detected`,
        `${failedTxs} failed transactions`,
        `Total fees: ${recentTxs.transactions.reduce((s, t) => s + t.fee, 0) / 1e9} SOL`,
      ],
    });
  }

  // ── Signal 3: Route quality (Jupiter) ───────────────────────────────────────
  const availableRoutes = jupiterQuotes.filter((q) => q.available);
  const avgPriceImpact =
    availableRoutes.length > 0
      ? availableRoutes.reduce((s, q) => s + q.priceImpactPct, 0) / availableRoutes.length
      : 0;
  const routeScore = availableRoutes.length / Math.max(jupiterQuotes.length, 1);
  signals.push({
    type: "ROUTE_QUALITY",
    score: routeScore,
    confidence: jupiterQuotes.length > 0 ? 0.85 : 0.2,
    evidence: [
      `${availableRoutes.length}/${jupiterQuotes.length} swap routes available`,
      `Average price impact: ${avgPriceImpact.toFixed(3)}%`,
      ...availableRoutes.map(
        (q) => `${q.inputMint.slice(0, 8)}→${q.outputMint.slice(0, 8)}: ${q.routeCount} route(s)`
      ),
    ],
  });

  // ── Signal 4: Whale activity ─────────────────────────────────────────────────
  const WHALE_THRESHOLD_SOL = 10;
  const largeTxs = recentTxs.transactions.filter(
    (t) => (t.transferAmountSol || 0) > WHALE_THRESHOLD_SOL
  );
  const whaleDetected = largeTxs.length > 0;
  if (whaleDetected) {
    signals.push({
      type: "WHALE_ACTIVITY",
      score: Math.min(largeTxs.length / 3, 1),
      confidence: 0.7,
      evidence: [
        `${largeTxs.length} large transfer(s) > ${WHALE_THRESHOLD_SOL} SOL detected`,
        ...largeTxs.map(
          (t) => `Tx ${t.signature.slice(0, 16)}... moved ~${t.transferAmountSol?.toFixed(2)} SOL`
        ),
      ],
    });
  }

  // ── Signal 5: New token discovery ────────────────────────────────────────────
  const allMintsInTxs = new Set(recentTxs.transactions.flatMap((t) => t.involvedMints));
  const knownMints = new Set(current.tokenAccounts.map((ta) => ta.mint));
  const newMints = [...allMintsInTxs].filter((m) => !knownMints.has(m) && !watchlistMints.includes(m));

  if (newMints.length > 0) {
    signals.push({
      type: "NEW_TOKEN",
      score: Math.min(newMints.length / 5, 1),
      confidence: 0.55,
      evidence: [
        `${newMints.length} new mint(s) seen in recent transactions`,
        ...newMints.slice(0, 3).map((m) => `Mint: ${m}`),
      ],
    });
  }

  return {
    signals,
    summary: {
      solBalanceChangePct: solChangePct,
      txCountLast10: txCount,
      largestTransferSol: Math.max(
        0,
        ...recentTxs.transactions.map((t) => t.transferAmountSol || 0)
      ),
      routesAvailable: availableRoutes.length,
      whaleDetected,
      newMintsDetected: newMints,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractMintsFromTx(tx: ParsedTransactionWithMeta | null): string[] {
  if (!tx?.meta?.postTokenBalances) return [];
  return [
    ...new Set(tx.meta.postTokenBalances.map((b) => b.mint).filter(Boolean)),
  ];
}

function extractSolTransfer(
  tx: ParsedTransactionWithMeta | null,
  pubkey: string
): number | undefined {
  if (!tx?.meta?.preBalances || !tx.meta.postBalances) return undefined;
  const accountKeys = tx.transaction.message.accountKeys;
  const idx = accountKeys.findIndex((k: any) => k.pubkey?.toBase58?.() === pubkey || k === pubkey);
  if (idx < 0) return undefined;
  const diff = Math.abs(tx.meta.postBalances[idx] - tx.meta.preBalances[idx]);
  return diff / LAMPORTS_PER_SOL;
}
