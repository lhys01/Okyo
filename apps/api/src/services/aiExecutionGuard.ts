import { getRuntimeSafetyConfig } from '../config/runtimeSafety.js';
import { metrics, recordAiRequest } from '../observability/metrics.js';
import { logStructured } from '../observability/structuredLogger.js';

export class AiSaturatedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('AI capacity is temporarily busy.');
    this.name = 'AiSaturatedError';
  }
}

export class AiCircuitOpenError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('AI provider is temporarily unavailable.');
    this.name = 'AiCircuitOpenError';
  }
}

type CircuitState = 'closed' | 'open' | 'half_open';

let inFlight = 0;
let consecutiveFailures = 0;
let openedAt = 0;
let halfOpenProbeActive = false;

/**
 * A process-local bulkhead and circuit breaker around every OpenRouter call.
 * It prevents slow/failed inference from consuming all Node sockets or memory
 * and keeps unrelated routes responsive. The breaker intentionally fails fast;
 * a durable, cross-instance queue remains a production prerequisite.
 */
export async function runWithAiExecutionGuard<T>(
  input: { stage: string; operation: () => Promise<T> },
): Promise<T> {
  const config = getRuntimeSafetyConfig();
  const circuit = getCircuitState(Date.now(), config.aiCircuitBreakerResetMs);
  if (circuit === 'open') {
    const retryAfterSeconds = Math.max(1, Math.ceil((config.aiCircuitBreakerResetMs - (Date.now() - openedAt)) / 1_000));
    metrics.increment('okyo_ai_rejected_total', { reason: 'circuit_open', stage: input.stage });
    throw new AiCircuitOpenError(retryAfterSeconds);
  }
  if (circuit === 'half_open') {
    if (halfOpenProbeActive) {
      metrics.increment('okyo_ai_rejected_total', { reason: 'circuit_half_open', stage: input.stage });
      throw new AiCircuitOpenError(1);
    }
    halfOpenProbeActive = true;
  }
  if (inFlight >= config.aiMaxConcurrentCalls) {
    if (circuit === 'half_open') halfOpenProbeActive = false;
    metrics.increment('okyo_ai_rejected_total', { reason: 'concurrency_limit', stage: input.stage });
    throw new AiSaturatedError(1);
  }

  const startedAt = Date.now();
  inFlight += 1;
  metrics.setGauge('okyo_ai_in_flight', inFlight);
  try {
    const value = await input.operation();
    recordAiRequest(input.stage, 'success', Date.now() - startedAt);
    closeCircuitAfterSuccess(circuit);
    return value;
  } catch (error) {
    recordAiRequest(input.stage, isGuardRejection(error) ? 'rejected' : 'failure', Date.now() - startedAt);
    if (isProviderAvailabilityFailure(error)) recordFailure(input.stage, config.aiCircuitBreakerFailureThreshold);
    throw error;
  } finally {
    inFlight -= 1;
    metrics.setGauge('okyo_ai_in_flight', inFlight);
    if (circuit === 'half_open') halfOpenProbeActive = false;
  }
}

function getCircuitState(now: number, resetMs: number): CircuitState {
  if (openedAt === 0) return 'closed';
  if (now - openedAt < resetMs) return 'open';
  return 'half_open';
}

function closeCircuitAfterSuccess(circuit: CircuitState) {
  if (circuit === 'half_open' || consecutiveFailures > 0) {
    logStructured('info', 'ai_circuit_closed', { prior_state: circuit });
  }
  consecutiveFailures = 0;
  openedAt = 0;
}

function recordFailure(stage: string, threshold: number) {
  consecutiveFailures += 1;
  if (consecutiveFailures < threshold || openedAt !== 0) return;
  openedAt = Date.now();
  logStructured('warn', 'ai_circuit_opened', {
    consecutive_failures: consecutiveFailures,
    stage,
    threshold,
  });
  metrics.increment('okyo_ai_circuit_open_total', { stage });
}

function isGuardRejection(error: unknown): boolean {
  return error instanceof AiSaturatedError || error instanceof AiCircuitOpenError ||
    (error instanceof Error && error.name === 'AiDailyCapExceededError');
}

/** The provider error class is intentionally not imported to avoid a cycle. */
function isProviderAvailabilityFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError') return false;
  if (error.name !== 'OpenRouterProviderError') return error instanceof TypeError;
  const failure = (error as Error & { failure?: { reason?: string; httpStatus?: number } }).failure;
  const status = failure?.httpStatus;
  return failure?.reason === 'openrouter_timeout' ||
    failure?.reason === 'openrouter_network_error' ||
    (failure?.reason === 'openrouter_http_error' && (status === 429 || status === 408 || (status ?? 0) >= 500));
}

export function getAiExecutionSnapshot() {
  const config = getRuntimeSafetyConfig();
  return {
    circuitState: getCircuitState(Date.now(), config.aiCircuitBreakerResetMs),
    consecutiveFailures,
    inFlight,
    maxConcurrentCalls: config.aiMaxConcurrentCalls,
  };
}

export function resetAiExecutionGuardForTests(): void {
  inFlight = 0;
  consecutiveFailures = 0;
  openedAt = 0;
  halfOpenProbeActive = false;
}
