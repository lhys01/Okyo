import type { ScanRequestPhase } from './scanRequestPipeline';

export type ScanActivity = { scanSessionId: string; phase: ScanRequestPhase } | null;

let activity: ScanActivity = null;
const listeners = new Set<() => void>();

export function getScanActivitySnapshot(): ScanActivity {
  return activity;
}

export function subscribeToScanActivity(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setScanActivity(scanSessionId: string, phase: ScanRequestPhase): void {
  activity = { scanSessionId, phase };
  listeners.forEach((listener) => listener());
}

export function clearScanActivity(scanSessionId: string): void {
  if (activity?.scanSessionId !== scanSessionId) return;
  activity = null;
  listeners.forEach((listener) => listener());
}
