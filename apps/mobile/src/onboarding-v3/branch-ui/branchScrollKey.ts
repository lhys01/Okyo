import type { BranchId } from './branchTheme';

// A new question needs a fresh scroll position; selecting a low option on the
// previous question must not open the next one halfway down its content.
export function branchScrollKey(branch: BranchId, step?: string): string {
  return `${branch}:${step ?? 'body'}`;
}
