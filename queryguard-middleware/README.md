# queryguard-middleware

Express/Node.js middleware for SQL injection detection via the QueryGuard API.

## Features

- LRU cache with TTL to reduce API calls
- Circuit breaker (5 failure threshold, 30s open window)
- TypeScript types included
- Zero dependencies beyond axios

## Installation

```bash
npm install queryguard-middleware
```

## Usage

```typescript
import express from 'express';
import { createQueryGuardMiddleware } from 'queryguard-middleware';

const app = express();
app.use(express.json());

const queryGuard = createQueryGuardMiddleware({
  apiUrl: 'http://your-queryguard-instance:3001',
  apiKey: 'your-api-key',
  blockOnMalicious: true,
  onMalicious: (query, result) => {
    console.warn('SQL injection detected:', result.attack_type);
  },
});

app.post('/search', queryGuard, (req, res) => {
  // req.queryGuardResult contains the full analysis
  res.json({ safe: true });
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | string | — | QueryGuard backend URL |
| `apiKey` | string | — | API key |
| `timeoutMs` | number | 5000 | Request timeout |
| `blockOnMalicious` | boolean | true | Return 400 on detection |
| `onMalicious` | function | — | Callback on detection |
| `cacheSize` | number | 500 | LRU cache capacity |
| `cacheTtlMs` | number | 60000 | Cache entry TTL |
