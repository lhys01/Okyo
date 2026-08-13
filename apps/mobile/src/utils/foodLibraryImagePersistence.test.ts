import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(relativePath: string) {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

test('built-in food library images resolve from bundled recipe assets', () => {
  const assets = read('assets/food/index.ts');
  const recipeImages = read('src/utils/recipeImages.ts');
  const recommendationCard = read('src/components/RecommendationCard.tsx');

  const imageFiles = [...assets.matchAll(/require\('\.\/recipes\/([^']+)'\)/g)].map((match) => match[1]);
  assert.ok(imageFiles.length > 0);
  for (const imageFile of imageFiles) {
    assert.equal(existsSync(path.join(mobileRoot, 'assets/food/recipes', imageFile)), true, `${imageFile} must be bundled`);
  }

  assert.match(assets, /getFoodLibraryImageAsset/);
  assert.match(assets, /recipeId\.startsWith\('rec-\'\) \? foodAssets\.bowl/);
  assert.match(recipeImages, /getFoodLibraryImageAsset/);
  assert.match(recipeImages, /getRecipeImageSource/);
  assert.match(recommendationCard, /imageSource=\{getRecipeImageSource\(recipe\)\}/);
});

test('delete all data removes only the user scan-image directory', () => {
  const store = read('src/state/useOkyoStore.ts');

  assert.match(store, /FileSystem\.deleteAsync\(dir, \{ idempotent: true \}\)/);
  assert.match(store, /okyo-scan-images/);
  assert.doesNotMatch(store, /assets\/food/);
  assert.doesNotMatch(store, /recipeAssets/);
});
