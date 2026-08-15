import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(process.cwd(), 'src/screens/ShareCardPreviewScreen.tsx'), 'utf8');

test('recipe share card is live-customizable and exports the visible card', () => {
  assert.match(source, /Customize card/);
  assert.match(source, /Choose what to include on your card\. Changes update instantly\./);
  assert.match(source, /Dish → Recipe/);
  assert.match(source, /Turn any dish into a recipe/);
  assert.match(source, /getMetricRows\(metrics\)/);
  assert.match(source, /captureRef\(cardRef/);
  assert.match(source, /source=\{require\('\.\.\/\.\.\/assets\/app-icon\/icon\.png'\)\}/);
  assert.doesNotMatch(source, /remade at home/);
  assert.doesNotMatch(source, /Seen online/);
});

test('recipe share caption avoids price and savings claims', () => {
  const caption = source.slice(source.indexOf('function buildCaption'), source.indexOf('function getEstimatedRestaurantPrice'));
  assert.match(caption, /turned into a recipe with Okyo/);
  assert.doesNotMatch(caption, /Restaurant estimate|home estimate|Saved about/);
});
