'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { FilePlus2, Loader2, CheckCircle2, Copy, Search, Send, ArrowRight, FileCode2 } from 'lucide-react';
import { useWalletContext } from '@/components/wallet/WalletProvider';
import { useContract } from '@/hooks/useContract';
import { FormWrapper } from '@/components/sandbox/FormWrapper';
import { TransactionStatus, type TxStatus } from '@/components/sandbox/TransactionStatus';

interface ParsedField { type: string; name: string; }

function parseSchemaDefinition(definition: string): ParsedField[] {
  return definition.split(',').map((s) => s.trim()).filter(Boolean)
    .map((pair) => { const parts = pair.split(/\s+/); return { type: parts[0], name: parts.slice(1).join(' ') }; });
}

const STEPS = [
  { label: 'Load Schema', icon: Search },
  { label: 'Fill Data', icon: FileCode2 },
  { label: 'Submit', icon: Send },
  { label: 'Complete', icon: CheckCircle2 },
];

export default function CreateAttestationPage() {
  const { state } = useWalletContext();
  const contracts = useContract();
  const [step, setStep] = useState(0);
  const [schemaUid, setSchemaUid] = useState('');
  const [schemaFields, setSchemaFields] = useState<ParsedField[]>([]);
  const [schemaDef, setSchemaDef] = useState('');
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [subject, setSubject] = useState('');
  const [expiration, setExpiration] = useState('');
  const [status, setStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleLoadSchema = async () => {
    if (!contracts || !schemaUid.trim()) return;
    setLoadingSchema(true); setLoadError(null);
    try {
      const registry = await contracts.getSchemaRegistry(false);
      const record = await registry.getSchema(schemaUid.trim());
      const definition = record.definition || record[1];
      const fields = parseSchemaDefinition(definition);
      setSchemaFields(fields); setSchemaDef(definition);
      const initial: Record<string, string> = {};
      for (const f of fields) initial[f.name] = '';
      setFieldValues(initial); setStep(1);
    } catch (err: unknown) {
      const { parseContractError } = await import('@/lib/parseContractError');
      setLoadError(parseContractError(err));
    } finally { setLoadingSchema(false); }
  };

  const handleSubmit = async () => {
    if (!contracts || !state.isConnected) return;
    setStatus('loading'); setTxHash(null); setUid(null); setError(null);
    try {
      const service = await contracts.getAttestationService(true);
      const coder = ethers.AbiCoder.defaultAbiCoder();
      const types = schemaFields.map((f) => f.type);
      const values = schemaFields.map((f) => {
        const raw = fieldValues[f.name] || '';
        if (f.type.startsWith('uint') || f.type.startsWith('int')) return BigInt(raw || '0');
        if (f.type === 'bool') return raw.toLowerCase() === 'true';
        return raw;
      });
      const encodedData = coder.encode(types, values);
      const expTime = expiration ? BigInt(expiration) : BigInt(0);
      const tx = await service.attest(schemaUid.trim(), subject.trim(), encodedData, expTime);
      const receipt = await tx.wait();
      setTxHash(receipt.hash);
      const iface = service.interface;
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed && parsed.name === 'AttestationCreated') { setUid(parsed.args[0]); break; }
        } catch { /* skip */ }
      }
      setStatus('success'); setStep(3);
    } catch (err: unknown) {
      const { parseContractError } = await import('@/lib/parseContractError');
      setError(parseContractError(err)); setStatus('error');
    }
  };

  const reset = () => { setStep(0); setSchemaUid(''); setSchemaFields([]); setSchemaDef(''); setFieldValues({}); setSubject(''); setExpiration(''); setStatus('idle'); setTxHash(null); setUid(null); setError(null); };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500"><FilePlus2 className="h-5 w-5" /></div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-surface-900">Attestation Workflow</h1>
            <span className="rounded-full bg-brand-500 px-3 py-0.5 text-xs font-medium text-white">Core Workflow</span>
          </div>
          <p className="mt-1 text-sm text-surface-500">Load a schema, encode attestation data, and submit to the AttestationService contract on Hedera.</p>
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
              <h2 className="mb-4 text-sm font-semibold text-surface-900">Load Schema</h2>
              <p className="mb-4 text-sm text-surface-500">Enter the Schema UID to load its field definitions from the registry.</p>
              <div className="flex gap-2">
                <input type="text" placeholder="0x..." value={schemaUid} onChange={(e) => setSchemaUid(e.target.value)}
                  className="flex-1 rounded-md border border-surface-200 bg-white px-3 py-2 font-mono text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                <button type="button" onClick={handleLoadSchema} disabled={!schemaUid.trim() || loadingSchema}
                  className="flex items-center gap-1.5 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
                  {loadingSchema && <Loader2 className="h-4 w-4 animate-spin" />} Load
                </button>
              </div>
              {loadError && <p className="mt-2 text-xs text-red-500">{loadError}</p>}
            </div>
            <div className="mt-6"><span className="text-sm text-surface-400">Step 1 of 4</span></div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="rounded-lg border border-surface-200 bg-white p-6">
                <h2 className="mb-4 text-sm font-semibold text-surface-900">Attestation Details</h2>
                <div className="mb-4">
                  <label className="mb-1.5 block text-sm text-surface-600">Subject Address</label>
                  <input type="text" placeholder="0x..." value={subject} onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-md border border-surface-200 bg-white px-3 py-2 font-mono text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm text-surface-600">Expiration <span className="text-surface-400">(unix, 0 = none)</span></label>
                  <input type="text" placeholder="0" value={expiration} onChange={(e) => setExpiration(e.target.value)}
                    className="w-full rounded-md border border-surface-200 bg-white px-3 py-2 font-mono text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
                <div className="mt-4 rounded-md border border-surface-200 bg-surface-50 p-3">
                  <p className="text-xs font-medium text-surface-500">Schema</p>
                  <code className="text-xs text-surface-600">{schemaDef}</code>
                </div>
              </div>
              <div className="rounded-lg border border-surface-200 bg-white p-6">
                <h2 className="mb-4 text-sm font-semibold text-surface-900">Schema Data</h2>
                <div className="space-y-3">
                  {schemaFields.map((field) => (
                    <div key={field.name}>
                      <label className="mb-1 block text-xs text-surface-500">{field.name} <span className="text-surface-400">({field.type})</span></label>
                      <input type="text" placeholder={`Enter ${field.type}`} value={fieldValues[field.name] || ''}
                        onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                        className="w-full rounded-md border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button type="button" onClick={() => setStep(0)} className="text-sm text-surface-500 hover:text-surface-700">Previous</button>
              <button type="button" onClick={() => setStep(2)} disabled={!subject.trim()} className="rounded-md bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="max-w-2xl rounded-lg border border-surface-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold text-surface-900">Review & Submit</h2>
              <p className="mb-4 text-sm text-surface-500">Review your attestation data and submit to the contract.</p>
              <div className="mb-3 rounded-md border border-surface-200 bg-surface-50 p-3" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                <p className="text-xs font-medium text-surface-500">Schema UID</p>
                <code className="text-xs text-surface-700 break-all block">{schemaUid}</code>
              </div>
              <div className="mb-3 rounded-md border border-surface-200 bg-surface-50 p-3" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                <p className="text-xs font-medium text-surface-500">Subject</p>
                <code className="text-xs text-surface-700 break-all block">{subject}</code>
              </div>
              <div className="mb-3 rounded-md border border-surface-200 bg-surface-50 p-3" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                <p className="text-xs font-medium text-surface-500">Data Fields</p>
                {schemaFields.map((f) => (<p key={f.name} className="text-xs text-surface-600 break-all">{f.name}: <span className="font-mono break-all">{fieldValues[f.name] || '(empty)'}</span></p>))}
              </div>
              <TransactionStatus status={status} txHash={txHash} uid={uid} uidLabel="Attestation UID" error={error} />
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button type="button" onClick={() => setStep(1)} disabled={status === 'loading'} className="text-sm text-surface-500 hover:text-surface-700">Previous</button>
              <button type="button" onClick={handleSubmit} disabled={status === 'loading' || !state.isConnected}
                className="rounded-md bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
                {status === 'loading' ? 'Submitting...' : 'Create Attestation'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="max-w-lg rounded-lg border border-green-200 bg-green-50 p-6">
              <div className="mb-3 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /><h2 className="text-sm font-semibold text-green-700">Attestation Created</h2></div>
              <p className="mb-4 text-sm text-green-600">Your attestation has been submitted on-chain.</p>
              {uid && (<div className="mb-3 rounded-md border border-green-200 bg-white p-3"><p className="mb-1 text-xs font-medium text-surface-500">Attestation UID</p><div className="flex items-center gap-2 min-w-0"><code className="truncate text-xs text-surface-700 block min-w-0">{uid}</code><button type="button" onClick={() => navigator.clipboard.writeText(uid)} className="shrink-0 text-surface-400 hover:text-surface-600" aria-label="Copy UID"><Copy className="h-3.5 w-3.5" /></button></div></div>)}
              {txHash && (<div className="rounded-md border border-green-200 bg-white p-3"><p className="mb-1 text-xs font-medium text-surface-500">Transaction</p><a href={`https://hashscan.io/testnet/transaction/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">View on HashScan</a></div>)}
            </div>
            <div className="mt-6"><button type="button" onClick={reset} className="rounded-md border border-surface-200 bg-white px-6 py-2.5 text-sm font-medium text-surface-600 hover:bg-surface-50">Create Another Attestation</button></div>
          </div>
        )}
      </FormWrapper>
    </div>
  );
}
