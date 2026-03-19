'use client';

import { useState } from 'react';
import { FileCode2, Plus, ArrowRight, CheckCircle2, Copy, Send } from 'lucide-react';
import { useWalletContext } from '@/components/wallet/WalletProvider';
import { useContract } from '@/hooks/useContract';
import { DEPLOYED_ADDRESSES } from '@/lib/contracts';
import { FormWrapper } from '@/components/sandbox/FormWrapper';
import { SchemaFieldBuilder, type SchemaField } from '@/components/sandbox/SchemaFieldBuilder';
import { TransactionStatus, type TxStatus } from '@/components/sandbox/TransactionStatus';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const RESOLVER_OPTIONS = [
  { label: 'No Resolver', value: '', description: 'No custom validation logic' },
  { label: 'Whitelist Resolver', value: DEPLOYED_ADDRESSES.WhitelistResolver, description: 'Only whitelisted attesters can create attestations' },
  { label: 'Fee Resolver', value: DEPLOYED_ADDRESSES.FeeResolver, description: 'Requires HBAR deposit before attesting' },
  { label: 'Token Gated Resolver', value: DEPLOYED_ADDRESSES.TokenGatedResolver, description: 'Requires minimum HTS token balance' },
  { label: 'Custom', value: 'custom', description: 'Enter a custom resolver address' },
];

const STEPS = [
  { label: 'Define Schema', icon: Plus },
  { label: 'Deploy Schema', icon: Send },
  { label: 'Complete', icon: CheckCircle2 },
];

export default function SchemaBuilderPage() {
  const { state } = useWalletContext();
  const contracts = useContract();

  const [step, setStep] = useState(0);
  const [fields, setFields] = useState<SchemaField[]>([{ name: '', type: 'string' }]);
  const [resolverOption, setResolverOption] = useState('');
  const [customResolver, setCustomResolver] = useState('');
  const [revocable, setRevocable] = useState(true);
  const [status, setStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const definition = fields
    .filter((f) => f.name.trim())
    .map((f) => `${f.type} ${f.name.trim()}`)
    .join(', ');

  const handleDeploy = async () => {
    if (!contracts || !state.isConnected) return;

    setStatus('loading');
    setTxHash(null);
    setUid(null);
    setError(null);

    try {
      const registry = await contracts.getSchemaRegistry(true);
      const resolverAddr = resolverOption === 'custom' ? (customResolver.trim() || ZERO_ADDRESS) : (resolverOption || ZERO_ADDRESS);
      const tx = await registry.register(definition, resolverAddr, revocable);
      const receipt = await tx.wait();

      setTxHash(receipt.hash);

      const iface = registry.interface;
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed && parsed.name === 'SchemaRegistered') {
            setUid(parsed.args[0]);
            break;
          }
        } catch { /* skip */ }
      }

      setStatus('success');
      setStep(2);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Transaction failed');
      setStatus('error');
    }
  };

  const canProceedToStep1 = definition.length > 0;

  return (
    <div className="p-8">
      {/* Header with icon + badge */}
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
          <FileCode2 className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-surface-900">Schema Deployer</h1>
            <span className="rounded-full bg-brand-500 px-3 py-0.5 text-xs font-medium text-white">
              Core Workflow
            </span>
          </div>
          <p className="mt-1 text-sm text-surface-500">
            Create and deploy custom attestation schemas to the Hedera blockchain. Define field structures and data types for your specific use case.
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  i <= step
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-200 text-surface-400'
                }`}
              >
                <s.icon className="h-4 w-4" />
              </div>
              <span
                className={`text-sm ${
                  i <= step ? 'font-medium text-surface-900' : 'text-surface-400'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <ArrowRight className="mx-2 h-4 w-4 text-surface-300" />
            )}
          </div>
        ))}
      </div>

      <FormWrapper>
        {/* Wallet status */}
        {state.isConnected && state.address && (
          <div className="mb-6 flex items-center gap-2 rounded-md border border-green-100 bg-green-50 px-4 py-2.5">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700">Connected:</span>
            <span className="font-mono text-sm text-green-700">
              {state.address.slice(0, 6)}...{state.address.slice(-4)}
            </span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(state.address!)}
              className="ml-1 text-green-500 hover:text-green-700"
              aria-label="Copy address"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Step 0: Define Schema */}
        {step === 0 && (
          <div>
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Left: Schema Details */}
              <div className="rounded-lg border border-surface-200 bg-white p-6">
                <h2 className="mb-4 text-sm font-semibold text-surface-900">Schema Details</h2>

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm text-surface-600">
                    Resolver <span className="text-surface-400">(optional)</span>
                  </label>
                  <select
                    value={resolverOption}
                    onChange={(e) => setResolverOption(e.target.value)}
                    className="w-full rounded-md border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    {RESOLVER_OPTIONS.map((opt) => (
                      <option key={opt.label} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {resolverOption && resolverOption !== 'custom' && (
                    <p className="mt-1 text-xs text-surface-400">
                      {RESOLVER_OPTIONS.find((o) => o.value === resolverOption)?.description}
                    </p>
                  )}
                  {resolverOption === 'custom' && (
                    <input
                      type="text"
                      placeholder={ZERO_ADDRESS}
                      value={customResolver}
                      onChange={(e) => setCustomResolver(e.target.value)}
                      className="mt-2 w-full rounded-md border border-surface-200 bg-white px-3 py-2 font-mono text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  )}
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={revocable}
                    onChange={(e) => setRevocable(e.target.checked)}
                    className="rounded border-surface-300 text-brand-500 focus:ring-brand-500"
                  />
                  <span className="text-sm text-surface-600">Revocable</span>
                </label>

                {definition && (
                  <div className="mt-6 rounded-md border border-surface-200 bg-surface-50 p-4">
                    <p className="mb-1 text-xs font-medium text-surface-500">Preview</p>
                    <p className="text-sm text-surface-600">
                      This schema will be deployed to the Hedera blockchain and can be used to create attestations with the defined structure.
                    </p>
                    <code className="mt-2 block text-xs text-surface-500">{definition}</code>
                  </div>
                )}
              </div>

              {/* Right: Schema Fields */}
              <div className="rounded-lg border border-surface-200 bg-white p-6">
                <SchemaFieldBuilder fields={fields} onChange={setFields} />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <span className="text-sm text-surface-400">Step 1 of 3</span>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={!canProceedToStep1}
                className="rounded-md bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Deploy Schema */}
        {step === 1 && (
          <div>
            <div className="max-w-lg rounded-lg border border-surface-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold text-surface-900">Deploy Schema</h2>
              <p className="mb-4 text-sm text-surface-500">
                Review your schema definition and deploy it to the Hedera SchemaRegistry contract.
              </p>

              <div className="mb-4 rounded-md border border-surface-200 bg-surface-50 p-4">
                <p className="mb-1 text-xs font-medium text-surface-500">Definition</p>
                <code className="text-sm text-surface-700">{definition}</code>
              </div>

              <div className="mb-4 flex items-center gap-4 text-sm text-surface-600">
                <span>Revocable: <span className="font-medium">{revocable ? 'Yes' : 'No'}</span></span>
                <span>Resolver: <span className="font-mono">{resolverOption ? (resolverOption === 'custom' ? customResolver.trim() || 'None' : RESOLVER_OPTIONS.find((o) => o.value === resolverOption)?.label) : 'None'}</span></span>
              </div>

              <TransactionStatus status={status} txHash={txHash} uid={uid} uidLabel="Schema UID" error={error} />
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(0)}
                disabled={status === 'loading'}
                className="text-sm text-surface-500 hover:text-surface-700"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={handleDeploy}
                disabled={status === 'loading' || !state.isConnected}
                className="rounded-md bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
              >
                {status === 'loading' ? 'Deploying...' : 'Register Schema'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Complete */}
        {step === 2 && (
          <div>
            <div className="max-w-lg rounded-lg border border-green-200 bg-green-50 p-6">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h2 className="text-sm font-semibold text-green-700">Schema Deployed</h2>
              </div>
              <p className="mb-4 text-sm text-green-600">
                Your schema has been registered on-chain and is ready for attestations.
              </p>

              {uid && (
                <div className="mb-3 rounded-md border border-green-200 bg-white p-3">
                  <p className="mb-1 text-xs font-medium text-surface-500">Schema UID</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="truncate text-xs text-surface-700 block min-w-0">{uid}</code>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(uid)}
                      className="shrink-0 text-surface-400 hover:text-surface-600"
                      aria-label="Copy UID"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {txHash && (
                <div className="rounded-md border border-green-200 bg-white p-3">
                  <p className="mb-1 text-xs font-medium text-surface-500">Transaction</p>
                  <a
                    href={`https://hashscan.io/testnet/transaction/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-600 hover:underline"
                  >
                    View on HashScan
                  </a>
                </div>
              )}
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => {
                  setStep(0);
                  setFields([{ name: '', type: 'string' }]);
                  setResolverOption('');
                  setCustomResolver('');
                  setRevocable(true);
                  setStatus('idle');
                  setTxHash(null);
                  setUid(null);
                  setError(null);
                }}
                className="rounded-md border border-surface-200 bg-white px-6 py-2.5 text-sm font-medium text-surface-600 transition-colors hover:bg-surface-50"
              >
                Deploy Another Schema
              </button>
            </div>
          </div>
        )}
      </FormWrapper>
    </div>
  );
}
