import type { CreateScanResult } from '../api/types';

export const HOME_UPLOAD_TARGET_SCREEN = 'AnalysisLoadingScreen' as const;

export function shouldStartPickedUpload(canceled: boolean, assetCount: number) {
  return !canceled && assetCount > 0;
}

export function isCurrentScanSession(activeSessionId: string | null, incomingSessionId: string) {
  return activeSessionId === incomingSessionId;
}

export function getSafeTerminalScanStatus(result: Pick<CreateScanResult, 'status' | 'scan' | 'recipe'>) {
  if (result.status === 'rejected') return 'rejected' as const;
  if (result.status === 'failed') return 'failed' as const;
  if (result.status === 'partial' && result.scan) return 'partial' as const;
  if (result.status === 'success' && result.scan && result.recipe) return 'success' as const;
  return 'failed' as const;
}

export type AnalysisScreenOutcome = 'pending' | 'success' | 'inline_failure';

// Decides whether AnalysisLoadingScreen should navigate to the result screen,
// render an inline failure state, or keep waiting. Only a genuinely usable
// successful result may navigate away — every other terminal status
// (partial, failed, rejected, or a claimed success with no usable recipe)
// resolves to an inline failure on the same screen.
export function getAnalysisScreenOutcome(input: {
  status: CreateScanResult['status'] | 'pending' | null | undefined;
  usable: boolean;
  hasResult: boolean;
}): AnalysisScreenOutcome {
  if (!input.status || input.status === 'pending') {
    return 'pending';
  }
  if (input.status === 'success' && input.usable && input.hasResult) {
    return 'success';
  }
  return 'inline_failure';
}
