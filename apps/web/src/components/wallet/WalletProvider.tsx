'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useWallet, type WalletState } from '@/hooks/useWallet';

interface WalletContextValue {
  state: WalletState;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToHederaTestnet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();

  return (
    <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>
  );
}

export function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWalletContext must be used within a WalletProvider');
  }
  return ctx;
}
