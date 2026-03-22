'use client';

import { useState, useCallback } from 'react';
import { GitMerge, CheckCircle2, Copy, ArrowRight, Send, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { useWalletContext } from '@/components/wallet/WalletProvider';
import { useContract } from '@/hooks/useContract';
import { FormWrapper } from '@/components/sandbox/FormWrapper';
import { TransactionStatus, type TxStatus } from '@/components/sandbox/TransactionStatus';

const STEPS = [
  { label: 'Configure', icon: GitMerge },
  { label: 'Submit', icon: Send },
  { label: 'Complete', icon: CheckCircle2 },
];

export default function CrossContractPage() {
  const { state } = useWalletContext();
  const contracts = useContract();
  const [step, setStep] = useState(0);
  const [resolverAddress, setResolverAddress] = useState('');
  const [pipelineAddresses, setPipelineAddresses] = useState<string[]>(['']);
  const [currentPipeline, setCurrentPipeline] = useState<string[] | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [status, setStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPipeline = useCallback(async () => {
    if (!contracts || !resolverAddress.trim()) return;
    setInfoLoading(true);
    try {
      const resolver = await contracts.getCrossContractResolver(resolverAddress.trim(), false);
      const pipeline = await resolver.getPipeline();
      setCurrentPipeline([...pipeline]);
    } catch { setCurrentPipeline(null); }
    finally { setInfoLoading(false); }
  }, [contracts, resolverAddress]);

  const addPipelineSlot = () => setPipelineAddresses([...pipelineAddresses, '']);
  const removePipelineSlot = (i: number) => setPipelineAddresses(pipelineAddresses.filter((_, idx) => idx !== i));
  const updatePipelineSlot = (i: number, val: string) => {
    const updated = [...pipelineAddresses];
    updated[i] = val;
    setPipelineAddresses(updated);
  };

  const handleSubmit = async () => {
    if (!contracts || !state.isConnected || !resolverAddress.trim()) return;
    const resolvers = pipelineAddresses.map(a => a.trim()).filter(Boolean);
    if (resolvers.length === 0) return;
    setStatus('loading'); setTxHash(null); setError(null);
    try {
      const resolver = await contracts.getCrossContractResolver(resolverAddress.trim(), true);
      const tx = await resolver.setPipeline(resolvers);
      const receipt = await tx.wait();
      setTxHash(receipt.hash); setStatus('success'); setStep(2);
      loadPipeline();
    } catch (err: unknown) {
      const { parseContractError } = await import('@/lib/parseContractError');
      setError(parseContractError(err)); setStatus('error');
    }
  };

  const validPipeline = pipelineAddresses.filter(a => a.trim()).length > 0;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-500"><GitMerge className="h-5 w-5" /></div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-surface-900">Cross-Contract Resolver</h1>
            <span className="rounded-full bg-violet-500 px-3 py-0.5 text-xs font-medium text-white">Expert</span>
          </div>
          <p className="mt-1 text-sm text-surface-500">Configure a pipeline of resolvers that run in sequence. All must approve for the attestation to proceed. Chain whitelist + fee + token gate checks.</p>
        </div>
      </div>

      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${i <= step ? 'bg-violet-500 text-white' : 'bg-surface-200 text-surface-400'}`}><s.icon className="h-4 w-4" /></div>
            <span className={`text-sm ${i <= step ? 'font-medium text-surface-900' : 'text-surface-400'}`}>{s.label}</span>
            {i < STEPS.length - 1 && <ArrowRight className="mx-2 h-4 w-4 text-surface-300" />}
          </div>
        ))}
      </div>

      <FormWrapper>
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">CrossContractResolver Address</label>
              <div className="flex gap-2">
                <input type="text" value={resolverAddress} onChange={(e) => setResolverAddress(e.target.value)}
                  placeholder="0x..." className="flex-1 rounded-lg border border-surface-200 px-4 py-2.5 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                <button onClick={loadPipeline} disabled={infoLoading || !resolverAddress.trim()}
                  className="flex items-center gap-1 rounded-lg bg-surface-100 px-3 py-2 text-sm text-surface-600 hover:bg-surface-200 disabled:opacity-50">
                  <RefreshCw className={`h-4 w-4 ${infoLoading ? 'animate-spin' : ''}`} /> Load
                </button>
              </div>
            </div>

            {currentPipeline && (
              <div className="rounded-lg bg-violet-50 p-3">
                <p className="text-xs font-medium text-violet-700">Current Pipeline ({currentPipeline.length} resolvers):</p>
                {currentPipeline.map((addr, i) => (
                  <p key={i} className="mt-1 font-mono text-xs text-violet-600">{i + 1}. {addr}</p>
                ))}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-surface-700">New Pipeline (ordered)</label>
              {pipelineAddresses.map((addr, i) => (
                <div key={i} className="mb-2 flex items-center gap-2">
                  <span className="w-6 text-center text-xs text-surface-400">{i + 1}.</span>
                  <input type="text" value={addr} onChange={(e) => updatePipelineSlot(i, e.target.value)}
                    placeholder="Resolver address 0x..." className="flex-1 rounded-lg border border-surface-200 px-4 py-2.5 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  {pipelineAddresses.length > 1 && (
                    <button onClick={() => removePipelineSlot(i)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              ))}
              <button onClick={addPipelineSlot} className="flex items-center gap-1 text-sm text-brand-500 hover:text-brand-600">
                <Plus className="h-4 w-4" /> Add Resolver
              </button>
            </div>

            <button onClick={() => setStep(1)} disabled={!resolverAddress.trim() || !validPipeline}
              className="flex items-center gap-2 rounded-lg bg-violet-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50">
              Set Pipeline <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-50 p-4">
              <p className="text-sm font-medium text-surface-700">Set Pipeline ({pipelineAddresses.filter(a => a.trim()).length} resolvers)</p>
              {pipelineAddresses.filter(a => a.trim()).map((addr, i) => (
                <p key={i} className="mt-1 font-mono text-xs text-surface-500">{i + 1}. {addr.trim()}</p>
              ))}
            </div>
            <TransactionStatus status={status} txHash={txHash} error={error} />
            <div className="flex gap-3">
              <button onClick={() => { setStep(0); setStatus('idle'); }} className="rounded-lg bg-surface-100 px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-200">Back</button>
              <button onClick={handleSubmit} disabled={status === 'loading' || !state.isConnected}
                className="flex items-center gap-2 rounded-lg bg-violet-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50">
                <Send className="h-4 w-4" /> {status === 'loading' ? 'Submitting...' : 'Submit Transaction'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-sm font-medium text-green-700">✓ Pipeline configured successfully</p>
            </div>
            {txHash && (
              <div className="flex items-center gap-2 rounded-lg bg-surface-50 p-3">
                <span className="font-mono text-xs text-surface-500 truncate">{txHash}</span>
                <button onClick={() => navigator.clipboard.writeText(txHash)} className="text-surface-400 hover:text-surface-600"><Copy className="h-4 w-4" /></button>
              </div>
            )}
            <button onClick={() => { setStep(0); setStatus('idle'); setTxHash(null); }}
              className="rounded-lg bg-violet-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-violet-600">Start Over</button>
          </div>
        )}
      </FormWrapper>
    </div>
  );
}
