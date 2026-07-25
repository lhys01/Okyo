import assert from 'node:assert/strict';
import test from 'node:test';

import { getNextGuidedCookingPreview } from './guidedCookingPreview';

const steps = [
  { title: 'Chop the vegetables', instruction: 'Cut the vegetables into even pieces.' },
  { title: 'Make the sauce', instruction: 'Whisk the sauce ingredients together.' },
  { title: 'Finish the dish', instruction: 'Toss everything together.' },
];

test('step 1 previews the real step 2 title', () => {
  assert.equal(getNextGuidedCookingPreview(steps, 0), 'Make the sauce');
});

test('the preview updates immediately after advancing', () => {
  assert.equal(getNextGuidedCookingPreview(steps, 0), 'Make the sauce');
  assert.equal(getNextGuidedCookingPreview(steps, 1), 'Finish the dish');
});

test('the final step shows no next-step preview', () => {
  assert.equal(getNextGuidedCookingPreview(steps, 2), null);
});

test('missing or malformed next-step text fails safely', () => {
  assert.equal(getNextGuidedCookingPreview([{ title: 'Current' }, { title: '', instruction: '' }], 0), null);
  assert.equal(getNextGuidedCookingPreview([{ title: 'Current' }, { title: 'Step 2', instruction: null }], 0), null);
  assert.equal(getNextGuidedCookingPreview([{ title: 'Current' }, { title: 'Step 2', instruction: 'Stir the sauce. Add herbs.' }], 0), 'Stir the sauce.');
});
