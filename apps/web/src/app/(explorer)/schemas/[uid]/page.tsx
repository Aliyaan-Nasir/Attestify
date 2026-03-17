'use client';

import { use } from 'react';
import Link from 'next/link';
import { FileCode2, ArrowLeft, CheckCircle2, XCircle, ExternalLink, ScrollText } from 'lucide-react';
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
import type { AttestationRecord } from '@/lib/api';

export default function SchemaDetailPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params);

  const { data: schema, loading, error, refetch } = useIndexer(
    () => indexerApi.getSchema(uid),
    [uid],
  );

  const { data: attestations, pagination } = usePaginatedIndexer(
    () => indexerApi.getAttestations({ schemaUid: uid, limit: 10 }),
    [uid],
  );

  if (loading) {
    return (
      <div>
        <div className="mb-6"><DetailSkeleton fields={10} /></div>
        <TableSkeleton rows={3} cols={5} />
      </div>
    );
  }

  if (error || !schema) {
    return (
      <div>
        <Link href="/schemas" className="mb-6 inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-900">
          <ArrowLeft className="h-4 w-4" />
          Back to Schemas
        </Link>
        <ErrorState message={error || 'Schema not found'} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <Link href="/schemas" className="mb-6 inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-900">
        <ArrowLeft className="h-4 w-4" />
        Back to Schemas
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <FileCode2 className="h-5 w-5 text-brand-500" />
        <h1 className="text-xl font-bold text-surface-900">Schema Detail</h1>
      </div>

      <div className="space-y-6">
        <DetailCard
          title="Schema Information"
          icon={<FileCode2 className="h-4 w-4 text-brand-500" />}
          fields={[
            { label: 'UID', value: schema.uid, mono: true },
            { label: 'Definition', value: schema.definition, mono: true },
            {
              label: 'Authority',
              value: (
                <Link href={`/authorities/${schema.authorityAddress}`} className="text-brand-500 hover:underline">
                  {schema.authorityAddress}
                </Link>
              ),
              mono: true,
            },
            {
              label: 'Resolver',
              value: schema.resolverAddress || 'None',
              mono: !!schema.resolverAddress,
            },
            {
              label: 'Revocable',
              value: (
                <span className="inline-flex items-center gap-1.5">
                  {schema.revocable ? (
                    <><CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> Yes</>
                  ) : (
                    <><XCircle className="h-3.5 w-3.5 text-surface-500" /> No</>
                  )}
                </span>
              ),
            },
            { label: 'Transaction', value: schema.transactionHash, mono: true },
            { label: 'Block', value: String(schema.blockNumber) },
            { label: 'Consensus Timestamp', value: schema.consensusTimestamp || '—', mono: !!schema.consensusTimestamp },
            { label: 'Created', value: formatDate(schema.createdAt) },
            { label: 'Attestation Count', value: pagination ? String(pagination.total) : '—' },
          ]}
        />

        {/* HCS Audit Trail */}
        <DetailCard
          title="HCS Audit Trail"
          icon={<ScrollText className="h-4 w-4 text-brand-500" />}
          fields={[
            ...(schema.hcsTopicId ? [{
              label: 'Schema Topic',
              value: (
                <a href={`https://hashscan.io/testnet/topic/${schema.hcsTopicId}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-brand-500 hover:underline">
                  {schema.hcsTopicId} <ExternalLink className="h-3 w-3" />
                </a>
              ),
            }] : [{
              label: 'Schema Topic',
              value: 'Not available (created before HCS was enabled)',
            }]),
            {
              label: 'Global Schemas Topic',
              value: (
                <a href={`https://hashscan.io/testnet/topic/${HCS_TOPICS.schemas}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-brand-500 hover:underline">
                  {HCS_TOPICS.schemas} <ExternalLink className="h-3 w-3" />
                </a>
              ),
            },
          ]}
        />

        {attestations.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-surface-900">Linked Attestations</h2>
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
                  header: 'Attester',
                  accessor: (row) => <span className="font-mono text-xs">{truncateHex(row.attesterAddress)}</span>,
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
