export type Label = 'SAFE' | 'MALICIOUS';

export type AttackType =
  | 'UNION_BASED'
  | 'BOOLEAN_BLIND'
  | 'TIME_BASED'
  | 'ERROR_BASED'
  | 'STACKED_QUERY'
  | 'COMMAND_EXEC'
  | 'COMMENT_INJECTION'
  | 'OBFUSCATED'
  | null;

export interface AnalysisResult {
  id: string;
  query: string;
  label: Label;
  confidence: number;
  safe_prob: number;
  malicious_prob: number;
  attack_type: AttackType;
  latency_ms: number;
  timestamp: string;
}

export interface AuditEntry {
  id: string;
  tenantId: string;
  query: string;
  label: Label;
  confidence: number;
  attackType: AttackType;
  latencyMs: number;
  timestamp: string;
  source: string;
}

export interface HistoryResponse {
  items: AuditEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface Stats {
  totalAnalyzed: number;
  totalMalicious: number;
  totalSafe: number;
  detectionRate: number;
  avgConfidence: number;
  avgLatencyMs: number;
  attackTypeBreakdown: Record<string, number>;
  recentTrend: { hour: string; safe: number; malicious: number }[];
}

export interface ExplainResult {
  char_scores: number[];
  top_suspicious_span: string;
  attention_rollout_matrix: number[][];
  summary: string;
  query: string;
}

export interface ObfuscationResult {
  technique: string;
  original: string;
  obfuscated: string;
}

export interface AdversarialReport {
  original_query: string;
  obfuscations: ObfuscationResult[];
  robustness_score?: number;
  vulnerable_to?: string[];
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

export interface UncertainEntry {
  id: string;
  query: string;
  confidence: number;
  timestamp: string;
}

export interface LabelSuggestion {
  suggested_label: Label;
  confidence: number;
  reasoning: string;
  attack_type: AttackType;
}

export interface SSEEvent {
  type: 'analysis' | 'connected';
  tenantId?: string;
  clientId?: string;
  data?: {
    id: string;
    query: string;
    label: Label;
    confidence: number;
    attackType: AttackType;
    latencyMs: number;
    timestamp: string;
  };
}
