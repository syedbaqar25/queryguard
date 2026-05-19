import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { sseService } from '../services/sseService';
import { activeSSEConnections } from '../monitoring/metrics';

export const streamRouter = Router();

streamRouter.get('/', (req: Request, res: Response): void => {
  const clientId = uuidv4();
  const tenantId = req.tenant!.id;

  const accepted = sseService.addClient(clientId, tenantId, res);
  if (!accepted) {
    res.status(503).json({ error: 'SSE connection limit reached' });
    return;
  }

  activeSSEConnections.set(sseService.getClientCount());

  req.on('close', () => {
    sseService.removeClient(clientId);
    activeSSEConnections.set(sseService.getClientCount());
  });
});
