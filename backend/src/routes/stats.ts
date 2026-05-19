import { Router, Request, Response } from 'express';
import { auditService } from '../services/auditService';
import { mlService } from '../services/mlService';

export const statsRouter = Router();

statsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenant!.id;
  const stats = auditService.getStats(tenantId);
  res.json(stats);
});

statsRouter.get('/model', async (_req: Request, res: Response): Promise<void> => {
  try {
    const info = await mlService.getModelInfo();
    res.json(info);
  } catch (err) {
    res.status(502).json({ error: 'ML service unavailable', details: String(err) });
  }
});
