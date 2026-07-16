export class ScanDeadlineExceededError extends Error {
  constructor() {
    super('The scan exceeded its server deadline.');
    this.name = 'ScanDeadlineExceededError';
  }
}

export class ScanCancelledError extends Error {
  constructor() {
    super('The scan request was cancelled.');
    this.name = 'ScanCancelledError';
  }
}

export type ScanExecutionContext = {
  requestId: string;
  deadlineAt: number;
  signal: AbortSignal;
};

export function getScanDeadlineMs(): number {
  const configured = Number(process.env.AI_SCAN_DEADLINE_MS ?? 55_000);
  return Number.isFinite(configured) ? Math.min(58_000, Math.max(5_000, Math.round(configured))) : 55_000;
}

export function getRemainingScanMs(deadlineAt?: number): number | undefined {
  return deadlineAt === undefined ? undefined : Math.max(0, deadlineAt - Date.now());
}

export function throwIfScanCancelled(signal?: AbortSignal, deadlineAt?: number): void {
  if (deadlineAt !== undefined && Date.now() >= deadlineAt) {
    throw new ScanDeadlineExceededError();
  }
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new ScanCancelledError();
}

export async function waitForScanDelay(
  delayMs: number,
  signal?: AbortSignal,
  deadlineAt?: number,
): Promise<void> {
  throwIfScanCancelled(signal, deadlineAt);
  const remaining = getRemainingScanMs(deadlineAt);
  const boundedDelay = remaining === undefined ? delayMs : Math.min(delayMs, remaining);

  await new Promise<void>((resolve, reject) => {
    const finish = (callback: () => void) => {
      signal?.removeEventListener('abort', onAbort);
      callback();
    };
    const timer = setTimeout(() => {
      finish(() => {
        if (boundedDelay < delayMs) {
          reject(new ScanDeadlineExceededError());
        } else {
          resolve();
        }
      });
    }, boundedDelay);
    const onAbort = () => {
      clearTimeout(timer);
      finish(() => {
        try {
          throwIfScanCancelled(signal, deadlineAt);
        } catch (error) {
          reject(error);
        }
      });
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
  throwIfScanCancelled(signal, deadlineAt);
}
