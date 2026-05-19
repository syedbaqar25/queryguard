import { create } from 'zustand';
import type { AnalysisResult, AuditEntry, Stats, SSEEvent } from '../types';

interface QueryState {
  apiKey: string;
  setApiKey: (key: string) => void;

  lastResult: AnalysisResult | null;
  setLastResult: (result: AnalysisResult | null) => void;

  isAnalyzing: boolean;
  setIsAnalyzing: (v: boolean) => void;

  history: AuditEntry[];
  setHistory: (items: AuditEntry[]) => void;
  prependHistoryEntry: (entry: AuditEntry) => void;

  stats: Stats | null;
  setStats: (stats: Stats) => void;

  liveEvents: SSEEvent[];
  addLiveEvent: (event: SSEEvent) => void;
  clearLiveEvents: () => void;

  sseConnected: boolean;
  setSseConnected: (v: boolean) => void;

  error: string | null;
  setError: (err: string | null) => void;
}

export const useQueryStore = create<QueryState>((set) => ({
  apiKey: localStorage.getItem('queryguard_api_key') || '',
  setApiKey: (key) => {
    localStorage.setItem('queryguard_api_key', key);
    set({ apiKey: key });
  },

  lastResult: null,
  setLastResult: (result) => set({ lastResult: result }),

  isAnalyzing: false,
  setIsAnalyzing: (v) => set({ isAnalyzing: v }),

  history: [],
  setHistory: (items) => set({ history: items }),
  prependHistoryEntry: (entry) => set((state) => ({ history: [entry, ...state.history] })),

  stats: null,
  setStats: (stats) => set({ stats }),

  liveEvents: [],
  addLiveEvent: (event) =>
    set((state) => ({
      liveEvents: [event, ...state.liveEvents].slice(0, 50),
    })),
  clearLiveEvents: () => set({ liveEvents: [] }),

  sseConnected: false,
  setSseConnected: (v) => set({ sseConnected: v }),

  error: null,
  setError: (err) => set({ error: err }),
}));
