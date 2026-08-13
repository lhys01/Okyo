import assert from 'node:assert/strict';
import test from 'node:test';

import { getConciseGuidedInstruction } from './guidedInstruction';

test('a short Guided Cooking instruction remains unchanged', () => {
  assert.equal(
    getConciseGuidedInstruction('Preheat your oven to 350°F (175°C).'),
    'Preheat your oven to 350°F (175°C).',
  );
});

test('a detailed instruction keeps every useful cooking cue', () => {
  const instruction =
    'Keep the skillet over medium heat. Add the shredded carrots and sauté for 2 minutes until crisp-tender. Add the sliced mushrooms and cook for 2–3 minutes until lightly browned. Add spinach last and move on when it is just wilted.';

  assert.equal(getConciseGuidedInstruction(instruction), instruction);
});
