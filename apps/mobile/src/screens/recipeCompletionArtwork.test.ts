import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(process.cwd(), 'src/screens/RecipeDetailScreen.tsx'), 'utf8');

test('completion screen uses the supplied large pasta Kiko artwork', () => {
  assert.match(source, /kiko-pasta-celebration\.png/);
  assert.match(source, /completionMascotArt:[\s\S]{0,120}height: 190/);
  assert.doesNotMatch(source, /<KikoMascot pose="success"/);
});

test('completion content expands within the available screen', () => {
  assert.match(source, /completionCard:[\s\S]{0,100}flex: 1/);
  assert.match(source, /completionScrollContent:[\s\S]{0,80}flexGrow: 1/);
});
