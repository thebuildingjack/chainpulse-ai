// apps/web/src/app/agents/[sessionId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { InsightCard } from "@/components/agent/InsightCard";
import { ActionCard } from "@/components/agent/ActionCard";
import { api } from "@/lib/api";

export default function AgentSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [tab, setTab] = useState<"insights" | "actions" | "audit">("insights");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    Promise.all([
      api.sessions.get(sessionId),
      api.insights.list(sessionId),
      api.actions.list(sessionId),
    ]).then(([sess, ins, acts]) => {
      setSession(sess);
      setInsights(ins);
      setActions(acts);
    }).finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-dark-700 rounded-xl" />)}</div>;
  }
  if (!session) return <p className="text-gray-400">Session not found</p>;

  const guardrails = session.guardrails || {};
  const runs = session.runs || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-dark-700 border border-dark-600 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Session <span className="font-mono text-[#14F195]">{session.id.slice(0, 16)}...</span></h1>
            <p className="text-sm text-gray-400 font-mono mt-1">{session.walletAddress}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm border font-medium ${session.isActive ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-gray-500/10 text-gray-400 border-gray-600"}`}>
            {session.isActive ? "● Active" : "Inactive"}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <InfoItem label="Mode" value={session.permissionsMode} />
          <InfoItem label="Timeframe" value={session.timeframe} />
          <InfoItem label="Risk Level" value={session.riskLevel} />
          <InfoItem label="Loop Interval" value={`${session.loopIntervalMinutes}m`} />
          <InfoItem label="Last Run" value={session.lastRunAt ? new Date(session.lastRunAt).toLocaleString() : "Never"} />
          <InfoItem label="Next Run" value={session.nextRunAt ? new Date(session.nextRunAt).toLocaleString() : "—"} />
          <InfoItem label="Max Spend/Day" value={`${guardrails.maxSpendSolPerDay || 0} SOL`} />
          <InfoItem label="Approval Threshold" value={`${guardrails.approvalThresholdSol || 0} SOL`} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-800 rounded-xl p-1 w-fit">
        {(["insights", "actions", "audit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors capitalize ${tab === t ? "bg-dark-600 text-white" : "text-gray-400 hover:text-white"}`}
          >
            {t} {t === "insights" ? `(${insights.length})` : t === "actions" ? `(${actions.length})` : `(${runs.length})`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "insights" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.length === 0 ? <EmptyMsg text="No insights yet" /> : insights.map(i => <InsightCard key={i.id} insight={i} />)}
        </div>
      )}

      {tab === "actions" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {actions.length === 0 ? <EmptyMsg text="No actions yet" /> : actions.map(a => <ActionCard key={a.id} action={a} onUpdate={() => api.actions.list(sessionId).then(setActions)} />)}
        </div>
      )}

      {tab === "audit" && (
        <div className="space-y-3">
          {runs.length === 0 ? <EmptyMsg text="No runs yet" /> : runs.map((run: any) => <RunRecord key={run.id} run={run} />)}
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-white mt-0.5">{value}</p>
    </div>
  );
}

function RunRecord({ run }: { run: any }) {
  const [expanded, setExpanded] = useState(false);
  const logs: any[] = run.toolCallLog || [];

  return (
    <div className="bg-dark-700 border border-dark-600 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-dark-600/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${run.status === "COMPLETED" ? "bg-green-500" : run.status === "FAILED" ? "bg-red-500" : "bg-yellow-500"}`} />
          <span className="text-sm font-mono text-gray-300">{run.id.slice(0, 16)}...</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${run.status === "COMPLETED" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
            {run.status}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{logs.length} tool call(s)</span>
          <span>{new Date(run.startedAt).toLocaleString()}</span>
          <span>{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-dark-600 p-4 space-y-3">
          {run.errorMessage && (
            <div className="bg-red-900/10 border border-red-900/20 rounded-lg p-3 text-xs text-red-400">
              Error: {run.errorMessage}
            </div>
          )}
          {logs.map((log: any, i: number) => (
            <div key={i} className="bg-dark-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-[#14F195]">{log.tool}()</span>
                <span className="text-xs text-gray-600">{new Date(log.calledAt).toLocaleTimeString()}</span>
              </div>
              {log.error ? (
                <p className="text-xs text-red-400">Error: {log.error}</p>
              ) : (
                <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap max-h-32">
                  {JSON.stringify(log.result || log.params, null, 2)}
                </pre>
              )}
            </div>
          ))}
          {run.aiOutputRaw && (
            <div className="bg-dark-800 rounded-lg p-3">
              <p className="text-xs text-[#9945FF] font-mono mb-2">AI Output (raw)</p>
              <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap max-h-40">
                {run.aiOutputRaw.slice(0, 800)}{run.aiOutputRaw.length > 800 ? "..." : ""}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyMsg({ text }: { text: string }) {
  return <div className="col-span-2 text-center py-12 text-gray-500">{text}</div>;
}
