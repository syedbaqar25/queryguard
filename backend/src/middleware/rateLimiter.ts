import { RequestHandler } from 'express';

// Token bucket rate limiting is in keyService.ts / authMiddleware.ts
export const rateLimiter: RequestHandler = (_req, _res, next) => next();
