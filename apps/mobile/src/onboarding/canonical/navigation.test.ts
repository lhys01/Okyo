import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveCanonicalPreviewNavigation, shouldExitCanonicalPreviewBranch } from './navigation';

test('only the branch entry step returns Back to the V3 host', () => {
  assert.equal(shouldExitCanonicalPreviewBranch('intro', 'intro'), true);
  assert.equal(shouldExitCanonicalPreviewBranch('reveal', 'intro'), false);
  assert.equal(shouldExitCanonicalPreviewBranch('complete', 'intro'), false);
});

test('preview navigation intent has no branch-route side effects', () => {
  assert.deepEqual(resolveCanonicalPreviewNavigation({ currentRoute: 'intro', entryRoute: 'intro' }), { shouldExitHost: true });
  assert.deepEqual(resolveCanonicalPreviewNavigation({ currentRoute: 'question1', entryRoute: 'intro' }), { shouldExitHost: false });
});
