import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema } from 'zod';

export function validateBody(schema: ZodSchema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation error', details: result.error.errors });
      return;
    }
    req.body = result.data;
    next();
  };
}
