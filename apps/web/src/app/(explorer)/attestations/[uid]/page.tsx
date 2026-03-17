'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { ethers } from 'ethers';
import { Fingerprint, ArrowLeft, Database, FileCode2, ExternalLink, ScrollText } from 'lucide-react';
import { indexerApi } from '@/lib/api';
import { HCS_TOPICS } from '@/lib/contracts';
import { useIndexer } from '@/hooks/useIndexer';
import { formatDate } from '@/lib/format';
import { DetailCard } from '@/components/explorer/DetailCard';
import { StatusBadge } from '@/components/explorer/StatusBadge';
import { computeAttestationStatus } from '@/lib/attestation-status';
import { DetailSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';

function decodeAttestationData(definition: string, data: string): { name: string; type: string; value: string }[] {
  try {
    const fields = definition.split(',').map((s) => s.trim()).filter(Boolean)
      .map((pair) => { const parts = pair.split(/\s+/); return { type: parts[0], name: parts.slice(1).join(' ') }; });
    const types = fields.map((f) => f.type);
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const decoded = coder.decode(types, data);
    return fields.map((f, i) => ({ name: f.name, type: f.type, value: String(decoded[i]) }));
  } catch {
    return [];
  }
}

export default function AttestationDetailPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params);

  const { data: attestation, loading, error, refetch } = useIndexer(
    () => indexerApi.getAttestation(uid),
    [uid],
  );

  const { data: schema } = useIndexer(
    () => attestation
      ? indexerApi.getSchema(attestation.schemaUid)
      : Promise.resolve({ success: false as const, data: null as unknown as Awaited<ReturnType<typeof indexerApi.getSchema>>['data'] }),
    [attestation?.schemaUid],
  );

  const decodedFields = useMemo(() => {
    if (!schema?.definition || !attestation?.data) return [];
    return decodeAttestationData(schema.definition, attestation.data);
  }, [schema, attestation]);

  if (loading) {
    return (
      <div className="space-y-6">
        <DetailSkeleton fields={10} />
        <DetailSkeleton fields={4} />
      </div>
    );
  }

  if (error || !attestation) {
    return (
      <div>
        <Link href="/attestations" className="mb-6 inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-900">
          <ArrowLeft className="h-4 w-4" />
          Back to Attestations
        </Link>
        <ErrorState message={error || 'Attestation not found'} onRetry={refetch} />
      </div>
    );
  }

  const status = computeAttestationStatus(attestation.revoked, attestation.expirationTime);

  return (
    <div>
      <Link href="/attestations" className="mb-6 inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-900">
        <ArrowLeft className="h-4 w-4" />
        Back to Attestations
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <Fingerprint className="h-5 w-5 text-brand-500" />
        <h1 className="text-xl font-bold text-surface-900">Attestation Detail</h1>
        <StatusBadge status={status} />
      </div>

      <div className="space-y-6">
        <DetailCard
          title="Attestation Information"
          icon={<Fingerprint className="h-4 w-4 text-brand-500" />}
          fields={[
            { label: 'UID', value: attestation.uid, mono: true },
            {
              label: 'Schema',
              value: (
                <Link href={`/schemas/${attestation.schemaUid}`} className="text-brand-500 hover:underline">
                  {attestation.schemaUid}
                </Link>
              ),
              mono: true,
            },
            {
              label: 'Attester',
              value: (
                <Link href={`/authorities/${attestation.attesterAddress}`} className="text-brand-500 hover:underline">
                  {attestation.attesterAddress}
                </Link>
              ),
              mono: true,
            },
            { label: 'Subject', value: attestation.subjectAddress, mono: true },
            { label: 'Nonce', value: String(attestation.nonce) },
            { label: 'Status', value: <StatusBadge status={status} /> },
            { label: 'Expiration', value: attestation.expirationTime ? formatDate(attestation.expirationTime) : 'None' },
            { label: 'Revoked', value: attestation.revoked ? 'Yes' : 'No' },
            ...(attestation.revocationTime
              ? [{ label: 'Revocation Time', value: formatDate(attestation.revocationTime) }]
              : []),
            { label: 'Created', value: formatDate(attestation.createdAt) },
          ]}
        />

        {/* Decoded Data */}
        {decodedFields.length > 0 ? (
          <DetailCard
            title="Decoded Attestation Data"
            icon={<FileCode2 className="h-4 w-4 text-brand-500" />}
            fields={decodedFields.map((f) => ({
              label: `${f.name} (${f.type})`,
              value: f.value,
              mono: true,
            }))}
          />
        ) : attestation.data ? (
          <DetailCard
            title="Raw Attestation Data"
            icon={<FileCode2 className="h-4 w-4 text-brand-500" />}
            fields={[{ label: 'Data', value: attestation.data, mono: true }]}
          />
        ) : null}

        <DetailCard
          title="Hedera Information"
          icon={<Database className="h-4 w-4 text-brand-500" />}
          fields={[
            { label: 'Transaction Hash', value: attestation.transactionHash, mono: true },
            { label: 'Block Number', value: String(attestation.blockNumber) },
            { label: 'Consensus Timestamp', value: attestation.consensusTimestamp || '—', mono: !!attestation.consensusTimestamp },
            ...(attestation.revocationTxHash
              ? [{ label: 'Revocation Tx Hash', value: attestation.revocationTxHash, mono: true }]
              : []),
          ]}
        />

        {/* HCS Audit Trail */}
        <DetailCard
          title="HCS Audit Trail"
          icon={<ScrollText className="h-4 w-4 text-brand-500" />}
          fields={[
            ...(schema?.hcsTopicId ? [{
              label: 'Schema Topic',
              value: (
                <a href={`https://hashscan.io/testnet/topic/${schema.hcsTopicId}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-brand-500 hover:underline">
                  {schema.hcsTopicId} <ExternalLink className="h-3 w-3" />
                </a>
              ),
            }] : [{
              label: 'Schema Topic',
              value: 'Not available (schema created before HCS was enabled)',
            }]),
            {
              label: 'Global Attestations Topic',
              value: (
                <a href={`https://hashscan.io/testnet/topic/${HCS_TOPICS.attestations}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-brand-500 hover:underline">
                  {HCS_TOPICS.attestations} <ExternalLink className="h-3 w-3" />
                </a>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
