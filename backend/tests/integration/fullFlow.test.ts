import request from 'supertest';
import app from '../../src/app';
import { keyService } from '../../src/services/keyService';
import { mlService } from '../../src/services/mlService';
import { mockPredictResult, mockSafePredictResult, mockExplainResult } from '../mocks/mlService.mock';

jest.mock('../../src/services/mlService');
const mockedMl = mlService as jest.Mocked<typeof mlService>;

let apiKey: string;
const TENANT = 'integration-test';

beforeAll(() => {
  const tenant = keyService.createTenant(TENANT, 'Integration Test Tenant');
  apiKey = tenant.apiKey;
});

afterEach(() => jest.clearAllMocks());

describe('Full analysis flow', () => {
  it('analyze → stats → history pipeline', async () => {
    mockedMl.predict.mockResolvedValue(mockPredictResult);

    const analyzeRes = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query: "SELECT * FROM users WHERE id=1 UNION SELECT null--" });
    expect(analyzeRes.status).toBe(200);
    expect(analyzeRes.body.label).toBe('MALICIOUS');
    const analysisId = analyzeRes.body.id;

    const statsRes = await request(app)
      .get('/api/stats')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.totalAnalyzed).toBeGreaterThanOrEqual(1);
    expect(statsRes.body.totalMalicious).toBeGreaterThanOrEqual(1);

    const historyRes = await request(app)
      .get('/api/history')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(historyRes.status).toBe(200);
    const found = historyRes.body.items.find((item: { id: string }) => item.id === analysisId);
    expect(found).toBeDefined();
  });

  it('analyze safe → filter in history', async () => {
    mockedMl.predict.mockResolvedValue(mockSafePredictResult);

    await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query: 'SELECT name FROM products WHERE id = $1' });

    const historyRes = await request(app)
      .get('/api/history?filter=safe')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.total).toBeGreaterThanOrEqual(1);
    historyRes.body.items.forEach((item: { label: string }) => {
      expect(item.label).toBe('SAFE');
    });
  });

  it('explain endpoint works after analyze', async () => {
    mockedMl.explain.mockResolvedValue(mockExplainResult);

    const explainRes = await request(app)
      .post('/api/explain')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query: "SELECT * FROM users WHERE id=1 UNION SELECT null--" });
    expect(explainRes.status).toBe(200);
    expect(explainRes.body.char_scores).toBeDefined();
  });

  it('adversarial obfuscations all have different text than original', async () => {
    const query = "SELECT * FROM users WHERE id=1 OR 1=1--";
    const res = await request(app)
      .post('/api/adversarial')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query });
    expect(res.status).toBe(200);
    expect(res.body.obfuscations.length).toBe(8);
  });

  it('usage tracking increments with each request', async () => {
    mockedMl.predict.mockResolvedValue(mockSafePredictResult);
    const before = await request(app)
      .get('/api/keys/usage')
      .set('Authorization', `Bearer ${apiKey}`);
    const beforeCount = before.body.totalRequests;

    await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query: 'SELECT 1' });

    const after = await request(app)
      .get('/api/keys/usage')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(after.body.totalRequests).toBeGreaterThan(beforeCount);
  });
});
