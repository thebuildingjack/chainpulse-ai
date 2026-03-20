// apps/api/src/agent/aiPipeline.ts
// AI inference pipeline with tool-calling pattern and strict JSON output.
// The model is instructed to act as the "brain" of ChainPulse AI.

import { AIAgentOutputSchema } from "@chainpulse/shared";
import type { ComputedSignals, WalletBalancesResult } from "../tools/solanaTools";

const AI_API_KEY = process.env.AI_API_KEY!;
const AI_PROVIDER = process.env.AI_PROVIDER || "anthropic";
const AI_MODEL = process.env.AI_MODEL || "claude-sonnet-4-20250514";

export interface AgentRunInput {
  walletAddress: string;
  solBalanceUi: number;
  tokenAccounts: { mint: string; symbol?: string; uiAmount: number }[];
  recentTxCount: number;
  largestTransferSol: number;
  signals: ComputedSignals["signals"];
  signalSummary: ComputedSignals["summary"];
  jupiterQuotes: {
    inputMint: string;
    outputMint: string;
    available: boolean;
    priceImpactPct: number;
  }[];
  watchlistMints: string[];
  timeframe: string;
  riskLevel: string;
  permissionsMode: string;
  guardrails: {
    maxSwapSolPerTx: number;
    slippageBpsMax: number;
    allowedOutputMints: string[];
    approvalThresholdSol: number;
  };
  previousInsightTitles?: string[];
}

export interface AIRunResult {
  output: import("@chainpulse/shared").AIAgentOutput;
  rawResponse: string;
  promptTokens?: number;
  modelUsed: string;
}

// ─── Build system prompt ──────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are ChainPulse AI — an autonomous Solana on-chain opportunity detection agent.
  Your role is to analyze on-chain data snapshots, identify profit/opportunity signals, and recommend SAFE, BOUNDED actions.

  STRICT RULES:
  1. You MUST output ONLY valid JSON matching the exact schema below. No preamble, no explanation, no markdown.
  2. Confidence scores must be 0.0-1.0 (be honest — devnet data is limited, cap at 0.7 unless strong evidence).
  3. Actions must respect the provided guardrails. Never recommend actions that violate limits.
  4. For READ_ONLY mode: only recommend NOTIFY actions.
  5. For EXECUTE_LIMITED mode: you may recommend JUPITER_SWAP only if a route exists and amount <= maxSwapSolPerTx.
  6. Be concise in summaries (max 2 sentences). Evidence must be specific facts from the data.
  7. nextCheckInMinutes should be 3-15 based on signal urgency.

  OUTPUT SCHEMA (strict):
  {
    "insights": [
      {
        "title": string,
        "type": "MOMENTUM" | "VOLUME_SPIKE" | "ROUTE_QUALITY" | "WHALE_ACTIVITY" | "NEW_TOKEN" | "OTHER",
        "severity": "LOW" | "MED" | "HIGH",
        "confidence": number,
        "summary": string,
        "evidence": string[],
        "recommendedNext": string
      }
    ],
    "recommendedActions": [
      {
        "actionType": "JUPITER_SWAP" | "NOTIFY" | "TRANSFER",
        "risk": "LOW" | "MED" | "HIGH",
        "params": object,
        "reason": string
      }
    ],
    "nextCheckInMinutes": number
  }

  CRITICAL: Output ONLY the raw JSON object. No markdown. No code fences. No explanation. No text before or after. Start your response with { and end with }. Nothing else.`;
}

// ─── Build user prompt ────────────────────────────────────────────────────────

function buildUserPrompt(input: AgentRunInput): string {
  const signalDescriptions = input.signals.map((s) =>
    `- ${s.type}: score=${s.score.toFixed(2)}, confidence=${s.confidence.toFixed(2)}\n  Evidence: ${s.evidence.slice(0, 2).join(" | ")}`
  ).join("\n");

  const quoteDescriptions = input.jupiterQuotes.map((q) =>
    `- ${q.inputMint.slice(0, 12)}→${q.outputMint.slice(0, 12)}: available=${q.available}, priceImpact=${q.priceImpactPct.toFixed(3)}%`
  ).join("\n");

  const tokenList = input.tokenAccounts.map((t) =>
    `${t.symbol || t.mint.slice(0, 12)}: ${t.uiAmount}`
  ).join(", ");

  const prevInsights = input.previousInsightTitles?.slice(0, 3).join(" | ") || "none";

  return `## On-Chain Snapshot
Wallet: ${input.walletAddress}
SOL Balance: ${input.solBalanceUi.toFixed(4)} SOL
Token Holdings: ${tokenList || "none"}
Recent Tx Count: ${input.recentTxCount}
Largest Transfer: ${input.largestTransferSol.toFixed(4)} SOL

## Computed Signals
${signalDescriptions || "No significant signals detected."}

## Signal Summary
- SOL Balance Change: ${input.signalSummary.solBalanceChangePct.toFixed(2)}%
- Tx Count: ${input.signalSummary.txCountLast10}
- Whale Detected: ${input.signalSummary.whaleDetected}
- Routes Available: ${input.signalSummary.routesAvailable}
- New Mints Seen: ${input.signalSummary.newMintsDetected.slice(0, 3).join(", ") || "none"}

## Jupiter Route Quotes
${quoteDescriptions || "No quotes fetched."}

## Session Preferences
- Timeframe: ${input.timeframe}
- Risk Level: ${input.riskLevel}
- Permissions Mode: ${input.permissionsMode}
- Max Swap Per Tx: ${input.guardrails.maxSwapSolPerTx} SOL
- Max Slippage: ${input.guardrails.slippageBpsMax} bps
- Allowed Output Mints: ${input.guardrails.allowedOutputMints.join(", ") || "any"}
- Approval Threshold: ${input.guardrails.approvalThresholdSol} SOL

## Watchlist
${input.watchlistMints.join(", ") || "none"}

## Previous Insights (avoid repeating)
${prevInsights}

---
Analyze the above data, identify the top 1-3 opportunity insights, and recommend at most 2 safe actions within the guardrails.
Respond ONLY with the JSON object. No other text.`;
}

// ─── Call AI model ────────────────────────────────────────────────────────────

export async function runAgentInference(input: AgentRunInput): Promise<AIRunResult> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(input);

  let rawResponse = "";
  let modelUsed = AI_MODEL;

  if (AI_PROVIDER === "anthropic") {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": AI_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`AI API error ${resp.status}: ${err}`);
    }

    const data = await resp.json() as { content?: Array<{ text: string }>; model?: string };
    rawResponse = data.content?.[0]?.text || "";
    modelUsed = data.model || AI_MODEL;
  } else if (AI_PROVIDER === "openai") {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2048,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`OpenAI API error ${resp.status}: ${err}`);
    }

    const data = await resp.json() as { choices?: Array<{ message?: { content: string } }>; model?: string };
    rawResponse = data.choices?.[0]?.message?.content || "";
    modelUsed = data.model || AI_MODEL;
  } else {
    throw new Error(`Unsupported AI_PROVIDER: ${AI_PROVIDER}`);
  }

  // ── Parse + validate output ─────────────────────────────────────────────────
  let parsed: unknown;
  try {
    // Strip markdown fences, leading text, anything before first {
    let clean = rawResponse
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    // Find the first { and last } to extract pure JSON
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      clean = clean.slice(firstBrace, lastBrace + 1);
    }
    parsed = JSON.parse(clean);
  } catch (err) {
    throw new Error(`AI output is not valid JSON: ${rawResponse.slice(0, 200)}`);
  }

  const validated = AIAgentOutputSchema.safeParse(parsed);
  if (!validated.success) {
    console.warn("[AI] Schema validation failed, using best-effort fallback");
    // Return a minimal valid output rather than crashing the loop
    const fallback = {
      insights: [
        {
          title: "AI output validation failed — manual review recommended",
          type: "OTHER" as const,
          severity: "LOW" as const,
          confidence: 0.1,
          summary: "The AI model returned output that did not match the expected schema.",
          evidence: [`Raw response (truncated): ${rawResponse.slice(0, 100)}`],
          recommendedNext: "Check AI model configuration and try again.",
        },
      ],
      recommendedActions: [],
      nextCheckInMinutes: 15,
    };
    return { output: fallback, rawResponse, modelUsed };
  }

  return { output: validated.data, rawResponse, modelUsed };
}
