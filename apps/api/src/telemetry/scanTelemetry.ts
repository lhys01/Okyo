import type {
  ScanAggregateTiming,
  ScanRecipeContract,
} from '../services/scanDeadline.js';

export type ScanMetricStatus = 'success' | 'failure' | 'cancelled';

export type ScanMetricDetails = Record<string, boolean | number | string | null | undefined>;

export function logScanMetric(input: {
  requestId: string;
  stage: string;
  durationMs: number;
  status?: ScanMetricStatus;
  details?: ScanMetricDetails;
}): void {
  console.log('[scan_metric]', {
    requestId: input.requestId,
    stage: input.stage,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    status: input.status ?? 'success',
    ...input.details,
  });
}

export async function measureScanStage<T>(input: {
  requestId: string;
  stage: string;
  run: () => Promise<T>;
  details?: ScanMetricDetails;
}): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await input.run();
    logScanMetric({
      requestId: input.requestId,
      stage: input.stage,
      durationMs: Date.now() - startedAt,
      details: input.details,
    });
    return result;
  } catch (error) {
    logScanMetric({
      requestId: input.requestId,
      stage: input.stage,
      durationMs: Date.now() - startedAt,
      status: isAbortLikeError(error) ? 'cancelled' : 'failure',
      details: input.details,
    });
    throw error;
  }
}

export function createScanAggregateTiming(input: {
  requestId: string;
  startedAt?: number;
  recipeContract?: ScanRecipeContract;
}): ScanAggregateTiming {
  return {
    requestId: input.requestId,
    startedAt: input.startedAt ?? Date.now(),
    visionMs: 0,
    recipeMs: 0,
    repairMs: 0,
    persistenceMs: 0,
    logicalProviderCalls: 0,
    providerAttempts: 0,
    recipeContract: input.recipeContract ?? 'unknown',
    repairReasons: [],
    emitted: false,
  };
}

export function addScanAggregateDuration(
  timing: ScanAggregateTiming | undefined,
  stage: 'vision' | 'recipe' | 'repair' | 'persistence',
  durationMs: number,
): void {
  if (!timing) return;
  const value = Math.max(0, Math.round(durationMs));
  if (stage === 'vision') timing.visionMs += value;
  if (stage === 'recipe') timing.recipeMs += value;
  if (stage === 'repair') timing.repairMs += value;
  if (stage === 'persistence') timing.persistenceMs += value;
}

export async function measureScanAggregateStage<T>(input: {
  timing?: ScanAggregateTiming;
  stage: 'vision' | 'recipe' | 'repair' | 'persistence';
  run: () => Promise<T>;
}): Promise<T> {
  const startedAt = Date.now();
  try {
    return await input.run();
  } finally {
    addScanAggregateDuration(input.timing, input.stage, Date.now() - startedAt);
  }
}

export function setScanRecipeContract(
  timing: ScanAggregateTiming | undefined,
  recipeContract: ScanRecipeContract,
): void {
  if (timing) timing.recipeContract = recipeContract;
}

export function recordLogicalProviderCall(timing: ScanAggregateTiming | undefined): void {
  if (timing) timing.logicalProviderCalls += 1;
}

export function recordProviderAttempt(timing: ScanAggregateTiming | undefined): void {
  if (timing) timing.providerAttempts += 1;
}

export function recordRepairReasons(
  timing: ScanAggregateTiming | undefined,
  reasons: string | string[],
): void {
  if (!timing) return;
  const values = Array.isArray(reasons) ? reasons : reasons.split(',');
  for (const value of values) {
    const normalized = value.trim();
    if (normalized && !timing.repairReasons.includes(normalized)) {
      timing.repairReasons.push(normalized);
    }
  }
}

export function getScanAggregateTimingEvent(
  timing: ScanAggregateTiming,
  status: ScanMetricStatus,
  now = Date.now(),
) {
  return {
    requestId: timing.requestId,
    visionMs: timing.visionMs,
    recipeMs: timing.recipeMs,
    repairMs: timing.repairMs,
    persistenceMs: timing.persistenceMs,
    totalMs: Math.max(0, Math.round(now - timing.startedAt)),
    logicalProviderCalls: timing.logicalProviderCalls,
    providerAttempts: timing.providerAttempts,
    recipeContract: timing.recipeContract,
    repairReasons: [...timing.repairReasons],
    status,
  };
}

export function logScanAggregateTiming(
  timing: ScanAggregateTiming,
  status: ScanMetricStatus,
): void {
  if (timing.emitted) return;
  timing.emitted = true;
  console.log('[scan_aggregate_timing]', getScanAggregateTimingEvent(timing, status));
}

function isAbortLikeError(error: unknown): boolean {
  return error instanceof Error && (
    error.name === 'AbortError' ||
    error.name === 'ScanDeadlineExceededError' ||
    error.name === 'ScanCancelledError'
  );
}
