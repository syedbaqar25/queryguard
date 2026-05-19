import request from 'supertest';
import app from '../src/app';
import { keyService } from '../src/services/keyService';
import { auditService } from '../src/services/auditService';
import { mlService } from '../src/services/mlService';
import { mockModelInfo } from './mocks/mlService.mock';

jest.mock('../src/services/mlService');
const mockedMl = mlService as jest.Mocked<typeof mlService>;

let apiKey: string;
const TENANT = 'stats-test';

beforeAll(() => {
  const tenant = keyService.createTenant(TENANT, 'Stats Test Tenant');
  apiKey = tenant.apiKey;

  auditService.append(TENANT, { query: 'SELECT 1', label: 'SAFE', confidence: 0.9, attackType: null, latencyMs: 10, source: 'test' });
  auditService.append(TENANT, { query: "' OR 1=1", label: 'MALICIOUS', confidence: 0.97, attackType: 'BOOLEAN_BLIND', latencyMs: 15, source: 'test' });
  auditService.append(TENANT, { query: 'UNION SELECT', label: 'MALICIOUS', confidence: 0.99, attackType: 'UNION_BASED', latencyMs: 20, source: 'test' });
});

afterEach(() => jest.clearAllMocks());

describe('GET /api/stats', () => {
  it('returns aggregate statistics', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(200);
    expect(res.body.totalAnalyzed).toBe(3);
    expect(res.body.totalMalicious).toBe(2);
    expect(res.body.totalSafe).toBe(1);
    expect(res.body.detectionRate).toBeCloseTo(2 / 3);
    expect(res.body.avgConfidence).toBeDefined();
    expect(res.body.avgLatencyMs).toBeDefined();
    expect(res.body.attackTypeBreakdown).toBeDefined();
    expect(res.body.recentTrend).toHaveLength(24);
  });

  it('attackTypeBreakdown contains correct types', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.body.attackTypeBreakdown['BOOLEAN_BLIND']).toBe(1);
    expect(res.body.attackTypeBreakdown['UNION_BASED']).toBe(1);
  });
});

describe('GET /api/stats/model', () => {
  it('returns model info from ML service', async () => {
    mockedMl.getModelInfo.mockResolvedValue(mockModelInfo);
    const res = await request(app)
      .get('/api/stats/model')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(200);
    expect(res.body.d_model).toBe(64);
    expect(res.body.trained).toBe(true);
  });

  it('returns 502 when ML service is down', async () => {
    mockedMl.getModelInfo.mockRejectedValue(new Error('down'));
    const res = await request(app)
      .get('/api/stats/model')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(502);
  });
});
