import request from 'supertest';
import app from '../src/app';
import { keyService } from '../src/services/keyService';
import { auditService } from '../src/services/auditService';

let apiKey: string;
const TENANT = 'history-test';

beforeAll(() => {
  const tenant = keyService.createTenant(TENANT, 'History Test Tenant');
  apiKey = tenant.apiKey;

  for (let i = 0; i < 5; i++) {
    auditService.append(TENANT, {
      query: `SELECT * FROM t WHERE id=${i}`,
      label: 'SAFE',
      confidence: 0.9,
      attackType: null,
      latencyMs: 10,
      source: 'test',
    });
  }
  for (let i = 0; i < 3; i++) {
    auditService.append(TENANT, {
      query: `' OR 1=1--${i}`,
      label: 'MALICIOUS',
      confidence: 0.98,
      attackType: 'BOOLEAN_BLIND',
      latencyMs: 15,
      source: 'test',
    });
  }
});

describe('GET /api/history', () => {
  it('returns paginated history', async () => {
    const res = await request(app)
      .get('/api/history')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.total).toBe(8);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });

  it('filters by safe', async () => {
    const res = await request(app)
      .get('/api/history?filter=safe')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    res.body.items.forEach((item: { label: string }) => expect(item.label).toBe('SAFE'));
  });

  it('filters by malicious', async () => {
    const res = await request(app)
      .get('/api/history?filter=malicious')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    res.body.items.forEach((item: { label: string }) => expect(item.label).toBe('MALICIOUS'));
  });

  it('respects page and limit', async () => {
    const res = await request(app)
      .get('/api/history?page=1&limit=2')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);
  });

  it('returns 400 for invalid filter', async () => {
    const res = await request(app)
      .get('/api/history?filter=invalid')
      .set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(400);
  });
});
