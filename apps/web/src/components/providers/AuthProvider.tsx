// apps/web/src/components/providers/AuthProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { apiFetch } from "@/lib/api";

interface AuthState {
  authenticated: boolean;
  userId?: string;
  walletAddress?: string;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  authenticated: false,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, signMessage, connected } = useWallet();
  const [authenticated, setAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string>();
  const [walletAddress, setWalletAddress] = useState<string>();
  const [loading, setLoading] = useState(true);

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
    alert("Please connect your wallet first before signing in.");
    return;
  }
  if (!publicKey || !signMessage) {
    alert("Wallet not ready — please try again.");
    return;
  }

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
      body: JSON.stringify({
        walletAddress: address,
        signature: signatureBase58,
        nonce,
      }),
    });

    if (result.success) {
      setAuthenticated(true);
      setUserId(result.userId);
      setWalletAddress(result.walletAddress);
    }
  } catch (err: any) {
    console.error("[Auth] Sign in failed:", err);
    if (err.message?.includes("User rejected")) {
      alert("Signature rejected. Please approve the sign-in request in your wallet.");
    } else if (err.message?.includes("fetch")) {
      alert("Cannot reach the API. Make sure the backend is running on port 4000.");
    } else {
      alert(`Sign in failed: ${err.message}`);
    }
  }
}, [publicKey, signMessage, connected]);

  const signOut = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    setAuthenticated(false);
    setUserId(undefined);
    setWalletAddress(undefined);
  }, []);

  // Auto sign-in when wallet connects (if not already authenticated)
  useEffect(() => {
    if (connected && publicKey && !authenticated && !loading) {
      // Don't auto-sign-in — require explicit user action for security
    }
    if (!connected && authenticated) {
      // Wallet disconnected — sign out
      signOut();
    }
  }, [connected, publicKey]);

  return (
    <AuthContext.Provider
      value={{ authenticated, userId, walletAddress, loading, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
