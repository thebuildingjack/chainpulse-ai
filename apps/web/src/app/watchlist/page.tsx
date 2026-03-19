// apps/web/src/app/watchlist/page.tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const PRESET_TOKENS = [
  { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", name: "USD Coin" },
  { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", symbol: "USDT", name: "Tether USD" },
  { mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", symbol: "ETH", name: "Wrapped Ether (Wormhole)" },
  { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", name: "Bonk" },
  { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP", name: "Jupiter" },
];

export default function WatchlistPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [newMint, setNewMint] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.sessions.list().then((data) => {
      setSessions(data);
      setActiveSession(data.find((s: any) => s.isActive));
    });
  }, []);

  const watchlistMints: string[] = activeSession?.watchlistMints || [];

  const toggleToken = async (mint: string) => {
    if (!activeSession) return;
    const updated = watchlistMints.includes(mint)
      ? watchlistMints.filter((m) => m !== mint)
      : [...watchlistMints, mint];

    setSaving(true);
    try {
      const res = await api.sessions.update(activeSession.id, { watchlistMints: updated });
      setActiveSession(res);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addCustomMint = async () => {
    if (!newMint.trim() || !activeSession) return;
    const updated = [...new Set([...watchlistMints, newMint.trim()])];
    setSaving(true);
    try {
      const res = await api.sessions.update(activeSession.id, { watchlistMints: updated });
      setActiveSession(res);
      setNewMint("");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Watchlist</h1>
        <p className="text-gray-400 text-sm mt-1">Tokens and programs the AI agent monitors for signals</p>
      </div>

      {!activeSession ? (
        <div className="bg-dark-700 border border-dark-600 rounded-xl p-8 text-center text-gray-400">
          Create a session on the dashboard first
        </div>
      ) : (
        <>
          {/* Preset tokens */}
          <div className="bg-dark-700 border border-dark-600 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-4">Common Tokens</h3>
            <div className="space-y-2">
              {PRESET_TOKENS.map((token) => {
                const isWatched = watchlistMints.includes(token.mint);
                return (
                  <div
                    key={token.mint}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                      isWatched
                        ? "bg-[#14F195]/5 border-[#14F195]/20"
                        : "bg-dark-800 border-dark-600 hover:border-dark-500"
                    }`}
                    onClick={() => toggleToken(token.mint)}
                  >
                    <div>
                      <span className="font-mono text-sm font-semibold text-white">{token.symbol}</span>
                      <span className="text-xs text-gray-400 ml-2">{token.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 font-mono">{token.mint.slice(0, 8)}...</span>
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isWatched ? "bg-[#14F195] border-[#14F195]" : "border-dark-500"
                        }`}
                      >
                        {isWatched && <span className="text-black text-xs font-bold">✓</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom mint */}
          <div className="bg-dark-700 border border-dark-600 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-4">Add Custom Token</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMint}
                onChange={(e) => setNewMint(e.target.value)}
                placeholder="Token mint address..."
                className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#14F195]/50 focus:outline-none font-mono"
                onKeyDown={(e) => e.key === "Enter" && addCustomMint()}
              />
              <button
                onClick={addCustomMint}
                disabled={saving || !newMint.trim()}
                className="px-4 py-2 bg-[#14F195]/10 text-[#14F195] border border-[#14F195]/30 rounded-lg text-sm hover:bg-[#14F195]/20 transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Current watchlist */}
          {watchlistMints.length > 0 && (
            <div className="bg-dark-700 border border-dark-600 rounded-xl p-5">
              <h3 className="font-semibold text-white mb-3">Active Watchlist ({watchlistMints.length})</h3>
              <div className="space-y-2">
                {watchlistMints.map((mint) => (
                  <div key={mint} className="flex items-center justify-between bg-dark-800 rounded-lg px-3 py-2">
                    <span className="font-mono text-xs text-gray-300">{mint}</span>
                    <button
                      onClick={() => toggleToken(mint)}
                      className="text-xs text-red-400 hover:text-red-300 ml-2"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {saving && (
            <p className="text-xs text-[#14F195] text-center animate-pulse">Saving...</p>
          )}
        </>
      )}
    </div>
  );
}
