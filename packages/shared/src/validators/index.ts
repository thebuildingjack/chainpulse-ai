// packages/shared/src/validators/index.ts
import { z } from "zod";

// ─── Guardrails ───────────────────────────────────────────────────────────────

export const GuardrailsSchema = z.object({
  maxSpendSolPerDay: z.number().min(0).max(100).default(1.0),
  maxSwapSolPerTx: z.number().min(0).max(10).default(0.1),
  allowedOutputMints: z.array(z.string()).default([]),
  slippageBpsMax: z.number().min(0).max(5000).default(300),
  approvalThresholdSol: z.number().min(0).default(0.5),
  allowedDestinationAddresses: z.array(z.string()).default([]),
});

// ─── Session ──────────────────────────────────────────────────────────────────

export const CreateSessionSchema = z.object({
  watchlistMints: z.array(z.string()).min(0).max(20).default([]),
  watchlistPrograms: z.array(z.string()).max(10).default([]),
  timeframe: z.enum(["short", "medium", "long"]).default("medium"),
  riskLevel: z.enum(["low", "medium", "high"]).default("medium"),
  permissionsMode: z.enum(["READ_ONLY", "EXECUTE_LIMITED"]).default("READ_ONLY"),
  guardrails: GuardrailsSchema.default({}),
});

export const UpdateSessionSchema = CreateSessionSchema.partial();

export const UpdateGuardrailsSchema = GuardrailsSchema.partial();

// ─── AI Output (strict) ───────────────────────────────────────────────────────

export const AIInsightSchema = z.object({
  title: z.string().max(120),
  type: z.enum(["MOMENTUM", "VOLUME_SPIKE", "ROUTE_QUALITY", "WHALE_ACTIVITY", "NEW_TOKEN", "OTHER"]),
  severity: z.enum(["LOW", "MED", "HIGH"]),
  confidence: z.number().min(0).max(1),
  summary: z.string().max(500),
  evidence: z.array(z.string()).max(10),
  recommendedNext: z.string().max(300),
});

export const JupiterSwapParamsSchema = z.object({
  inputMint: z.string(),
  outputMint: z.string(),
  amountLamports: z.number().int().positive(),
  slippageBps: z.number().int().min(0).max(5000),
});

export const TransferParamsSchema = z.object({
  mint: z.string().optional(),
  destinationAddress: z.string(),
  amount: z.number().positive(),
});

export const NotifyParamsSchema = z.object({
  message: z.string().max(500),
  severity: z.enum(["LOW", "MED", "HIGH"]),
});

export const AIActionSchema = z.object({
  actionType: z.enum(["JUPITER_SWAP", "NOTIFY", "TRANSFER"]),
  risk: z.enum(["LOW", "MED", "HIGH"]),
  params: z.union([JupiterSwapParamsSchema, TransferParamsSchema, NotifyParamsSchema]),
  reason: z.string().max(400),
});

export const AIAgentOutputSchema = z.object({
  insights: z.array(AIInsightSchema).max(10),
  recommendedActions: z.array(AIActionSchema).max(5),
  nextCheckInMinutes: z.number().int().min(1).max(60),
});

// ─── Auth ────────────────────────────────────────────────────────────────────

export const NonceRequestSchema = z.object({
  walletAddress: z.string().min(32).max(44),
});

export const VerifySignatureSchema = z.object({
  walletAddress: z.string().min(32).max(44),
  signature: z.string(),
  nonce: z.string(),
});

// ─── Tool call inputs ────────────────────────────────────────────────────────

export const GetWalletBalancesSchema = z.object({
  pubkey: z.string().min(32).max(44),
});

export const GetRecentTransactionsSchema = z.object({
  pubkey: z.string().min(32).max(44),
  limit: z.number().int().min(1).max(50).default(20),
});

export const GetJupiterQuoteSchema = z.object({
  inputMint: z.string(),
  outputMint: z.string(),
  amountLamports: z.number().int().positive(),
  slippageBps: z.number().int().min(0).max(5000).default(300),
});

export const GetTokenMetadataSchema = z.object({
  mint: z.string(),
});

export const ApproveActionSchema = z.object({
  actionId: z.string(),
});

// ─── Type exports (inferred) ──────────────────────────────────────────────────

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;
export type GuardrailsInput = z.infer<typeof GuardrailsSchema>;
export type AIAgentOutput = z.infer<typeof AIAgentOutputSchema>;
export type AIInsightOutput = z.infer<typeof AIInsightSchema>;
export type AIActionOutput = z.infer<typeof AIActionSchema>;
export type JupiterSwapParams = z.infer<typeof JupiterSwapParamsSchema>;
export type TransferParams = z.infer<typeof TransferParamsSchema>;
export type NotifyParams = z.infer<typeof NotifyParamsSchema>;
