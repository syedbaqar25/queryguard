import { PredictResult, ExplainResult, ModelInfo } from '../../src/services/mlService';

export const mockPredictResult: PredictResult = {
  label: 'MALICIOUS',
  confidence: 0.97,
  safe_prob: 0.03,
  malicious_prob: 0.97,
  attack_type: 'UNION_BASED',
  latency_ms: 12,
};

export const mockSafePredictResult: PredictResult = {
  label: 'SAFE',
  confidence: 0.95,
  safe_prob: 0.95,
  malicious_prob: 0.05,
  attack_type: null,
  latency_ms: 10,
};

export const mockExplainResult: ExplainResult = {
  char_scores: Array(50).fill(0.1),
  top_suspicious_span: 'UNI',
  attention_rollout_matrix: Array(8).fill(Array(8).fill(0.125)),
  summary: 'High attention on UNION keyword indicating UNION_BASED injection',
  query: "SELECT * FROM users WHERE id=1 UNION SELECT null,null,null--",
};

export const mockModelInfo: ModelInfo = {
  d_model: 64,
  nhead: 4,
  num_layers: 2,
  d_ff: 128,
  vocab_size: 99,
  max_len: 256,
  parameter_count: 123456,
  trained: true,
  version: '1.0.0',
};

export const mlServiceMock = {
  predict: jest.fn().mockResolvedValue(mockPredictResult),
  explain: jest.fn().mockResolvedValue(mockExplainResult),
  getModelInfo: jest.fn().mockResolvedValue(mockModelInfo),
  getUncertainQueue: jest.fn().mockResolvedValue([
    { id: 'abc123', query: 'SELECT * FROM users', confidence: 0.51, timestamp: new Date().toISOString() },
  ]),
  labelEntry: jest.fn().mockResolvedValue({ success: true }),
  triggerRetrain: jest.fn().mockResolvedValue({ triggered: true, message: 'Retraining started' }),
  getModelVersions: jest.fn().mockResolvedValue({ versions: [] }),
  exportOnnx: jest.fn().mockResolvedValue({ path: 'model.onnx', size_bytes: 500000, opset: 17 }),
  getOnnxVocab: jest.fn().mockResolvedValue({ idx_to_char: {}, char_to_idx: {}, vocab_size: 99 }),
  getModelCard: jest.fn().mockResolvedValue('# Model Card'),
  healthCheck: jest.fn().mockResolvedValue({ status: 'ok', model_loaded: true }),
};
