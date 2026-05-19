import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authenticateKey } from './middleware/authMiddleware';
import { analyzeRouter } from './routes/analyze';
import { historyRouter } from './routes/history';
import { statsRouter } from './routes/stats';
import { explainRouter } from './routes/explain';
import { adversarialRouter } from './routes/adversarial';
import { activeLearningRouter } from './routes/activeLearning';
import { keysRouter } from './routes/keys';
import { streamRouter } from './routes/stream';
import { onnxRouter } from './routes/onnx';
import { register } from './monitoring/metrics';
import { httpRequestsTotal, httpRequestDurationMs } from './monitoring/metrics';
import { logger } from './utils/logger';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const route = req.route?.path ?? req.path;
    httpRequestsTotal.inc({ method: req.method, route, status_code: String(res.statusCode) });
    httpRequestDurationMs.observe({ method: req.method, route }, Date.now() - start);
  });
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/api/analyze', authenticateKey, analyzeRouter);
app.use('/api/history', authenticateKey, historyRouter);
app.use('/api/stats', authenticateKey, statsRouter);
app.use('/api/explain', authenticateKey, explainRouter);
app.use('/api/adversarial', authenticateKey, adversarialRouter);
app.use('/api/active-learning', authenticateKey, activeLearningRouter);
app.use('/api/keys', authenticateKey, keysRouter);
app.use('/api/stream', authenticateKey, streamRouter);
app.use('/api/onnx', authenticateKey, onnxRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
