'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Coins, CheckCircle2, Copy, ArrowRight, Send, RefreshCw } from 'lucide-react';
import { useWalletContext } from '@/components/wallet/WalletProvider';
import { useContract } from '@/hooks/useContract';
import { DEPLOYED_ADDRESSES } from '@/lib/contracts';
import { FormWrapper } from '@/components/sandbox/FormWrapper';
import { TransactionStatus, type TxStatus } from '@/components/sandbox/TransactionStatus';

const STEPS = [
  { label: 'Deposit', icon: Coins },
  { label: 'Confirm', icon: Send },
  { label: 'Complete', icon: CheckCircle2 },
];

export default function FeeResolverPage() {
  const { state } = useWalletContext();
  const contracts = useContract();
  const [step, setStep] = useState(0);
  const [depositAmount, setDepositAmount] = useState('');
  const [currentFee, setCurrentFee] = useState<string | null>(null);
  const [myBalance, setMyBalance] = useState<string | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [status, setStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInfo = useCallback(async () => {
    if (!contracts) return;
    setInfoLoading(true);
    try {
      const resolver = await contracts.getFeeResolver(false);
      const fee = await resolver.fee();
      setCurrentFee(ethers.formatEther(fee));
      if (state.address) {
        const bal = await resolver.balances(state.address);
        setMyBalance(ethers.formatEther(bal));
      }
    } catch { /* ignore */ }
    finally { setInfoLoading(false); }
  }, [contracts, state.address]);

  useEffect(() => { loadInfo(); }, [loadInfo]);

  const handleDeposit = async () => {
    if (!contracts || !state.isConnected || !depositAmount) return;
    setStatus('loading'); setTxHash(null); setError(null);
    try {
      const resolver = await contracts.getFeeResolver(true);
      const tx = await resolver.deposit({ value: ethers.parseEther(depositAmount) });
      const receipt = await tx.wait();
      setTxHash(receipt.hash); setStatus('success'); setStep(2);
      loadInfo();
    } catch (err: unknown) {
      const { parseContractError } = await import('@/lib/parseContractError');
      setError(parseContractError(err)); setStatus('error');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500"><Coins className="h-5 w-5" /></div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-surface-900">Fee Resolver</h1>
            <span className="rounded-full bg-brand-500 px-3 py-0.5 text-xs font-medium text-white">Resolver</span>
          </div>
          <p className="mt-1 text-sm text-surface-500">Deposit HBAR to cover attestation fees for schemas using the Fee Resolver.</p>
          <p className="mt-1 font-mono text-xs text-surface-400">Contract: {DEPLOYED_ADDRESSES.FeeResolver}</p>
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
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-surface-900">Resolver Info</h2>
                  <button type="button" onClick={loadInfo} disabled={infoLoading} className="text-surface-400 hover:text-surface-600" aria-label="Refresh">
                    <RefreshCw className={`h-4 w-4 ${infoLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="rounded-md border border-surface-200 bg-surface-50 p-3">
                    <p className="text-xs font-medium text-surface-500">Required Fee per Attestation</p>
                    <p className="text-lg font-semibold text-surface-900">{currentFee !== null ? `${currentFee} HBAR` : '—'}</p>
                  </div>
                  <div className="rounded-md border border-surface-200 bg-surface-50 p-3">
                    <p className="text-xs font-medium text-surface-500">Your Deposited Balance</p>
                    <p className="text-lg font-semibold text-surface-900">{myBalance !== null ? `${myBalance} HBAR` : '—'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-surface-200 bg-white p-6">
                <h2 className="mb-4 text-sm font-semibold text-surface-900">Deposit HBAR</h2>
                <label className="mb-1.5 block text-sm text-surface-600">Amount (HBAR)</label>
                <input type="text" placeholder="e.g. 1.0" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full rounded-md border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                <p className="mt-1.5 text-xs text-surface-400">Deposit HBAR to cover future attestation fees on schemas using this resolver.</p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-sm text-surface-400">Step 1 of 3</span>
              <button type="button" onClick={() => setStep(1)} disabled={!depositAmount}
                className="rounded-md bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="max-w-lg rounded-lg border border-surface-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold text-surface-900">Confirm Deposit</h2>
              <div className="mb-4 rounded-md border border-surface-200 bg-surface-50 p-3">
                <p className="text-xs font-medium text-surface-500">Deposit Amount</p>
                <p className="text-lg font-semibold text-surface-700">{depositAmount} HBAR</p>
              </div>
              <TransactionStatus status={status} txHash={txHash} error={error} />
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button type="button" onClick={() => setStep(0)} disabled={status === 'loading'} className="text-sm text-surface-500 hover:text-surface-700">Previous</button>
              <button type="button" onClick={handleDeposit} disabled={status === 'loading' || !state.isConnected}
                className="rounded-md bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
                {status === 'loading' ? 'Depositing...' : 'Deposit HBAR'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="max-w-lg rounded-lg border border-green-200 bg-green-50 p-6">
              <div className="mb-3 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /><h2 className="text-sm font-semibold text-green-700">Deposit Successful</h2></div>
              <p className="mb-4 text-sm text-green-600">Your HBAR has been deposited into the Fee Resolver.</p>
              {myBalance && <p className="mb-4 text-sm text-green-600">New balance: {myBalance} HBAR</p>}
              {txHash && (<div className="rounded-md border border-green-200 bg-white p-3"><p className="mb-1 text-xs font-medium text-surface-500">Transaction</p><a href={`https://hashscan.io/testnet/transaction/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">View on HashScan</a></div>)}
            </div>
            <div className="mt-6"><button type="button" onClick={() => { setStep(0); setDepositAmount(''); setStatus('idle'); setTxHash(null); setError(null); }}
              className="rounded-md border border-surface-200 bg-white px-6 py-2.5 text-sm font-medium text-surface-600 hover:bg-surface-50">Deposit More</button></div>
          </div>
        )}
      </FormWrapper>
    </div>
  );
}
