"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useAuth } from "@/components/providers/AuthProvider";
import { useState, useEffect } from "react";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/actions", label: "Actions" },
  { href: "/settings/guardrails", label: "Guardrails" },
];

export function Navbar() {
  const path = usePathname();
  const { authenticated, signIn, signOut, walletAddress, authError, authLoading, clearAuthError } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (!authError) return;
    const t = setTimeout(() => clearAuthError?.(), 5000);
    return () => clearTimeout(t);
  }, [authError, clearAuthError]);

  return (
    <>
      {/* Error toast */}
      {authError && (
        <div style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#1a0808",
          border: "1px solid #ff4d6a",
          color: "#ff4d6a",
          fontFamily: "monospace",
          fontSize: 12,
          padding: "10px 20px",
          borderRadius: 4,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 4px 24px rgba(255,77,106,0.25)",
          whiteSpace: "nowrap",
          maxWidth: "90vw",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          <span>⚠ {authError}</span>
          <button
            onClick={() => clearAuthError?.()}
            style={{
              background: "none",
              border: "none",
              color: "#ff4d6a",
              cursor: "pointer",
              fontSize: 14,
              padding: 0,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}

      <nav
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-1)" }}
        className="sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-6">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 flex-shrink-0">
            <div
              style={{ width: 28, height: 28, background: "var(--green)", borderRadius: 2 }}
              className="flex items-center justify-center"
            >
              <span style={{ color: "#040706", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 11 }}>CP</span>
            </div>
            <div>
              <span style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 15, color: "#e8f5ec", letterSpacing: "-0.01em" }}>
                ChainPulse
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--green)", marginLeft: 6 }}>AI</span>
            </div>
            <span style={{ border: "1px solid var(--border)", color: "var(--text-dim)", fontSize: 9, padding: "1px 5px", borderRadius: 1, letterSpacing: "0.1em" }}>
              DEVNET
            </span>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-1 flex-1">
            {NAV.map(n => (
              <Link
                key={n.href}
                href={n.href}
                style={{
                  fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.06em",
                  padding: "5px 12px", borderRadius: 1, transition: "all 0.15s",
                  color: path === n.href ? "var(--green)" : "var(--text-dim)",
                  background: path === n.href ? "var(--green-glow)" : "transparent",
                  border: `1px solid ${path === n.href ? "var(--green-dim)" : "transparent"}`,
                  textDecoration: "none",
                }}
              >
                {n.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {authenticated && walletAddress && (
              <div style={{
                border: "1px solid var(--border)",
                borderRadius: 2,
                padding: "4px 10px",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                <span className="dot-green pulse-green" />
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>
                  {walletAddress.slice(0, 4)}…{walletAddress.slice(-4)}
                </span>
              </div>
            )}

            {authenticated
              ? (
                <button onClick={signOut} className="btn btn-ghost">
                  sign out
                </button>
              )
              : (
                <button
                  onClick={signIn}
                  disabled={authLoading}
                  className="btn btn-green"
                  style={{ opacity: authLoading ? 0.6 : 1 }}
                >
                  {authLoading ? "signing…" : "sign in"}
                </button>
              )
            }

            {mounted && <WalletMultiButton />}
          </div>
        </div>
      </nav>
    </>
  );
}