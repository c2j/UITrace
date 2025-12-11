import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiResponse, handleApiError } from '../services/api';

// Generic API hook options
export interface UseApiOptions<T> {
  immediate?: boolean; // Fetch immediately on mount
  dependencies?: any[]; // Refetch when dependencies change
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
  retryCount?: number;
  retryDelay?: number;
}

// Generic API hook return type
export interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: any[]) => Promise<T | null>;
  refetch: () => Promise<T | null>;
  reset: () => void;
}

// Generic API hook
export function useApi<T>(
  apiFunction: (...args: any[]) => Promise<ApiResponse<T>>,
  options: UseApiOptions<T> = {}
): UseApiReturn<T> {
  const {
    immediate = true,
    dependencies = [],
    onSuccess,
    onError,
    retryCount = 3,
    retryDelay = 1000,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryAttempt = useRef(0);
  const lastArgs = useRef<any[]>([]);

  const execute = useCallback(async (...args: any[]): Promise<T | null> => {
    setLoading(true);
    setError(null);
    lastArgs.current = args;

    try {
      const response = await apiFunction(...args);

      if (response.success && response.data) {
        setData(response.data);
        onSuccess?.(response.data);
        retryAttempt.current = 0;
        return response.data;
      } else {
        const errorMessage = response.error || 'API request failed';
        setError(errorMessage);
        onError?.(errorMessage);

        // Retry logic
        if (retryAttempt.current < retryCount) {
          retryAttempt.current++;
          setTimeout(() => {
            execute(...args);
          }, retryDelay * retryAttempt.current);
        }

        return null;
      }
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      onError?.(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiFunction, onSuccess, onError, retryCount, retryDelay]);

  const refetch = useCallback(() => {
    return execute(...lastArgs.current);
  }, [execute]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
    retryAttempt.current = 0;
  }, []);

  // Auto-fetch on mount if immediate is true
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, []); // Empty dependency array - only run once on mount

  return {
    data,
    loading,
    error,
    execute,
    refetch,
    reset,
  };
}

// Hook for paginated data
export interface UsePaginatedApiOptions<T> extends UseApiOptions<T> {
  initialPage?: number;
  pageSize?: number;
}

export interface UsePaginatedApiReturn<T> extends UseApiReturn<T> {
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextPage: () => void;
  prevPage: () => void;
}

export function usePaginatedApi<T>(
  apiFunction: (params: { page: number; pageSize: number; [key: string]: any }) => Promise<ApiResponse<any>>,
  options: UsePaginatedApiOptions<T> = {}
): UsePaginatedApiReturn<T> {
  const { initialPage = 1, pageSize = 20, ...apiOptions } = options;
  const [page, setPage] = useState(initialPage);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<T[]>([]);

  const { data, loading, error, execute, refetch } = useApi(
    async (params: any = {}) => {
      const response = await apiFunction({
        page,
        pageSize: currentPageSize,
        ...params,
      });

      if (response.success && response.data) {
        setItems(response.data.items || []);
        setTotal(response.data.total || 0);
        return response.data.items || [];
      }

      return [];
    },
    {
      ...apiOptions,
      dependencies: [page, currentPageSize, ...(apiOptions.dependencies || [])],
    }
  );

  const hasNext = page * currentPageSize < total;
  const hasPrev = page > 1;

  const nextPage = () => {
    if (hasNext) setPage(page + 1);
  };

  const prevPage = () => {
    if (hasPrev) setPage(page - 1);
  };

  const changePageSize = (newSize: number) => {
    setCurrentPageSize(newSize);
    setPage(1); // Reset to first page
  };

  return {
    data: items,
    loading,
    error,
    execute,
    refetch,
    page,
    setPage,
    pageSize: currentPageSize,
    setPageSize: changePageSize,
    total,
    hasNext,
    hasPrev,
    nextPage,
    prevPage,
  };
}

// Hook for mutations (POST, PUT, DELETE)
export interface UseMutationOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: string, variables: TVariables) => void;
  onSettled?: (data: TData | null, error: string | null, variables: TVariables) => void;
  invalidateQueries?: (() => void)[];
}

export interface UseMutationReturn<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData | null>;
  loading: boolean;
  error: string | null;
  reset: () => void;
}

export function useMutation<TData, TVariables>(
  apiFunction: (variables: TVariables) => Promise<ApiResponse<TData>>,
  options: UseMutationOptions<TData, TVariables> = {}
): UseMutationReturn<TData, TVariables> {
  const { onSuccess, onError, onSettled, invalidateQueries = [] } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (variables: TVariables): Promise<TData | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFunction(variables);

      if (response.success && response.data) {
        onSuccess?.(response.data, variables);
        onSettled?.(response.data, null, variables);

        // Invalidate related queries
        invalidateQueries.forEach(query => {
          query();
        });

        return response.data;
      } else {
        const errorMessage = response.error || 'Mutation failed';
        setError(errorMessage);
        onError?.(errorMessage, variables);
        onSettled?.(null, errorMessage, variables);
        return null;
      }
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      onError?.(errorMessage, variables);
      onSettled?.(null, errorMessage, variables);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiFunction, onSuccess, onError, onSettled, invalidateQueries]);

  const reset = () => {
    setLoading(false);
    setError(null);
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

// Hook for WebSocket connection
export interface UseWebSocketOptions {
  onMessage?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnect?: boolean;
}

export interface UseWebSocketReturn {
  connected: boolean;
  send: (data: any) => void;
  disconnect: () => void;
  connect: () => Promise<void>;
}

export function useWebSocket(
  connectFunction: (onMessage: (data: any) => void, onError?: (error: Event) => void) => Promise<void>,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const { onMessage, onConnect, onDisconnect, onError } = options;
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<any>(null);

  const connect = useCallback(async () => {
    try {
      await connectFunction(
        (data) => {
          onMessage?.(data);
        },
        (error) => {
          onError?.(error);
        }
      );
      setConnected(true);
      onConnect?.();
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      setConnected(false);
    }
  }, [connectFunction, onMessage, onConnect, onError]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect();
      setConnected(false);
      onDisconnect?.();
    }
  }, [onDisconnect]);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, []);

  const send = useCallback((data: any) => {
    if (wsRef.current && connected) {
      wsRef.current.send(data);
    }
  }, [connected]);

  return {
    connected,
    send,
    disconnect,
    connect,
  };
}