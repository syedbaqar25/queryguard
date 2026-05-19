import request from 'supertest';
import app from '../src/app';
import { keyService } from '../src/services/keyService';
import { mlService } from '../src/services/mlService';
import { claudeService } from '../src/services/claudeService';
import { mockLabelSuggestion } from './mocks/claudeService.mock';

jest.mock('../src/services/mlService');
jest.mock('../src/services/claudeService');

const mockedMl = mlService as jest.Mocked<typeof mlService>;
const mockedClaude = claudeService as jest.Mocked<typeof claudeService>;

let apiKey: string;

beforeAll(() => {
  const tenant = keyService.createTenant('al-test', 'Active Learning Test');
  apiKey = tenant.apiKey;
});

afterEach(() => jest.clearAllMocks());

describe('GET /api/active-learning/queue', () => {
  it('returns uncertain queue', async () => {
    mockedMl.getUncertainQueue.mockResolvedValue([
      { id: 'abc', query: 'SELECT * FROM t', confidence: 0.51, timestamp: new Date().toISOString() },
    ]);
    const res = await request(app)
      .get('/api/active-learning/queue')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.count).toBe(1);
  });
});

describe('POST /api/active-learning/queue/:id/label', () => {
  it('labels an entry', async () => {
    mockedMl.labelEntry.mockResolvedValue({ success: true });
    const res = await request(app)
      .post('/api/active-learning/queue/abc/label')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ label: 'SAFE' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 for invalid label', async () => {
    const res = await request(app)
      .post('/api/active-learning/queue/abc/label')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ label: 'UNKNOWN' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/active-learning/retrain', () => {
  it('triggers retrain', async () => {
    mockedMl.triggerRetrain.mockResolvedValue({ triggered: true, message: 'Retraining' });
    const res = await request(app)
      .post('/api/active-learning/retrain')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(200);
    expect(res.body.triggered).toBe(true);
  });
});

describe('POST /api/active-learning/suggest', () => {
  it('returns Claude label suggestion', async () => {
    mockedClaude.suggestLabel.mockResolvedValue(mockLabelSuggestion);
    const res = await request(app)
      .post('/api/active-learning/suggest')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query: 'SELECT * FROM users UNION SELECT null--', confidence: 0.55 });
    expect(res.status).toBe(200);
    expect(res.body.suggested_label).toBe('MALICIOUS');
    expect(res.body.reasoning).toBeDefined();
  });

  it('returns 400 for missing fields', async () => {
    const res = await request(app)
      .post('/api/active-learning/suggest')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ query: 'SELECT 1' });
    expect(res.status).toBe(400);
  });
});
