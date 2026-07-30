import assert from 'node:assert/strict';
import test from 'node:test';

import { StaleRecipeRevisionError } from '../store.js';
import { CorrectionRequestValidationError, CorrectionValidationError } from './correctionIntent.js';
import {
  createCorrectionDiagnostics,
  getCorrectionErrorCategory,
  getCorrectionHttpStatus,
  getCorrectionIssueCodes,
  logCorrectionRequest,
} from './correctionReliability.js';
import {
  OpenRouterProviderError,
  type OpenRouterFailureReason,
} from './openRouterProvider.js';

function providerError(reason: OpenRouterFailureReason, httpStatus?: number) {
  return new OpenRouterProviderError({
    reason,
    aiEnabled: true,
    hasOpenRouterKey: true,
    model: 'provider-model',
    provider: 'provider',
    timeoutMs: 1000,
    maxOutputTokens: 1000,
    httpStatus,
  });
}

test('correction errors reserve 500 for unexpected programming failures', () => {
  assert.equal(getCorrectionHttpStatus(new CorrectionRequestValidationError(['empty'])), 400);
  assert.equal(getCorrectionHttpStatus(new CorrectionValidationError(['missed target'])), 422);
  assert.equal(getCorrectionHttpStatus(new StaleRecipeRevisionError('old', 'new')), 409);
  assert.equal(getCorrectionHttpStatus(providerError('openrouter_invalid_json')), 502);
  assert.equal(getCorrectionHttpStatus(providerError('openrouter_output_truncated')), 502);
  assert.equal(getCorrectionHttpStatus(providerError('openrouter_invalid_schema')), 502);
  assert.equal(getCorrectionHttpStatus(providerError('openrouter_network_error')), 503);
  assert.equal(getCorrectionHttpStatus(providerError('openrouter_timeout')), 503);
  assert.equal(getCorrectionHttpStatus(providerError('openrouter_http_error', 429)), 503);
  assert.equal(getCorrectionHttpStatus(providerError('openrouter_http_error', 503)), 503);
  assert.equal(getCorrectionHttpStatus(providerError('openrouter_http_error', 401)), 502);
  assert.equal(getCorrectionHttpStatus(new Error('unexpected')), 500);
});

test('structured correction logging emits one diagnosable summary without prompts or raw user text', () => {
  const originalLog = console.log;
  const calls: unknown[][] = [];
  console.log = (...args: unknown[]) => {
    calls.push(args);
  };
  try {
    const diagnostics = createCorrectionDiagnostics({
      correctionRequestId: 'request-1',
      sourceRecipeId: 'source-1',
    });
    diagnostics.intentType = 'nutrition_goal';
    diagnostics.normalizedTargetConcept = 'more protein';
    diagnostics.fuzzyNormalizedConcept = true;
    diagnostics.parsedRequirements = [{
      requirementIndex: 1,
      intentType: 'nutrition_goal',
      nutrient: 'protein',
      direction: 'more',
    }];
    diagnostics.originalNutrition = {
      calories: 400,
      proteinGrams: 25,
      carbohydratesGrams: 30,
      fatGrams: 20,
    };
    diagnostics.nutritionTargets = [{
      requirementIndex: 1,
      type: 'nutrition_goal',
      nutrient: 'protein',
      direction: 'more',
      originalValue: 25,
      targetValue: 30,
      targetMinimum: 30,
    }];
    diagnostics.firstValidationIssueCodes = [
      'nutrition_target_not_met',
      'protein_target_not_met',
    ];
    diagnostics.firstAttempt = {
      candidateNutrition: {
        calories: 405,
        proteinGrams: 27,
        carbohydratesGrams: 30,
        fatGrams: 20,
      },
      providerRequirementEvaluations: [{
        requirementIndex: 1,
        type: 'nutrition_goal',
        nutrient: 'protein',
        direction: 'more',
        originalValue: 25,
        targetValue: 30,
        targetMinimum: 30,
        candidateValue: 27,
        numericTargetPassed: false,
        ingredientEvidencePassed: true,
        stepEvidencePassed: false,
        servingsStable: true,
        macroDerivedCalories: 408,
        displayedCalories: 405,
        calorieTolerance: 40.8,
        calorieConsistencyPassed: true,
        issueCodes: [
          'protein_target_not_met',
          'nutrition_step_evidence_missing',
        ],
      }],
      finalRequirementEvaluations: [],
      validationIssueCodes: [
        'nutrition_target_not_met',
        'protein_target_not_met',
        'nutrition_step_evidence_missing',
      ],
      caloriesReconciled: false,
      providerDisplayedCalories: 405,
      detectedChangeCount: 1,
      ingredientChanges: [{
        kind: 'quantity_changed',
        normalizedBeforeName: 'grain base',
        normalizedAfterName: 'grain base',
        beforeQuantity: '1 cup',
        afterQuantity: '1.5 cup',
        affectedRequirementIndexes: [1],
        affectedStepIndexes: [1],
        referencedInSteps: true,
      }],
      rejectedManifestChanges: [],
    };
    diagnostics.focusedRepairRan = true;
    diagnostics.repairValidationIssueCodes = [];
    diagnostics.generatedRevisionId = 'revision-2';
    diagnostics.parentRevisionId = 'source-1';
    diagnostics.metrics = {
      providerCallCount: 2,
      deterministicRepairMs: 1,
      combinedRepairMs: 0,
      normalizationMs: 1,
      stages: ['recipe', 'recipe_retry'],
      attempts: [
        {
          attempt: 1,
          stage: 'recipe',
          finishReason: 'length',
          schemaParseResult: 'failure',
          failureReason: 'openrouter_invalid_schema',
        },
        {
          attempt: 2,
          stage: 'recipe_retry',
          finishReason: 'stop',
          schemaParseResult: 'success',
        },
      ],
    };

    logCorrectionRequest(diagnostics, 201);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], '[recipe_correction_request]');
    const payload = JSON.parse(String(calls[0][1])) as Record<string, unknown>;
    assert.equal(payload.correctionRequestId, 'request-1');
    assert.equal(payload.generatedRevisionId, 'revision-2');
    assert.equal(payload.finalHttpStatus, 201);
    assert.deepEqual(payload.originalNutrition, diagnostics.originalNutrition);
    assert.deepEqual(payload.nutritionTargets, diagnostics.nutritionTargets);
    assert.deepEqual(payload.firstAttempt, diagnostics.firstAttempt);
    assert.equal('prompt' in payload, false);
    assert.equal('correctionNote' in payload, false);
  } finally {
    console.log = originalLog;
  }
});

test('correction logs classify failures and use generic validation issue codes', () => {
  assert.equal(
    getCorrectionErrorCategory(providerError('openrouter_invalid_json')),
    'openrouter_invalid_json',
  );
  assert.deepEqual(
    getCorrectionIssueCodes([
      'Per-serving protein did not make the required meaningful change.',
      'An ingredient added for the protein goal is missing from the affected instructions.',
      'Servings changed even though the nutrition goal did not require it.',
    ]),
    [
      'nutrition_target_not_met',
      'nutrition_step_evidence_missing',
      'servings_changed',
    ],
  );

  assert.deepEqual(
    getCorrectionIssueCodes([], [{
      requirementIndex: 2,
      type: 'nutrition_goal',
      nutrient: 'protein',
      direction: 'more',
      originalValue: 25,
      targetValue: 30,
      targetMinimum: 30,
      candidateValue: 27,
      numericTargetPassed: false,
      ingredientEvidencePassed: false,
      stepEvidencePassed: false,
      servingsStable: false,
      macroDerivedCalories: 408,
      displayedCalories: 350,
      calorieTolerance: 40.8,
      calorieConsistencyPassed: false,
      issueCodes: [
        'protein_target_not_met',
        'nutrition_ingredient_change_missing',
        'nutrition_step_evidence_missing',
        'servings_changed',
        'calorie_macro_conflict',
      ],
    }]),
    [
      'protein_target_not_met',
      'nutrition_ingredient_change_missing',
      'nutrition_step_evidence_missing',
      'servings_changed',
      'calorie_macro_conflict',
    ],
  );
  assert.deepEqual(
    getCorrectionIssueCodes([
      'Correction change manifest could not be verified (manifest_change_not_found).',
    ]),
    ['correction_manifest_invalid'],
  );
});
