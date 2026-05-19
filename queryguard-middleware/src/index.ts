import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { QueryGuardClient } from './client';
import type { QueryGuardConfig, AnalysisResult } from './types';

export { QueryGuardClient } from './client';
export { LRUCache } from './cache';
export type { QueryGuardConfig, AnalysisResult, CircuitBreakerState } from './types';

declare global {
  namespace Express {
    interface Request {
      queryGuardResult?: AnalysisResult;
    }
  }
}

export function createQueryGuardMiddleware(config: QueryGuardConfig): RequestHandler {
  const client = new QueryGuardClient(config);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const query =
      req.body?.query ??
      req.query?.q ??
      req.query?.query ??
      null;

    if (!query || typeof query !== 'string') {
      next();
      return;
    }

    try {
      const result = await client.analyze(query);
      req.queryGuardResult = result;

      if (result.label === 'MALICIOUS') {
        if (config.onMalicious) {
          config.onMalicious(query, result);
        }
        if (config.blockOnMalicious !== false) {
          res.status(400).json({
            error: 'Potential SQL injection detected',
            attack_type: result.attack_type,
            confidence: result.confidence,
          });
          return;
        }
      }
      next();
    } catch (err) {
      next();
    }
  };
}
