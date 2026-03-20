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

function buildSystemPrompt(input: AgentRunInput): string {
  const signals = input.signals.slice(0, 3).map(s =>
    `${s.type}: score=${s.score.toFixed(2)}, conf=${s.confidence.toFixed(2)}`
  ).join("\n");

  const quotes = input.jupiterQuotes.slice(0, 2).map(q =>
    `${q.outputMint.slice(0, 8)}: available=${q.available}, impact=${q.priceImpactPct.toFixed(3)}%`
  ).join("\n");

  return `Wallet: ${input.walletAddress}
  SOL: ${input.solBalanceUi.toFixed(4)}
  Txs: ${input.recentTxCount}
  Mode: ${input.permissionsMode}
  Risk: ${input.riskLevel}
  MaxSwap: ${input.guardrails.maxSwapSolPerTx} SOL

  Signals:
  ${signals || "none"}

  Routes:
  ${quotes || "none"}

  Whale: ${input.signalSummary.whaleDetected}
  NewMints: ${input.signalSummary.newMintsDetected.slice(0,2).join(", ") || "none"}

  Output JSON only. 1-3 insights, max 1 action.`;
}

// ─── Build user prompt ────────────────────────────────────────────────────────

function buildUserPrompt(input: AgentRunInput): string {
  const topSignals = input.signals
    .slice(0, 2)
    .map(s => `${s.type}(score=${s.score.toFixed(2)},conf=${s.confidence.toFixed(2)})`)
    .join(", ");

  const topRoute = input.jupiterQuotes.find(q => q.available);

  return `Wallet: ${input.walletAddress.slice(0, 16)}
  SOL: ${input.solBalanceUi.toFixed(3)}
  TxCount: ${input.recentTxCount}
  Mode: ${input.permissionsMode}
  Risk: ${input.riskLevel}
  MaxSwap: ${input.guardrails.maxSwapSolPerTx}SOL
  Signals: ${topSignals || "none"}
  RouteAvail: ${topRoute ? `yes(impact=${topRoute.priceImpactPct.toFixed(3)}%)` : "no"}
  Whale: ${input.signalSummary.whaleDetected}
  SOLChange: ${input.signalSummary.solBalanceChangePct.toFixed(1)}%

  Respond with JSON only. 1-2 insights max. No markdown.`;
}

// ─── Call AI model ────────────────────────────────────────────────────────────

export async function runAgentInference(input: AgentRunInput): Promise<AIRunResult> {
  const systemPrompt = buildSystemPrompt(input);
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
        max_tokens: 512,  // ← add this line
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
