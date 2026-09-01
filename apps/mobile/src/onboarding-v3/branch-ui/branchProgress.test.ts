import test from 'node:test';
import assert from 'node:assert/strict';
import { getBranchProgress } from './branchProgress';

// A miniature route shaped like the real branches: an intro that shows no bar,
// question + non-question screens, then reveal + complete.
const ORDER = ['intro', 'q1', 'beatA', 'q2', 'beatB', 'q3', 'reveal', 'complete'] as const;

test('the bar advances one notch per screen, not per question bucket', () => {
  // 7 screens after intro; the last (complete) is index 6 = full.
  assert.deepEqual(getBranchProgress(ORDER, 'q1'), { answered: 0, total: 6 });
  assert.deepEqual(getBranchProgress(ORDER, 'beatA'), { answered: 1, total: 6 });
  assert.deepEqual(getBranchProgress(ORDER, 'q2'), { answered: 2, total: 6 });
  assert.deepEqual(getBranchProgress(ORDER, 'beatB'), { answered: 3, total: 6 });
  assert.deepEqual(getBranchProgress(ORDER, 'q3'), { answered: 4, total: 6 });
  assert.deepEqual(getBranchProgress(ORDER, 'reveal'), { answered: 5, total: 6 });
  assert.deepEqual(getBranchProgress(ORDER, 'complete'), { answered: 6, total: 6 });
});

test('every screen moves the fill — no two adjacent screens share a value', () => {
  const seq = ['q1', 'beatA', 'q2', 'beatB', 'q3', 'reveal', 'complete'] as const;
  const values = seq.map((s) => getBranchProgress(ORDER, s).answered);
  for (let i = 1; i < values.length; i += 1) assert.equal(values[i], values[i - 1] + 1);
});

test('Next raises the fill and Back lowers it', () => {
  const atQ2 = getBranchProgress(ORDER, 'q2').answered;
  assert.ok(getBranchProgress(ORDER, 'beatB').answered > atQ2, 'Next increases progress');
  assert.ok(getBranchProgress(ORDER, 'beatA').answered < atQ2, 'Back decreases progress');
});

test('the intro screen is excluded and complete renders as 100%', () => {
  const done = getBranchProgress(ORDER, 'complete');
  assert.equal(done.answered, done.total);
  // intro is not part of the sequence, so it maps to the start.
  assert.deepEqual(getBranchProgress(ORDER, 'intro'), { answered: 0, total: 6 });
});

test('an unknown step maps to the start rather than the end', () => {
  assert.deepEqual(getBranchProgress(ORDER, 'nope'), { answered: 0, total: 6 });
});
