import assert from 'node:assert/strict';
import test from 'node:test';

import { describeDiet, isNothingSelected, toggleAvoid, togglePattern, type DietSelection } from './diet';

const EMPTY: DietSelection = { avoid: [] };

test('nothing is the default state', () => {
  assert.equal(isNothingSelected(EMPTY), true);
  assert.equal(describeDiet(EMPTY).line, 'Include everything.');
});

test('vegetarian and vegan are mutually exclusive', () => {
  const veg = togglePattern(EMPTY, 'vegetarian');
  assert.equal(veg.dietPattern, 'vegetarian');
  const vegan = togglePattern(veg, 'vegan');
  assert.equal(vegan.dietPattern, 'vegan', 'selecting vegan replaces vegetarian');
});

test('vegan is not treated as vegetarian-plus', () => {
  const vegan = togglePattern(EMPTY, 'vegan');
  assert.equal(vegan.dietPattern, 'vegan');
  assert.notEqual(vegan.dietPattern, 'vegetarian');
});

test('tapping the active pattern clears it back to nothing', () => {
  const veg = togglePattern(EMPTY, 'vegetarian');
  assert.equal(togglePattern(veg, 'vegetarian').dietPattern, undefined);
});

test('choosing Nothing clears the pattern but is independent of exclusions', () => {
  const state = toggleAvoid(togglePattern(EMPTY, 'vegan'), 'dairy');
  const cleared = togglePattern(state, null);
  assert.equal(cleared.dietPattern, undefined);
  assert.deepEqual(cleared.avoid, ['dairy'], 'exclusions are a separate model');
});

test('exclusions toggle independently and stay in a stable order', () => {
  let s = toggleAvoid(EMPTY, 'nuts');
  s = toggleAvoid(s, 'gluten');
  assert.deepEqual(s.avoid, ['gluten', 'nuts'], 'canonical order, not tap order');
  s = toggleAvoid(s, 'gluten');
  assert.deepEqual(s.avoid, ['nuts']);
});

test('vegan plus gluten is a valid combination', () => {
  const s = toggleAvoid(togglePattern(EMPTY, 'vegan'), 'gluten');
  assert.equal(s.dietPattern, 'vegan');
  assert.deepEqual(s.avoid, ['gluten']);
  assert.equal(describeDiet(s).line, 'Be vegan and leave out gluten.');
});

test('vegetarian plus dairy and nuts reads correctly', () => {
  let s = togglePattern(EMPTY, 'vegetarian');
  s = toggleAvoid(s, 'dairy');
  s = toggleAvoid(s, 'nuts');
  assert.equal(describeDiet(s).line, 'Be vegetarian and leave out dairy and nuts.');
});

test('exclusions alone do not imply a pattern', () => {
  const s = toggleAvoid(EMPTY, 'dairy');
  assert.equal(s.dietPattern, undefined);
  assert.match(describeDiet(s).detail, /No eating pattern set/);
});
