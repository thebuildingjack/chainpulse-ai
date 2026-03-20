import type { Metadata } from "next";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { WalletContextProvider } from "@/components/providers/WalletProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { Navbar } from "@/components/ui/Navbar";
import { useEffect } from "react";

export const metadata: Metadata = {
  title: "ChainPulse AI",
  description: "Solana on-chain opportunity agent",
};

// Ping the API on app load to wake Render if sleeping
useEffect(() => {
  fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`).catch(() => {});
}, []);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "#040706", color: "#c8d8cc", margin: 0, padding: 0 }}>
        <WalletContextProvider>
          <AuthProvider>
            <Navbar />
            <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 16px" }}>
              {children}
            </main>
          </AuthProvider>
        </WalletContextProvider>
      </body>
    </html>
  );
}