import axios, { AxiosInstance } from 'axios';
import { LRUCache } from './cache';
import type { AnalysisResult, QueryGuardConfig, CircuitBreakerState } from './types';

const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_OPEN_WINDOW_MS = 30000;

export class QueryGuardClient {
  private http: AxiosInstance;
  private cache: LRUCache<AnalysisResult>;
  private breaker: CircuitBreakerState;

  constructor(private config: QueryGuardConfig) {
    this.http = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeoutMs ?? 5000,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    this.cache = new LRUCache<AnalysisResult>(
      config.cacheSize ?? 500,
      config.cacheTtlMs ?? 60000
    );

    this.breaker = { failures: 0, lastFailure: 0, isOpen: false };
  }

  private isBreakerOpen(): boolean {
    if (!this.breaker.isOpen) return false;
    if (Date.now() - this.breaker.lastFailure > CIRCUIT_OPEN_WINDOW_MS) {
      this.breaker.isOpen = false;
      this.breaker.failures = 0;
      return false;
    }
    return true;
  }

  private recordFailure(): void {
    this.breaker.failures++;
    this.breaker.lastFailure = Date.now();
    if (this.breaker.failures >= CIRCUIT_FAILURE_THRESHOLD) {
      this.breaker.isOpen = true;
    }
  }

  private recordSuccess(): void {
    this.breaker.failures = 0;
    this.breaker.isOpen = false;
  }

  async analyze(query: string): Promise<AnalysisResult> {
    const cacheKey = query;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    if (this.isBreakerOpen()) {
      throw new Error('QueryGuard circuit breaker is open — service temporarily unavailable');
    }

    try {
      const { data } = await this.http.post<AnalysisResult>('/api/analyze', { query });
      this.cache.set(cacheKey, data);
      this.recordSuccess();
      return data;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }

  getBreakerState(): CircuitBreakerState {
    return { ...this.breaker };
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}
