export const SCAN_SHEET_ACTIONS = ['Take photo', 'Upload photo', 'Describe a dish'] as const;
export type ScanSheetActionKey = 'takePhoto' | 'upload' | 'describe';

export function createScanSheetActions(callbacks: { onDescribeMeal: () => void; onTakePhoto: () => void; onUpload: () => void }) {
  return [
    { caption: 'Photograph a prepared dish.', key: 'takePhoto', label: SCAN_SHEET_ACTIONS[0], onSelect: callbacks.onTakePhoto },
    { caption: 'Choose one from your library.', key: 'upload', label: SCAN_SHEET_ACTIONS[1], onSelect: callbacks.onUpload },
    { caption: 'Tell Okyo what you want.', key: 'describe', label: SCAN_SHEET_ACTIONS[2], onSelect: callbacks.onDescribeMeal },
  ] as const;
}

export type PendingScanAction = { current: (() => void) | null };

export function queueScanAction(pending: PendingScanAction, action: () => void) {
  pending.current = action;
}

export function takeScanAction(pending: PendingScanAction) {
  const action = pending.current;
  pending.current = null;
  return action;
}

export function clearScanAction(pending: PendingScanAction) {
  pending.current = null;
}

export function getScanSheetMaxHeight(windowHeight: number) {
  return Math.min(680, Math.round(windowHeight * 0.92));
}

export function shouldDismissScanSheet(translationY: number, velocityY: number) {
  return translationY > 72 || (translationY > 20 && velocityY > 0.8);
}
