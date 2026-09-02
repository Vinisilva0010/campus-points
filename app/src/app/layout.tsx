import type { Metadata } from "next";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletContextProvider";

export const metadata: Metadata = {
  title: "Campus Points — Recompensas Estudantis na Solana",
  description: "Sistema de pontos intransferíveis e reputação acadêmica para universidades.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#f9f1f5] text-black min-h-screen">
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
