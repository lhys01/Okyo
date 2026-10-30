import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveCanonicalProgress, resolveCanonicalProgressSnapshot } from './progress';

test('canonical progress follows visible route order and moves back deterministically', () => {
  const routes = ['intro', 'question1', 'insight', 'question2', 'complete'];
  assert.deepEqual(resolveCanonicalProgress(routes, 'question1', { hiddenRoutes: ['intro'] }), { answered: 0, total: 3 });
  assert.deepEqual(resolveCanonicalProgress(routes, 'insight', { hiddenRoutes: ['intro'] }), { answered: 1, total: 3 });
  assert.deepEqual(resolveCanonicalProgress(routes, 'complete', { hiddenRoutes: ['intro'] }), { answered: 3, total: 3 });
  assert.deepEqual(resolveCanonicalProgress(routes, 'unknown', { hiddenRoutes: ['intro'] }), { answered: 0, total: 3 });
});

test('typed progress requests preserve the compatibility resolver result', () => {
  const request = { routeOrder: ['intro', 'question', 'complete'], currentRoute: 'question', hiddenRoutes: ['intro'] };
  assert.deepEqual(resolveCanonicalProgressSnapshot(request), resolveCanonicalProgress(request.routeOrder, request.currentRoute, { hiddenRoutes: request.hiddenRoutes }));
});
