import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { recordPlatterCoverage, recordRecipeQuality } from './recipeQualityAnalytics.js';

test('production quality analytics persist aggregate metrics without dish or ingredient names', async () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    recipeFlag: process.env.RECIPE_QUALITY_ANALYTICS,
    recipePath: process.env.RECIPE_QUALITY_ANALYTICS_PATH,
    platterFlag: process.env.PLATTER_COVERAGE_ANALYTICS,
    platterPath: process.env.PLATTER_COVERAGE_ANALYTICS_PATH,
  };
  const directory = await mkdtemp(join(tmpdir(), 'okyo-quality-privacy-'));
  try {
    process.env.NODE_ENV = 'production';
    process.env.RECIPE_QUALITY_ANALYTICS = 'true';
    process.env.RECIPE_QUALITY_ANALYTICS_PATH = join(directory, 'recipe.jsonl');
    process.env.PLATTER_COVERAGE_ANALYTICS = 'true';
    process.env.PLATTER_COVERAGE_ANALYTICS_PATH = join(directory, 'platter.jsonl');

    await recordRecipeQuality({
      model: 'model', category: 'dinner', score: 90, initialScore: 80,
      repairUsed: true, repairImprovement: 10, repairSuccess: true,
      compact: false, generationMs: 1000, stepCount: 4, warnings: {},
    });
    await recordPlatterCoverage({
      model: 'model', broadDishCategory: 'dinner', detectedComponentCount: 3,
      generatedComponentCount: 2, missingComponentCount: 1, coveragePercent: 67,
      finalCoveragePercent: 67, repairTriggered: false, repairAddedComponents: 0,
      repairSucceeded: false,
    });

    const recipeRow = JSON.parse((await readFile(process.env.RECIPE_QUALITY_ANALYTICS_PATH, 'utf8')).trim());
    const platterRow = JSON.parse((await readFile(process.env.PLATTER_COVERAGE_ANALYTICS_PATH, 'utf8')).trim());
    assert.equal('dish' in recipeRow, false);
    assert.equal('dish' in platterRow, false);
    assert.equal('missingComponentNames' in platterRow, false);
    assert.equal(recipeRow.category, 'dinner');
    assert.equal(platterRow.missingComponentCount, 1);
  } finally {
    process.env.NODE_ENV = previous.nodeEnv;
    process.env.RECIPE_QUALITY_ANALYTICS = previous.recipeFlag;
    process.env.RECIPE_QUALITY_ANALYTICS_PATH = previous.recipePath;
    process.env.PLATTER_COVERAGE_ANALYTICS = previous.platterFlag;
    process.env.PLATTER_COVERAGE_ANALYTICS_PATH = previous.platterPath;
    await rm(directory, { recursive: true, force: true });
  }
});
