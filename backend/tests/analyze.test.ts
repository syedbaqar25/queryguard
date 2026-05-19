import request from 'supertest';
import app from '../src/app';
import { mlService } from '../src/services/mlService';
import { mockPredictResult, mockSafePredictResult } from './mocks/mlService.mock';
import { keyService } from '../src/services/keyService';

jest.mock('../src/services/mlService');

const mockedMl = mlService as jest.Mocked<typeof mlService>;
let apiKey: string;

beforeAll(() => {
  const tenant = keyService.createTenant('test-analyze', 'Test Analyze Tenant');
  apiKey = tenant.apiKey;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/analyze', () => {
  it('returns 401 without API key', async () => {
    const res = await request(app).post('/api/analyze').send({ query: 'SELECT 1' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for empty query', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query: '' });
    expect(res.status).toBe(400);
  });

  it('returns prediction for malicious query', async () => {
    mockedMl.predict.mockResolvedValue(mockPredictResult);
    const res = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query: "SELECT * FROM users WHERE id=1 UNION SELECT null,null--" });

    expect(res.status).toBe(200);
    expect(res.body.label).toBe('MALICIOUS');
    expect(res.body.confidence).toBeGreaterThan(0.9);
    expect(res.body.attack_type).toBe('UNION_BASED');
    expect(res.body.id).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns prediction for safe query', async () => {
    mockedMl.predict.mockResolvedValue(mockSafePredictResult);
    const res = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query: 'SELECT name FROM products WHERE category = $1' });

    expect(res.status).toBe(200);
    expect(res.body.label).toBe('SAFE');
    expect(res.body.attack_type).toBeNull();
  });

  it('returns 502 when ML service is down', async () => {
    mockedMl.predict.mockRejectedValue(new Error('Connection refused'));
    const res = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query: 'SELECT 1' });
    expect(res.status).toBe(502);
  });

  it('accepts x-api-key header', async () => {
    mockedMl.predict.mockResolvedValue(mockSafePredictResult);
    const res = await request(app)
      .post('/api/analyze')
      .set('x-api-key', apiKey)
      .send({ query: 'SELECT 1' });
    expect(res.status).toBe(200);
  });

  it('includes source field in audit', async () => {
    mockedMl.predict.mockResolvedValue(mockPredictResult);
    const res = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query: 'SELECT * FROM users', source: 'sdk' });
    expect(res.status).toBe(200);
    expect(res.body.label).toBeDefined();
  });
});
