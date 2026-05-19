# QueryGuard

Production-grade SQL injection detection system using a character-level Transformer model with Differential Privacy, active learning, and real-time monitoring.

## Architecture

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Frontend   │───▶│   Backend    │───▶│  ML Service  │
│  React/Vite  │    │  Node/Express│    │ FastAPI/PyTorch│
│   port 5173  │    │   port 3001  │    │   port 8000  │
└──────────────┘    └──────────────┘    └──────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
     ┌────────▼───────┐      ┌──────────▼──────┐
     │   Prometheus   │      │     Grafana      │
     │   port 9090    │      │    port 3000     │
     └────────────────┘      └─────────────────┘
```

## Quick Start

```bash
cp .env.example .env
# Edit .env and add ANTHROPIC_API_KEY
docker compose up
```

Services:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- ML Service: http://localhost:8000
- Grafana: http://localhost:3000 (admin/queryguard)
- Prometheus: http://localhost:9090

## Model

- Character-level Transformer (d_model=64, nhead=4, num_layers=2)
- Sinusoidal positional encoding
- Hybrid detector: ensemble of Transformer + SQL AST features
- Differential Privacy via Opacus DP-SGD
- ONNX export with INT8 quantization for browser-side inference
- Attention Rollout explainability (Abnar & Zuidema 2020)
- Active learning with Claude-powered label suggestions

## Attack Types Detected

- UNION_BASED
- BOOLEAN_BLIND
- TIME_BASED
- ERROR_BASED
- STACKED_QUERY
- COMMAND_EXEC
- COMMENT_INJECTION
- OBFUSCATED

## API

```bash
# Analyze a query
curl -X POST http://localhost:3001/api/analyze \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * FROM users WHERE id=1 UNION SELECT null--"}'

# Get statistics
curl http://localhost:3001/api/stats \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## NPM Package

```bash
npm install queryguard-middleware
```

```typescript
import { createQueryGuardMiddleware } from 'queryguard-middleware';
app.use('/search', createQueryGuardMiddleware({ apiUrl, apiKey, blockOnMalicious: true }));
```

## Development

```bash
# ML Service
cd ml-service && pip install -r requirements.txt
python train.py
pytest

# Backend
cd backend && npm install
npm test
npm run dev

# Frontend
cd frontend && npm install
npm run dev
```

## License

MIT
