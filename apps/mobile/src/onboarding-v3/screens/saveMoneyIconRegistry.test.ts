import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const screen = readFileSync(join(__dirname, 'SaveMoneyBranchScreen.tsx'), 'utf8');
const iconRegistry = readFileSync(join(__dirname, '..', 'assets', 'onboardingStickerIcons.tsx'), 'utf8');
const imageFallbacks = readFileSync(join(__dirname, '..', '..', 'utils', 'imageAssetFallbacks.ts'), 'utf8');

function optionBlock(name: 'priorityOptions') {
  const match = screen.match(new RegExp(`const ${name}[\\s\\S]*?\\n\\];`));
  assert.ok(match, `${name} must be declared`);
  return match[0];
}

test('Save Money priorities use six distinct appropriate icon components', () => {
  const priorities = optionBlock('priorityOptions');
  const expected = ['coins', 'timer', 'flame', 'leaf', 'proteinBar', 'chat'];

  for (const icon of expected) assert.match(priorities, new RegExp(`icon: stickerIcons\\.${icon}`));
  assert.equal(new Set(expected).size, expected.length);
  assert.doesNotMatch(priorities, /imageSource|assets\/food|recipes\//);
});

test('the shared icon renderer has an icon fallback and never a food fallback', () => {
  assert.match(iconRegistry, /assetKind="icon"/);
  assert.match(imageFallbacks, /icon: require\('\.\.\/\.\.\/assets\/onboarding-v3\/iconsnew\/onboarding-icon-sparkle\.png'\)/);
  assert.doesNotMatch(imageFallbacks, /icon: require\('\.\.\/\.\.\/assets\/food\//);
});

test('the Save Money final result does not use meal-option assets', () => {
  const finalPlan = screen.slice(screen.indexOf('function FinalPlan'));
  assert.doesNotMatch(finalPlan, /iconbreakfast|iconlunch|icondinner|iconsnacks|iconvaries/);
});
