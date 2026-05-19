import request from 'supertest';
import app from '../src/app';
import { keyService } from '../src/services/keyService';

let validKey: string;
let revokedKey: string;

beforeAll(() => {
  const tenant = keyService.createTenant('auth-test', 'Auth Test Tenant');
  validKey = tenant.apiKey;
  const revoked = keyService.createTenant('auth-revoked', 'Revoked Tenant');
  revokedKey = revoked.apiKey;
  keyService.revokeKey('auth-revoked');
});

describe('Authentication middleware', () => {
  it('returns 401 for missing API key', async () => {
    const res = await request(app).get('/api/history');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Missing API key');
  });

  it('returns 401 for invalid API key', async () => {
    const res = await request(app)
      .get('/api/history')
      .set('Authorization', 'Bearer invalid_key_xyz_123');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid API key');
  });

  it('returns 401 for revoked API key', async () => {
    const res = await request(app)
      .get('/api/history')
      .set('Authorization', `Bearer ${revokedKey}`);
    expect(res.status).toBe(401);
  });

  it('accepts valid Bearer token', async () => {
    const res = await request(app)
      .get('/api/history')
      .set('Authorization', `Bearer ${validKey}`);
    expect(res.status).toBe(200);
  });

  it('accepts valid x-api-key header', async () => {
    const res = await request(app)
      .get('/api/history')
      .set('x-api-key', validKey);
    expect(res.status).toBe(200);
  });

  it('returns 403 for non-admin accessing admin endpoints', async () => {
    const res = await request(app)
      .get('/api/keys')
      .set('Authorization', `Bearer ${validKey}`);
    expect(res.status).toBe(403);
  });
});

describe('Rate limiting', () => {
  it('responds with 429 after exceeding rate limit', async () => {
    const tenant = keyService.createTenant('rl-test', 'RL Test');
    const state = keyService.rateLimits.get('rl-test');
    if (state) state.tokens = 0;

    const res = await request(app)
      .get('/api/history')
      .set('Authorization', `Bearer ${tenant.apiKey}`);
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Rate limit exceeded');
    expect(res.headers['retry-after']).toBeDefined();
  });
});
