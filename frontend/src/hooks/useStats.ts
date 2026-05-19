import { useEffect, useCallback } from 'react';
import { useQueryStore } from '../stores/queryStore';
import { getAPI } from '../services/api';

export function useStats(autoRefreshMs = 0) {
  const { setStats, setError } = useQueryStore();

  const refresh = useCallback(async () => {
    try {
      const stats = await getAPI().getStats();
      setStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    }
  }, [setStats, setError]);

  useEffect(() => {
    refresh();
    if (autoRefreshMs > 0) {
      const timer = setInterval(refresh, autoRefreshMs);
      return () => clearInterval(timer);
    }
  }, [refresh, autoRefreshMs]);

  return { refresh };
}
