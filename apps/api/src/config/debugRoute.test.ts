import assert from 'node:assert/strict';
import test from 'node:test';

import { isAiDebugRouteAvailable } from './debugRoute.js';

test('AI configuration debug output is unavailable in production', () => {
  assert.equal(isAiDebugRouteAvailable('production'), false);
  assert.equal(isAiDebugRouteAvailable('development'), true);
});
