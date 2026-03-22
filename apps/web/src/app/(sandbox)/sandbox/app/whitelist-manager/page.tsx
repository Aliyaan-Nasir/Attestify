'use client';

import { useState } from 'react';
import { List, CheckCircle2, Copy, ArrowRight, Send, XCircle } from 'lucide-react';
import { useWalletContext } from '@/components/wallet/WalletProvider';
import { useContract } from '@/hooks/useContract';
import { DEPLOYED_ADDRESSES } from '@/lib/contracts';
import { FormWrapper } from '@/components/sandbox/FormWrapper';
import { TransactionStatus, type TxStatus } from '@/components/sandbox/TransactionStatus';

const STEPS = [
  { label: 'Configure', icon: List },
  { label: 'Submit', icon: Send },
  { label: 'Complete', icon: CheckCircle2 },
];

export default function WhitelistManagerPage() {
  const { state } = useWalletContext();
  const contracts = useContract();
  const [step, setStep] = useState(0);
  const [targetAddress, setTargetAddress] = useState('');
  const [action, setAction] = useState<'add' | 'remove'>('add');
  const [checkAddress, setCheckAddress] = useState('');
  const [checkResult, setCheckResult] = useState<boolean | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [status, setStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!contracts || !state.isConnected || !targetAddress.trim()) return;
    setStatus('loading'); setTxHash(null); setError(null);
    try {
      const resolver = await contracts.getWhitelistResolver(true);
      const tx = action === 'add'
        ? await resolver.addAddress(targetAddress.trim())
        : await resolver.removeAddress(targetAddress.trim());
      const receipt = await tx.wait();
      setTxHash(receipt.hash); setStatus('success'); setStep(2);
    } catch (err: unknown) {
      const { parseContractError } = await import('@/lib/parseContractError');
      setError(parseContractError(err)); setStatus('error');
    }
  };

  const handleCheck = async () => {
    if (!contracts || !checkAddress.trim()) return;
    setCheckLoading(true); setCheckResult(null);
    try {
      const resolver = await contracts.getWhitelistResolver(false);
      const result = await resolver.whitelisted(checkAddress.trim());
      setCheckResult(result);
    } catch { setCheckResult(null); }
    finally { setCheckLoading(false); }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500"><List className="h-5 w-5" /></div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-surface-900">Whitelist Manager</h1>
            <span className="rounded-full bg-amber-500 px-3 py-0.5 text-xs font-medium text-white">Admin Only</span>
          </div>
          <p className="mt-1 text-sm text-surface-500">Add or remove addresses from the WhitelistResolver. Only the resolver owner can manage the whitelist.</p>
          <p className="mt-1 font-mono text-xs text-surface-400">Contract: {DEPLOYED_ADDRESSES.WhitelistResolver}</p>
        </div>
      </div>

      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${i <= step ? 'bg-brand-500 text-white' : 'bg-surface-200 text-surface-400'}`}><s.icon className="h-4 w-4" /></div>
            <span className={`text-sm ${i <= step ? 'font-medium text-surface-900' : 'text-surface-400'}`}>{s.label}</span>
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
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg border border-surface-200 bg-white p-6">
                <h2 className="mb-4 text-sm font-semibold text-surface-900">Manage Whitelist</h2>
                <div className="mb-4">
                  <label className="mb-1.5 block text-sm text-surface-600">Address</label>
                  <input type="text" placeholder="0x..." value={targetAddress} onChange={(e) => setTargetAddress(e.target.value)}
                    className="w-full rounded-md border border-surface-200 bg-white px-3 py-2 font-mono text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={action === 'add'} onChange={() => setAction('add')} className="text-brand-500 focus:ring-brand-500" />
                    <span className="text-sm text-surface-600">Add to whitelist</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={action === 'remove'} onChange={() => setAction('remove')} className="text-red-500 focus:ring-red-500" />
                    <span className="text-sm text-surface-600">Remove from whitelist</span>
                  </label>
                </div>
              </div>

              <div className="rounded-lg border border-surface-200 bg-white p-6">
                <h2 className="mb-4 text-sm font-semibold text-surface-900">Check Whitelist Status</h2>
                <div className="mb-4">
                  <label className="mb-1.5 block text-sm text-surface-600">Address to check</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="0x..." value={checkAddress} onChange={(e) => { setCheckAddress(e.target.value); setCheckResult(null); }}
                      className="flex-1 rounded-md border border-surface-200 bg-white px-3 py-2 font-mono text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    <button type="button" onClick={handleCheck} disabled={!checkAddress.trim() || checkLoading}
                      className="rounded-md bg-surface-100 px-3 py-2 text-sm font-medium text-surface-600 hover:bg-surface-200 disabled:opacity-50">
                      {checkLoading ? '...' : 'Check'}
                    </button>
                  </div>
                </div>
                {checkResult !== null && (
                  <div className={`flex items-center gap-2 rounded-md p-3 ${checkResult ? 'border border-green-200 bg-green-50' : 'border border-red-200 bg-red-50'}`}>
                    {checkResult ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-500" />}
                    <span className={`text-sm ${checkResult ? 'text-green-700' : 'text-red-600'}`}>
                      {checkResult ? 'Address is whitelisted' : 'Address is NOT whitelisted'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-sm text-surface-400">Step 1 of 3</span>
              <button type="button" onClick={() => setStep(1)} disabled={!targetAddress.trim()}
                className="rounded-md bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="max-w-lg rounded-lg border border-surface-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold text-surface-900">Confirm Action</h2>
              <div className="mb-4 rounded-md border border-surface-200 bg-surface-50 p-3">
                <p className="text-xs font-medium text-surface-500">Address</p>
                <code className="break-all text-xs text-surface-700">{targetAddress}</code>
              </div>
              <div className="mb-4 rounded-md border border-surface-200 bg-surface-50 p-3">
                <p className="text-xs font-medium text-surface-500">Action</p>
                <p className="text-sm text-surface-700">{action === 'add' ? 'Add to Whitelist' : 'Remove from Whitelist'}</p>
              </div>
              <TransactionStatus status={status} txHash={txHash} error={error} />
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button type="button" onClick={() => setStep(0)} disabled={status === 'loading'} className="text-sm text-surface-500 hover:text-surface-700">Previous</button>
              <button type="button" onClick={handleSubmit} disabled={status === 'loading' || !state.isConnected}
                className={`rounded-md px-6 py-2.5 text-sm font-medium text-white ${action === 'add' ? 'bg-brand-500 hover:bg-brand-600' : 'bg-red-500 hover:bg-red-600'} disabled:opacity-50`}>
                {status === 'loading' ? 'Processing...' : action === 'add' ? 'Add to Whitelist' : 'Remove from Whitelist'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="max-w-lg rounded-lg border border-green-200 bg-green-50 p-6">
              <div className="mb-3 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /><h2 className="text-sm font-semibold text-green-700">{action === 'add' ? 'Address Whitelisted' : 'Address Removed'}</h2></div>
              <p className="mb-4 text-sm text-green-600">{action === 'add' ? 'The address has been added to the whitelist.' : 'The address has been removed from the whitelist.'}</p>
              {txHash && (<div className="rounded-md border border-green-200 bg-white p-3"><p className="mb-1 text-xs font-medium text-surface-500">Transaction</p><a href={`https://hashscan.io/testnet/transaction/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">View on HashScan</a></div>)}
            </div>
            <div className="mt-6"><button type="button" onClick={() => { setStep(0); setTargetAddress(''); setStatus('idle'); setTxHash(null); setError(null); }}
              className="rounded-md border border-surface-200 bg-white px-6 py-2.5 text-sm font-medium text-surface-600 hover:bg-surface-50">Manage Another</button></div>
          </div>
        )}
      </FormWrapper>
    </div>
  );
}
