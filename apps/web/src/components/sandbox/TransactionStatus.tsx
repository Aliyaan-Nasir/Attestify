'use client';

import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

export type TxStatus = 'idle' | 'loading' | 'success' | 'error';

interface TransactionStatusProps {
  status: TxStatus;
  txHash?: string | null;
  uid?: string | null;
  uidLabel?: string;
  error?: string | null;
}

export function TransactionStatus({ status, txHash, uid, uidLabel = 'UID', error }: TransactionStatusProps) {
  if (status === 'idle') return null;

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-3 rounded-md border border-surface-200 bg-white p-4" data-testid="tx-loading">
        <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
        <span className="text-sm text-surface-600">Processing transaction...</span>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="space-y-2 rounded-md border border-green-200 bg-green-50 p-4" data-testid="tx-success">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium text-green-700">Transaction successful</span>
        </div>
        {txHash && (
          <div className="text-sm">
            <span className="text-green-600">Tx Hash: </span>
            <a
              href={`https://hashscan.io/testnet/transaction/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-brand-600 hover:underline"
            >
              {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </a>
          </div>
        )}
        {uid && (
          <div className="text-sm">
            <span className="text-green-600">{uidLabel}: </span>
            <span className="font-mono text-surface-700">{uid.slice(0, 10)}...{uid.slice(-8)}</span>
          </div>
        )}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4" data-testid="tx-error">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
        <div>
          <p className="text-sm font-medium text-red-700">Transaction failed</p>
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    );
  }

  return null;
}
