// apps/web/src/components/agent/ActionCard.tsx
"use client";
import { useState } from "react";
import { api } from "@/lib/api";

interface Action {
  id: string;
  actionType: "JUPITER_SWAP" | "NOTIFY" | "TRANSFER";
  risk: "LOW" | "MED" | "HIGH";
  params: Record<string, any>;
  reason: string;
  status: string;
  policyDecision?: { approved: boolean; reasons: string[]; requiresHumanApproval: boolean };
  txSignature?: string;
  explorerLink?: string;
  failureReason?: string;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING_APPROVAL: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  APPROVED:         "bg-blue-500/10 text-blue-400 border-blue-500/20",
  EXECUTED:         "bg-green-500/10 text-green-400 border-green-500/20",
  SKIPPED_NO_ROUTE: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  SKIPPED_POLICY:   "bg-orange-500/10 text-orange-400 border-orange-500/20",
  FAILED:           "bg-red-500/10 text-red-400 border-red-500/20",
  REJECTED:         "bg-red-900/10 text-red-600 border-red-900/20",
};

const RISK_STYLES: Record<string, string> = {
  LOW:  "text-green-400",
  MED:  "text-yellow-400",
  HIGH: "text-red-400",
};

const TYPE_ICONS: Record<string, string> = {
  JUPITER_SWAP: "🔄",
  NOTIFY: "🔔",
  TRANSFER: "📤",
};

export function ActionCard({ action, onUpdate }: { action: Action; onUpdate: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await api.actions.approve(action.id);
      onUpdate();
    } catch (e: any) {
      alert(`Approve failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await api.actions.reject(action.id);
      onUpdate();
    } catch (e: any) {
      alert(`Reject failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!confirm("Execute this action on-chain? This cannot be undone.")) return;
    setLoading(true);
    try {
      const result = await api.actions.execute(action.id);
      if (result.explorerLink) {
        window.open(result.explorerLink, "_blank");
      }
      onUpdate();
    } catch (e: any) {
      alert(`Execute failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-dark-700 border border-dark-600 rounded-xl p-5 card-glow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{TYPE_ICONS[action.actionType]}</span>
          <div>
            <span className="font-mono text-sm text-white">{action.actionType}</span>
            <span className={`ml-2 text-xs font-semibold ${RISK_STYLES[action.risk]}`}>
              ● {action.risk} RISK
            </span>
          </div>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[action.status] || "bg-gray-500/10 text-gray-400"}`}
        >
          {action.status.replace("_", " ")}
        </span>
      </div>

      {/* Reason */}
      <p className="text-sm text-gray-300 mb-3">{action.reason}</p>

      {/* Params */}
      <div className="bg-dark-800 rounded-lg p-3 mb-3 font-mono text-xs text-gray-400 overflow-x-auto">
        {action.actionType === "JUPITER_SWAP" && (
          <div className="space-y-1">
            <div><span className="text-gray-600">Amount: </span>{((action.params.amountLamports || 0) / 1e9).toFixed(4)} SOL</div>
            <div><span className="text-gray-600">Output: </span>{(action.params.outputMint || "").slice(0, 20)}...</div>
            <div><span className="text-gray-600">Slippage: </span>{action.params.slippageBps} bps</div>
          </div>
        )}
        {action.actionType === "NOTIFY" && (
          <div>{action.params.message}</div>
        )}
        {action.actionType === "TRANSFER" && (
          <div className="space-y-1">
            <div><span className="text-gray-600">To: </span>{action.params.destinationAddress}</div>
            <div><span className="text-gray-600">Amount: </span>{action.params.amount}</div>
          </div>
        )}
      </div>

      {/* Policy decision */}
      {action.policyDecision && (
        <div className="text-xs text-gray-500 mb-3 space-y-0.5">
          {action.policyDecision.reasons.map((r, i) => (
            <div key={i} className="flex items-start gap-1">
              <span className={action.policyDecision!.approved ? "text-green-600" : "text-red-600"}>
                {action.policyDecision!.approved ? "✓" : "✗"}
              </span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* TX link */}
      {action.txSignature && action.explorerLink && (
        <a
          href={action.explorerLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[#14F195] hover:underline mb-3"
        >
          <span>View on Solscan</span>
          <span>↗</span>
          <span className="text-gray-600 font-mono ml-1">{action.txSignature.slice(0, 12)}...</span>
        </a>
      )}

      {/* Failure reason */}
      {action.failureReason && (
        <p className="text-xs text-red-400 mb-3">⚠ {action.failureReason}</p>
      )}

      {/* Actions */}
      {action.status === "PENDING_APPROVAL" && (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 py-2 text-sm bg-[#14F195]/10 text-[#14F195] border border-[#14F195]/30 rounded-lg hover:bg-[#14F195]/20 transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "✓ Approve"}
          </button>
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex-1 py-2 text-sm bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "✗ Reject"}
          </button>
        </div>
      )}

      {action.status === "APPROVED" && (
        <button
          onClick={handleExecute}
          disabled={loading}
          className="w-full py-2 text-sm bg-[#9945FF]/20 text-[#9945FF] border border-[#9945FF]/30 rounded-lg hover:bg-[#9945FF]/30 transition-colors disabled:opacity-50"
        >
          {loading ? "Executing..." : "⚡ Execute On-Chain"}
        </button>
      )}
    </div>
  );
}
