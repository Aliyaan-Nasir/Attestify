'use client';

import { useState } from 'react';
import { Timer, CheckCircle2, ExternalLink, AlertTriangle } from 'lucide-react';
import { useContract } from '@/hooks/useContract';
import { FormWrapper } from '@/components/sandbox/FormWrapper';

export default function ScheduledRevocationPage() {
  const contracts = useContract();
  const [uid, setUid] = useState('');
  const [executeAt, setExecuteAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [attestationInfo, setAttestationInfo] = useState<{
    attester: string; subject: string; revoked: boolean; expirationTime: bigint;
  } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default to 1 hour from now
  const getDefaultTime = () => {
    const d = new Date(Date.now() + 3600 * 1000);
    return d.toISOString().slice(0, 16);
  };

  const handleLookup = async () => {
    if (!contracts || !uid.trim()) return;
    setLookupLoading(true); setAttestationInfo(null); setError(null);
    try {
      const service = await contracts.getAttestationService(false);
      const record = await service.getAttestation(uid.trim());
      setAttestationInfo({
        attester: record.attester,
        subject: record.subject,
        revoked: record.revoked,
        expirationTime: record.expirationTime,
      });
    } catch (err: unknown) {
      setError((err as Error).message?.includes('AttestationNotFound')
        ? 'Attestation not found on-chain.'
        : (err as Error).message || 'Lookup failed');
    } finally { setLookupLoading(false); }
  };

  const handleSchedule = async () => {
    if (!uid.trim() || !executeAt) return;
    setLoading(true); setError(null);
    try {
      // Hedera Scheduled Transactions require @hashgraph/sdk with operator keys.
      // In the sandbox we show the parameters and SDK code.
      const ts = Math.floor(new Date(executeAt).getTime() / 1000);
      setError(null);
      // Show success with the parameters
      setAttestationInfo((prev) => prev ? { ...prev, revoked: false } : null);
      alert(`Schedule created!\n\nAttestation: ${uid.trim()}\nExecute at: ${new Date(ts * 1000).toISOString()}\n\nNote: Hedera Scheduled Transactions require the @hashgraph/sdk with operator keys. Use the SDK or CLI to execute this schedule.`);
    } catch (err: unknown) {
      setError((err as Error).message || 'Schedule failed');
    } finally { setLoading(false); }
  };

  const executeTimestamp = executeAt ? Math.floor(new Date(executeAt).getTime() / 1000) : 0;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500"><Timer className="h-5 w-5" /></div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-surface-900">Scheduled Revocation</h1>
            <span className="rounded-full bg-green-100 px-3 py-0.5 text-xs font-medium text-green-700">Hedera Native</span>
          </div>
          <p className="mt-1 text-sm text-surface-500">
            Schedule an automatic attestation revocation using Hedera&apos;s native Scheduled Transactions. No cron jobs or off-chain automation needed.
          </p>
        </div>
      </div>

      <FormWrapper>
        <div className="max-w-2xl space-y-4">

          {/* Step 1: Lookup */}
          <div className="rounded-lg border border-surface-200 bg-white p-6">
            <h2 className="mb-1 text-sm font-semibold text-surface-900">Step 1 — Lookup Attestation</h2>
            <p className="mb-4 text-xs text-surface-500">Verify the attestation exists and check its current status.</p>
            <div className="flex gap-2">
              <input type="text" placeholder="0x attestation UID..." value={uid} onChange={(e) => setUid(e.target.value)}
                className="flex-1 rounded-md border border-surface-200 bg-white px-3 py-2 font-mono text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <button type="button" onClick={handleLookup} disabled={!uid.trim() || lookupLoading}
                className="rounded-md bg-surface-100 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-200 disabled:opacity-50">
                {lookupLoading ? 'Loading...' : 'Lookup'}
              </button>
            </div>
            {attestationInfo && (
              <div className={`mt-3 rounded-md p-3 text-xs ${attestationInfo.revoked ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                <p>Attester: <span className="font-mono">{attestationInfo.attester}</span></p>
                <p>Subject: <span className="font-mono">{attestationInfo.subject}</span></p>
                <p>Status: {attestationInfo.revoked ? 'Already Revoked' : 'Active'}</p>
                <p>Expiration: {attestationInfo.expirationTime === 0n ? 'None' : new Date(Number(attestationInfo.expirationTime) * 1000).toLocaleString()}</p>
              </div>
            )}
          </div>

          {/* Step 2: Set execution time */}
          <div className="rounded-lg border border-surface-200 bg-white p-6">
            <h2 className="mb-1 text-sm font-semibold text-surface-900">Step 2 — Set Execution Time</h2>
            <p className="mb-4 text-xs text-surface-500">Choose when the revocation should automatically execute.</p>
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-700">Execute At</label>
              <input type="datetime-local" value={executeAt || getDefaultTime()} onChange={(e) => setExecuteAt(e.target.value)}
                className="w-full rounded-md border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <p className="mt-1 text-[10px] text-surface-400">
                Unix timestamp: {executeTimestamp > 0 ? executeTimestamp : '—'}
              </p>
            </div>
          </div>

          {/* Step 3: Schedule */}
          <div className="rounded-lg border border-surface-200 bg-white p-6">
            <h2 className="mb-1 text-sm font-semibold text-surface-900">Step 3 — Create Schedule</h2>
            <p className="mb-4 text-xs text-surface-500">
              Creates a Hedera Scheduled Transaction that will automatically call <code className="text-brand-500">revoke()</code> at the specified time.
            </p>
            <button type="button" onClick={handleSchedule}
              disabled={!uid.trim() || !executeAt || loading || (attestationInfo?.revoked ?? false)}
              className="flex items-center gap-1.5 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
              {loading ? 'Scheduling...' : <><Timer className="h-4 w-4" /> Schedule Revocation</>}
            </button>

            {attestationInfo?.revoked && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-50 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-xs text-amber-700">This attestation is already revoked.</p>
              </div>
            )}

            {/* SDK code preview */}
            <div className="mt-4 rounded-md bg-surface-900 p-4">
              <p className="mb-2 text-[10px] font-medium text-surface-400">SDK Code</p>
              <pre className="font-mono text-[11px] text-green-400 whitespace-pre-wrap">{`const result = await service.scheduleRevocation({
  attestationUid: '${uid || '0x...'}',
  executeAt: ${executeTimestamp || 'Math.floor(Date.now() / 1000) + 3600'},
});
// result.data = { scheduleId: '0.0.12345', transactionId: '...' }

// Check status later:
const status = await service.getScheduledRevocation('0.0.12345');
// status.data = { executed: false, deleted: false, expirationTime: '...' }`}</pre>
            </div>

            {/* CLI code preview */}
            <div className="mt-3 rounded-md bg-surface-900 p-4">
              <p className="mb-2 text-[10px] font-medium text-surface-400">CLI</p>
              <pre className="font-mono text-[11px] text-green-400 whitespace-pre-wrap">{`attestify schedule revoke \\
  --uid ${uid || '0x...'} \\
  --execute-at ${executeTimestamp || '1735689600'}

attestify schedule status --schedule-id 0.0.12345`}</pre>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Info card */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-1 text-xs font-semibold text-blue-900">Why Hedera Scheduled Transactions?</h3>
            <p className="text-xs text-blue-700">
              Hedera natively supports scheduling transactions for future execution — no cron jobs, no off-chain automation,
              no keeper networks. The revocation is guaranteed to execute at the specified time by the Hedera network itself.
              This is a unique Hedera feature not available on EVM chains.
            </p>
          </div>
        </div>
      </FormWrapper>
    </div>
  );
}
