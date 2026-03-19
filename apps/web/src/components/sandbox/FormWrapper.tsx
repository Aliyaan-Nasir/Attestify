'use client';

import { Wallet } from 'lucide-react';
import { useWalletContext } from '@/components/wallet/WalletProvider';

interface FormWrapperProps {
  children: React.ReactNode;
}

export function FormWrapper({ children }: FormWrapperProps) {
  const { state } = useWalletContext();

  if (!state.isConnected) {
    return (
      <div
        className="flex items-center rounded-lg border border-surface-200 bg-white px-8 py-10"
        data-testid="connect-prompt"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-100">
            <Wallet className="h-5 w-5 text-surface-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-900">Wallet Required</p>
            <p className="text-sm text-surface-500">
              Connect your MetaMask wallet to interact with Hedera contracts on-chain.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
