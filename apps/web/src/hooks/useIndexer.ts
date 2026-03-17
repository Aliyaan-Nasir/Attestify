'use client';

import { useCallback, useEffect, useState } from 'react';

interface UseIndexerResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useIndexer<T>(
  fetcher: () => Promise<{ success: boolean; data: T }>,
  deps: unknown[] = [],
): UseIndexerResult<T> {
  const [data, setData] = useState<T | null>(null);
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

  return { data, loading, error, refetch };
}
