import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'PromiseScreen.tsx'), 'utf8');

// These are structural safeguards; simulator checks are still required for
// perceived motion, VoiceOver focus, safe areas, and food-image cropping.
test('the shared opening preserves one mounted food surface across its two beats', () => {
  assert.equal((source.match(/source=\{dish\}/g) ?? []).length, 1);
  assert.match(source, /layout=\{transition\}/);
  assert.match(source, /explaining && styles\.inputPhoto/);
  assert.doesNotMatch(source, /key=\{explaining/);
});

test('the mechanism explains inputs, usable output, and optional customization without separate feature cards', () => {
  for (const copy of ['Scan, upload, or describe a dish.', 'Ingredients & amounts', 'Clear cooking steps', 'With Pro, add protein']) {
    assert.ok(source.includes(copy), copy);
  }
  assert.doesNotMatch(source, /<Card|<GoalCard|<Pill/);
  assert.match(source, /Nutrition and cost are estimates/);
  assert.match(source, /not official restaurant recipes/);
});

test('the opening can be skipped and restored without triggering purchase or camera services', () => {
  assert.match(source, /accessibilityLabel="Try my first recipe" accessibilityRole="button" onPress=\{onTryRecipe\}/);
  assert.match(source, /onPress=\{onRestore\}/);
  assert.doesNotMatch(source, /purchasePackage|requestCameraPermissionsAsync|analyzeFood/);
});

test('large text gets a stacked composition, a scrollable body, and an uncapped primary label', () => {
  assert.match(source, /fontScale > 1\.4 && explaining && styles\.stackedScene/);
  assert.match(source, /<ScrollView/);
  assert.match(source, /LinearTransition\.duration\(reduceMotion \? 0 : 380\)/);
  assert.doesNotMatch(source, /maxFontSizeMultiplier|allowFontScaling=\{false\}/);
  assert.match(source, /primaryLabel: \{ color: colors\.ink/);
});
