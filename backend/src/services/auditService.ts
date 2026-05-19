import { v4 as uuidv4 } from 'uuid';

interface AuditEntry {
  id: string;
  tenantId: string;
  query: string;
  label: string;
  confidence: number;
  attackType: string | null;
  latencyMs: number;
  timestamp: Date;
  source: string;
}

class AuditService {
  private logs: Map<string, AuditEntry[]> = new Map();
  private readonly MAX_PER_TENANT = 1000;

  append(
    tenantId: string,
    entry: Omit<AuditEntry, 'id' | 'tenantId' | 'timestamp'>
  ): AuditEntry {
    const full: AuditEntry = { id: uuidv4(), tenantId, timestamp: new Date(), ...entry };
    if (!this.logs.has(tenantId)) this.logs.set(tenantId, []);
    const tl = this.logs.get(tenantId)!;
    tl.unshift(full);
    if (tl.length > this.MAX_PER_TENANT) tl.splice(this.MAX_PER_TENANT);
    return full;
  }

  getHistory(
    tenantId: string,
    page = 1,
    limit = 20,
    filter: 'all' | 'safe' | 'malicious' = 'all'
  ): { items: AuditEntry[]; total: number; page: number; limit: number } {
    const tl = this.logs.get(tenantId) || [];
    const filtered = tl.filter((e) => {
      if (filter === 'safe') return e.label === 'SAFE';
      if (filter === 'malicious') return e.label === 'MALICIOUS';
      return true;
    });
    const start = (page - 1) * limit;
    return { items: filtered.slice(start, start + limit), total: filtered.length, page, limit };
  }

  getStats(tenantId: string): object {
    const tl = this.logs.get(tenantId) || [];
    const totalAnalyzed = tl.length;
    const totalMalicious = tl.filter((e) => e.label === 'MALICIOUS').length;
    const totalSafe = tl.filter((e) => e.label === 'SAFE').length;
    const detectionRate = totalAnalyzed > 0 ? totalMalicious / totalAnalyzed : 0;
    const avgConfidence = totalAnalyzed > 0
      ? tl.reduce((s, e) => s + e.confidence, 0) / totalAnalyzed : 0;
    const avgLatencyMs = totalAnalyzed > 0
      ? tl.reduce((s, e) => s + e.latencyMs, 0) / totalAnalyzed : 0;

    const attackTypeBreakdown: Record<string, number> = {};
    for (const e of tl) {
      if (e.label === 'MALICIOUS' && e.attackType) {
        attackTypeBreakdown[e.attackType] = (attackTypeBreakdown[e.attackType] || 0) + 1;
      }
    }

    const now = Date.now();
    const recentTrend: Array<{ hour: string; safe: number; malicious: number }> = [];
    for (let h = 23; h >= 0; h--) {
      const hStart = new Date(now - h * 3_600_000);
      const hEnd = new Date(now - (h - 1) * 3_600_000);
      const inRange = tl.filter((e) => e.timestamp >= hStart && e.timestamp < hEnd);
      recentTrend.push({
        hour: hStart.toISOString().slice(0, 13) + ':00',
        safe: inRange.filter((e) => e.label === 'SAFE').length,
        malicious: inRange.filter((e) => e.label === 'MALICIOUS').length,
      });
    }

    return { totalAnalyzed, totalMalicious, totalSafe, detectionRate, avgConfidence, avgLatencyMs, attackTypeBreakdown, recentTrend };
  }
}

export const auditService = new AuditService();
