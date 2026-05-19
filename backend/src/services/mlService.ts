import axios, { AxiosInstance } from 'axios';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

export interface PredictResult {
  label: 'SAFE' | 'MALICIOUS';
  confidence: number;
  safe_prob: number;
  malicious_prob: number;
  attack_type: string | null;
  latency_ms: number;
  transformer_score?: number;
  ast_score?: number;
  ensemble_malicious_prob?: number;
}

export interface ExplainResult {
  char_scores: number[];
  top_suspicious_span: string;
  attention_rollout_matrix: number[][];
  summary: string;
  query: string;
}

export interface ModelInfo {
  d_model: number;
  nhead: number;
  num_layers: number;
  d_ff: number;
  vocab_size: number;
  max_len: number;
  parameter_count: number;
  trained: boolean;
  version: string;
}

class MLService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: ML_SERVICE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async predict(query: string): Promise<PredictResult> {
    const { data } = await this.client.post<PredictResult>('/predict', { query });
    return data;
  }

  async explain(query: string): Promise<ExplainResult> {
    const { data } = await this.client.post<ExplainResult>('/explain', { query });
    return data;
  }

  async getModelInfo(): Promise<ModelInfo> {
    const { data } = await this.client.get<ModelInfo>('/model-info');
    return data;
  }

  async getUncertainQueue(): Promise<{ id: string; query: string; confidence: number; timestamp: string }[]> {
    const { data } = await this.client.get('/uncertain-queue');
    return data;
  }

  async labelEntry(id: string, label: 'SAFE' | 'MALICIOUS'): Promise<{ success: boolean }> {
    const { data } = await this.client.post(`/uncertain-queue/${id}/label`, { label });
    return data;
  }

  async triggerRetrain(): Promise<{ triggered: boolean; message: string }> {
    const { data } = await this.client.post('/retrain');
    return data;
  }

  async getModelVersions(): Promise<{ versions: { version: string; timestamp: string; metrics: object }[] }> {
    const { data } = await this.client.get('/model-versions');
    return data;
  }

  async exportOnnx(): Promise<{ path: string; size_bytes: number; opset: number }> {
    const { data } = await this.client.post('/onnx/export');
    return data;
  }

  async getOnnxVocab(): Promise<{ idx_to_char: Record<string, string>; char_to_idx: Record<string, number>; vocab_size: number }> {
    const { data } = await this.client.get('/onnx/vocab');
    return data;
  }

  async getModelCard(): Promise<string> {
    const { data } = await this.client.get('/model-card');
    return data;
  }

  async healthCheck(): Promise<{ status: string; model_loaded: boolean }> {
    const { data } = await this.client.get('/health');
    return data;
  }
}

export const mlService = new MLService();
