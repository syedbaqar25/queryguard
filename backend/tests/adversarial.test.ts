import request from 'supertest';
import app from '../src/app';
import { keyService } from '../src/services/keyService';
import { mlService } from '../src/services/mlService';
import { mockSafePredictResult, mockPredictResult } from './mocks/mlService.mock';

jest.mock('../src/services/mlService');
const mockedMl = mlService as jest.Mocked<typeof mlService>;

let apiKey: string;

beforeAll(() => {
  const tenant = keyService.createTenant('adversarial-test', 'Adversarial Test');
  apiKey = tenant.apiKey;
});

afterEach(() => jest.clearAllMocks());

describe('POST /api/adversarial', () => {
  it('returns 8 obfuscations without robustness test', async () => {
    const res = await request(app)
      .post('/api/adversarial')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query: "SELECT * FROM users WHERE id=1 UNION SELECT null--" });

    expect(res.status).toBe(200);
    expect(res.body.obfuscations).toHaveLength(8);
    expect(res.body.obfuscations[0].technique).toBeDefined();
    expect(res.body.obfuscations[0].obfuscated).toBeDefined();
  });

  it('returns robustness report when test_robustness=true', async () => {
    mockedMl.predict.mockResolvedValue(mockPredictResult);
    const res = await request(app)
      .post('/api/adversarial')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query: "SELECT * FROM users WHERE 1=1 UNION SELECT--", test_robustness: true });

    expect(res.status).toBe(200);
    expect(res.body.robustness_score).toBeDefined();
    expect(res.body.vulnerable_to).toBeDefined();
  });

  it('returns 400 for missing query', async () => {
    const res = await request(app)
      .post('/api/adversarial')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('case_variation technique alternates case', async () => {
    const res = await request(app)
      .post('/api/adversarial')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query: 'select' });

    const caseVariation = res.body.obfuscations.find(
      (o: { technique: string }) => o.technique === 'case_variation'
    );
    expect(caseVariation.obfuscated).toBe('SeLeCt');
  });

  it('comment_insertion replaces spaces with /**/', async () => {
    const res = await request(app)
      .post('/api/adversarial')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query: 'SELECT 1' });

    const commentInsertion = res.body.obfuscations.find(
      (o: { technique: string }) => o.technique === 'comment_insertion'
    );
    expect(commentInsertion.obfuscated).toContain('/**/');
  });
});
