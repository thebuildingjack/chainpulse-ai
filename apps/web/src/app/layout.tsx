import type { Metadata } from "next";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { WalletContextProvider } from "@/components/providers/WalletProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { Navbar } from "@/components/ui/Navbar";

export const metadata: Metadata = {
  title: "ChainPulse AI",
  description: "Solana on-chain opportunity agent",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletContextProvider>
          <AuthProvider>
            <Navbar />
            <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
          </AuthProvider>
        </WalletContextProvider>
      </body>
    </html>
  );
}
