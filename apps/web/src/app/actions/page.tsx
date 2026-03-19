// apps/web/src/app/actions/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { ActionCard } from "@/components/agent/ActionCard";
import { api } from "@/lib/api";

const STATUSES = ["ALL", "PENDING_APPROVAL", "EXECUTED", "SKIPPED_POLICY", "FAILED", "REJECTED"];

export default function ActionsPage() {
  const [actions, setActions] = useState<any[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.actions.list(undefined, filter === "ALL" ? undefined : filter);
      setActions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const stats = {
    pending: actions.filter((a) => a.status === "PENDING_APPROVAL").length,
    executed: actions.filter((a) => a.status === "EXECUTED").length,
    skipped: actions.filter((a) => a.status.startsWith("SKIPPED")).length,
    failed: actions.filter((a) => a.status === "FAILED").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Action Feed</h1>
        <p className="text-gray-400 text-sm mt-1">All proposed and executed actions with full audit trail</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-dark-700 border border-yellow-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
          <p className="text-xs text-gray-500 mt-1">Pending Approval</p>
        </div>
        <div className="bg-dark-700 border border-green-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[#14F195]">{stats.executed}</p>
          <p className="text-xs text-gray-500 mt-1">Executed</p>
        </div>
        <div className="bg-dark-700 border border-orange-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-400">{stats.skipped}</p>
          <p className="text-xs text-gray-500 mt-1">Skipped</p>
        </div>
        <div className="bg-dark-700 border border-red-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
          <p className="text-xs text-gray-500 mt-1">Failed</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              filter === s
                ? "bg-[#14F195]/10 text-[#14F195] border-[#14F195]/30"
                : "text-gray-400 border-dark-600 hover:border-dark-500"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Action list */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-dark-700 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : actions.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">📭</p>
          <p>No actions found for this filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {actions.map((action) => (
            <ActionCard key={action.id} action={action} onUpdate={load} />
          ))}
        </div>
      )}
    </div>
  );
}
