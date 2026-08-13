import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Parsed from source rather than imported: this module pulls in react-native,
// which will not load under the plain node test runner.
const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), 'recommendedRecipes.ts');
const source = fs.readFileSync(SRC, 'utf8');

const ANIMAL_PROTEIN =
  /\b(chicken|beef|pork|lamb|veal|duck|turkey|bacon|sausage|steak|brisket|ham|prosciutto|pancetta|chorizo|pepperoni|salami|meatball|oxtail|gelatin|lard|anchov|fish|salmon|tuna|cod|tilapia|halibut|trout|bass|snapper|sardine|shrimp|prawn|crab|lobster|scallop|clam|mussel|oyster|squid|calamari|octopus|shellfish|seafood)\b/;

function parseSpecs() {
  const body = source.slice(source.indexOf('const specs: RecommendationSpec[] = ['));
  return body
    .split(/\n {2}\{\n/)
    .slice(1)
    .map((chunk) => {
      const grab = (re) => (chunk.match(re) || [])[1] || '';
      const ingBlock = (chunk.match(/ingredients: \[([\s\S]*?)\n {4}\]/) || [])[1] || '';
      const ingredients = [...ingBlock.matchAll(/\['[^']*',\s*'((?:[^'\\]|\\.)*)'\]/g)].map(
        (m) => m[1],
      );
      return {
        id: grab(/^\s*id: '((?:[^'\\]|\\.)*)'/m),
        title: grab(/^\s*title: '((?:[^'\\]|\\.)*)'/m),
        category: grab(/^\s*category: '((?:[^'\\]|\\.)*)'/m),
        ingredients,
        draft: /\n {4}draft: true,/.test(chunk),
      };
    })
    .filter((s) => s.id && s.title);
}

const specs = parseSpecs();
const published = specs.filter((s) => !s.draft);
const searchText = (s) => [s.title, ...s.ingredients].join(' ').toLowerCase();

const categories = [
  ...(source
    .match(/export const recommendationCategories: RecommendationCategory\[\] = \[([\s\S]*?)\n\];/)?.[1]
    .matchAll(/'((?:[^'\\]|\\.)*)'/g) ?? []),
].map((m) => m[1]);

test('parses the library and something is published', () => {
  assert.ok(specs.length > 600, `only parsed ${specs.length} specs`);
  assert.ok(published.length > 0, 'nothing is published');
});

test('every recipe has a category from the canonical list', () => {
  for (const s of specs) {
    assert.ok(
      categories.includes(s.category),
      `"${s.title}" has unknown category "${s.category}"`,
    );
  }
});

test('Vegetarian never contains meat, poultry or seafood', () => {
  // The exact bug reported: "Moroccan Lamb Tagine" surfaced under a
  // plant-based/vegetarian browse tile.
  const offenders = published
    .filter((s) => s.category === 'Vegetarian' && ANIMAL_PROTEIN.test(searchText(s)))
    .map((s) => s.title);
  assert.deepEqual(offenders, [], `meat found in Vegetarian: ${offenders.join(', ')}`);
});

test('no draft recipe is ever published', () => {
  assert.ok(
    published.every((s) => !s.draft),
    'a draft recipe leaked into the published set',
  );
});

test('published recipes have ingredients that mention the dish', () => {
  // Guards the template-filler regression: "Arroz con Pollo" whose ingredients
  // were pork tenderloin, couscous and soy-honey glaze.
  const STOP = new Set([
    'with', 'and', 'the', 'style', 'classic', 'easy', 'homemade', 'fresh',
    'baked', 'roasted', 'grilled', 'crispy', 'creamy', 'loaded', 'fluffy',
    'sheet', 'pan', 'slow', 'cooker', 'instant', 'pot', 'soft', 'mini',
  ]);
  const orphans = [];
  for (const s of published) {
    const tokens = s.title
      .toLowerCase()
      .replace(/[^a-z ]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 3 && !STOP.has(t));
    if (!tokens.length) continue;
    const ing = s.ingredients.join(' ').toLowerCase();
    if (!tokens.some((t) => ing.includes(t.replace(/s$/, '')))) orphans.push(s.title);
  }
  assert.ok(
    orphans.length <= 10,
    `${orphans.length} published recipes have ingredients unrelated to their name: ${orphans
      .slice(0, 12)
      .join(', ')}`,
  );
});

test('no two published recipes share an identical ingredient list', () => {
  // Tiramisu and Carrot Cake previously had byte-identical ingredients.
  const seen = new Map();
  const dupes = [];
  for (const s of published) {
    if (!s.ingredients.length) continue;
    const key = s.ingredients.join('|').toLowerCase();
    const prev = seen.get(key);
    if (prev) dupes.push(`${s.title} == ${prev}`);
    else seen.set(key, s.title);
  }
  assert.deepEqual(dupes, [], `duplicate ingredient lists: ${dupes.join('; ')}`);
});

test('recipe ids are unique', () => {
  const ids = specs.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});
