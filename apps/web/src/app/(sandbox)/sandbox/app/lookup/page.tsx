'use client';

import { useState } from 'react';
import { Eye, CheckCircle2, Copy, Search } from 'lucide-react';
import { useContract } from '@/hooks/useContract';
import { FormWrapper } from '@/components/sandbox/FormWrapper';

interface AttestationData {
  uid: string;
  schemaUid: string;
  attester: string;
  subject: string;
  data: string;
  timestamp: bigint;
  expirationTime: bigint;
  revoked: boolean;
  revocationTime: bigint;
  nonce: bigint;
}

export default function LookupPage() {
  const contracts = useContract();
  const [uid, setUid] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AttestationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!contracts || !uid.trim()) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const service = await contracts.getAttestationService(false);
      const record = await service.getAttestation(uid.trim());
      setResult({
        uid: record.uid,
        schemaUid: record.schemaUid,
        attester: record.attester,
        subject: record.subject,
        data: record.data,
        timestamp: record.timestamp,
        expirationTime: record.expirationTime,
        revoked: record.revoked,
        revocationTime: record.revocationTime,
        nonce: record.nonce,
      });
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Lookup failed';
      if (msg.includes('AttestationNotFound')) setError('Attestation not found on-chain.');
      else if (msg.includes('AttestationExpired')) setError('Attestation exists but has expired.');
      else setError(msg);
    } finally { setLoading(false); }
  };

  const formatTimestamp = (ts: bigint) => {
    if (ts === 0n) return 'None';
    return new Date(Number(ts) * 1000).toLocaleString();
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500"><Eye className="h-5 w-5" /></div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-surface-900">Lookup Attestation</h1>
            <span className="rounded-full bg-surface-200 px-3 py-0.5 text-xs font-medium text-surface-600">Read-Only</span>
          </div>
          <p className="mt-1 text-sm text-surface-500">Read attestation data directly from the smart contract (not the indexer).</p>
        </div>
      </div>

      <FormWrapper>
        <div className="max-w-2xl">
          <div className="rounded-lg border border-surface-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-surface-900">Attestation UID</h2>
            <div className="flex gap-2">
              <input type="text" placeholder="0x..." value={uid} onChange={(e) => setUid(e.target.value)}
                className="flex-1 rounded-md border border-surface-200 bg-white px-3 py-2 font-mono text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <button type="button" onClick={handleLookup} disabled={!uid.trim() || loading}
                className="flex items-center gap-1.5 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
                {loading ? 'Loading...' : <><Search className="h-4 w-4" /> Lookup</>}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-4 rounded-lg border border-surface-200 bg-white p-6">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <h2 className="text-sm font-semibold text-surface-900">On-Chain Attestation Record</h2>
              </div>
              <div className="divide-y divide-surface-100">
                {[
                  { label: 'UID', value: result.uid },
                  { label: 'Schema UID', value: result.schemaUid },
                  { label: 'Attester', value: result.attester },
                  { label: 'Subject', value: result.subject },
                  { label: 'Data', value: result.data },
                  { label: 'Timestamp', value: formatTimestamp(result.timestamp) },
                  { label: 'Expiration', value: formatTimestamp(result.expirationTime) },
                  { label: 'Revoked', value: result.revoked ? 'Yes' : 'No' },
                  { label: 'Revocation Time', value: formatTimestamp(result.revocationTime) },
                  { label: 'Nonce', value: String(result.nonce) },
                ].map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4 py-2.5">
                    <span className="shrink-0 text-xs font-medium text-surface-500">{row.label}</span>
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="truncate font-mono text-xs text-surface-700">{row.value}</span>
                      {typeof row.value === 'string' && row.value.startsWith('0x') && (
                        <button type="button" onClick={() => navigator.clipboard.writeText(row.value)}
                          className="shrink-0 text-surface-400 hover:text-surface-600" aria-label="Copy">
                          <Copy className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </FormWrapper>
    </div>
  );
}
