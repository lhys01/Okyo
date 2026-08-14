import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addDietaryAllergy,
  addDietaryRestriction,
  completeDietarySafety,
  DIETARY_ALLERGY_OPTIONS,
  DIETARY_CUSTOM_ENTRY_MAX_COUNT,
  DIETARY_CUSTOM_ENTRY_MAX_LENGTH,
  DIETARY_RESTRICTION_OPTIONS,
  deselectNoneOfTheseDietary,
  emptyDietarySafetyAnswers,
  isDietarySafetyAnswered,
  normalizeCustomDietaryEntries,
  removeDietaryAllergy,
  removeDietaryRestriction,
  selectNoneOfTheseDietary,
  setDietaryDislikes,
} from './dietaryContracts';

test('all plan-required allergy and restriction options are present and distinct', () => {
  assert.deepEqual([...DIETARY_ALLERGY_OPTIONS], ['Peanuts', 'Tree nuts', 'Shellfish', 'Fish', 'Milk', 'Egg', 'Wheat', 'Soy', 'Sesame']);
  assert.deepEqual([...DIETARY_RESTRICTION_OPTIONS], ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Halal', 'Kosher']);
  assert.equal(new Set(DIETARY_ALLERGY_OPTIONS).size, DIETARY_ALLERGY_OPTIONS.length);
  assert.equal(new Set(DIETARY_RESTRICTION_OPTIONS).size, DIETARY_RESTRICTION_OPTIONS.length);
});

// --- Custom entry normalization ---------------------------------------------

test('custom entries are trimmed, whitespace-collapsed, and empties dropped', () => {
  assert.deepEqual(normalizeCustomDietaryEntries(['  Cilantro  ', '   ', 'Extra   spaces here']), ['Cilantro', 'Extra spaces here']);
});

test('custom entries deduplicate case-insensitively', () => {
  assert.deepEqual(normalizeCustomDietaryEntries(['Olives', 'olives', 'OLIVES']), ['Olives']);
});

test('custom entries are length-limited', () => {
  const long = 'x'.repeat(100);
  const [result] = normalizeCustomDietaryEntries([long]);
  assert.equal(result.length, DIETARY_CUSTOM_ENTRY_MAX_LENGTH);
});

test('custom entry list is count-limited', () => {
  const many = Array.from({ length: 50 }, (_, i) => `item-${i}`);
  assert.equal(normalizeCustomDietaryEntries(many).length, DIETARY_CUSTOM_ENTRY_MAX_COUNT);
});

test('non-string values in the input are ignored, not thrown', () => {
  assert.deepEqual(normalizeCustomDietaryEntries([42, null, undefined, 'Real entry'] as unknown[]), ['Real entry']);
});

// --- Mutual exclusivity ------------------------------------------------------

test('adding an allergy clears noneOfThese', () => {
  const withNone = selectNoneOfTheseDietary(emptyDietarySafetyAnswers);
  assert.equal(withNone.noneOfThese, true);
  const next = addDietaryAllergy(withNone, 'Peanuts');
  assert.equal(next.noneOfThese, false);
  assert.deepEqual(next.allergies, ['Peanuts']);
});

test('adding a restriction clears noneOfThese', () => {
  const withNone = selectNoneOfTheseDietary(emptyDietarySafetyAnswers);
  const next = addDietaryRestriction(withNone, 'Vegan');
  assert.equal(next.noneOfThese, false);
});

test('setting a dislike clears noneOfThese', () => {
  const withNone = selectNoneOfTheseDietary(emptyDietarySafetyAnswers);
  const next = setDietaryDislikes(withNone, ['Cilantro']);
  assert.equal(next.noneOfThese, false);
});

test('selecting noneOfThese deterministically clears every group', () => {
  let answers = addDietaryAllergy(emptyDietarySafetyAnswers, 'Peanuts');
  answers = addDietaryRestriction(answers, 'Vegan');
  answers = setDietaryDislikes(answers, ['Cilantro']);
  const cleared = selectNoneOfTheseDietary(answers);
  assert.deepEqual(cleared.allergies, []);
  assert.deepEqual(cleared.restrictions, []);
  assert.deepEqual(cleared.dislikes, []);
  assert.equal(cleared.noneOfThese, true);
});

test('deselecting noneOfThese leaves groups empty (does not resurrect prior selections)', () => {
  const withNone = selectNoneOfTheseDietary(emptyDietarySafetyAnswers);
  const deselected = deselectNoneOfTheseDietary(withNone);
  assert.equal(deselected.noneOfThese, false);
  assert.deepEqual(deselected.allergies, []);
});

test('removing an allergy/restriction does not affect noneOfThese', () => {
  const withAllergy = addDietaryAllergy(emptyDietarySafetyAnswers, 'Peanuts');
  const removed = removeDietaryAllergy(withAllergy, 'Peanuts');
  assert.equal(removed.noneOfThese, false);
  assert.deepEqual(removed.allergies, []);

  const withRestriction = addDietaryRestriction(emptyDietarySafetyAnswers, 'Vegan');
  assert.deepEqual(removeDietaryRestriction(withRestriction, 'Vegan').restrictions, []);
});

test('adding the same allergy twice does not duplicate it', () => {
  const once = addDietaryAllergy(emptyDietarySafetyAnswers, 'Peanuts');
  const twice = addDietaryAllergy(once, 'Peanuts');
  assert.deepEqual(twice.allergies, ['Peanuts']);
});

// --- Explicit none vs. unanswered --------------------------------------------

test('a fresh draft is unanswered: not noneOfThese, not completed, all groups empty', () => {
  assert.equal(isDietarySafetyAnswered(emptyDietarySafetyAnswers), false);
  assert.equal(emptyDietarySafetyAnswers.completed, false);
  assert.equal(emptyDietarySafetyAnswers.noneOfThese, false);
});

test('explicit noneOfThese counts as answered, distinct from unanswered empty groups', () => {
  const withNone = selectNoneOfTheseDietary(emptyDietarySafetyAnswers);
  assert.equal(isDietarySafetyAnswered(withNone), true);
  // Structurally identical groups (all empty) to the unanswered state, but
  // noneOfThese is the field that distinguishes them.
  assert.deepEqual(withNone.allergies, emptyDietarySafetyAnswers.allergies);
  assert.notEqual(withNone.noneOfThese, emptyDietarySafetyAnswers.noneOfThese);
});

test('completeDietarySafety is the only place completed becomes true', () => {
  assert.equal(emptyDietarySafetyAnswers.completed, false);
  const withAllergy = addDietaryAllergy(emptyDietarySafetyAnswers, 'Peanuts');
  assert.equal(withAllergy.completed, false, 'answering a group alone does not complete the screen');
  assert.equal(completeDietarySafety(withAllergy).completed, true);
});
