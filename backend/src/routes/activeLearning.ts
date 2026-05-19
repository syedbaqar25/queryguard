import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validator';
import { mlService } from '../services/mlService';
import { claudeService } from '../services/claudeService';
import { activeLearningQueueSize } from '../monitoring/metrics';

export const activeLearningRouter = Router();

activeLearningRouter.get('/queue', async (_req: Request, res: Response): Promise<void> => {
  try {
    const queue = await mlService.getUncertainQueue();
    activeLearningQueueSize.set(queue.length);
    res.json({ items: queue, count: queue.length });
  } catch (err) {
    res.status(502).json({ error: 'ML service unavailable', details: String(err) });
  }
});

const LabelSchema = z.object({
  label: z.enum(['SAFE', 'MALICIOUS']),
});

activeLearningRouter.post('/queue/:id/label', validateBody(LabelSchema), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { label } = req.body as { label: 'SAFE' | 'MALICIOUS' };

  try {
    const result = await mlService.labelEntry(id, label);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'Failed to label entry', details: String(err) });
  }
});

activeLearningRouter.post('/retrain', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await mlService.triggerRetrain();
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'Failed to trigger retrain', details: String(err) });
  }
});

activeLearningRouter.get('/versions', async (_req: Request, res: Response): Promise<void> => {
  try {
    const versions = await mlService.getModelVersions();
    res.json(versions);
  } catch (err) {
    res.status(502).json({ error: 'ML service unavailable', details: String(err) });
  }
});

const SuggestSchema = z.object({
  query: z.string().min(1).max(10000),
  confidence: z.number().min(0).max(1),
});

activeLearningRouter.post('/suggest', validateBody(SuggestSchema), async (req: Request, res: Response): Promise<void> => {
  const { query, confidence } = req.body as { query: string; confidence: number };

  try {
    const suggestion = await claudeService.suggestLabel(query, confidence);
    res.json(suggestion);
  } catch (err) {
    res.status(502).json({ error: 'Claude service unavailable', details: String(err) });
  }
});
