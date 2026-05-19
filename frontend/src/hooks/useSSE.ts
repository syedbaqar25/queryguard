import { useEffect, useRef } from 'react';
import { useQueryStore } from '../stores/queryStore';
import type { SSEEvent } from '../types';

export function useSSE(apiKey: string) {
  const { addLiveEvent, setSseConnected } = useQueryStore();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!apiKey) return;

    const API_URL = import.meta.env.VITE_API_URL || '';
    const url = `${API_URL}/api/stream`;

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setSseConnected(true);

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as SSEEvent;
        addLiveEvent(parsed);
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      es.close();
      setSseConnected(false);
      esRef.current = null;
    };
  }, [apiKey, addLiveEvent, setSseConnected]);
}
