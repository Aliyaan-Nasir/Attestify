'use client';

import { useState } from 'react';
import { XCircle, CheckCircle2, Copy, ArrowRight, Send } from 'lucide-react';
import { useWalletContext } from '@/components/wallet/WalletProvider';
import { useContract } from '@/hooks/useContract';
import { DEPLOYED_ADDRESSES } from '@/lib/contracts';
import { FormWrapper } from '@/components/sandbox/FormWrapper';
import { TransactionStatus, type TxStatus } from '@/components/sandbox/TransactionStatus';

const STEPS = [
  { label: 'Configure', icon: XCircle },
  { label: 'Submit', icon: Send },
  { label: 'Complete', icon: CheckCircle2 },
];

export default function DelegatedRevocationPage() {
  const { state } = useWalletContext();
  const contracts = useContract();
  const [step, setStep] = useState(0);
  const [attestationUid, setAttestationUid] = useState('');
  const [status, setStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!contracts || !state.isConnected || !attestationUid.trim()) return;
    setStatus('loading'); setTxHash(null); setError(null);
    try {
      const service = await contracts.getAttestationService(true);
      const tx = await service.revokeOnBehalf(attestationUid.trim());
      const receipt = await tx.wait();
      setTxHash(receipt.hash); setStatus('success'); setStep(2);
    } catch (err: unknown) {
      const { parseContractError } = await import('@/lib/parseContractError');
      setError(parseContractError(err)); setStatus('error');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500"><XCircle className="h-5 w-5" /></div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-surface-900">Delegated Revocation</h1>
            <span className="rounded-full bg-red-500 px-3 py-0.5 text-xs font-medium text-white">Intermediate</span>
          </div>
          <p className="mt-1 text-sm text-surface-500">Revoke attestations on behalf of the original attester. You must be an authorized delegate of the attester.</p>
          <p className="mt-1 font-mono text-xs text-surface-400">Contract: {DEPLOYED_ADDRESSES.AttestationService}</p>
        </div>
      </div>

      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${i <= step ? 'bg-red-500 text-white' : 'bg-surface-200 text-surface-400'}`}><s.icon className="h-4 w-4" /></div>
            <span className={`text-sm ${i <= step ? 'font-medium text-surface-900' : 'text-surface-400'}`}>{s.label}</span>
            {i < STEPS.length - 1 && <ArrowRight className="mx-2 h-4 w-4 text-surface-300" />}
          </div>
        ))}
      </div>

      <FormWrapper>
        {step === 0 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600">
              You must be an authorized delegate of the original attester. Use the Delegated Attestation page to manage delegates.
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">Attestation UID</label>
              <input type="text" value={attestationUid} onChange={(e) => setAttestationUid(e.target.value)}
                placeholder="0x..." className="w-full rounded-lg border border-surface-200 px-4 py-2.5 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <p className="mt-1 text-xs text-surface-400">The attestation must have been created by an authority who delegated you.</p>
            </div>
            <button onClick={() => setStep(1)} disabled={!attestationUid.trim()}
              className="flex items-center gap-2 rounded-lg bg-red-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-50 p-4">
              <p className="text-sm font-medium text-surface-700">Delegated Revocation</p>
              <p className="mt-1 font-mono text-xs text-surface-500 break-all">{attestationUid}</p>
            </div>
            <TransactionStatus status={status} txHash={txHash} error={error} />
            <div className="flex gap-3">
              <button onClick={() => { setStep(0); setStatus('idle'); }} className="rounded-lg bg-surface-100 px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-200">Back</button>
              <button onClick={handleSubmit} disabled={status === 'loading' || !state.isConnected}
                className="flex items-center gap-2 rounded-lg bg-red-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">
                <Send className="h-4 w-4" /> {status === 'loading' ? 'Revoking...' : 'Revoke On Behalf'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-sm font-medium text-green-700">✓ Attestation revoked successfully via delegation</p>
            </div>
            {txHash && (
              <div className="flex items-center gap-2 rounded-lg bg-surface-50 p-3">
                <span className="font-mono text-xs text-surface-500 truncate">{txHash}</span>
                <button onClick={() => navigator.clipboard.writeText(txHash)} className="text-surface-400 hover:text-surface-600"><Copy className="h-4 w-4" /></button>
              </div>
            )}
            <button onClick={() => { setStep(0); setStatus('idle'); setTxHash(null); }}
              className="rounded-lg bg-red-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-600">Start Over</button>
          </div>
        )}
      </FormWrapper>
    </div>
  );
}
