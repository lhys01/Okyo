import assert from 'node:assert/strict';
import test from 'node:test';

import { BRANCH_COMMITMENT_STORAGE_KEY, createBranchCommitmentPersistence } from './branchCommitmentPersistence';
import { beginStroke, emptySignature, extendStroke } from './signatureDrawing';

function signature() {
  let drawing = beginStroke(emptySignature(0.6), { x: 0.1, y: 0.1 });
  for (let index = 1; index <= 20; index += 1) drawing = extendStroke(drawing, { x: 0.1 + index * 0.03, y: 0.1 + (index % 3) * 0.1 });
  return drawing;
}

function storage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
  };
}

test('a signature persists for its branch during an onboarding session', async () => {
  const memory = storage();
  const persistence = createBranchCommitmentPersistence(memory);
  const saved = signature();
  await persistence.write('save_money', saved);
  assert.deepEqual(await persistence.read('save_money'), saved);
  assert.equal(await persistence.read('eat_healthier'), null);
  assert.ok(memory.values.has(BRANCH_COMMITMENT_STORAGE_KEY));
});

test('reset removes current and legacy signatures so a fresh onboarding session is blank', async () => {
  const memory = storage();
  const persistence = createBranchCommitmentPersistence(memory);
  await persistence.write('save_money', signature());
  memory.values.set('okyo:onboarding-branch-commitments:v1', JSON.stringify({ save_money: signature() }));
  await persistence.reset();
  assert.equal(await persistence.read('save_money'), null);
  assert.equal(memory.values.has('okyo:onboarding-branch-commitments:v1'), false);
});
