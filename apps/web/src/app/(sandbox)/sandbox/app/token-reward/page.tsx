'use client';

import { useState, useEffect, useCallback } from 'react';
import { Gift, CheckCircle2, Copy, ArrowRight, Send, RefreshCw } from 'lucide-react';
import { useWalletContext } from '@/components/wallet/WalletProvider';
import { useContract } from '@/hooks/useContract';
import { FormWrapper } from '@/components/sandbox/FormWrapper';
import { TransactionStatus, type TxStatus } from '@/components/sandbox/TransactionStatus';

const STEPS = [
  { label: 'Configure', icon: Gift },
  { label: 'Submit', icon: Send },
  { label: 'Complete', icon: CheckCircle2 },
];

export default function TokenRewardPage() {
  const { state } = useWalletContext();
  const contracts = useContract();
  const [step, setStep] = useState(0);
  const [resolverAddress, setResolverAddress] = useState('');
  const [rewardToken, setRewardToken] = useState('');
  const [rewardAmount, setRewardAmount] = useState('');
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [currentAmount, setCurrentAmount] = useState<string | null>(null);
  const [checkSubject, setCheckSubject] = useState('');
  const [distributed, setDistributed] = useState<string | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [status, setStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInfo = useCallback(async () => {
    if (!contracts || !resolverAddress.trim()) return;
    setInfoLoading(true);
    try {
      const resolver = await contracts.getTokenRewardResolver(resolverAddress.trim(), false);
      const [token, amount] = await Promise.all([resolver.rewardToken(), resolver.rewardAmount()]);
      setCurrentToken(token); setCurrentAmount(String(amount));
    } catch { setCurrentToken(null); setCurrentAmount(null); }
    finally { setInfoLoading(false); }
  }, [contracts, resolverAddress]);

  const handleCheckDistributed = async () => {
    if (!contracts || !resolverAddress.trim() || !checkSubject.trim()) return;
    try {
      const resolver = await contracts.getTokenRewardResolver(resolverAddress.trim(), false);
      const d = await resolver.rewardsDistributed(checkSubject.trim());
      setDistributed(String(d));
    } catch { setDistributed(null); }
  };

  const handleSubmit = async () => {
    if (!contracts || !state.isConnected || !resolverAddress.trim()) return;
    setStatus('loading'); setTxHash(null); setError(null);
    try {
      const resolver = await contracts.getTokenRewardResolver(resolverAddress.trim(), true);
      const tx = await resolver.setRewardConfig(rewardToken.trim(), rewardAmount);
      const receipt = await tx.wait();
      setTxHash(receipt.hash); setStatus('success'); setStep(2);
      loadInfo();
    } catch (err: unknown) {
      setError((err as Error).message || 'Transaction failed'); setStatus('error');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500"><Gift className="h-5 w-5" /></div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-surface-900">Token Reward Resolver</h1>
            <span className="rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-medium text-white">Advanced</span>
          </div>
          <p className="mt-1 text-sm text-surface-500">Configure a resolver that automatically rewards attestation subjects with HTS tokens. When someone receives an attestation, they get tokens.</p>
        </div>
      </div>

      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${i <= step ? 'bg-emerald-500 text-white' : 'bg-surface-200 text-surface-400'}`}><s.icon className="h-4 w-4" /></div>
            <span className={`text-sm ${i <= step ? 'font-medium text-surface-900' : 'text-surface-400'}`}>{s.label}</span>
            {i < STEPS.length - 1 && <ArrowRight className="mx-2 h-4 w-4 text-surface-300" />}
          </div>
        ))}
      </div>

      <FormWrapper>
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">TokenRewardResolver Address</label>
              <div className="flex gap-2">
                <input type="text" value={resolverAddress} onChange={(e) => setResolverAddress(e.target.value)}
                  placeholder="0x..." className="flex-1 rounded-lg border border-surface-200 px-4 py-2.5 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                <button onClick={loadInfo} disabled={infoLoading || !resolverAddress.trim()}
                  className="flex items-center gap-1 rounded-lg bg-surface-100 px-3 py-2 text-sm text-surface-600 hover:bg-surface-200 disabled:opacity-50">
                  <RefreshCw className={`h-4 w-4 ${infoLoading ? 'animate-spin' : ''}`} /> Load
                </button>
              </div>
            </div>

            {currentToken && (
              <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
                <p>Current Token: <span className="font-mono">{currentToken}</span></p>
                <p>Reward Amount: <span className="font-mono">{currentAmount}</span></p>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">Reward Token Address</label>
              <input type="text" value={rewardToken} onChange={(e) => setRewardToken(e.target.value)}
                placeholder="0x... (HTS token)" className="w-full rounded-lg border border-surface-200 px-4 py-2.5 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">Reward Amount (per attestation)</label>
              <input type="text" value={rewardAmount} onChange={(e) => setRewardAmount(e.target.value)}
                placeholder="e.g. 100" className="w-full rounded-lg border border-surface-200 px-4 py-2.5 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>

            <div className="border-t border-surface-200 pt-4">
              <label className="mb-1 block text-sm font-medium text-surface-700">Check Rewards Distributed</label>
              <div className="flex gap-2">
                <input type="text" value={checkSubject} onChange={(e) => setCheckSubject(e.target.value)}
                  placeholder="Subject address" className="flex-1 rounded-lg border border-surface-200 px-4 py-2.5 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                <button onClick={handleCheckDistributed} disabled={!checkSubject.trim() || !resolverAddress.trim()}
                  className="rounded-lg bg-surface-100 px-3 py-2 text-sm text-surface-600 hover:bg-surface-200 disabled:opacity-50">Check</button>
              </div>
              {distributed !== null && (
                <p className="mt-2 text-sm text-emerald-600">Total distributed: <span className="font-mono">{distributed}</span> tokens</p>
              )}
            </div>

            <button onClick={() => setStep(1)} disabled={!resolverAddress.trim() || !rewardToken.trim() || !rewardAmount}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50">
              Configure Reward <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-50 p-4">
              <p className="text-sm font-medium text-surface-700">Set Reward Config</p>
              <p className="mt-1 font-mono text-xs text-surface-500">Token: {rewardToken}</p>
              <p className="font-mono text-xs text-surface-500">Amount: {rewardAmount}</p>
            </div>
            <TransactionStatus status={status} txHash={txHash} error={error} />
            <div className="flex gap-3">
              <button onClick={() => { setStep(0); setStatus('idle'); }} className="rounded-lg bg-surface-100 px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-200">Back</button>
              <button onClick={handleSubmit} disabled={status === 'loading' || !state.isConnected}
                className="flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50">
                <Send className="h-4 w-4" /> {status === 'loading' ? 'Submitting...' : 'Submit Transaction'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-sm font-medium text-green-700">✓ Reward configuration updated</p>
            </div>
            {txHash && (
              <div className="flex items-center gap-2 rounded-lg bg-surface-50 p-3">
                <span className="font-mono text-xs text-surface-500 truncate">{txHash}</span>
                <button onClick={() => navigator.clipboard.writeText(txHash)} className="text-surface-400 hover:text-surface-600"><Copy className="h-4 w-4" /></button>
              </div>
            )}
            <button onClick={() => { setStep(0); setStatus('idle'); setTxHash(null); }}
              className="rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-600">Start Over</button>
          </div>
        )}
      </FormWrapper>
    </div>
  );
}
