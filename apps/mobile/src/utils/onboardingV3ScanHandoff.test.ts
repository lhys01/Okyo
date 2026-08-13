import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import type { AnalyzeScanResult, CreateScanResult } from '../api/types';
import { runOnboardingAnalysis, runOnboardingRecipeGeneration } from '../onboarding-v3/controller/onboardingV3Requests';

const analysis: AnalyzeScanResult = {
  analysisId: 'analysis-1',
  confidence: 0.87,
  dishName: 'Spicy ramen',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  inputKind: 'prepared_dish',
  scanState: 'clear_food',
};

test('phase one forwards the real request and AbortSignal exactly once', async () => {
  const calls: unknown[] = [];
  const controller = new AbortController();
  const result = await runOnboardingAnalysis(
    { source: 'description', mealDescription: 'spicy ramen', mode: 'Normal' },
    controller.signal,
    { analyze: async (request, signal) => { calls.push({ request, signal }); return analysis; } },
  );
  assert.equal(result, analysis);
  assert.equal(calls.length, 1);
  assert.equal((calls[0] as { signal: AbortSignal }).signal, controller.signal);
});

test('phase two sends dietary choices without repeating analysis', async () => {
  let generateCalls = 0;
  let fallbackCalls = 0;
  const result = { status: 'success', source: 'description' } as CreateScanResult;
  const request = {
    mode: 'Normal' as const,
    dietaryRestrictions: ['Dairy'],
    dietaryDislikes: ['Olives'],
    recipeRequestId: 'request-1',
  };
  const output = await runOnboardingRecipeGeneration({
    analysisId: 'analysis-1',
    request,
    fallbackRequest: { source: 'description', mealDescription: 'spicy ramen', ...request },
  }, undefined, {
    generate: async (analysisId, actual) => {
      generateCalls += 1;
      assert.equal(analysisId, 'analysis-1');
      assert.deepEqual(actual, request);
      return result;
    },
    fallback: async () => { fallbackCalls += 1; return result; },
  });
  assert.equal(output, result);
  assert.equal(generateCalls, 1);
  assert.equal(fallbackCalls, 0);
});

test('an expired analysis falls back once to the full scan with dietary choices intact', async () => {
  let fallbackBody: unknown;
  const result = { status: 'success', source: 'photos' } as CreateScanResult;
  await runOnboardingRecipeGeneration({
    analysisId: 'expired-analysis',
    request: { dietaryRestrictions: ['Shellfish'], dietaryDislikes: ['Onions'], recipeRequestId: 'request-2' },
    fallbackRequest: {
      source: 'photos',
      image: { uri: 'file:///meal.jpg', dataUrl: 'data:image/jpeg;base64,AA==' },
      dietaryRestrictions: ['Shellfish'],
      dietaryDislikes: ['Onions'],
    },
  }, undefined, {
    generate: async () => { throw { status: 410, code: 'analysis_expired' }; },
    fallback: async (request) => { fallbackBody = request; return result; },
  });
  assert.deepEqual((fallbackBody as { dietaryRestrictions: string[] }).dietaryRestrictions, ['Shellfish']);
  assert.deepEqual((fallbackBody as { dietaryDislikes: string[] }).dietaryDislikes, ['Onions']);
});

test('photo selection stays temporary until a successful recipe is ready to commit', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/onboarding-v3/controller/useOnboardingV3Controller.ts'),
    'utf8',
  );
  const selectPhoto = source.slice(source.indexOf('const selectPhoto'), source.indexOf('const beginSession'));
  const generateRecipe = source.slice(source.indexOf('const generateRecipe'), source.indexOf('const retryRecipe'));
  const generationIndex = generateRecipe.indexOf('runOnboardingRecipeGeneration');
  const persistenceIndex = generateRecipe.indexOf('copyToDocuments');
  const commitIndex = generateRecipe.indexOf('commitRecipeResult');

  assert.ok(!selectPhoto.includes('copyToDocuments'));
  assert.ok(generationIndex >= 0);
  assert.ok(persistenceIndex > generationIndex);
  assert.ok(commitIndex > persistenceIndex);
});
