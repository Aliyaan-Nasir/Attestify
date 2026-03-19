'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, AlertTriangle } from 'lucide-react';
import { indexerApi } from '@/lib/api';

export type SearchInputType = 'uid' | 'address' | 'invalid';

export function detectSearchType(input: string): SearchInputType {
  const trimmed = input.trim().toLowerCase();
  if (/^0x[0-9a-f]{64}$/.test(trimmed)) return 'uid';
  if (/^0x[0-9a-f]{40}$/.test(trimmed)) return 'address';
  return 'invalid';
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setSearching(true);
    setError(null);

    const type = detectSearchType(trimmed);

    try {
      if (type === 'address') {
        router.push(`/authorities/${trimmed}`);
        return;
      }

      if (type === 'uid') {
        try {
          const attRes = await indexerApi.getAttestation(trimmed);
          if (attRes.success && attRes.data) {
            router.push(`/attestations/${trimmed}`);
            return;
          }
        } catch { /* not an attestation */ }

        try {
          const schemaRes = await indexerApi.getSchema(trimmed);
          if (schemaRes.success && schemaRes.data) {
            router.push(`/schemas/${trimmed}`);
            return;
          }
        } catch { /* not found */ }

        setError('No attestation or schema found with this UID.');
      } else {
        setError('Invalid input. Enter a 66-character hex UID (0x + 64 chars) or a 42-character hex address (0x + 40 chars).');
      }
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header with icon + badge */}
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
          <Search className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-surface-900">Universal Search</h1>
            <span className="rounded-full bg-surface-200 px-3 py-0.5 text-xs font-medium text-surface-600">
              Retrieval Flow
            </span>
          </div>
          <p className="mt-1 text-sm text-surface-500">
            Search by Attestation UID, Schema UID, or Hedera account address.
          </p>
        </div>
      </div>

      <div className="max-w-lg">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="rounded-lg border border-surface-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-surface-900">Search</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="0x... (UID or address)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={searching}
                className="flex-1 rounded-md border border-surface-200 bg-white px-3 py-2 font-mono text-sm text-surface-700 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                data-testid="search-input"
              />
              <button
                type="submit"
                disabled={!query.trim() || searching}
                className="flex items-center gap-1.5 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </button>
            </div>

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3" data-testid="search-error">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-surface-200 bg-white p-4">
            <p className="mb-2 text-xs font-medium text-surface-500">Accepted formats</p>
            <ul className="space-y-1 text-xs text-surface-500">
              <li><span className="font-mono text-surface-600">0x + 64 hex chars</span> — Attestation or Schema UID</li>
              <li><span className="font-mono text-surface-600">0x + 40 hex chars</span> — Authority address</li>
            </ul>
          </div>
        </form>
      </div>
    </div>
  );
}
