// apps/api/src/agent/aiPipeline.ts
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

// ─── System prompt — instructions only, no data ───────────────────────────────

function buildSystemPrompt(): string {
  return `You are a Solana on-chain analysis AI. Analyze wallet data and return ONLY a JSON object.

REQUIRED OUTPUT FORMAT - return exactly this structure:
{
  "insights": [
    {
      "title": "short descriptive title",
      "type": "MOMENTUM",
      "severity": "LOW",
      "confidence": 0.6,
      "summary": "one sentence summary",
      "evidence": ["fact 1", "fact 2"],
      "recommendedNext": "what to do next"
    }
  ],
  "recommendedActions": [],
  "nextCheckInMinutes": 15
}

Rules:
- type must be one of: MOMENTUM, VOLUME_SPIKE, ROUTE_QUALITY, WHALE_ACTIVITY, NEW_TOKEN, OTHER
- severity must be one of: LOW, MED, HIGH
- confidence must be 0.0 to 1.0
- Return 1-2 insights max
- Return ONLY the JSON. No explanation. No markdown. Start with {`;
}

// ─── User prompt — data only, very short ─────────────────────────────────────

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
Signals: ${topSignals || "none"}
Route: ${topRoute ? `yes(impact=${topRoute.priceImpactPct.toFixed(3)}%)` : "no routes available"}
Whale: ${input.signalSummary.whaleDetected}
SOLChange: ${input.signalSummary.solBalanceChangePct.toFixed(1)}%`;
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
        max_tokens: 512,
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
        max_tokens: 512,
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

  // ── Parse + validate output ───────────────────────────────────────────────
  let parsed: unknown;
  try {
    let clean = rawResponse
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
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
    console.warn("[AI] Schema validation failed:", validated.error.flatten());
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