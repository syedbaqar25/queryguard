import request from 'supertest';
import app from '../src/app';
import { keyService } from '../src/services/keyService';

let apiKey: string;

beforeAll(() => {
  const tenant = keyService.createTenant('stream-test', 'Stream Test');
  apiKey = tenant.apiKey;
});

describe('GET /api/stream', () => {
  it('returns 401 without API key', async () => {
    const res = await request(app).get('/api/stream');
    expect(res.status).toBe(401);
  });

  it('establishes SSE connection with valid key', (done) => {
    const req = request(app)
      .get('/api/stream')
      .set('Authorization', `Bearer ${apiKey}`)
      .buffer(false)
      .parse((res, callback) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
          if (data.includes('connected')) {
            callback(null, data);
            (res as NodeJS.ReadableStream).destroy();
          }
        });
        res.on('error', () => callback(null, data));
      });

    req.then((res) => {
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      done();
    }).catch(done);
  });
});
