/**
 * Custom hooks for optimized data fetching with caching and prefetching
 */

import { useEffect, useState, useCallback } from 'react';
import { cachedFetch, prefetch, invalidateCache } from '../lib/api';

interface UseOptimizedDataOptions<T> {
  skip?: boolean;
  cacheTTL?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseOptimizedDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

/**
 * Hook for fetching data with caching support
 */
export function useOptimizedData<T>(
  endpoint: string,
  options: UseOptimizedDataOptions<T> = {}
): UseOptimizedDataResult<T> {
  const { skip = false, cacheTTL, onSuccess, onError } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (skip) return;

    setLoading(true);
    setError(null);

    try {
      const result = await cachedFetch<T>(endpoint, { cacheTTL });
      setData(result);
      onSuccess?.(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  }, [endpoint, skip, cacheTTL, onSuccess, onError]);

  const invalidate = useCallback(() => {
    invalidateCache(endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  }, [endpoint]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    invalidate,
  };
}

/**
 * Hook for prefetching data on hover or mount
 */
export function usePrefetch() {
  return useCallback((endpoint: string, delay: number = 0) => {
    if (delay > 0) {
      setTimeout(() => prefetch(endpoint), delay);
    } else {
      prefetch(endpoint);
    }
  }, []);
}

/**
 * Hook for optimistic updates
 */
export function useOptimisticUpdate<T>() {
  return useCallback(
    async (
      currentData: T,
      updateFn: () => Promise<T>,
      optimisticUpdate: (data: T) => T
    ): Promise<T> => {
      // Apply optimistic update immediately
      const optimisticData = optimisticUpdate(currentData);

      try {
        // Perform actual update
        const result = await updateFn();
        return result;
      } catch (error) {
        // Revert to original data on error
        throw error;
      }
    },
    []
  );
}

/**
 * Hook for pagination with prefetching
 */
interface UsePaginationOptions {
  pageSize?: number;
  prefetchNext?: boolean;
}

export function usePagination<T>(
  getEndpoint: (page: number, pageSize: number) => string,
  options: UsePaginationOptions = {}
) {
  const { pageSize = 10, prefetchNext = true } = options;
  const [page, setPage] = useState(1);
  
  const endpoint = getEndpoint(page, pageSize);
  const { data, loading, error, refetch } = useOptimizedData<T>(endpoint);

  // Prefetch next page
  useEffect(() => {
    if (prefetchNext && !loading && data) {
      const nextEndpoint = getEndpoint(page + 1, pageSize);
      prefetch(nextEndpoint);
    }
  }, [page, pageSize, prefetchNext, loading, data, getEndpoint]);

  const nextPage = useCallback(() => {
    setPage(p => p + 1);
  }, []);

  const previousPage = useCallback(() => {
    setPage(p => Math.max(1, p - 1));
  }, []);

  const goToPage = useCallback((newPage: number) => {
    setPage(Math.max(1, newPage));
  }, []);

  return {
    data,
    loading,
    error,
    page,
    nextPage,
    previousPage,
    goToPage,
    refetch,
  };
}
