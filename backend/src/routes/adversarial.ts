import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validator';
import { adversarialService } from '../services/adversarialService';
import { mlService } from '../services/mlService';
import { adversarialTestsTotal } from '../monitoring/metrics';

export const adversarialRouter = Router();

const AdversarialSchema = z.object({
  query: z.string().min(1).max(10000),
  test_robustness: z.boolean().optional().default(false),
});

adversarialRouter.post('/', validateBody(AdversarialSchema), async (req: Request, res: Response): Promise<void> => {
  const { query, test_robustness } = req.body as { query: string; test_robustness: boolean };

  if (test_robustness) {
    adversarialTestsTotal.inc();
    try {
      const report = await adversarialService.testRobustness(query, (q) =>
        mlService.predict(q).then((p) => ({ label: p.label, confidence: p.confidence }))
      );
      res.json(report);
    } catch (err) {
      res.status(502).json({ error: 'Robustness test failed', details: String(err) });
    }
  } else {
    const obfuscations = adversarialService.generateObfuscations(query);
    res.json({ original_query: query, obfuscations });
  }
});
