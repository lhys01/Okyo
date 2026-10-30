import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPreferencesPromptBlock, type RecipeGenerationPreferences } from './openRouterProvider.js';

test('no preferences produces no prompt block', () => {
  assert.equal(buildPreferencesPromptBlock(undefined), '');
  assert.equal(buildPreferencesPromptBlock({}), '',
    'an empty object must not inject an empty header');
});

test('recipePriority speed adds a tie-break instruction', () => {
  const block = buildPreferencesPromptBlock({ recipePriority: 'cook_faster_or_easier' });
  assert.match(block, /faster/);
  assert.match(block, /simpler technique/);
});

test('each recipePriority value produces a distinct instruction', () => {
  const speed = buildPreferencesPromptBlock({ recipePriority: 'cook_faster_or_easier' });
  const fewest = buildPreferencesPromptBlock({ recipePriority: 'know_ingredients' });
  const cost = buildPreferencesPromptBlock({ recipePriority: 'spend_less' });
  assert.notEqual(speed, fewest);
  assert.notEqual(fewest, cost);
  assert.match(cost, /cheaper/);
  assert.match(fewest, /complete, clear ingredient list/);
});

test('vegan and vegetarian emit different exclusions', () => {
  const vegan = buildPreferencesPromptBlock({ dietaryRestrictions: ['meat, fish, dairy, eggs, and honey'] });
  const vegetarian = buildPreferencesPromptBlock({ dietaryRestrictions: ['meat and fish'] });
  assert.match(vegan, /meat, fish, dairy, eggs, and honey/);
  assert.match(vegetarian, /meat and fish/);
  assert.notEqual(vegan, vegetarian);
});

test('avoid list is named explicitly', () => {
  const block = buildPreferencesPromptBlock({ dietaryAllergies: ['gluten'], dietaryRestrictions: ['nuts'] });
  assert.match(block, /saved allergies: gluten/);
  assert.match(block, /HARD DIETARY RESTRICTION:.*nuts/);
});

test('a time ceiling forbids claiming an unachievable time', () => {
  const block = buildPreferencesPromptBlock({ goalContext: { handsOnTimeMinutes: 15 } });
  assert.match(block, /Prefer no more than about 15 minutes of hands-on cooking/);
});

test('every block ends with the food-safety floor', () => {
  const block = buildPreferencesPromptBlock({ dietaryAllergies: ['peanuts'] });
  assert.match(block, /SAFETY CRITICAL/);
  assert.match(block, /MUST NOT include/);
});

test('less_effort cannot silently drop safety', () => {
  const block = buildPreferencesPromptBlock({
    recipePriority: 'cook_faster_or_easier',
    cookingFrictionFollowUp: 'too_many_steps',
    dietaryAllergies: ['sesame'],
  });
  assert.match(block, /combine steps where safe/);
  assert.match(block, /SAFETY CRITICAL/);
});

test('spend-less priority favors common lower-cost ingredients', () => {
  const block = buildPreferencesPromptBlock({ recipePriority: 'spend_less' });
  assert.match(block, /cheaper, common ingredients/);
});

test('only the fields that are set appear', () => {
  const prefs: RecipeGenerationPreferences = { goalContext: { trackingPreference: 'essentials' } };
  const block = buildPreferencesPromptBlock(prefs);
  assert.match(block, /Nutrition detail preference: essentials/);
  assert.equal(/vegan/.test(block), false);
  assert.equal(/minutes/.test(block), false);
});
