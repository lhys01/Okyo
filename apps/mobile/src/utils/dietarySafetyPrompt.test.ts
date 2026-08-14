import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyDietarySafetyPrompt } from './dietarySafetyPrompt';

test('no saved allergies produces no prompt, regardless of other groups', () => {
  assert.equal(classifyDietarySafetyPrompt({ allergies: [] }, []), 'none');
});

test('saved allergies with no detected conflict produce the general reminder', () => {
  assert.equal(classifyDietarySafetyPrompt({ allergies: ['Peanuts'] }, []), 'general_reminder');
});

test('a detected allergy or restriction conflict produces the possible-conflict level, overriding the general reminder', () => {
  assert.equal(classifyDietarySafetyPrompt({ allergies: ['Peanuts'] }, [{ category: 'allergy' }]), 'possible_conflict');
  assert.equal(classifyDietarySafetyPrompt({ allergies: ['Peanuts'] }, [{ category: 'restriction' }]), 'possible_conflict');
});

test('a dislike or avoidance conflict alone does not escalate to possible_conflict', () => {
  assert.equal(classifyDietarySafetyPrompt({ allergies: ['Peanuts'] }, [{ category: 'dislike' }, { category: 'avoidance' }]), 'general_reminder');
});

test('a custom (non-canonical) allergy that automated matching cannot recognize still produces the general reminder', () => {
  // "Kiwi allergy" is not one of DIETARY_ALLERGY_OPTIONS and findFoodPreferenceConflicts
  // would likely never match it against typical ingredient names — the level
  // is driven by allergies.length, not by whether matching found anything.
  assert.equal(classifyDietarySafetyPrompt({ allergies: ['Kiwi allergy'] }, []), 'general_reminder');
});
