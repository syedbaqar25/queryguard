import express from 'express';
import { createQueryGuardMiddleware } from '../src/index';

const app = express();
app.use(express.json());

const queryGuard = createQueryGuardMiddleware({
  apiUrl: process.env.QUERYGUARD_URL || 'http://localhost:3001',
  apiKey: process.env.QUERYGUARD_API_KEY || '',
  blockOnMalicious: true,
  onMalicious: (query, result) => {
    console.warn(`[SECURITY] SQL injection detected: ${result.attack_type} (${(result.confidence * 100).toFixed(0)}%) — query: ${query}`);
  },
  cacheSize: 1000,
  cacheTtlMs: 300000,
});

app.post('/search', queryGuard, (req, res) => {
  const { query } = req.body as { query: string };
  res.json({ message: `Safe query executed: ${query}`, guardResult: req.queryGuardResult });
});

app.listen(4000, () => console.log('Example server on port 4000'));
