import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { recommendedRecipes } from '../data/recommendedRecipes';
import { getHomeIdeaIdsForLocalHour, getHomeIdeasPeriod } from './homeIdeas';

const mobileRoot = process.cwd();
const imageRegistry = readFileSync(resolve(mobileRoot, 'assets/food/index.ts'), 'utf8');

test('time-based idea periods honor every local-time boundary', () => {
  assert.equal(getHomeIdeasPeriod(3), 'overnight');
  assert.equal(getHomeIdeasPeriod(4), 'morning');
  assert.equal(getHomeIdeasPeriod(11), 'morning');
  assert.equal(getHomeIdeasPeriod(12), 'afternoon');
  assert.equal(getHomeIdeasPeriod(16), 'afternoon');
  assert.equal(getHomeIdeasPeriod(17), 'dinner');
  assert.equal(getHomeIdeasPeriod(0), 'overnight');
});

test('each period selects a stable two-card pair and morning does not use breakfast burrito', () => {
  assert.deepEqual(getHomeIdeaIdsForLocalHour(4), ['rec-scrambled-eggs-toast', 'rec-crispy-tofu-power-bowl']);
  assert.deepEqual(getHomeIdeaIdsForLocalHour(12), ['rec-greek-salad', 'rec-creamy-tomato-rigatoni']);
  assert.deepEqual(getHomeIdeaIdsForLocalHour(17), ['rec-smash-cheeseburger', 'rec-sheet-pan-lemon-chicken']);
  assert.equal(getHomeIdeaIdsForLocalHour(4).includes('rec-breakfast-burrito'), false);
});

test('every Home example resolves to its own catalog label and bundled recipe image', () => {
  const ids = [...new Set([0, 4, 12, 17].flatMap((hour) => getHomeIdeaIdsForLocalHour(hour)))];

  for (const id of ids) {
    const recipe = recommendedRecipes.find((candidate) => candidate.id === id);
    assert.ok(recipe, `Home example ${id} must exist in the recommendation catalog`);
    assert.ok(recipe.title.trim().length > 0, `Home example ${id} must have a visible label`);

    const assetKey = id.replace(/^rec-/, '');
    const relativeAsset = `assets/food/recipes/${assetKey}.png`;
    assert.ok(existsSync(resolve(mobileRoot, relativeAsset)), `${id} must have its own bundled image`);
    assert.match(imageRegistry, new RegExp(`['\"]${assetKey}['\"]\\s*:\\s*require\\('./recipes/${assetKey}\\.png'\\)`));
  }
});
