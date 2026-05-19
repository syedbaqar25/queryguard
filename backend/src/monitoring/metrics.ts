import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestsTotal = new client.Counter({
  name: 'queryguard_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDurationMs = new client.Histogram({
  name: 'queryguard_http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register],
});

export const queriesAnalyzedTotal = new client.Counter({
  name: 'queryguard_queries_analyzed_total',
  help: 'Total queries analyzed',
  labelNames: ['tenant_id', 'label'],
  registers: [register],
});

export const mlServiceLatencyMs = new client.Histogram({
  name: 'queryguard_ml_service_latency_ms',
  help: 'ML service prediction latency in milliseconds',
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2500],
  registers: [register],
});

export const activeSSEConnections = new client.Gauge({
  name: 'queryguard_active_sse_connections',
  help: 'Number of active SSE connections',
  registers: [register],
});

export const rateLimitHitsTotal = new client.Counter({
  name: 'queryguard_rate_limit_hits_total',
  help: 'Total rate limit violations',
  labelNames: ['tenant_id'],
  registers: [register],
});

export const adversarialTestsTotal = new client.Counter({
  name: 'queryguard_adversarial_tests_total',
  help: 'Total adversarial robustness tests run',
  registers: [register],
});

export const activeLearningQueueSize = new client.Gauge({
  name: 'queryguard_active_learning_queue_size',
  help: 'Size of the active learning uncertain queue',
  registers: [register],
});

export { register };
