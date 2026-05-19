import { useCallback } from 'react';
import { useQueryStore } from '../stores/queryStore';
import { getAPI } from '../services/api';

export function useAnalyze() {
  const { setLastResult, setIsAnalyzing, setError, prependHistoryEntry } = useQueryStore();

  const analyze = useCallback(async (query: string) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await getAPI().analyze(query);
      setLastResult(result);
      prependHistoryEntry({
        id: result.id,
        tenantId: '',
        query: result.query,
        label: result.label,
        confidence: result.confidence,
        attackType: result.attack_type,
        latencyMs: result.latency_ms,
        timestamp: result.timestamp,
        source: 'web',
      });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [setLastResult, setIsAnalyzing, setError, prependHistoryEntry]);

  return { analyze };
}
