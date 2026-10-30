/**
 * Operational limits for the current stateless-API-in-front-of-AI shape.
 *
 * These are intentionally conservative defaults. They protect one API process
 * today; a production multi-instance deployment must additionally use the
 * shared queue/rate-limit store documented in docs/performance.
 */
export type RuntimeSafetyConfig = {
  aiCircuitBreakerFailureThreshold: number;
  aiCircuitBreakerResetMs: number;
  aiMaxConcurrentCalls: number;
  apiMaxInFlightRequests: number;
  idempotencyMaxEntries: number;
  idempotencyTtlMs: number;
  maxInMemoryAnalysisEntries: number;
  maxInMemoryGeneratedRecipeEntries: number;
  maxInMemoryScanCacheEntries: number;
  requestDeadlineMs: number;
  shutdownGracePeriodMs: number;
  trustProxy: boolean;
};

export function getRuntimeSafetyConfig(): RuntimeSafetyConfig {
  return {
    aiCircuitBreakerFailureThreshold: getPositiveInteger(
      process.env.AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      5,
    ),
    aiCircuitBreakerResetMs: getPositiveInteger(
      process.env.AI_CIRCUIT_BREAKER_RESET_MS,
      30_000,
    ),
    // This is deliberately a provider-safe ceiling, not a throughput target.
    // Set it from the provider's contracted concurrency limit with headroom.
    aiMaxConcurrentCalls: getPositiveInteger(process.env.AI_MAX_CONCURRENCY, 12),
    apiMaxInFlightRequests: getPositiveInteger(process.env.API_MAX_IN_FLIGHT_REQUESTS, 500),
    idempotencyMaxEntries: getPositiveInteger(process.env.IDEMPOTENCY_MAX_ENTRIES, 2_000),
    idempotencyTtlMs: getPositiveInteger(process.env.IDEMPOTENCY_TTL_MS, 10 * 60_000),
    maxInMemoryAnalysisEntries: getPositiveInteger(process.env.IN_MEMORY_ANALYSIS_MAX_ENTRIES, 500),
    maxInMemoryGeneratedRecipeEntries: getPositiveInteger(
      process.env.IN_MEMORY_GENERATED_RECIPE_MAX_ENTRIES,
      1_000,
    ),
    maxInMemoryScanCacheEntries: getPositiveInteger(process.env.IN_MEMORY_SCAN_CACHE_MAX_ENTRIES, 200),
    // The mobile client times out at 60s. Leave transport/proxy headroom rather
    // than allowing the server to spend the entire client budget.
    requestDeadlineMs: getPositiveInteger(process.env.REQUEST_DEADLINE_MS, 55_000),
    shutdownGracePeriodMs: getPositiveInteger(process.env.SHUTDOWN_GRACE_PERIOD_MS, 25_000),
    trustProxy: process.env.TRUST_PROXY === 'true',
  };
}

function getPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
