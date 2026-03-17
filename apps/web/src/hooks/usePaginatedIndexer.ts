'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PaginatedResponse } from '@/lib/api';

interface UsePaginatedResult<T> {
  data: T[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean } | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePaginatedIndexer<T>(
  fetcher: () => Promise<PaginatedResponse<T[]>>,
  deps: unknown[] = [],
): UsePaginatedResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState<UsePaginatedResult<T>['pagination']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => {
    setTrigger((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcher()
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setData(res.data);
          setPagination(res.pagination ?? null);
        } else {
          setError('Request failed');
        }
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, ...deps]);

  return { data, pagination, loading, error, refetch };
}
