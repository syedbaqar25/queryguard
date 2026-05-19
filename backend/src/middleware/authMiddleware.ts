import { Request, Response, NextFunction, RequestHandler } from 'express';
import { keyService } from '../services/keyService';

declare global {
  namespace Express {
    interface Request {
      tenant?: { id: string; name: string };
    }
  }
}

export const authenticateKey: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const xApiKey = req.headers['x-api-key'] as string | undefined;

  let apiKey: string | undefined;
  if (authHeader?.startsWith('Bearer ')) {
    apiKey = authHeader.slice(7);
  } else if (xApiKey) {
    apiKey = xApiKey;
  }

  if (!apiKey) {
    res.status(401).json({ error: 'Missing API key' });
    return;
  }

  const tenant = keyService.safeValidateKey(apiKey);
  if (!tenant) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  const rl = keyService.checkRateLimit(tenant.id);
  if (!rl.allowed) {
    res.set('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)));
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfterMs: rl.retryAfterMs,
      retryAfterSeconds: Math.ceil(rl.retryAfterMs / 1000),
    });
    return;
  }

  keyService.recordUsage(tenant.id);
  req.tenant = { id: tenant.id, name: tenant.name };
  next();
};

export const requireAdmin: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (req.tenant?.id !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};
