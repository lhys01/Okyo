import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');
const settings = read('src/screens/SettingsScreen.tsx');
const dietary = read('src/screens/DietaryPreferencesScreen.tsx');
const result = read('src/screens/ResultSummaryScreen.tsx');
const recipe = read('src/screens/RecipeDetailScreen.tsx');
const privacy = read('src/screens/PrivacyDataScreen.tsx');
const stats = read('src/screens/StatsProgressScreen.tsx');

test('Settings exposes account, preferences, progress, privacy, and support without production onboarding reset', () => {
  for (const label of ['Dietary preferences', 'Notifications', 'Stats & progress', 'Privacy & data', 'Help & support', 'Terms & privacy', 'Delete account']) assert.match(settings, new RegExp(label.replace('&', '&')));
  assert.match(settings, /__DEV__ \?/);
});

test('dietary preferences distinguish four categories and accept custom values', () => {
  for (const label of ['ALLERGIES', 'DIETARY RESTRICTIONS', 'THINGS I AVOID', 'DISLIKES', 'Other allergy']) assert.match(dietary, new RegExp(label));
  assert.match(dietary, /Search dietary preferences/);
});

test('result and recipe surfaces include warnings and pre-cook blocking', () => {
  assert.match(result, /FoodSafetyNotice/);
  assert.match(recipe, /FoodSafetyNotice/);
  assert.match(result, /Before you cook/);
  assert.match(recipe, /Before you cook/);
  assert.match(recipe, /Make this work for me/);
});

test('privacy deletion distinguishes local cleanup from authenticated account deletion', () => {
  assert.match(privacy, /Delete all Okyo data/);
  assert.match(privacy, /No account is signed in\. Local data can still be deleted above\./);
  assert.match(privacy, /deleteAuthenticatedAccount\(token\)/);
  assert.match(privacy, /External providers handle retention under their own policies/i);
});

test('stats use completed recipes and label estimates', () => {
  assert.match(stats, /state\.completedMeals/);
  assert.match(stats, /meal\.completedAt/);
  assert.match(stats, /estimated saved/);
  assert.match(stats, /Nutrition across completed recipes|Average protein across completed recipes/);
  assert.doesNotMatch(stats, /You ate/);
});
