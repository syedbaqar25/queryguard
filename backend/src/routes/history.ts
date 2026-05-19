import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { auditService } from '../services/auditService';

export const historyRouter = Router();

const HistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  filter: z.enum(['all', 'safe', 'malicious']).optional().default('all'),
});

historyRouter.get('/', (req: Request, res: Response): void => {
  const parsed = HistoryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.errors });
    return;
  }
  const { page, limit, filter } = parsed.data;
  const tenantId = req.tenant!.id;
  const result = auditService.getHistory(tenantId, page, limit, filter);
  res.json(result);
});
