import assert from 'node:assert/strict';
import test from 'node:test';

import { getConciseGuidedInstruction } from './guidedInstruction';

test('a short Guided Cooking instruction remains unchanged', () => {
  assert.equal(
    getConciseGuidedInstruction('Preheat your oven to 350°F (175°C).'),
    'Preheat your oven to 350°F (175°C).',
  );
});

test('an exceptional Guided Cooking instruction is shortened before layout', () => {
  const instruction = Array.from(
    { length: 50 },
    (_, index) => `instruction-${index + 1}`,
  ).join(' ');
  const concise = getConciseGuidedInstruction(instruction);

  assert.ok(concise.length <= 218);
  assert.ok(concise.endsWith('…'));
});
