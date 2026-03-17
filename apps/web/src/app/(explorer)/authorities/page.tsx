'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { indexerApi } from '@/lib/api';
import { usePaginatedIndexer } from '@/hooks/usePaginatedIndexer';
import { truncateHex, formatDate } from '@/lib/format';
import { SearchBar } from '@/components/explorer/SearchBar';
import { DataTable } from '@/components/explorer/DataTable';
import { Pagination } from '@/components/explorer/Pagination';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import type { AuthorityRecord } from '@/lib/api';

const PAGE_SIZE = 20;

export default function AuthoritiesPage() {
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  const { data, pagination, loading, error, refetch } = usePaginatedIndexer(
    () => indexerApi.getAuthorities({ limit: PAGE_SIZE, offset, search: search || undefined }),
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
          <ShieldCheck className="h-5 w-5 text-brand-500" />
          <h1 className="text-xl font-bold text-surface-900">Authorities</h1>
        </div>
      </div>

      <div className="mb-6">
        <SearchBar
          placeholder="Search by address..."
          onSearch={handleSearch}
          defaultValue={search}
        />
      </div>

      {loading && <TableSkeleton rows={5} cols={4} />}

      {error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && (
        <>
          <DataTable<AuthorityRecord>
            columns={[
              {
                header: 'Address',
                accessor: (row) => (
                  <Link href={`/authorities/${row.address}`} className="font-mono text-xs text-brand-500 hover:underline">
                    {truncateHex(row.address)}
                  </Link>
                ),
              },
              {
                header: 'Metadata',
                accessor: (row) => (
                  <span className="block max-w-xs truncate text-xs text-surface-600">{row.metadata || '—'}</span>
                ),
              },
              {
                header: 'Verified',
                accessor: (row) =>
                  row.isVerified ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : (
                    <span className="text-xs text-surface-500">Unverified</span>
                  ),
              },
              {
                header: 'Registered',
                accessor: (row) => <span className="text-xs text-surface-500">{formatDate(row.createdAt)}</span>,
              },
            ]}
            data={data}
            keyExtractor={(row) => row.address}
            emptyMessage="No authorities found"
            onRowClick={(row) => {
              window.location.href = `/authorities/${row.address}`;
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
