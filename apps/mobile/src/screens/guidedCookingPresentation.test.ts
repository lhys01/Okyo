import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(process.cwd(), 'src/screens/RecipeDetailScreen.tsx'), 'utf8');
const guidedScreen = source.slice(source.indexOf('export function RecipeStepsScreen'), source.indexOf('function ActiveCookingKeepAwake'));

test('guided cooking keeps ingredient and equipment references available at every density', () => {
  assert.match(guidedScreen, /<StepChips label="Ingredients" values=\{activeStep\.ingredientsUsed\.map\(getGuidedIngredientChipLabel\)\} \/>/);
  assert.match(guidedScreen, /<StepChips label="Equipment" values=\{activeStep\.toolsUsed\} \/>/);
  assert.doesNotMatch(guidedScreen, /<StepList/);
  assert.match(source, /guidedChipRow:[\s\S]{0,100}flexWrap: 'wrap'/);
});

test('adaptive cooking layouts change spacing only, never the shared type scale', () => {
  assert.match(guidedScreen, /getGuidedStepDensity\(activeStep\)/);
  assert.match(source, /guidedStepCardShort:[\s\S]{0,80}minHeight: 340/);
  assert.match(source, /guidedInstructionScrollLong: \{ maxHeight: 270 \}/);
  assert.match(source, /guidedInstructionContentShort:[\s\S]{0,160}minHeight: 272/);
  assert.doesNotMatch(source, /guidedStepTitleShort|guidedInstructionShort|guidedChipTextShort/);
});

test('guided cooking reads every shared text role from one typography token set', () => {
  assert.match(source, /import \{ guidedCookingTypography \} from '\.\.\/theme\/guidedCookingTypography'/);
  for (const role of ['nav', 'progress', 'title', 'instruction', 'sectionLabel', 'chip', 'upNext', 'button', 'primaryButton']) {
    assert.match(source, new RegExp(`guidedCookingTypography\\.${role}`));
  }
  assert.match(source, /smallBackText:[\s\S]{0,100}guidedCookingTypography\.nav/);
});

test('up-next stays in content flow while navigation remains anchored and accessible', () => {
  assert.ok(guidedScreen.indexOf('guidedNextPreview') < guidedScreen.indexOf('guidedControlArea'));
  assert.match(guidedScreen, /accessibilityLabel="Previous cooking step"/);
  assert.match(guidedScreen, /'Finish cooking' : 'Next cooking step'/);
  assert.match(source, /guidedControlArea:[\s\S]{0,220}marginTop: 'auto'/);
});

test('removed guided-cooking clutter and orange styling stay absent', () => {
  assert.doesNotMatch(guidedScreen, /Ask Okyo|Hands-on|Waiting|THIS STEP|Start timer/);
  assert.doesNotMatch(source, /guidedSafetyLabel:[\s\S]{0,120}recipeColors\.orange/);
});
