import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useQueryStore } from '../src/stores/queryStore';
import type { AnalysisResult, Stats } from '../src/types';

vi.mock('../src/stores/queryStore', async () => {
  const { create } = await import('zustand');
  const store = create(() => ({
    apiKey: '',
    setApiKey: vi.fn(),
    lastResult: null,
    setLastResult: vi.fn(),
    isAnalyzing: false,
    setIsAnalyzing: vi.fn(),
    history: [],
    setHistory: vi.fn(),
    prependHistoryEntry: vi.fn(),
    stats: null,
    setStats: vi.fn(),
    liveEvents: [],
    addLiveEvent: vi.fn(),
    clearLiveEvents: vi.fn(),
    sseConnected: false,
    setSseConnected: vi.fn(),
    error: null,
    setError: vi.fn(),
  }));
  return { useQueryStore: store };
});

describe('queryStore', () => {
  it('has default state', () => {
    const state = useQueryStore.getState();
    expect(state.lastResult).toBeNull();
    expect(state.isAnalyzing).toBe(false);
    expect(state.history).toHaveLength(0);
    expect(state.stats).toBeNull();
    expect(state.liveEvents).toHaveLength(0);
    expect(state.sseConnected).toBe(false);
    expect(state.error).toBeNull();
  });
});
