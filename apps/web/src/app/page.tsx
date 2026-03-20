// apps/web/src/app/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useAuth } from "@/components/providers/AuthProvider";
import { InsightCard } from "@/components/agent/InsightCard";
import { ActionCard } from "@/components/agent/ActionCard";
import { api } from "@/lib/api";
import Link from "next/link";

export default function DashboardPage() {
  const { connected } = useWallet();
  const { authenticated, signIn, loading } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

const loadData = useCallback(async () => {
    if (!authenticated) return;
    try {
      const [s, ins, acts] = await Promise.all([
        api.sessions.list(),
        api.insights.list(),
        api.actions.list(),
      ]);
      setSessions(s);
      setInsights(ins.slice(0, 6));
      setActions(acts.filter((a: any) => a.status === "PENDING_APPROVAL").slice(0, 4));
    } catch (e: any) {
      // Silently ignore rate limit and auth errors during polling
      console.warn("[Dashboard] load error:", e.message);
    }
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    loadData();
    const t = setInterval(loadData, 60000); // 60s instead of 30s to avoid rate limit
    return () => clearInterval(t);
  }, [loadData, authenticated]);

  const handleRunAgent = async (sessId: string) => {
    setAgentRunning(true);
    try {
      await api.agent.runOnce(sessId);
      setLastRun(new Date().toLocaleTimeString());
      setTimeout(loadData, 3000); // Reload after 3s
    } catch (e: any) {
      alert(`Run failed: ${e.message}`);
    } finally {
      setAgentRunning(false);
    }
  };

  const handleCreateSession = async () => {
    try {
      const session = await api.sessions.create({
        watchlistMints: ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"],
        timeframe: "medium",
        riskLevel: "low",
        permissionsMode: "READ_ONLY",
        guardrails: {
          maxSpendSolPerDay: 0.5,
          maxSwapSolPerTx: 0.05,
          allowedOutputMints: ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"],
          slippageBpsMax: 300,
          approvalThresholdSol: 0.1,
          allowedDestinationAddresses: [],
        },
      });
      setSessions((prev) => [session, ...prev]);
    } catch (e: any) {
      alert(`Failed to create session: ${e.message}`);
    }
  };

  if (!connected) {
    return <LandingScreen />;
  }

  if (!authenticated && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Sign in to ChainPulse AI</h2>
          <p className="text-gray-400 mb-6">Sign a message with your wallet to authenticate. No transaction required.</p>
          <button
            onClick={signIn}
            className="px-8 py-3 bg-gradient-to-r from-[#14F195] to-[#9945FF] text-black font-bold rounded-xl hover:opacity-90 transition-opacity"
          >
            Sign In with Solana
          </button>
        </div>
      </div>
    );
  }

  const activeSession = sessions.find((s) => s.isActive);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            AI Dashboard
            <span className="ml-3 text-sm font-normal text-[#14F195] bg-[#14F195]/10 px-2 py-1 rounded-full">
              ● LIVE
            </span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {activeSession
              ? `Active session · next run ${activeSession.nextRunAt ? new Date(activeSession.nextRunAt).toLocaleTimeString() : "soon"}`
              : "No active session — create one to start monitoring"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRun && (
            <span className="text-xs text-gray-500">Last run: {lastRun}</span>
          )}
          {activeSession ? (
            <button
              onClick={() => handleRunAgent(activeSession.id)}
              disabled={agentRunning}
              className="px-4 py-2 text-sm bg-[#14F195]/10 text-[#14F195] border border-[#14F195]/30 rounded-xl hover:bg-[#14F195]/20 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {agentRunning ? (
                <>
                  <span className="w-3 h-3 border-2 border-[#14F195] border-t-transparent rounded-full animate-spin" />
                  Running...
                </>
              ) : (
                "▶ Run Agent Now"
              )}
            </button>
          ) : (
            <button
              onClick={handleCreateSession}
              className="px-4 py-2 text-sm bg-[#9945FF]/10 text-[#9945FF] border border-[#9945FF]/30 rounded-xl hover:bg-[#9945FF]/20 transition-colors"
            >
              + Create Session
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      {activeSession && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Mode" value={activeSession.permissionsMode} accent={activeSession.permissionsMode === "EXECUTE_LIMITED" ? "green" : "blue"} />
          <StatCard label="Risk Level" value={activeSession.riskLevel.toUpperCase()} />
          <StatCard label="Loop Interval" value={`${activeSession.loopIntervalMinutes}m`} />
          <StatCard label="Insights Today" value={String(insights.length)} accent="green" />
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Insights column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Top Opportunities</h2>
            <Link href="/actions" className="text-sm text-gray-400 hover:text-[#14F195] transition-colors">
              View all →
            </Link>
          </div>

          {dataLoading && insights.length === 0 ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 bg-dark-700 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : insights.length === 0 ? (
            <EmptyState
              icon="🔭"
              title="No insights yet"
              description={activeSession ? "Run the agent to generate your first insights." : "Create a session to start monitoring."}
            />
          ) : (
            <div className="space-y-4">
              {insights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}
        </div>

        {/* Actions sidebar */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Pending Actions</h2>
            <Link href="/actions" className="text-sm text-gray-400 hover:text-[#14F195] transition-colors">
              All actions →
            </Link>
          </div>

          {actions.length === 0 ? (
            <EmptyState icon="✅" title="No pending actions" description="The agent will propose actions here." compact />
          ) : (
            <div className="space-y-4">
              {actions.map((action) => (
                <ActionCard key={action.id} action={action} onUpdate={loadData} />
              ))}
            </div>
          )}

          {/* Quick links */}
          <div className="bg-dark-700 border border-dark-600 rounded-xl p-4 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Quick Actions</p>
            {[
              { href: "/watchlist", icon: "👁️", label: "Manage Watchlist" },
              { href: "/settings/guardrails", icon: "🛡️", label: "Edit Guardrails" },
              { href: activeSession ? `/agents/${activeSession.id}` : "#", icon: "📋", label: "View Audit Log" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-1.5 px-2 rounded-lg hover:bg-dark-600"
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string; accent?: "green" | "blue" | "yellow" }) {
  const colors = {
    green: "text-[#14F195]",
    blue: "text-blue-400",
    yellow: "text-yellow-400",
  };
  return (
    <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono ${accent ? colors[accent] : "text-white"}`}>{value}</p>
    </div>
  );
}

function EmptyState({ icon, title, description, compact = false }: {
  icon: string; title: string; description: string; compact?: boolean;
}) {
  return (
    <div className={`bg-dark-700 border border-dark-600 rounded-xl flex flex-col items-center justify-center text-center ${compact ? "p-6" : "p-12"}`}>
      <span className={compact ? "text-3xl mb-2" : "text-5xl mb-4"}>{icon}</span>
      <p className="font-medium text-white mb-1">{title}</p>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  );
}

function LandingScreen() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div style={{
      minHeight: "75vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 16px",
    }}>
      <div style={{ textAlign: "center", maxWidth: 560, width: "100%" }}>
        {/* Badge */}
        <div style={{
          fontFamily: "monospace",
          fontSize: 10,
          letterSpacing: "0.16em",
          color: "#00a855",
          marginBottom: 20,
          textTransform: "uppercase",
        }}>
          Buildifi AI Track · Solana Devnet
        </div>

        {/* Hero title */}
        <h1 style={{
          fontFamily: "sans-serif",
          fontWeight: 800,
          fontSize: "clamp(32px, 8vw, 52px)",
          color: "#e8f5ec",
          lineHeight: 1.1,
          marginBottom: 16,
          letterSpacing: "-0.02em",
        }}>
          Chain<span style={{ color: "#00e87a" }}>Pulse</span> AI
        </h1>

        {/* Subtitle */}
        <p style={{
          fontFamily: "monospace",
          fontSize: "clamp(11px, 3vw, 13px)",
          color: "#c8d8cc",
          lineHeight: 1.7,
          marginBottom: 32,
          padding: "0 8px",
        }}>
          Autonomous Solana agent · spots on-chain signals · executes safely within your rules
        </p>

        {/* Feature pills */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
          marginBottom: 40,
          padding: "0 8px",
        }}>
          {[
            { icon: "📈", label: "Momentum Signals" },
            { icon: "🐋", label: "Whale Detection" },
            { icon: "🛣️", label: "Route Quality" },
            { icon: "⚡", label: "Volume Spikes" },
            { icon: "✨", label: "New Tokens" },
            { icon: "🛡️", label: "Policy Engine" },
          ].map(f => (
            <span key={f.label} style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "system-ui, sans-serif",
              fontSize: 13,
              color: "#c8d8cc",
              border: "1px solid #1a2d1e",
              padding: "8px 14px",
              borderRadius: 20,
              background: "#080f0a",
              whiteSpace: "nowrap",
            }}>
              <span style={{ fontSize: 16 }}>{f.icon}</span>
              {f.label}
            </span>
          ))}
        </div>

        {/* Wallet button */}
        {mounted && <WalletMultiButton />}

        <p style={{
          fontFamily: "monospace",
          fontSize: 10,
          color: "#2e4235",
          marginTop: 16,
        }}>
          Connect your Solana wallet to get started · Devnet only
        </p>
      </div>
    </div>
  );
}