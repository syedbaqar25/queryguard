import crypto from 'crypto';

interface Tenant {
  id: string;
  apiKey: string;
  name: string;
  createdAt: Date;
  quotaPerHour: number;
  usageThisHour: number;
  usageResetAt: Date;
  totalRequests: number;
  isActive: boolean;
}

interface RateLimitState {
  tokens: number;
  lastRefill: number;
}

const RATE_LIMIT_PER_MINUTE = 100;
const TOKENS_PER_MS = RATE_LIMIT_PER_MINUTE / 60000;

class KeyService {
  tenants: Map<string, Tenant> = new Map();
  keyToId: Map<string, string> = new Map();
  rateLimits: Map<string, RateLimitState> = new Map();

  constructor() {
    const defaultKey = process.env.DEFAULT_API_KEY || this.generateKey();
    this.createTenant('default', 'Default Tenant', defaultKey, 10000);
    console.log(`[KeyService] Default API key: ${defaultKey}`);
  }

  generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  createTenant(id: string, name: string, apiKey?: string, quotaPerHour: number = 1000): Tenant {
    const key = apiKey || this.generateKey();
    const now = new Date();
    const tenant: Tenant = {
      id,
      apiKey: key,
      name,
      createdAt: now,
      quotaPerHour,
      usageThisHour: 0,
      usageResetAt: new Date(now.getTime() + 3_600_000),
      totalRequests: 0,
      isActive: true,
    };
    this.tenants.set(id, tenant);
    this.keyToId.set(key, id);
    this.rateLimits.set(id, { tokens: RATE_LIMIT_PER_MINUTE, lastRefill: Date.now() });
    return tenant;
  }

  safeValidateKey(apiKey: string): Tenant | null {
    const padLen = 64;
    const inputBuf = Buffer.alloc(padLen);
    Buffer.from(apiKey).copy(inputBuf, 0, 0, Math.min(apiKey.length, padLen));

    let foundId: string | null = null;

    // Iterate ALL keys without early exit — prevents timing attacks
    for (const [storedKey, tenantId] of this.keyToId.entries()) {
      const storedBuf = Buffer.alloc(padLen);
      Buffer.from(storedKey).copy(storedBuf, 0, 0, Math.min(storedKey.length, padLen));

      // crypto.timingSafeEqual — constant time comparison
      const equal = crypto.timingSafeEqual(inputBuf, storedBuf);
      // Also verify string equality to avoid false positives from padding collision
      if (equal && storedKey === apiKey) {
        foundId = tenantId;
      }
    }

    if (!foundId) return null;
    const tenant = this.tenants.get(foundId);
    if (!tenant || !tenant.isActive) return null;
    return tenant;
  }

  checkRateLimit(tenantId: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    let state = this.rateLimits.get(tenantId);
    if (!state) {
      state = { tokens: RATE_LIMIT_PER_MINUTE, lastRefill: now };
      this.rateLimits.set(tenantId, state);
    }

    const elapsed = now - state.lastRefill;
    state.tokens = Math.min(RATE_LIMIT_PER_MINUTE, state.tokens + elapsed * TOKENS_PER_MS);
    state.lastRefill = now;

    if (state.tokens >= 1) {
      state.tokens -= 1;
      return { allowed: true, remaining: Math.floor(state.tokens), retryAfterMs: 0 };
    }

    const retryAfterMs = Math.ceil((1 - state.tokens) / TOKENS_PER_MS);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  recordUsage(tenantId: string): void {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return;
    const now = new Date();
    if (now > tenant.usageResetAt) {
      tenant.usageThisHour = 0;
      tenant.usageResetAt = new Date(now.getTime() + 3_600_000);
    }
    tenant.totalRequests++;
    tenant.usageThisHour++;
  }

  getTenantUsage(tenantId: string): object {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error('Tenant not found');
    const rl = this.rateLimits.get(tenantId);
    return {
      id: tenant.id,
      name: tenant.name,
      totalRequests: tenant.totalRequests,
      usageThisHour: tenant.usageThisHour,
      quotaPerHour: tenant.quotaPerHour,
      quotaRemaining: Math.max(0, tenant.quotaPerHour - tenant.usageThisHour),
      rateLimitRemaining: Math.floor(rl?.tokens ?? 0),
      createdAt: tenant.createdAt,
    };
  }

  revokeKey(tenantId: string): boolean {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return false;
    tenant.isActive = false;
    return true;
  }

  getAllTenants(): Tenant[] {
    return Array.from(this.tenants.values());
  }
}

export const keyService = new KeyService();
