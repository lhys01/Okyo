import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const servicesDir = path.dirname(fileURLToPath(import.meta.url));
const apiSrcDir = path.resolve(servicesDir, '..');
const repoRoot = path.resolve(apiSrcDir, '..', '..', '..');

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function between(source: string, start: string, end: string): string {
  return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
}

test('production correction behavior contains no acceptance-fixture recipes or ingredient branches', () => {
  const aiService = read('apps/api/src/services/aiService.ts');
  const provider = read('apps/api/src/services/openRouterProvider.ts');
  const store = read('apps/api/src/store.ts');
  const canonicalRecipes = read('apps/mobile/src/state/canonicalRecipes.ts');
  const productionCorrectionSources = [
    read('apps/api/src/services/correctionIntent.ts'),
    read('apps/api/src/services/correctionPatch.ts'),
    read('apps/api/src/services/correctionReliability.ts'),
    read('apps/api/src/services/correctionValidator.ts'),
    between(aiService, 'export async function createAiRecipeCorrection', 'async function createAiScanWithMetrics'),
    between(provider, 'function getCorrectionPromptSection', 'async function callOpenRouterJson'),
    between(store, 'export class StaleRecipeRevisionError', 'export function getScan'),
    read('apps/mobile/src/utils/recipeCorrection.ts'),
    between(canonicalRecipes, 'export function correctCanonicalRecipe', 'export function setCanonicalRecipeMode'),
  ].join('\n');

  const fixtureTerms = [
    'Soy Sauce Noodles',
    'beef',
    'noodles',
    'sesame',
    'chicken',
    'tofu',
    'lamb',
    'peanuts',
    'mushrooms',
    'chili crisp',
    'peppers',
    'croutons',
    'broccoli',
    'lemon juice',
    'Greek yogurt',
    'wheat cereal',
    'patties',
    'oat cream',
    'ginger sauce',
    'fresh herb blend',
    'Savory Grain Plate',
    'standard savory component',
    'lean high-protein savory component',
  ];

  for (const term of fixtureTerms) {
    assert.doesNotMatch(
      productionCorrectionSources,
      new RegExp(`\\b${term.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i'),
      `${term} belongs in tests, not production correction behavior`,
    );
  }
  for (const fixtureTypo of ['protien', 'protin', 'vegtable', 'caleries', 'carps', 'diary', 'spicer', 'cruchy', 'sweeet']) {
    assert.doesNotMatch(
      productionCorrectionSources,
      new RegExp(`\\b${fixtureTypo}\\b`, 'i'),
      `${fixtureTypo} must be handled by generic edit-distance normalization, not a production branch`,
    );
  }
  assert.doesNotMatch(
    productionCorrectionSources,
    /if\s*\([^)]*(?:correction|note|normalizedNote)[^)]*includes\s*\(/i,
  );
  assert.doesNotMatch(
    productionCorrectionSources,
    /\b(?:calories|proteinGrams|carbohydratesGrams|fatGrams)\s*:\s*\d+/,
    'Production correction behavior must not contain fixed nutrition outputs',
  );
  assert.doesNotMatch(
    productionCorrectionSources,
    /\bquantity\s*:\s*['"][^'"]*\d[^'"]*['"]/,
    'Production correction behavior must not contain fixed corrected ingredient amounts',
  );
});

test('normal Edit Recipe uses the AI-native complete-recipe path without patch or quality-repair stages', () => {
  const aiService = read('apps/api/src/services/aiService.ts');
  const provider = read('apps/api/src/services/openRouterProvider.ts');
  const normalEditPath = between(
    aiService,
    'async function createAiRecipeCorrectionWithMetrics',
    'function createRecipeEditAnalysis',
  );
  const providerEditPath = between(
    provider,
    'export async function generateRecipeEditWithOpenRouter',
    'function hasStructuredCorrectionPatchOutput',
  );

  assert.match(normalEditPath, /generateRecipeEditWithOpenRouter/);
  assert.match(normalEditPath, /storeGeneratedRecipeRevision/);
  assert.doesNotMatch(normalEditPath, /generateRecipeFromDish|applyCorrectionPatch|focusedRepair|fallbackRan/);
  assert.doesNotMatch(providerEditPath, /ingredientOperations|stepOperations|PATCH-FIRST|ONE FOCUSED REPAIR/);
});

test('active V1 quality checks do not require removed teaching-card fields', () => {
  const aiService = read('apps/api/src/services/aiService.ts');
  const provider = read('apps/api/src/services/openRouterProvider.ts');
  const activeQualitySources = [
    between(aiService, 'export async function enrichRecipeCoaching', 'export function estimateIngredientCosts'),
    between(aiService, 'export function calculateRecipeCoachingScore', 'function ensureStructuredStepFallbacks'),
    between(aiService, 'function collectV1RecipeWarnings', '// Pure detection pass'),
    between(provider, 'function getRecipeQualityIssues', 'const standaloneVagueIngredient'),
  ].join('\n');

  for (const obsoleteField of ['why', 'chefTip', 'commonQuestion', 'decisionPoint']) {
    assert.doesNotMatch(activeQualitySources, new RegExp(`\\b${obsoleteField}\\b`));
  }
});
