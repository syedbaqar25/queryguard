import nock from 'nock';
import { QueryGuardClient } from '../src/client';
import { LRUCache } from '../src/cache';
import type { AnalysisResult } from '../src/types';

const BASE_URL = 'http://localhost:3001';
const API_KEY = 'test-key-12345';

const maliciousResult: AnalysisResult = {
  id: 'abc',
  label: 'MALICIOUS',
  confidence: 0.97,
  safe_prob: 0.03,
  malicious_prob: 0.97,
  attack_type: 'UNION_BASED',
  latency_ms: 12,
  timestamp: new Date().toISOString(),
};

const safeResult: AnalysisResult = {
  id: 'def',
  label: 'SAFE',
  confidence: 0.95,
  safe_prob: 0.95,
  malicious_prob: 0.05,
  attack_type: null,
  latency_ms: 8,
  timestamp: new Date().toISOString(),
};

afterEach(() => nock.cleanAll());

describe('LRUCache', () => {
  it('stores and retrieves values', () => {
    const cache = new LRUCache<string>(10, 60000);
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('evicts LRU entry when capacity exceeded', () => {
    const cache = new LRUCache<string>(2, 60000);
    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.set('c', 'C');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('B');
    expect(cache.get('c')).toBe('C');
  });

  it('evicts expired entries', async () => {
    const cache = new LRUCache<string>(10, 1);
    cache.set('key', 'value');
    await new Promise((r) => setTimeout(r, 10));
    expect(cache.get('key')).toBeUndefined();
  });

  it('moves accessed node to front (MRU)', () => {
    const cache = new LRUCache<string>(2, 60000);
    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.get('a');
    cache.set('c', 'C');
    expect(cache.get('a')).toBe('A');
    expect(cache.get('b')).toBeUndefined();
  });

  it('updates existing key without growing size', () => {
    const cache = new LRUCache<string>(3, 60000);
    cache.set('a', 'A1');
    cache.set('a', 'A2');
    expect(cache.size).toBe(1);
    expect(cache.get('a')).toBe('A2');
  });
});

describe('QueryGuardClient', () => {
  it('returns analysis result for safe query', async () => {
    nock(BASE_URL).post('/api/analyze').reply(200, safeResult);
    const client = new QueryGuardClient({ apiUrl: BASE_URL, apiKey: API_KEY });
    const result = await client.analyze('SELECT 1');
    expect(result.label).toBe('SAFE');
  });

  it('returns cached result on second call', async () => {
    nock(BASE_URL).post('/api/analyze').once().reply(200, safeResult);
    const client = new QueryGuardClient({ apiUrl: BASE_URL, apiKey: API_KEY });
    await client.analyze('SELECT 1');
    const result = await client.analyze('SELECT 1');
    expect(result.label).toBe('SAFE');
    expect(nock.isDone()).toBe(true);
  });

  it('opens circuit breaker after 5 failures', async () => {
    nock(BASE_URL).post('/api/analyze').times(5).replyWithError('ECONNREFUSED');
    const client = new QueryGuardClient({ apiUrl: BASE_URL, apiKey: API_KEY });
    for (let i = 0; i < 5; i++) {
      await client.analyze(`query_${i}`).catch(() => {});
    }
    expect(client.getBreakerState().isOpen).toBe(true);
  });

  it('throws when circuit breaker is open', async () => {
    nock(BASE_URL).post('/api/analyze').times(5).replyWithError('fail');
    const client = new QueryGuardClient({ apiUrl: BASE_URL, apiKey: API_KEY });
    for (let i = 0; i < 5; i++) {
      await client.analyze(`q${i}`).catch(() => {});
    }
    await expect(client.analyze('SELECT 1')).rejects.toThrow('circuit breaker');
  });

  it('detects malicious query', async () => {
    nock(BASE_URL).post('/api/analyze').reply(200, maliciousResult);
    const client = new QueryGuardClient({ apiUrl: BASE_URL, apiKey: API_KEY });
    const result = await client.analyze("SELECT * UNION SELECT null--");
    expect(result.label).toBe('MALICIOUS');
    expect(result.attack_type).toBe('UNION_BASED');
  });
});
