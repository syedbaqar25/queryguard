export interface QueryGuardConfig {
  apiUrl: string;
  apiKey: string;
  timeoutMs?: number;
  blockOnMalicious?: boolean;
  onMalicious?: (query: string, result: AnalysisResult) => void;
  cacheSize?: number;
  cacheTtlMs?: number;
}

export interface AnalysisResult {
  id: string;
  label: 'SAFE' | 'MALICIOUS';
  confidence: number;
  safe_prob: number;
  malicious_prob: number;
  attack_type: string | null;
  latency_ms: number;
  timestamp: string;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}
