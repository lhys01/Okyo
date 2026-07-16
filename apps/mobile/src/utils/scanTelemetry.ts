const scanStartedAt = new Map<string, number>();
const revealedRequestIds = new Set<string>();

type MetricDetails = Record<string, boolean | number | string | null | undefined>;

export function markMobileScanStarted(requestId: string): void {
  scanStartedAt.set(requestId, Date.now());
  logMobileScanMetric(requestId, 'mobile_scan_started', 0);
}

export async function measureMobileScanStage<T>(
  requestId: string,
  stage: string,
  run: () => Promise<T>,
  details?: MetricDetails,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await run();
    logMobileScanMetric(requestId, stage, Date.now() - startedAt, details);
    return result;
  } catch (error) {
    logMobileScanMetric(requestId, stage, Date.now() - startedAt, {
      ...details,
      status: 'failure',
      reason: error instanceof Error ? error.name : 'unknown',
    });
    throw error;
  }
}

export function logMobileScreenReveal(requestId: string | null | undefined): void {
  if (!requestId || revealedRequestIds.has(requestId)) return;
  revealedRequestIds.add(requestId);
  const startedAt = scanStartedAt.get(requestId);
  logMobileScanMetric(
    requestId,
    'mobile_screen_reveal',
    startedAt === undefined ? 0 : Date.now() - startedAt,
    { hasStartTimestamp: startedAt !== undefined },
  );
  scanStartedAt.delete(requestId);
}

export function logMobileScanMetric(
  requestId: string,
  stage: string,
  durationMs: number,
  details?: MetricDetails,
): void {
  console.log('[scan_metric]', {
    requestId,
    stage,
    durationMs: Math.max(0, Math.round(durationMs)),
    ...details,
  });
}
