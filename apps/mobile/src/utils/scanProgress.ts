import type { ScanStatus } from '../api/types';

export type ScanProgressInput = {
  hasPreparedImage: boolean;
  hasValidatedRecipe: boolean;
  status: ScanStatus | 'pending' | null;
};

export function getScanProgress({ hasPreparedImage, hasValidatedRecipe, status }: ScanProgressInput) {
  if (hasValidatedRecipe && status === 'success') {
    return 1;
  }

  if (status === 'failed' || status === 'rejected') {
    return 0.86;
  }

  if (status === 'pending' && hasPreparedImage) {
    return 0.62;
  }

  return hasPreparedImage ? 0.32 : 0.12;
}

// ─── Monotonic, session-scoped progress ──────────────────────────────────────
//
// A single scan session must animate 0 -> ~1 exactly once: it can grow, it can
// freeze below completion on failure, and it can reach exactly 1 once on a
// validated success — but it must never go backwards and must never loop back
// to 0 while the session is still active. A brand-new scanSessionId is the
// only thing allowed to reset the value back to 0.

export type ScanProgressState = {
  scanSessionId: string | null;
  value: number;
};

export const INITIAL_SCAN_PROGRESS_STATE: ScanProgressState = {
  scanSessionId: null,
  value: 0,
};

export type NextScanProgressInput = ScanProgressInput & {
  previous: ScanProgressState;
  scanSessionId: string;
};

// The ceiling for a scan that is still pending — progress must stay visibly
// short of completion until a real success lands, so it never "fakes" 100%.
const PENDING_PROGRESS_CEILING = 0.98;

export function nextScanProgress({
  hasPreparedImage,
  hasValidatedRecipe,
  previous,
  scanSessionId,
  status,
}: NextScanProgressInput): ScanProgressState {
  const isNewSession = scanSessionId !== previous.scanSessionId;
  const baseline = isNewSession ? 0 : previous.value;

  const rawTarget = getScanProgress({ hasPreparedImage, hasValidatedRecipe, status });
  const target = status === 'pending' ? Math.min(rawTarget, PENDING_PROGRESS_CEILING) : rawTarget;

  // Monotonic within a session: never let the animated value fall back below
  // where it already was, even if a stale/duplicate update reports a lower
  // target (e.g. a re-render before the store has caught up).
  const value = Math.max(baseline, target);

  return { scanSessionId, value };
}
