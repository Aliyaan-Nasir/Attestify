'use client';

import { useState } from 'react';
import { UserCheck, CheckCircle2, Copy, FileCode2, Send, ArrowRight } from 'lucide-react';
import { useWalletContext } from '@/components/wallet/WalletProvider';
import { useContract } from '@/hooks/useContract';
import { FormWrapper } from '@/components/sandbox/FormWrapper';
import { TransactionStatus, type TxStatus } from '@/components/sandbox/TransactionStatus';

const STEPS = [
  { label: 'Enter Details', icon: FileCode2 },
  { label: 'Register', icon: Send },
  { label: 'Complete', icon: CheckCircle2 },
];

export default function RegisterAuthorityPage() {
  const { state } = useWalletContext();
  const contracts = useContract();
  const [step, setStep] = useState(0);
  const [metadata, setMetadata] = useState('');
  const [status, setStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!contracts || !state.isConnected || !metadata.trim()) return;
    setStatus('loading'); setTxHash(null); setError(null);
    try {
      const service = await contracts.getAttestationService(true);
      const tx = await service.registerAuthority(metadata.trim());
      const receipt = await tx.wait();
      setTxHash(receipt.hash); setStatus('success'); setStep(2);
    } catch (err: unknown) {
      setError((err as Error).message || 'Transaction failed'); setStatus('error');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500"><UserCheck className="h-5 w-5" /></div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-surface-900">Register Authority</h1>
            <span className="rounded-full bg-brand-500 px-3 py-0.5 text-xs font-medium text-white">Core Workflow</span>
          </div>
          <p className="mt-1 text-sm text-surface-500">Register your address as a trusted authority with metadata.</p>
        </div>
      </div>

      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${i <= step ? 'bg-brand-500 text-white' : 'bg-surface-200 text-surface-400'}`}><s.icon className="h-4 w-4" /></div>
              <span className={`text-sm ${i <= step ? 'font-medium text-surface-900' : 'text-surface-400'}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <ArrowRight className="mx-2 h-4 w-4 text-surface-300" />}
          </div>
        ))}
      </div>

      <FormWrapper>
        {state.isConnected && state.address && (
          <div className="mb-6 flex items-center gap-2 rounded-md border border-green-100 bg-green-50 px-4 py-2.5">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700">Connected:</span>
            <span className="font-mono text-sm text-green-700">{state.address.slice(0, 6)}...{state.address.slice(-4)}</span>
            <button type="button" onClick={() => navigator.clipboard.writeText(state.address!)} className="ml-1 text-green-500 hover:text-green-700" aria-label="Copy address"><Copy className="h-3.5 w-3.5" /></button>
          </div>
        )}

        {step === 0 && (
          <div>
            <div className="max-w-lg rounded-lg border border-surface-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold text-surface-900">Authority Details</h2>
              <label className="mb-1.5 block text-sm text-surface-600">Metadata</label>
              <input type="text" placeholder="e.g. KYC Provider, University, DAO" value={metadata} onChange={(e) => setMetadata(e.target.value)}
                className="w-full rounded-md border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <p className="mt-1.5 text-xs text-surface-400">Descriptive label for your authority (stored on-chain)</p>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-sm text-surface-400">Step 1 of 3</span>
              <button type="button" onClick={() => setStep(1)} disabled={!metadata.trim()}
                className="rounded-md bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="max-w-lg rounded-lg border border-surface-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold text-surface-900">Confirm Registration</h2>
              <p className="mb-4 text-sm text-surface-500">Register your connected wallet as a trusted authority on the Hedera network.</p>
              <div className="mb-4 rounded-md border border-surface-200 bg-surface-50 p-3">
                <p className="text-xs font-medium text-surface-500">Metadata</p>
                <p className="text-sm text-surface-700">{metadata}</p>
              </div>
              <div className="mb-4 rounded-md border border-surface-200 bg-surface-50 p-3">
                <p className="text-xs font-medium text-surface-500">Authority Address</p>
                <code className="text-xs text-surface-700">{state.address}</code>
              </div>
              <TransactionStatus status={status} txHash={txHash} error={error} />
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button type="button" onClick={() => setStep(0)} disabled={status === 'loading'} className="text-sm text-surface-500 hover:text-surface-700">Previous</button>
              <button type="button" onClick={handleRegister} disabled={status === 'loading' || !state.isConnected}
                className="rounded-md bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
                {status === 'loading' ? 'Registering...' : 'Register Authority'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="max-w-lg rounded-lg border border-green-200 bg-green-50 p-6">
              <div className="mb-3 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /><h2 className="text-sm font-semibold text-green-700">Authority Registered</h2></div>
              <p className="mb-4 text-sm text-green-600">Your address has been registered as an authority on-chain.</p>
              {txHash && (<div className="rounded-md border border-green-200 bg-white p-3"><p className="mb-1 text-xs font-medium text-surface-500">Transaction</p><a href={`https://hashscan.io/testnet/transaction/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">View on HashScan</a></div>)}
            </div>
            <div className="mt-6"><button type="button" onClick={() => { setStep(0); setMetadata(''); setStatus('idle'); setTxHash(null); setError(null); }}
              className="rounded-md border border-surface-200 bg-white px-6 py-2.5 text-sm font-medium text-surface-600 hover:bg-surface-50">Register Another</button></div>
          </div>
        )}
      </FormWrapper>
    </div>
  );
}
