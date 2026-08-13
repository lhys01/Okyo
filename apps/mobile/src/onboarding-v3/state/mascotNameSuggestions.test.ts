import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MASCOT_NAME_SUGGESTIONS,
  TYPEWRITER_NAME_SUGGESTIONS,
  advanceNameTypewriter,
  createNameTypewriterState,
  pickRandomMascotName,
  shouldAnimateNamePlaceholder,
} from './mascotNameSuggestions';

test('random mascot names come from the curated normal-name pool and avoid immediate repeats', () => {
  assert.deepEqual(MASCOT_NAME_SUGGESTIONS, [
    'Kiko', 'Milo', 'Luna', 'Theo', 'Ollie', 'Coco', 'Mochi', 'Leo', 'Pip', 'Nico',
    'Sunny', 'Teddy', 'Remy', 'Mika', 'Finn', 'Ruby', 'Louie', 'Bean', 'Archie', 'Nori',
  ]);
  const first = pickRandomMascotName(null, () => 0);
  const second = pickRandomMascotName(first, () => 0);
  assert.equal(first, 'Kiko');
  assert.notEqual(second, first);
  assert.ok(MASCOT_NAME_SUGGESTIONS.includes(second as typeof MASCOT_NAME_SUGGESTIONS[number]));
});

test('the placeholder types, pauses, deletes, and advances to the next name', () => {
  let state = createNameTypewriterState();
  for (const expected of ['M', 'Mi', 'Mil', 'Milo']) {
    state = advanceNameTypewriter(state);
    assert.equal(state.text, expected);
  }
  assert.equal(state.phase, 'pausing');
  state = advanceNameTypewriter(state);
  assert.equal(state.phase, 'deleting');
  for (const expected of ['Mil', 'Mi', 'M', '']) {
    state = advanceNameTypewriter(state);
    assert.equal(state.text, expected);
  }
  assert.equal(TYPEWRITER_NAME_SUGGESTIONS[state.nameIndex], 'Luna');
  state = advanceNameTypewriter(state);
  assert.equal(state.text, 'L');
});

test('placeholder animation stops for focus, user input, and Reduce Motion', () => {
  assert.equal(shouldAnimateNamePlaceholder('', false, false), true);
  assert.equal(shouldAnimateNamePlaceholder('', true, false), false);
  assert.equal(shouldAnimateNamePlaceholder('M', false, false), false);
  assert.equal(shouldAnimateNamePlaceholder('', false, true), false);
});

