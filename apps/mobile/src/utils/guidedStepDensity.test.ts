import assert from 'node:assert/strict';
import test from 'node:test';

import { getGuidedStepDensity } from './guidedStepDensity';

const base = { ingredientsUsed: [], toolsUsed: [], instruction: 'Wash the berries.', visualCue: undefined, doneWhen: undefined, commonMistake: undefined, safetyNote: undefined, chefTip: undefined, cookingTerm: undefined, tip: undefined };

test('short glanceable steps use the spacious presentation density', () => {
  assert.equal(getGuidedStepDensity({ ...base, ingredientsUsed: [{ name: 'blueberries', quantity: '1 cup' }], toolsUsed: ['strainer'] }), 'short');
});

test('long or helper-heavy steps remain compact and scrollable', () => {
  assert.equal(getGuidedStepDensity({ ...base, instruction: 'Preheat the grill. Season the beef, grill it for several minutes per side, check the temperature, then rest it before assembling the burger.', doneWhen: 'The center reaches 160°F.', ingredientsUsed: Array(6).fill({ name: 'item', quantity: '' }), toolsUsed: ['grill', 'thermometer'] }), 'long');
});
