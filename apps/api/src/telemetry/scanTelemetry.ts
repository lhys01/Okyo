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

function isAbortLikeError(error: unknown): boolean {
  return error instanceof Error && (
    error.name === 'AbortError' ||
    error.name === 'ScanDeadlineExceededError' ||
    error.name === 'ScanCancelledError'
  );
}
