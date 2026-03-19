// packages/shared/src/policy/engine.ts
// ─── Policy Engine ────────────────────────────────────────────────────────────
// Every action MUST pass through here before execution.
// This is the single source of truth for all guardrails.

import { z } from "zod";
import type {
  AgentSession,
  AgentAction,
  PolicyDecision,
  JupiterSwapParams,
  TransferParams,
  NotifyParams,
} from "../types";
import { JupiterSwapParamsSchema, TransferParamsSchema, NotifyParamsSchema } from "../validators";

export interface PolicyContext {
  session: AgentSession;
  action: {
    actionType: string;
    params: unknown;
    risk?: string;
  };
  dailySpendSolSoFar: number; // caller must provide current day's spend
}

export interface PolicyResult {
  approved: boolean;
  requiresHumanApproval: boolean;
  reasons: string[];
  checkedAt: string;
}

// ─── Main policy check function ───────────────────────────────────────────────

export function checkPolicy(ctx: PolicyContext): PolicyResult {
  const reasons: string[] = [];
  let approved = true;
  let requiresHumanApproval = false;
  const { session, action, dailySpendSolSoFar } = ctx;

  // 1. READ_ONLY mode: never execute anything except NOTIFY
  if (session.permissionsMode === "READ_ONLY" && action.actionType !== "NOTIFY") {
    reasons.push("Session is READ_ONLY — only NOTIFY actions are permitted");
    approved = false;
  }

  // 2. Validate action type is known
  const knownTypes = ["JUPITER_SWAP", "NOTIFY", "TRANSFER"];
  if (!knownTypes.includes(action.actionType)) {
    reasons.push(`Unknown action type: ${action.actionType}`);
    approved = false;
  }

  // 3. Per-action checks
  if (action.actionType === "JUPITER_SWAP") {
    const parsed = JupiterSwapParamsSchema.safeParse(action.params);
    if (!parsed.success) {
      reasons.push(`Invalid JUPITER_SWAP params: ${parsed.error.message}`);
      approved = false;
    } else {
      const p = parsed.data as JupiterSwapParams;

      // Check output mint is in allowlist
      const { allowedOutputMints } = session.guardrails;
      if (allowedOutputMints.length > 0 && !allowedOutputMints.includes(p.outputMint)) {
        reasons.push(`Output mint ${p.outputMint} not in allowlist`);
        approved = false;
      }

      // Check slippage
      if (p.slippageBps > session.guardrails.slippageBpsMax) {
        reasons.push(
          `Slippage ${p.slippageBps} bps exceeds max ${session.guardrails.slippageBpsMax} bps`
        );
        approved = false;
      }

      // Check per-tx cap
      const amountSol = p.amountLamports / 1e9;
      if (amountSol > session.guardrails.maxSwapSolPerTx) {
        reasons.push(
          `Swap amount ${amountSol.toFixed(4)} SOL exceeds per-tx cap ${session.guardrails.maxSwapSolPerTx} SOL`
        );
        approved = false;
      }

      // Check daily spend cap
      if (dailySpendSolSoFar + amountSol > session.guardrails.maxSpendSolPerDay) {
        reasons.push(
          `Daily spend would reach ${(dailySpendSolSoFar + amountSol).toFixed(4)} SOL, cap is ${session.guardrails.maxSpendSolPerDay} SOL`
        );
        approved = false;
      }

      // Check approval threshold
      if (amountSol > session.guardrails.approvalThresholdSol) {
        requiresHumanApproval = true;
        reasons.push(
          `Amount ${amountSol.toFixed(4)} SOL exceeds approval threshold ${session.guardrails.approvalThresholdSol} SOL — requires human approval`
        );
      }
    }
  }

  if (action.actionType === "TRANSFER") {
    const parsed = TransferParamsSchema.safeParse(action.params);
    if (!parsed.success) {
      reasons.push(`Invalid TRANSFER params: ${parsed.error.message}`);
      approved = false;
    } else {
      const p = parsed.data as TransferParams;

      // Check destination allowlist
      const { allowedDestinationAddresses } = session.guardrails;
      if (
        allowedDestinationAddresses.length > 0 &&
        !allowedDestinationAddresses.includes(p.destinationAddress)
      ) {
        reasons.push(`Destination ${p.destinationAddress} not in allowlist`);
        approved = false;
      }

      // Check daily cap
      const amountSol = p.amount / 1e9;
      if (dailySpendSolSoFar + amountSol > session.guardrails.maxSpendSolPerDay) {
        reasons.push(`Daily spend cap would be exceeded`);
        approved = false;
      }

      // Approval threshold
      if (amountSol > session.guardrails.approvalThresholdSol) {
        requiresHumanApproval = true;
        reasons.push(`Transfer requires human approval (amount > threshold)`);
      }
    }
  }

  if (action.actionType === "NOTIFY") {
    const parsed = NotifyParamsSchema.safeParse(action.params);
    if (!parsed.success) {
      reasons.push(`Invalid NOTIFY params: ${parsed.error.message}`);
      approved = false;
    }
    // NOTIFY is always allowed (even READ_ONLY) if params are valid
  }

  // 4. If approved so far but requires human approval, mark as needing approval
  if (approved && requiresHumanApproval) {
    // Will be set to PENDING_APPROVAL — not automatically executed
    reasons.push("Action queued for human approval");
  }

  if (approved && !requiresHumanApproval && reasons.length === 0) {
    reasons.push("All guardrails passed");
  }

  return {
    approved,
    requiresHumanApproval,
    reasons,
    checkedAt: new Date().toISOString(),
  };
}

// ─── Utility: check if an AI output action should be auto-executed ─────────────

export function canAutoExecute(
  policyResult: PolicyResult,
  session: AgentSession
): boolean {
  return (
    policyResult.approved &&
    !policyResult.requiresHumanApproval &&
    session.permissionsMode === "EXECUTE_LIMITED"
  );
}

// ─── Utility: build a human-readable audit summary ────────────────────────────

export function buildAuditSummary(policyResult: PolicyResult): string {
  const status = policyResult.approved ? "✅ APPROVED" : "❌ REJECTED";
  const approval = policyResult.requiresHumanApproval ? " (⏳ Awaiting human approval)" : "";
  const reasons = policyResult.reasons.map((r) => `  • ${r}`).join("\n");
  return `${status}${approval}\n${reasons}`;
}
