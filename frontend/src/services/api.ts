import axios, { AxiosInstance } from 'axios';
import type {
  AnalysisResult,
  HistoryResponse,
  Stats,
  ExplainResult,
  AdversarialReport,
  ModelInfo,
  UncertainEntry,
  LabelSuggestion,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || '';

function createClient(apiKey: string): AxiosInstance {
  return axios.create({
    baseURL: `${API_URL}/api`,
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: 30000,
  });
}

export class QueryGuardAPI {
  private client: AxiosInstance;

  constructor(apiKey: string) {
    this.client = createClient(apiKey);
  }

  async analyze(query: string, source = 'web'): Promise<AnalysisResult> {
    const { data } = await this.client.post<AnalysisResult>('/analyze', { query, source });
    return data;
  }

  async getHistory(page = 1, limit = 20, filter: 'all' | 'safe' | 'malicious' = 'all'): Promise<HistoryResponse> {
    const { data } = await this.client.get<HistoryResponse>('/history', {
      params: { page, limit, filter },
    });
    return data;
  }

  async getStats(): Promise<Stats> {
    const { data } = await this.client.get<Stats>('/stats');
    return data;
  }

  async getModelInfo(): Promise<ModelInfo> {
    const { data } = await this.client.get<ModelInfo>('/stats/model');
    return data;
  }

  async explain(query: string): Promise<ExplainResult> {
    const { data } = await this.client.post<ExplainResult>('/explain', { query });
    return data;
  }

  async testAdversarial(query: string, testRobustness = false): Promise<AdversarialReport> {
    const { data } = await this.client.post<AdversarialReport>('/adversarial', {
      query,
      test_robustness: testRobustness,
    });
    return data;
  }

  async getUncertainQueue(): Promise<{ items: UncertainEntry[]; count: number }> {
    const { data } = await this.client.get('/active-learning/queue');
    return data;
  }

  async labelEntry(id: string, label: 'SAFE' | 'MALICIOUS'): Promise<{ success: boolean }> {
    const { data } = await this.client.post(`/active-learning/queue/${id}/label`, { label });
    return data;
  }

  async suggestLabel(query: string, confidence: number): Promise<LabelSuggestion> {
    const { data } = await this.client.post<LabelSuggestion>('/active-learning/suggest', {
      query,
      confidence,
    });
    return data;
  }

  async triggerRetrain(): Promise<{ triggered: boolean; message: string }> {
    const { data } = await this.client.post('/active-learning/retrain');
    return data;
  }

  createEventSource(): EventSource {
    return new EventSource(`${API_URL}/api/stream`, {});
  }
}

let _api: QueryGuardAPI | null = null;

export function getAPI(): QueryGuardAPI {
  if (!_api) throw new Error('API not initialized — call initAPI first');
  return _api;
}

export function initAPI(apiKey: string): QueryGuardAPI {
  _api = new QueryGuardAPI(apiKey);
  return _api;
}
