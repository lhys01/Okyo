import assert from 'node:assert/strict';
import test from 'node:test';

import { createBranchTransitionGate } from './usePersistedBranchTransition';

type Draft = { step: 'first' | 'second' | 'third'; answer: string };
type Event = { type: 'NEXT' } | { type: 'BACK' };

function reduce(draft: Draft, event: Event): Draft {
  const order: Draft['step'][] = ['first', 'second', 'third'];
  const index = order.indexOf(draft.step);
  const nextIndex = event.type === 'NEXT'
    ? Math.min(index + 1, order.length - 1)
    : Math.max(index - 1, 0);
  return { ...draft, step: order[nextIndex] };
}

test('a persisted branch transition saves once and blocks a rapid second advance', async () => {
  let release!: () => void;
  const writes: Draft[] = [];
  let holdFirstWrite = true;
  const gate = createBranchTransitionGate<Draft, Event>({
    getStep: (draft) => draft.step,
    persist: (draft) => {
      writes.push(draft);
      if (!holdFirstWrite) return Promise.resolve(draft);
      holdFirstWrite = false;
      return new Promise((resolve) => { release = () => resolve(draft); });
    },
    reduce,
  });
  const draft: Draft = { step: 'first', answer: 'kept' };
  const first = gate.run(draft, { type: 'NEXT' });
  const duplicate = await gate.run(draft, { type: 'NEXT' });

  assert.deepEqual(duplicate, { accepted: false, draft });
  assert.equal(writes.length, 1);
  release();
  assert.deepEqual(await first, { accepted: true, draft: { step: 'second', answer: 'kept' }, destination: 'second' });
  assert.equal(gate.isLocked, true);
  gate.release();
  assert.equal((await gate.run({ step: 'second', answer: 'kept' }, { type: 'NEXT' })).accepted, true);
});

test('a failed draft write leaves the gate available and does not advance', async () => {
  const gate = createBranchTransitionGate<Draft, Event>({
    getStep: (draft) => draft.step,
    persist: async () => null,
    reduce,
  });
  const draft: Draft = { step: 'second', answer: 'preserved' };
  assert.deepEqual(await gate.run(draft, { type: 'NEXT' }), { accepted: false, draft });
  assert.equal(gate.isLocked, false);
});
