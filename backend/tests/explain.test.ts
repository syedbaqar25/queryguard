import request from 'supertest';
import app from '../src/app';
import { keyService } from '../src/services/keyService';
import { mlService } from '../src/services/mlService';
import { mockExplainResult } from './mocks/mlService.mock';

jest.mock('../src/services/mlService');
const mockedMl = mlService as jest.Mocked<typeof mlService>;

let apiKey: string;

beforeAll(() => {
  const tenant = keyService.createTenant('explain-test', 'Explain Test');
  apiKey = tenant.apiKey;
});

afterEach(() => jest.clearAllMocks());

describe('POST /api/explain', () => {
  it('returns explanation for a query', async () => {
    mockedMl.explain.mockResolvedValue(mockExplainResult);
    const res = await request(app)
      .post('/api/explain')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query: "SELECT * FROM users WHERE id=1 UNION SELECT null,null--" });

    expect(res.status).toBe(200);
    expect(res.body.char_scores).toBeDefined();
    expect(res.body.top_suspicious_span).toBe('UNI');
    expect(res.body.attention_rollout_matrix).toBeDefined();
    expect(res.body.summary).toBeDefined();
  });

  it('returns 400 for empty query', async () => {
    const res = await request(app)
      .post('/api/explain')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query: '' });
    expect(res.status).toBe(400);
  });

  it('returns 502 when ML service fails', async () => {
    mockedMl.explain.mockRejectedValue(new Error('timeout'));
    const res = await request(app)
      .post('/api/explain')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query: 'SELECT 1' });
    expect(res.status).toBe(502);
  });

  it('returns 401 without key', async () => {
    const res = await request(app).post('/api/explain').send({ query: 'SELECT 1' });
    expect(res.status).toBe(401);
  });
});
