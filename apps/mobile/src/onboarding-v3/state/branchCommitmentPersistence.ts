import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeSignature, type SignatureDrawing } from './signatureDrawing';

export type CommitmentBranch = 'save_money' | 'eat_healthier' | 'hit_macros';
// v1 stored strokes using a fixed canvas aspect. Those records render with a
// severe offset on the measured canvas, so they must never be revived.
export const BRANCH_COMMITMENT_STORAGE_KEY = 'okyo:onboarding-branch-commitments:v2';
const LEGACY_BRANCH_COMMITMENT_STORAGE_KEY = 'okyo:onboarding-branch-commitments:v1';

export function isCommitmentBranch(value: unknown): value is CommitmentBranch {
  return value === 'save_money' || value === 'eat_healthier' || value === 'hit_macros';
}

type StoredCommitments = Partial<Record<CommitmentBranch, SignatureDrawing>>;
type Storage = Pick<typeof AsyncStorage, 'getItem' | 'removeItem' | 'setItem'>;

function normalize(raw: unknown): StoredCommitments {
  if (!raw || typeof raw !== 'object') return {};
  const value = raw as Record<string, unknown>;
  return {
    save_money: normalizeSignature(value.save_money) ?? undefined,
    eat_healthier: normalizeSignature(value.eat_healthier) ?? undefined,
    hit_macros: normalizeSignature(value.hit_macros) ?? undefined,
  };
}

async function readAll(storage: Storage): Promise<StoredCommitments> {
  try { return normalize(JSON.parse((await storage.getItem(BRANCH_COMMITMENT_STORAGE_KEY)) ?? '{}')); } catch { return {}; }
}

export function createBranchCommitmentPersistence(storage: Storage) {
  return {
  async read(branch: CommitmentBranch) { return (await readAll(storage))[branch] ?? null; },
  async write(branch: CommitmentBranch, signature: SignatureDrawing) {
    const all = await readAll(storage);
    await storage.setItem(BRANCH_COMMITMENT_STORAGE_KEY, JSON.stringify({ ...all, [branch]: signature }));
  },
  async reset() {
    await Promise.all([
      storage.removeItem(BRANCH_COMMITMENT_STORAGE_KEY),
      storage.removeItem(LEGACY_BRANCH_COMMITMENT_STORAGE_KEY),
    ]);
  },
  };
}

export const branchCommitmentPersistence = createBranchCommitmentPersistence(AsyncStorage);
