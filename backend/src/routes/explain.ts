import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validator';
import { mlService } from '../services/mlService';

export const explainRouter = Router();

const ExplainSchema = z.object({
  query: z.string().min(1).max(10000),
});

explainRouter.post('/', validateBody(ExplainSchema), async (req: Request, res: Response): Promise<void> => {
  const { query } = req.body as { query: string };

  try {
    const result = await mlService.explain(query);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'ML service unavailable', details: String(err) });
  }
});
