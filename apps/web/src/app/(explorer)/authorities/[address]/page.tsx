'use client';

import { use } from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, CheckCircle2, XCircle, ExternalLink, ScrollText } from 'lucide-react';
import { indexerApi } from '@/lib/api';
import { HCS_TOPICS } from '@/lib/contracts';
import { useIndexer } from '@/hooks/useIndexer';
import { usePaginatedIndexer } from '@/hooks/usePaginatedIndexer';
import { truncateHex, formatDate } from '@/lib/format';
import { DetailCard } from '@/components/explorer/DetailCard';
import { DataTable } from '@/components/explorer/DataTable';
import { StatusBadge } from '@/components/explorer/StatusBadge';
import { computeAttestationStatus } from '@/lib/attestation-status';
import { DetailSkeleton, TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import type { SchemaRecord, AttestationRecord } from '@/lib/api';

export default function AuthorityDetailPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);

  const { data: authority, loading, error, refetch } = useIndexer(
    () => indexerApi.getAuthority(address),
    [address],
  );

  const { data: schemas } = usePaginatedIndexer(
    () => indexerApi.getSchemas({ authority: address, limit: 10 }),
    [address],
  );

  const { data: attestations } = usePaginatedIndexer(
    () => indexerApi.getAttestations({ attester: address, limit: 10 }),
    [address],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <DetailSkeleton fields={7} />
        <TableSkeleton rows={3} cols={4} />
      </div>
    );
  }

  if (error || !authority) {
    return (
      <div>
        <Link href="/authorities" className="mb-6 inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-900">
          <ArrowLeft className="h-4 w-4" />
          Back to Authorities
        </Link>
        <ErrorState message={error || 'Authority not found'} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <Link href="/authorities" className="mb-6 inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-900">
        <ArrowLeft className="h-4 w-4" />
        Back to Authorities
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-brand-500" />
        <h1 className="text-xl font-bold text-surface-900">Authority Detail</h1>
        {authority.isVerified && (
          <span className="inline-flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            Verified
          </span>
        )}
      </div>

      <div className="space-y-6">
        <DetailCard
          title="Authority Information"
          icon={<ShieldCheck className="h-4 w-4 text-brand-500" />}
          fields={[
            { label: 'Address', value: authority.address, mono: true },
            { label: 'Metadata', value: authority.metadata || '—' },
            {
              label: 'Verification',
              value: authority.isVerified ? (
                <span className="inline-flex items-center gap-1.5 text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-surface-500">
                  <XCircle className="h-3.5 w-3.5" /> Unverified
                </span>
              ),
            },
            { label: 'Transaction', value: authority.transactionHash, mono: true },
            { label: 'Block', value: String(authority.blockNumber) },
            { label: 'Consensus Timestamp', value: authority.consensusTimestamp || '—', mono: !!authority.consensusTimestamp },
            { label: 'Registered', value: formatDate(authority.createdAt) },
          ]}
        />

        {/* HCS Audit Trail */}
        <DetailCard
          title="HCS Audit Trail"
          icon={<ScrollText className="h-4 w-4 text-brand-500" />}
          fields={[
            {
              label: 'Global Authorities Topic',
              value: (
                <a href={`https://hashscan.io/testnet/topic/${HCS_TOPICS.authorities}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-brand-500 hover:underline">
                  {HCS_TOPICS.authorities} <ExternalLink className="h-3 w-3" />
                </a>
              ),
            },
            ...(schemas.filter((s) => s.hcsTopicId).length > 0 ? [{
              label: 'Per-Schema Topics',
              value: (
                <div className="flex flex-col gap-1">
                  {schemas.filter((s) => s.hcsTopicId).map((s) => (
                    <a key={s.uid} href={`https://hashscan.io/testnet/topic/${s.hcsTopicId}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs text-brand-500 hover:underline">
                      {s.hcsTopicId} <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              ),
            }] : []),
          ]}
        />

        {schemas.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-surface-900">Schemas Created</h2>
            <DataTable<SchemaRecord>
              columns={[
                {
                  header: 'UID',
                  accessor: (row) => (
                    <Link href={`/schemas/${row.uid}`} className="font-mono text-xs text-brand-500 hover:underline">
                      {truncateHex(row.uid)}
                    </Link>
                  ),
                },
                {
                  header: 'Definition',
                  accessor: (row) => <span className="block max-w-xs truncate text-xs">{row.definition}</span>,
                },
                {
                  header: 'Revocable',
                  accessor: (row) => (
                    <span className={`text-xs ${row.revocable ? 'text-green-400' : 'text-surface-500'}`}>
                      {row.revocable ? 'Yes' : 'No'}
                    </span>
                  ),
                },
                {
                  header: 'Created',
                  accessor: (row) => <span className="text-xs text-surface-500">{formatDate(row.createdAt)}</span>,
                },
              ]}
              data={schemas}
              keyExtractor={(row) => row.uid}
              onRowClick={(row) => {
                window.location.href = `/schemas/${row.uid}`;
              }}
            />
          </div>
        )}

        {attestations.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-surface-900">Attestations Issued</h2>
            <DataTable<AttestationRecord>
              columns={[
                {
                  header: 'UID',
                  accessor: (row) => (
                    <Link href={`/attestations/${row.uid}`} className="font-mono text-xs text-brand-500 hover:underline">
                      {truncateHex(row.uid)}
                    </Link>
                  ),
                },
                {
                  header: 'Subject',
                  accessor: (row) => <span className="font-mono text-xs">{truncateHex(row.subjectAddress)}</span>,
                },
                {
                  header: 'Status',
                  accessor: (row) => <StatusBadge status={computeAttestationStatus(row.revoked, row.expirationTime)} />,
                },
                {
                  header: 'Created',
                  accessor: (row) => <span className="text-xs text-surface-500">{formatDate(row.createdAt)}</span>,
                },
              ]}
              data={attestations}
              keyExtractor={(row) => row.uid}
              onRowClick={(row) => {
                window.location.href = `/attestations/${row.uid}`;
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
