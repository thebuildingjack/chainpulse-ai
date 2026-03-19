// packages/shared/src/types/index.ts
// Core domain types shared across apps

export type PermissionsMode = "READ_ONLY" | "EXECUTE_LIMITED";
export type RiskLevel = "low" | "medium" | "high";
export type Timeframe = "short" | "medium" | "long";
export type InsightType = "MOMENTUM" | "VOLUME_SPIKE" | "ROUTE_QUALITY" | "WHALE_ACTIVITY" | "NEW_TOKEN" | "OTHER";
export type Severity = "LOW" | "MED" | "HIGH";
export type ActionType = "JUPITER_SWAP" | "NOTIFY" | "TRANSFER";
export type ActionStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "EXECUTED"
  | "SKIPPED_NO_ROUTE"
  | "SKIPPED_POLICY"
  | "FAILED"
  | "REJECTED";

// ─── Agent Session ───────────────────────────────────────────────────────────

export interface Guardrails {
  maxSpendSolPerDay: number;
  maxSwapSolPerTx: number;
  allowedOutputMints: string[];
  slippageBpsMax: number;
  approvalThresholdSol: number;
  allowedDestinationAddresses: string[];
}

export interface AgentSession {
  id: string;
  userId: string;
  walletAddress: string;
  watchlistMints: string[];
  watchlistPrograms: string[];
  timeframe: Timeframe;
  riskLevel: RiskLevel;
  permissionsMode: PermissionsMode;
  guardrails: Guardrails;
  isActive: boolean;
  loopIntervalMinutes: number;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Insight ──────────────────────────────────────────────────────────────────

export interface Insight {
  id: string;
  sessionId: string;
  runId: string;
  title: string;
  type: InsightType;
  severity: Severity;
  confidence: number;
  summary: string;
  evidence: string[];
  recommendedNext: string;
  createdAt: string;
}

// ─── Action ───────────────────────────────────────────────────────────────────

export interface JupiterSwapParams {
  inputMint: string;
  outputMint: string;
  amountLamports: number;
  slippageBps: number;
}

export interface TransferParams {
  mint?: string; // if undefined = SOL transfer
  destinationAddress: string;
  amount: number;
}

export interface NotifyParams {
  message: string;
  severity: Severity;
}

export type ActionParams = JupiterSwapParams | TransferParams | NotifyParams;

export interface AgentAction {
  id: string;
  sessionId: string;
  runId: string;
  actionType: ActionType;
  risk: Severity;
  params: ActionParams;
  reason: string;
  status: ActionStatus;
  policyDecision?: PolicyDecision;
  txSignature?: string;
  explorerLink?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── AI Output ────────────────────────────────────────────────────────────────

export interface AIInsightOutput {
  title: string;
  type: InsightType;
  severity: Severity;
  confidence: number;
  summary: string;
  evidence: string[];
  recommendedNext: string;
}

export interface AIActionOutput {
  actionType: ActionType;
  risk: Severity;
  params: object;
  reason: string;
}

export interface AIAgentOutput {
  insights: AIInsightOutput[];
  recommendedActions: AIActionOutput[];
  nextCheckInMinutes: number;
}

// ─── Policy ───────────────────────────────────────────────────────────────────

export interface PolicyDecision {
  approved: boolean;
  reasons: string[];
  requiresHumanApproval: boolean;
  checkedAt: string;
}

// ─── Snapshot / Tools ────────────────────────────────────────────────────────

export interface TokenBalance {
  mint: string;
  symbol?: string;
  amount: number;
  decimals: number;
  uiAmount: number;
}

export interface WalletSnapshot {
  walletAddress: string;
  solBalanceLamports: number;
  tokenBalances: TokenBalance[];
  capturedAt: string;
}

export interface TransactionSummary {
  signature: string;
  blockTime?: number;
  fee: number;
  status: "confirmed" | "finalized" | "failed";
}

export interface JupiterQuoteResult {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  routeCount: number;
  slippageBps: number;
  available: boolean;
}

export interface SignalResult {
  type: InsightType;
  score: number;
  evidence: string[];
  confidence: number;
}

// ─── Agent Run ────────────────────────────────────────────────────────────────

export interface AgentRunRecord {
  id: string;
  sessionId: string;
  startedAt: string;
  completedAt?: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  snapshotData?: object;
  aiOutputRaw?: string;
  toolCallLog?: ToolCallLog[];
  errorMessage?: string;
}

export interface ToolCallLog {
  tool: string;
  params: object;
  result?: object;
  error?: string;
  calledAt: string;
}

// ─── Token Gate ───────────────────────────────────────────────────────────────

export interface TokenGateResult {
  tier: "BASE" | "PREMIUM" | "EXECUTION";
  loopIntervalMinutes: number;
  canExecute: boolean;
  deauraBalance: number;
  requiredForPremium: number;
  requiredForExecution: number;
}
