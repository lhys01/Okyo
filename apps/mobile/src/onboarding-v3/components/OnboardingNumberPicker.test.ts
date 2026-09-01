import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { NUMBER_PICKER_ITEM_HEIGHT, clampNumberPickerIndex, numberPickerIndexFromOffset } from './numberPickerMath';

test('number picker snaps offsets to the nearest valid option', () => {
  assert.equal(numberPickerIndexFromOffset(NUMBER_PICKER_ITEM_HEIGHT * 2.49, 10), 2);
  assert.equal(numberPickerIndexFromOffset(NUMBER_PICKER_ITEM_HEIGHT * 2.51, 10), 3);
  assert.equal(numberPickerIndexFromOffset(-100, 10), 0);
  assert.equal(numberPickerIndexFromOffset(10000, 3), 2);
});

test('number picker uses one committed selection change for haptic feedback', () => {
  const source = readFileSync(join(process.cwd(), 'src/onboarding-v3/components/OnboardingNumberPicker.tsx'), 'utf8');
  assert.match(source, /snapToInterval=\{NUMBER_PICKER_ITEM_HEIGHT\}/);
  assert.match(source, /onMomentumScrollEnd=\{handleSettled\}/);
  assert.match(source, /onScrollEndDrag=\{handleSettled\}/);
  assert.match(source, /if \(nextIndex === lastCommittedIndex\.current\) return/);
  assert.match(source, /Haptics\.selectionAsync\(\)/);
  assert.match(source, /useReduceMotion\(\)/);
});

test('number picker clamps empty and out-of-range selections safely', () => {
  assert.equal(clampNumberPickerIndex(2, 0), 0);
  assert.equal(clampNumberPickerIndex(-2, 4), 0);
  assert.equal(clampNumberPickerIndex(99, 4), 3);
});
