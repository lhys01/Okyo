import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const card = readFileSync(resolve(process.cwd(), 'src/components/RecommendationCard.tsx'), 'utf8');
const home = readFileSync(resolve(process.cwd(), 'src/screens/HomeScreen.tsx'), 'utf8');

test('Today’s Ideas cards keep full titles and align metadata at the row bottom', () => {
  assert.match(home, /contentContainerStyle=\{\[styles\.ideasScrollContent, \{ alignItems: 'stretch'/);
  assert.match(card, /<Text maxFontSizeMultiplier=\{1\.3\} style=\{styles\.title\}>\{recipe\.title\}<\/Text>/);
  assert.doesNotMatch(card, /numberOfLines=\{compact \? 3 : 2\}/);
  assert.match(card, /compactCard: \{ flex: 1, minHeight: 222/);
  assert.match(card, /compactWrap: \{\s*alignSelf: 'stretch'/);
  assert.match(card, /meta: \{[\s\S]*?marginTop: 'auto'/);
});
