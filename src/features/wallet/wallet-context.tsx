"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { WalletSummary } from "@/domain";

type WalletContextValue = {
  wallet: WalletSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setWallet: (wallet: WalletSummary | null) => void;
  openBuyCredits: boolean;
  setOpenBuyCredits: (open: boolean) => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openBuyCredits, setOpenBuyCredits] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/wallet");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load wallet");
      }
      const data = (await res.json()) as { wallet: WalletSummary };
      setWallet(data.wallet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial wallet load for the active workspace session.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      wallet,
      loading,
      error,
      refresh,
      setWallet,
      openBuyCredits,
      setOpenBuyCredits,
    }),
    [wallet, loading, error, refresh, openBuyCredits],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return ctx;
}

/** Safe for components that may render outside the provider. */
export function useWalletOptional() {
  return useContext(WalletContext);
}
