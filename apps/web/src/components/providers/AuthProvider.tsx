"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { setToken, clearToken, apiFetch } from "@/lib/api";

interface AuthState {
  authenticated: boolean;
  userId?: string;
  walletAddress?: string;
  loading: boolean;
  authError: string | null;
  authLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthState>({
  authenticated: false,
  loading: true,
  authError: null,
  authLoading: false,
  signIn: async () => {},
  signOut: async () => {},
  clearAuthError: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, signMessage, connected } = useWallet();

  // ── All useState hooks inside the component ──────────────────────────────
  const [authenticated, setAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string>();
  const [walletAddress, setWalletAddress] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Check existing session on mount
  useEffect(() => {
    apiFetch("/auth/me")
      .then((data) => {
        if (data.authenticated) {
          setAuthenticated(true);
          setUserId(data.userId);
          setWalletAddress(data.walletAddress);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async () => {
    if (!connected) {
      setAuthError("Please connect your wallet first");
      return;
    }
    if (!publicKey || !signMessage) {
      setAuthError("Wallet not ready — please try again");
      return;
    }

    setAuthError(null);
    setAuthLoading(true);

    try {
      const address = publicKey.toBase58();
      const { nonce, message } = await apiFetch("/auth/nonce", {
        method: "POST",
        body: JSON.stringify({ walletAddress: address }),
      });
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(messageBytes);
      const signatureBase58 = bs58.encode(signatureBytes);
      const result = await apiFetch("/auth/verify", {
        method: "POST",
        body: JSON.stringify({ walletAddress: address, signature: signatureBase58, nonce }),
      });
      if (result.success) {
        setToken(result.token);  // ← save to localStorage
        setAuthenticated(true);
        setUserId(result.userId);
        setWalletAddress(result.walletAddress);
      }
    } catch (err: any) {
      if (err.message?.includes("User rejected")) {
        setAuthError("Signature rejected — please approve in your wallet");
      } else if (err.message?.includes("fetch") || err.message?.includes("reach") || err.message?.includes("4000")) {
        setAuthError("API unreachable — backend may be sleeping, try again in 30s");
      } else {
        setAuthError(err.message || "Sign in failed");
      }
    } finally {
      setAuthLoading(false);
    }
  }, [publicKey, signMessage, connected]);

  const signOut = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    clearToken();  // ← clear from localStorage
    setAuthenticated(false);
    setUserId(undefined);
    setWalletAddress(undefined);
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  // Handle wallet disconnect
  useEffect(() => {
    if (!connected && authenticated) {
      signOut();
    }
  }, [connected, authenticated, signOut]);

  return (
    <AuthContext.Provider value={{
      authenticated,
      userId,
      walletAddress,
      loading,
      authError,
      authLoading,
      signIn,
      signOut,
      clearAuthError,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);