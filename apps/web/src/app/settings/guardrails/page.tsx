// apps/web/src/app/settings/guardrails/page.tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const DEFAULT_GUARDRAILS = {
  maxSpendSolPerDay: 1.0,
  maxSwapSolPerTx: 0.1,
  allowedOutputMints: [] as string[],
  slippageBpsMax: 300,
  approvalThresholdSol: 0.5,
  allowedDestinationAddresses: [] as string[],
};

export default function GuardrailsPage() {
  const [session, setSession] = useState<any>(null);
  const [guardrails, setGuardrails] = useState(DEFAULT_GUARDRAILS);
  const [permissionsMode, setPermissionsMode] = useState<"READ_ONLY" | "EXECUTE_LIMITED">("READ_ONLY");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newMint, setNewMint] = useState("");
  const [newAddr, setNewAddr] = useState("");

  useEffect(() => {
    api.sessions.list().then((sessions) => {
      const active = sessions.find((s: any) => s.isActive);
      if (active) {
        setSession(active);
        setGuardrails({ ...DEFAULT_GUARDRAILS, ...active.guardrails });
        setPermissionsMode(active.permissionsMode);
      }
    });
  }, []);

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    try {
      await api.sessions.updateGuardrails(session.id, guardrails);
      await api.sessions.update(session.id, { permissionsMode });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addMint = () => {
    if (!newMint.trim()) return;
    setGuardrails((g) => ({ ...g, allowedOutputMints: [...new Set([...g.allowedOutputMints, newMint.trim()])] }));
    setNewMint("");
  };
  const removeMint = (m: string) => setGuardrails((g) => ({ ...g, allowedOutputMints: g.allowedOutputMints.filter((x) => x !== m) }));
  const addAddr = () => {
    if (!newAddr.trim()) return;
    setGuardrails((g) => ({ ...g, allowedDestinationAddresses: [...new Set([...g.allowedDestinationAddresses, newAddr.trim()])] }));
    setNewAddr("");
  };
  const removeAddr = (a: string) => setGuardrails((g) => ({ ...g, allowedDestinationAddresses: g.allowedDestinationAddresses.filter((x) => x !== a) }));

  if (!session) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-4xl mb-3">🛡️</p>
        <p>Create a session on the dashboard first</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Guardrails & Permissions</h1>
        <p className="text-gray-400 text-sm mt-1">Every AI action is checked against these rules before execution</p>
      </div>

      {/* Permissions mode */}
      <Section title="Permissions Mode" icon="🔐">
        <div className="grid grid-cols-2 gap-3">
          {(["READ_ONLY", "EXECUTE_LIMITED"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setPermissionsMode(mode)}
              className={`p-4 rounded-xl border text-left transition-all ${
                permissionsMode === mode
                  ? mode === "EXECUTE_LIMITED"
                    ? "bg-[#9945FF]/10 border-[#9945FF]/40 text-[#9945FF]"
                    : "bg-[#14F195]/10 border-[#14F195]/40 text-[#14F195]"
                  : "bg-dark-800 border-dark-600 text-gray-400 hover:border-dark-500"
              }`}
            >
              <p className="font-semibold text-sm">{mode.replace("_", " ")}</p>
              <p className="text-xs mt-1 opacity-70">
                {mode === "READ_ONLY"
                  ? "AI monitors and alerts only — no execution"
                  : "AI can execute safe actions within your limits"}
              </p>
            </button>
          ))}
        </div>
        {permissionsMode === "EXECUTE_LIMITED" && (
          <div className="mt-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-xs text-yellow-400">
            ⚠ Execute mode is active. All actions are policy-checked and logged. Only 1 action per loop is auto-executed. Actions above your approval threshold require your manual sign-off.
          </div>
        )}
      </Section>

      {/* Spend limits */}
      <Section title="Spend Limits" icon="💰">
        <div className="space-y-4">
          <NumberInput
            label="Max SOL spend per day"
            hint="Total SOL the agent can spend across all actions in 24h"
            value={guardrails.maxSpendSolPerDay}
            onChange={(v) => setGuardrails((g) => ({ ...g, maxSpendSolPerDay: v }))}
            min={0} max={100} step={0.1}
          />
          <NumberInput
            label="Max SOL per swap transaction"
            hint="Hard cap on any single swap action"
            value={guardrails.maxSwapSolPerTx}
            onChange={(v) => setGuardrails((g) => ({ ...g, maxSwapSolPerTx: v }))}
            min={0} max={10} step={0.01}
          />
          <NumberInput
            label="Approval threshold (SOL)"
            hint="Actions above this amount require your manual approval"
            value={guardrails.approvalThresholdSol}
            onChange={(v) => setGuardrails((g) => ({ ...g, approvalThresholdSol: v }))}
            min={0} max={100} step={0.05}
          />
          <NumberInput
            label="Max slippage (bps)"
            hint="1 bps = 0.01%. 300 = 3% max slippage"
            value={guardrails.slippageBpsMax}
            onChange={(v) => setGuardrails((g) => ({ ...g, slippageBpsMax: Math.round(v) }))}
            min={0} max={5000} step={50}
          />
        </div>
      </Section>

      {/* Allowed output mints */}
      <Section title="Allowed Output Mints" icon="🪙" hint="AI can only swap INTO these tokens. Leave empty to allow any.">
        <div className="space-y-2 mb-3">
          {guardrails.allowedOutputMints.map((m) => (
            <div key={m} className="flex items-center justify-between bg-dark-800 rounded-lg px-3 py-2">
              <span className="font-mono text-xs text-gray-300 truncate flex-1">{m}</span>
              <button onClick={() => removeMint(m)} className="text-xs text-red-400 ml-2 flex-shrink-0">✕</button>
            </div>
          ))}
          {guardrails.allowedOutputMints.length === 0 && (
            <p className="text-xs text-gray-600 italic">Any output mint allowed (not recommended for production)</p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={newMint}
            onChange={(e) => setNewMint(e.target.value)}
            placeholder="Token mint address..."
            className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:border-[#14F195]/50 focus:outline-none"
            onKeyDown={(e) => e.key === "Enter" && addMint()}
          />
          <button onClick={addMint} className="px-3 py-2 bg-dark-600 text-gray-300 rounded-lg text-xs hover:bg-dark-500">+ Add</button>
        </div>
      </Section>

      {/* Allowed destination addresses */}
      <Section title="Allowed Destination Addresses" icon="📤" hint="For transfers: only these addresses are allowed as destinations.">
        <div className="space-y-2 mb-3">
          {guardrails.allowedDestinationAddresses.map((a) => (
            <div key={a} className="flex items-center justify-between bg-dark-800 rounded-lg px-3 py-2">
              <span className="font-mono text-xs text-gray-300 truncate flex-1">{a}</span>
              <button onClick={() => removeAddr(a)} className="text-xs text-red-400 ml-2 flex-shrink-0">✕</button>
            </div>
          ))}
          {guardrails.allowedDestinationAddresses.length === 0 && (
            <p className="text-xs text-gray-600 italic">No addresses allowed (transfers disabled)</p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={newAddr}
            onChange={(e) => setNewAddr(e.target.value)}
            placeholder="Wallet address..."
            className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:border-[#14F195]/50 focus:outline-none"
            onKeyDown={(e) => e.key === "Enter" && addAddr()}
          />
          <button onClick={addAddr} className="px-3 py-2 bg-dark-600 text-gray-300 rounded-lg text-xs hover:bg-dark-500">+ Add</button>
        </div>
      </Section>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-gradient-to-r from-[#14F195]/20 to-[#9945FF]/20 border border-[#14F195]/30 text-white font-semibold rounded-xl hover:from-[#14F195]/30 hover:to-[#9945FF]/30 transition-all disabled:opacity-50"
      >
        {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Guardrails"}
      </button>
    </div>
  );
}

function Section({ title, icon, hint, children }: { title: string; icon: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-dark-700 border border-dark-600 rounded-xl p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <span>{icon}</span>{title}
        </h3>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function NumberInput({ label, hint, value, onChange, min, max, step }: {
  label: string; hint: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
}) {
  return (
    <div>
      <label className="text-sm text-gray-300 block mb-1">{label}</label>
      <p className="text-xs text-gray-500 mb-2">{hint}</p>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 accent-[#14F195]"
        />
        <input
          type="number"
          min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-24 bg-dark-800 border border-dark-600 rounded-lg px-2 py-1 text-sm text-white text-right font-mono focus:border-[#14F195]/50 focus:outline-none"
        />
      </div>
    </div>
  );
}
