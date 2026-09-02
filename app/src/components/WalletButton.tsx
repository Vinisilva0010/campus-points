"use client";

import dynamic from "next/dynamic";
import React from "react";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  {
    ssr: false,
    loading: () => (
      <button
        type="button"
        className="wallet-adapter-button opacity-70 cursor-wait"
        disabled
      >
        Carregando...
      </button>
    ),
  }
);

export const WalletButton = () => {
  return <WalletMultiButton />;
};
