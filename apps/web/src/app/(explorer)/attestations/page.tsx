'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Fingerprint } from 'lucide-react';
import { indexerApi } from '@/lib/api';
import { usePaginatedIndexer } from '@/hooks/usePaginatedIndexer';
import { truncateHex, formatDate } from '@/lib/format';
import { SearchBar } from '@/components/explorer/SearchBar';
import { DataTable } from '@/components/explorer/DataTable';
import { Pagination } from '@/components/explorer/Pagination';
import { StatusBadge } from '@/components/explorer/StatusBadge';
import { computeAttestationStatus } from '@/lib/attestation-status';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import type { AttestationRecord } from '@/lib/api';

const PAGE_SIZE = 20;

export default function AttestationsPage() {
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  const { data, pagination, loading, error, refetch } = usePaginatedIndexer(
    () => indexerApi.getAttestations({ limit: PAGE_SIZE, offset, search: search || undefined }),
    [offset, search],
  );

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    setOffset(0);
  }, []);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Fingerprint className="h-5 w-5 text-brand-500" />
          <h1 className="text-xl font-bold text-surface-900">Attestations</h1>
        </div>
      </div>

      <div className="mb-6">
        <SearchBar
          placeholder="Search by UID, attester, subject, or schema UID..."
          onSearch={handleSearch}
          defaultValue={search}
        />
      </div>

      {loading && <TableSkeleton rows={5} cols={6} />}

      {error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && (
        <>
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
                header: 'Schema',
                accessor: (row) => (
                  <Link href={`/schemas/${row.schemaUid}`} className="font-mono text-xs text-surface-500 hover:text-surface-900">
                    {truncateHex(row.schemaUid)}
                  </Link>
                ),
              },
              {
                header: 'Attester',
                accessor: (row) => (
                  <Link href={`/authorities/${row.attesterAddress}`} className="font-mono text-xs text-surface-500 hover:text-surface-900">
                    {truncateHex(row.attesterAddress)}
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
            data={data}
            keyExtractor={(row) => row.uid}
            emptyMessage="No attestations found"
            onRowClick={(row) => {
              window.location.href = `/attestations/${row.uid}`;
            }}
          />

          {pagination && (
            <div className="mt-4">
              <Pagination
                total={pagination.total}
                limit={pagination.limit}
                offset={pagination.offset}
                onPageChange={setOffset}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
