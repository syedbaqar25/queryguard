import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validator';
import { requireAdmin } from '../middleware/authMiddleware';
import { keyService } from '../services/keyService';

export const keysRouter = Router();

keysRouter.get('/usage', (req: Request, res: Response): void => {
  try {
    const usage = keyService.getTenantUsage(req.tenant!.id);
    res.json(usage);
  } catch (err) {
    res.status(404).json({ error: String(err) });
  }
});

const CreateTenantSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1).max(128),
  quotaPerHour: z.number().int().min(1).max(1000000).optional().default(1000),
});

keysRouter.post('/', requireAdmin, validateBody(CreateTenantSchema), (req: Request, res: Response): void => {
  const { id, name, quotaPerHour } = req.body as { id: string; name: string; quotaPerHour: number };

  if (keyService.tenants.has(id)) {
    res.status(409).json({ error: 'Tenant ID already exists' });
    return;
  }

  const tenant = keyService.createTenant(id, name, undefined, quotaPerHour);
  res.status(201).json({
    id: tenant.id,
    name: tenant.name,
    apiKey: tenant.apiKey,
    quotaPerHour: tenant.quotaPerHour,
    createdAt: tenant.createdAt,
  });
});

keysRouter.delete('/:tenantId', requireAdmin, (req: Request, res: Response): void => {
  const { tenantId } = req.params;
  const revoked = keyService.revokeKey(tenantId);
  if (!revoked) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }
  res.json({ success: true, tenantId });
});

keysRouter.get('/', requireAdmin, (_req: Request, res: Response): void => {
  const tenants = keyService.getAllTenants().map((t) => ({
    id: t.id,
    name: t.name,
    isActive: t.isActive,
    totalRequests: t.totalRequests,
    usageThisHour: t.usageThisHour,
    quotaPerHour: t.quotaPerHour,
    createdAt: t.createdAt,
  }));
  res.json({ tenants });
});
