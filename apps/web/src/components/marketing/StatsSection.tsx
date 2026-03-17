'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { indexerApi } from '@/lib/api';

interface StatItem {
  label: string;
  value: string;
}

export function StatsSection() {
  const [stats, setStats] = useState<StatItem[]>([
    { label: 'Schemas Registered', value: '--' },
    { label: 'Attestations Issued', value: '--' },
    { label: 'Authorities', value: '--' },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [schemas, attestations, authorities] = await Promise.all([
        indexerApi.getSchemas({ limit: 1 }),
        indexerApi.getAttestations({ limit: 1 }),
        indexerApi.getAuthorities({ limit: 1 }),
      ]);

      setStats([
        { label: 'Schemas Registered', value: formatCount(schemas.pagination?.total ?? 0) },
        { label: 'Attestations Issued', value: formatCount(attestations.pagination?.total ?? 0) },
        { label: 'Authorities', value: formatCount(authorities.pagination?.total ?? 0) },
      ]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <section className="border-b border-surface-200 bg-surface-50">
      <div className="mx-auto grid max-w-5xl grid-cols-1 divide-y divide-surface-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {stats.map((stat) => (
          <div key={stat.label} className="px-6 py-8 text-center">
            {loading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-16 animate-pulse rounded bg-surface-200" />
                <p className="text-sm text-surface-400">{stat.label}</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-2">
                <p className="text-3xl font-bold tracking-tight text-surface-300">--</p>
                <p className="text-sm text-surface-400">{stat.label}</p>
              </div>
            ) : (
              <>
                <p className="text-3xl font-bold tracking-tight text-surface-900">{stat.value}</p>
                <p className="mt-1 text-sm text-surface-500">{stat.label}</p>
              </>
            )}
          </div>
        ))}
      </div>
      {error && !loading && (
        <div className="flex justify-center border-t border-surface-200 py-3">
          <button
            onClick={fetchStats}
            className="inline-flex items-center gap-1.5 text-xs text-surface-400 transition-colors hover:text-surface-600"
          >
            <RefreshCw className="h-3 w-3" />
            Failed to load stats. Retry
          </button>
        </div>
      )}
    </section>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
