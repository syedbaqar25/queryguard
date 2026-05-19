import { EventEmitter } from 'events';
import { Response } from 'express';

interface SSEClient {
  id: string;
  tenantId: string;
  res: Response;
}

interface AnalysisEvent {
  type: 'analysis';
  tenantId: string;
  data: {
    id: string;
    query: string;
    label: string;
    confidence: number;
    attackType: string | null;
    latencyMs: number;
    timestamp: string;
  };
}

const MAX_CLIENTS = 100;
const HEARTBEAT_INTERVAL_MS = 30000;

class SSEService extends EventEmitter {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatTimer: NodeJS.Timeout;

  constructor() {
    super();
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
    this.heartbeatTimer.unref();
  }

  addClient(clientId: string, tenantId: string, res: Response): boolean {
    if (this.clients.size >= MAX_CLIENTS) return false;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const client: SSEClient = { id: clientId, tenantId, res };
    this.clients.set(clientId, client);

    res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

    res.on('close', () => {
      this.clients.delete(clientId);
    });

    return true;
  }

  broadcastAnalysis(event: AnalysisEvent): void {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients.values()) {
      if (client.tenantId === event.tenantId) {
        try {
          client.res.write(payload);
        } catch {
          this.clients.delete(client.id);
        }
      }
    }
  }

  private sendHeartbeat(): void {
    const heartbeat = `: heartbeat\n\n`;
    for (const client of this.clients.values()) {
      try {
        client.res.write(heartbeat);
      } catch {
        this.clients.delete(client.id);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.res.end();
      } catch {
        // already closed
      }
      this.clients.delete(clientId);
    }
  }
}

export const sseService = new SSEService();
