import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validator';
import { mlService } from '../services/mlService';
import { auditService } from '../services/auditService';
import { sseService } from '../services/sseService';
import {
  queriesAnalyzedTotal,
  mlServiceLatencyMs,
} from '../monitoring/metrics';

export const analyzeRouter = Router();

const AnalyzeSchema = z.object({
  query: z.string().min(1).max(10000),
  source: z.string().optional().default('api'),
});

analyzeRouter.post('/', validateBody(AnalyzeSchema), async (req: Request, res: Response): Promise<void> => {
  const { query, source } = req.body as { query: string; source: string };
  const tenantId = req.tenant!.id;

  const t0 = Date.now();
  let prediction;
  try {
    prediction = await mlService.predict(query);
  } catch (err) {
    res.status(502).json({ error: 'ML service unavailable', details: String(err) });
    return;
  }
  const latencyMs = Date.now() - t0;

  mlServiceLatencyMs.observe(latencyMs);
  queriesAnalyzedTotal.inc({ tenant_id: tenantId, label: prediction.label });

  const entry = auditService.append(tenantId, {
    query,
    label: prediction.label,
    confidence: prediction.confidence,
    attackType: prediction.attack_type,
    latencyMs: prediction.latency_ms ?? latencyMs,
    source,
  });

  sseService.broadcastAnalysis({
    type: 'analysis',
    tenantId,
    data: {
      id: entry.id,
      query,
      label: entry.label,
      confidence: entry.confidence,
      attackType: entry.attackType,
      latencyMs: entry.latencyMs,
      timestamp: entry.timestamp.toISOString(),
    },
  });

  res.json({
    id: entry.id,
    query,
    label: prediction.label,
    confidence: prediction.confidence,
    safe_prob: prediction.safe_prob,
    malicious_prob: prediction.malicious_prob,
    attack_type: prediction.attack_type,
    latency_ms: prediction.latency_ms ?? latencyMs,
    timestamp: entry.timestamp.toISOString(),
  });
});
