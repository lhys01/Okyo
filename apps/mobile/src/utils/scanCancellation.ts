export type ScanCancellation = {
  signal: AbortSignal;
  cancel: () => void;
};

export function createScanCancellation(): ScanCancellation {
  const controller = new AbortController();

  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  };
}

export function canCommitScanResult(input: {
  activeScanSessionId: string | null;
  incomingScanSessionId: string;
  signal: AbortSignal;
}): boolean {
  return input.activeScanSessionId === input.incomingScanSessionId && !input.signal.aborted;
}
