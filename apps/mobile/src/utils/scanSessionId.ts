import type { ScanSource } from '../api/types';

// Extracted into its own dependency-free module (no React Native imports) so it
// can be unit tested directly — scanController.ts itself transitively imports
// react-native and can't be loaded under this repo's plain node:test runner.
export function createScanSessionId(source: ScanSource): string {
  return `scan-${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
