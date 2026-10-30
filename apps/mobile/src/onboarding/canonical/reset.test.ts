import assert from 'node:assert/strict';
import test from 'node:test';

import { resetCanonicalOnboarding } from './reset';

test('canonical reset clears persistent drafts before resetting the in-memory session', async () => {
  const calls: string[] = [];
  let releasePersistence!: () => void;
  const persistence = new Promise<void>((resolve) => { releasePersistence = resolve; });

  const reset = resetCanonicalOnboarding({
    resetCanonicalPersistence: () => { calls.push('persistence'); return persistence; },
    resetSession: () => { calls.push('session'); },
    resetTour: async () => { calls.push('tour'); },
    onError: () => { calls.push('error'); },
  });

  assert.deepEqual(calls, ['persistence']);
  releasePersistence();
  const result = await reset;
  assert.deepEqual(result, { reset: true });
  assert.deepEqual(calls, ['persistence', 'tour', 'session']);
});
