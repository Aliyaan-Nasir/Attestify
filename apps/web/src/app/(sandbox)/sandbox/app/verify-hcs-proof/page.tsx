'use client';

import { useState } from 'react';
import { Shield, CheckCircle2, Copy, Search, ExternalLink, Clock } from 'lucide-react';
import { FormWrapper } from '@/components/sandbox/FormWrapper';

const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 'http://localhost:3001';
const HCS_ATTESTATION_TOPIC = '0.0.8221946';

interface HCSProof {
  attestation: {
    uid: string;
    schemaUid: string;
    attester: string;
    subject: string;
    revoked: boolean;
    createdAt: string;
    transactionHash: string;
    blockNumber: number;
    consensusTimestamp: string | null;
  };
  hcsMessage: {
    sequenceNumber: number;
    consensusTimestamp: string;
    topicId: string;
    message: string;
  } | null;
}

export default function VerifyHCSProofPage() {
  const [uid, setUid] = useState('');
  const [loading, setLoading] = useState(false);
  const [proof, setProof] = useState<HCSProof | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!uid.trim()) return;
    setLoading(true); setProof(null); setError(null);
    try {
      // 1. Fetch attestation from indexer
      const attRes = await fetch(`${INDEXER_URL}/api/attestations/${uid.trim()}`);
      if (!attRes.ok) throw new Error('Attestation not found in indexer');
      const attJson = await attRes.json();
      const att = attJson.data;

      // 2. Fetch HCS messages from the attestation topic, search for this UID
      let hcsMessage = null;
      try {
        const hcsRes = await fetch(
          `https://testnet.mirrornode.hedera.com/api/v1/topics/${HCS_ATTESTATION_TOPIC}/messages?limit=100&order=desc`
        );
        if (hcsRes.ok) {
          const hcsJson = await hcsRes.json();
          for (const msg of hcsJson.messages || []) {
            try {
              const decoded = JSON.parse(Buffer.from(msg.message, 'base64').toString('utf-8'));
              if (decoded.payload?.uid === uid.trim()) {
                hcsMessage = {
                  sequenceNumber: msg.sequence_number,
                  consensusTimestamp: msg.consensus_timestamp,
                  topicId: HCS_ATTESTATION_TOPIC,
                  message: JSON.stringify(decoded, null, 2),
                };
                break;
              }
            } catch { /* skip unparseable messages */ }
          }
        }
      } catch { /* HCS lookup is best-effort */ }

      setProof({
        attestation: {
          uid: att.uid,
          schemaUid: att.schemaUid,
          attester: att.attesterAddress,
          subject: att.subjectAddress,
          revoked: att.revoked,
          createdAt: att.createdAt,
          transactionHash: att.transactionHash,
          blockNumber: att.blockNumber,
          consensusTimestamp: att.consensusTimestamp,
        },
        hcsMessage,
      });
    } catch (err: unknown) {
      const { parseContractError } = await import('@/lib/parseContractError');
      setError(parseContractError(err));
    } finally { setLoading(false); }
  };

  const copyText = (text: string) => navigator.clipboard.writeText(text);

  const formatConsensusTs = (ts: string) => {
    const [seconds, nanos] = ts.split('.');
    const date = new Date(Number(seconds) * 1000);
    return `${date.toLocaleString()} (${nanos ? nanos.slice(0, 6) : '0'}ns precision)`;
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500"><Shield className="h-5 w-5" /></div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-surface-900">Verify HCS Proof</h1>
            <span className="rounded-full bg-green-100 px-3 py-0.5 text-xs font-medium text-green-700">Hedera Native</span>
          </div>
          <p className="mt-1 text-sm text-surface-500">
            Verify an attestation&apos;s existence using its HCS consensus timestamp — an immutable, Hedera-native notarization proof.
          </p>
        </div>
      </div>

      <FormWrapper>
        <div className="max-w-2xl">
          <div className="rounded-lg border border-surface-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-surface-900">Attestation UID</h2>
            <div className="flex gap-2">
              <input type="text" placeholder="0x..." value={uid} onChange={(e) => setUid(e.target.value)}
                className="flex-1 rounded-md border border-surface-200 bg-white px-3 py-2 font-mono text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <button type="button" onClick={handleVerify} disabled={!uid.trim() || loading}
                className="flex items-center gap-1.5 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
                {loading ? 'Verifying...' : <><Search className="h-4 w-4" /> Verify</>}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {proof && (
            <div className="mt-4 space-y-4">
              {/* Attestation Record */}
              <div className="rounded-lg border border-surface-200 bg-white p-6">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <h2 className="text-sm font-semibold text-surface-900">Attestation Record</h2>
                </div>
                <div className="divide-y divide-surface-100">
                  {[
                    { label: 'UID', value: proof.attestation.uid },
                    { label: 'Schema UID', value: proof.attestation.schemaUid },
                    { label: 'Attester', value: proof.attestation.attester },
                    { label: 'Subject', value: proof.attestation.subject },
                    { label: 'Revoked', value: proof.attestation.revoked ? 'Yes' : 'No' },
                    { label: 'Created', value: proof.attestation.createdAt },
                    { label: 'Transaction', value: proof.attestation.transactionHash },
                    { label: 'Block', value: String(proof.attestation.blockNumber) },
                    { label: 'Consensus Timestamp', value: proof.attestation.consensusTimestamp || 'N/A' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-4 py-2.5">
                      <span className="shrink-0 text-xs font-medium text-surface-500">{row.label}</span>
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="truncate font-mono text-xs text-surface-700">{row.value}</span>
                        {typeof row.value === 'string' && row.value.startsWith('0x') && (
                          <button type="button" onClick={() => copyText(row.value)} className="shrink-0 text-surface-400 hover:text-surface-600" aria-label="Copy">
                            <Copy className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* HCS Proof */}
              <div className={`rounded-lg border p-6 ${proof.hcsMessage ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="mb-3 flex items-center gap-2">
                  <Clock className={`h-4 w-4 ${proof.hcsMessage ? 'text-green-600' : 'text-amber-600'}`} />
                  <h2 className={`text-sm font-semibold ${proof.hcsMessage ? 'text-green-900' : 'text-amber-900'}`}>
                    {proof.hcsMessage ? 'HCS Notarization Proof Found' : 'HCS Message Not Found'}
                  </h2>
                </div>

                {proof.hcsMessage ? (
                  <div className="space-y-3">
                    <div className="rounded-md bg-white/80 p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs font-medium text-surface-500">Topic ID</span>
                          <a href={`https://hashscan.io/testnet/topic/${proof.hcsMessage.topicId}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 font-mono text-xs text-brand-500 hover:underline">
                            {proof.hcsMessage.topicId} <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs font-medium text-surface-500">Sequence #</span>
                          <span className="font-mono text-xs text-surface-700">{proof.hcsMessage.sequenceNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs font-medium text-surface-500">Consensus Timestamp</span>
                          <span className="font-mono text-xs text-surface-700">{formatConsensusTs(proof.hcsMessage.consensusTimestamp)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-md bg-white/80 p-4">
                      <p className="mb-2 text-xs font-medium text-surface-500">HCS Message Payload</p>
                      <pre className="max-h-64 overflow-auto rounded bg-surface-900 p-3 font-mono text-[11px] text-green-400">
                        {proof.hcsMessage.message}
                      </pre>
                    </div>
                    <p className="text-xs text-green-700">
                      This attestation has an immutable HCS consensus timestamp, proving it existed at the exact moment shown above.
                      This timestamp is assigned by the Hedera network and cannot be forged or backdated.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-amber-700">
                    No HCS message found for this attestation UID in the last 100 messages. The attestation may have been created before HCS logging was enabled,
                    or the message may be older than the search window.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </FormWrapper>
    </div>
  );
}
