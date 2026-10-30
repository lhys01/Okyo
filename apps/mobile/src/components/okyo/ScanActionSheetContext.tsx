import { createContext, useContext } from 'react';

const ScanActionSheetContext = createContext<(() => void) | null>(null);

export const ScanActionSheetProvider = ScanActionSheetContext.Provider;

export function useOpenScanActionSheet() {
  const open = useContext(ScanActionSheetContext);
  if (!open) throw new Error('useOpenScanActionSheet must be used inside ScanActionSheetProvider');
  return open;
}
