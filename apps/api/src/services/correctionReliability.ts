import {
  CorrectionRequestValidationError,
  CorrectionValidationError,
  type IngredientChange,
  type NutritionRequirementEvaluation,
  type NutritionRequirementTarget,
  type RejectedManifestChange,
  type CorrectionValidationIssue,
} from './correctionIntent.js';
import {
  OpenRouterProviderError,
  type OpenRouterRequestMetrics,
} from './openRouterProvider.js';
import { StaleRecipeRevisionError } from '../store.js';
import type { CorrectionPatchApplication } from './correctionPatch.js';

export type CorrectionNutritionSnapshot = {
  calories: number;
  proteinGrams: number;
  carbohydratesGrams: number;
  fatGrams: number;
  fiberGrams?: number;
};

export type ParsedCorrectionRequirementDiagnostic = {
  requirementIndex: number;
  intentType: string;
  nutrient?: string;
  direction?: string;
};

export type CorrectionAttemptDiagnostics = {
  candidateNutrition?: CorrectionNutritionSnapshot;
  providerRequirementEvaluations: NutritionRequirementEvaluation[];
  finalRequirementEvaluations: NutritionRequirementEvaluation[];
  validationIssueCodes: string[];
  blockingValidationIssues?: CorrectionValidationIssue[];
  caloriesReconciled: boolean;
  providerDisplayedCalories: number | null;
  reconciledCalories?: number;
  detectedChangeCount: number;
  ingredientChanges: Array<Pick<
    IngredientChange,
    | 'kind'
    | 'normalizedBeforeName'
    | 'normalizedAfterName'
    | 'beforeQuantity'
    | 'afterQuantity'
    | 'affectedRequirementIndexes'
    | 'affectedStepIndexes'
    | 'referencedInSteps'
  >>;
  rejectedManifestChanges: RejectedManifestChange[];
  patch?: {
    ingredientReferenceMap: Record<string, string>;
    stepReferenceMap: Record<string, string>;
    ingredientOperations: unknown[];
    stepOperations: unknown[];
    rejectedOperationReasons: string[];
    appliedOperationCount: number;
    appliedStepReferences: string[];
  };
};

export type CorrectionRequestDiagnostics = {
  correctionRequestId: string;
  sourceRecipeId: string;
  generatedRevisionId?: string;
  parentRevisionId?: string;
  intentType?: string;
  normalizedTargetConcept?: string;
  fuzzyNormalizedConcept: boolean;
  parsedRequirements: ParsedCorrectionRequirementDiagnostic[];
  originalNutrition?: CorrectionNutritionSnapshot;
  nutritionTargets: NutritionRequirementTarget[];
  firstValidationIssueCodes: string[];
  firstAttempt?: CorrectionAttemptDiagnostics;
  focusedRepairRan: boolean;
  repairValidationIssueCodes: string[];
  repairAttempt?: CorrectionAttemptDiagnostics;
  repairCandidateEffectivelyIdentical?: boolean;
  failureCategory?: string;
  metrics?: OpenRouterRequestMetrics;
  startedAt: number;
  canonicalRecipeId?: string;
  requestedSourceRevisionId?: string;
  latestStoredRevisionId?: string;
  scanSessionId?: string;
  correctionKind?: 'new_scan' | 'sequential_correction' | 'stale_race' | 'unknown';
  repairBlockingValidationIssues?: CorrectionValidationIssue[];
};

export function createCorrectionDiagnostics(input: {
  correctionRequestId: string;
  sourceRecipeId: string;
}): CorrectionRequestDiagnostics {
  return {
    correctionRequestId: input.correctionRequestId,
    sourceRecipeId: input.sourceRecipeId,
    requestedSourceRevisionId: input.sourceRecipeId,
    fuzzyNormalizedConcept: false,
    parsedRequirements: [],
    nutritionTargets: [],
    firstValidationIssueCodes: [],
    focusedRepairRan: false,
    repairValidationIssueCodes: [],
    startedAt: Date.now(),
  };
}

export function getCorrectionHttpStatus(error: unknown): 400 | 409 | 422 | 502 | 503 | 500 {
  if (error instanceof CorrectionRequestValidationError) {
    return 400;
  }
  if (error instanceof StaleRecipeRevisionError) {
    return 409;
  }
  if (error instanceof CorrectionValidationError) {
    return 422;
  }
  if (error instanceof OpenRouterProviderError) {
    const { reason, httpStatus } = error.failure;
    if (
      reason === 'openrouter_missing_key' ||
      reason === 'openrouter_timeout' ||
      reason === 'openrouter_network_error' ||
      (reason === 'openrouter_http_error' && (
        httpStatus === 408 ||
        httpStatus === 429 ||
        (typeof httpStatus === 'number' && httpStatus >= 500)
      ))
    ) {
      return 503;
    }
    return 502;
  }
  return 500;
}

export function getCorrectionErrorCategory(error: unknown): string {
  if (error instanceof CorrectionRequestValidationError) {
    return 'malformed_correction_request';
  }
  if (error instanceof StaleRecipeRevisionError) {
    return 'stale_source_revision';
  }
  if (error instanceof CorrectionValidationError) {
    return 'mandatory_requirements_unsatisfied';
  }
  if (error instanceof OpenRouterProviderError) {
    return error.failure.reason;
  }
  return 'unexpected_programming_error';
}

export function getCorrectionIssueCodes(
  issues: string[],
  evaluations: NutritionRequirementEvaluation[] = [],
): string[] {
  return [...new Set([
    ...issues.map(getCorrectionIssueCode),
    ...evaluations.flatMap((evaluation) => evaluation.issueCodes),
  ])];
}

export function logCorrectionRequest(
  diagnostics: CorrectionRequestDiagnostics,
  finalHttpStatus: number,
  error?: unknown,
) {
  const unexpectedError = finalHttpStatus === 500 && error instanceof Error
    ? {
        name: error.name,
        message: error.message
          .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, '[redacted image data]')
          .slice(0, 240),
      }
    : undefined;
  const payload = {
    correctionRequestId: diagnostics.correctionRequestId,
    sourceRecipeId: diagnostics.sourceRecipeId,
    generatedRevisionId: diagnostics.generatedRevisionId,
    parentRevisionId: diagnostics.parentRevisionId,
    intentType: diagnostics.intentType,
    normalizedTargetConcept: diagnostics.normalizedTargetConcept,
    fuzzyNormalizedConcept: diagnostics.fuzzyNormalizedConcept,
    parsedRequirements: diagnostics.parsedRequirements,
    originalNutrition: diagnostics.originalNutrition,
    nutritionTargets: diagnostics.nutritionTargets,
    providerAttempts: diagnostics.metrics?.attempts ?? [],
    firstValidationIssueCodes: diagnostics.firstValidationIssueCodes,
    blockingValidationIssues: diagnostics.firstAttempt?.blockingValidationIssues ?? [],
    firstAttempt: diagnostics.firstAttempt,
    focusedRepairRan: diagnostics.focusedRepairRan,
    repairValidationIssueCodes: diagnostics.repairValidationIssueCodes,
    repairBlockingValidationIssues: diagnostics.repairBlockingValidationIssues ?? [],
    canonicalRecipeId: diagnostics.canonicalRecipeId,
    requestedSourceRevisionId: diagnostics.requestedSourceRevisionId,
    latestStoredRevisionId: diagnostics.latestStoredRevisionId,
    scanSessionId: diagnostics.scanSessionId,
    correctionKind: diagnostics.correctionKind,
    repairAttempt: diagnostics.repairAttempt,
    repairCandidateEffectivelyIdentical: diagnostics.repairCandidateEffectivelyIdentical,
    finalHttpStatus,
    errorCategory: diagnostics.failureCategory ?? (error ? getCorrectionErrorCategory(error) : undefined),
    unexpectedError,
    validationIssues: error instanceof CorrectionValidationError
      ? error.validationIssues
      : undefined,
    totalDurationMs: Date.now() - diagnostics.startedAt,
  };
  // Emit one sanitized JSON record so nested patch diagnostics remain fully
  // inspectable in Railway logs instead of being rendered as [Object].
  console.log('[recipe_correction_request]', JSON.stringify(payload));
}

function getCorrectionIssueCode(issue: string): string {
  const normalized = issue.toLowerCase();
  if (normalized.includes('change manifest')) {
    return 'correction_manifest_invalid';
  }
  if (normalized.includes('did not move') || normalized.includes('meaningful')) {
    return 'nutrition_target_not_met';
  }
  if (
    (normalized.includes('nutrition') && normalized.includes('invalid')) ||
    normalized.includes('calories conflict') ||
    normalized.includes('calorie change')
  ) {
    return 'nutrition_invalid';
  }
  if (normalized.includes('missing from ingredients')) {
    return 'required_ingredient_missing';
  }
  if (
    normalized.includes('missing from') &&
    (normalized.includes('step') || normalized.includes('instruction'))
  ) {
    return normalized.includes('nutrition') || normalized.includes('goal')
      ? 'nutrition_step_evidence_missing'
      : 'ingredient_step_reference_missing';
  }
  if (normalized.includes('removed ingredient') || normalized.includes('still appears')) {
    return 'removed_concept_still_present';
  }
  if (normalized.includes('servings changed')) {
    return 'servings_changed';
  }
  if (normalized.includes('too many')) {
    return 'unrelated_recipe_changes';
  }
  if (normalized.includes('removed the source recipe content') || normalized.includes('essential recipe structure')) {
    return 'destructive_unrelated_rewrite';
  }
  if (normalized.includes('missing required recipe content')) {
    return 'recipe_structure_invalid';
  }
  if (normalized.includes('invalid ingredient')) {
    return 'ingredient_structure_invalid';
  }
  if (normalized.includes('invalid cooking step')) {
    return 'step_structure_invalid';
  }
  if (normalized.includes('requested') && normalized.includes('target was not met')) {
    return 'nutrition_target_not_met';
  }
  if (normalized.includes('requested ingredient substitution')) {
    return 'ingredient_substitution_not_applied';
  }
  if (normalized.includes('did not change the recipe') || normalized.includes('no-op')) {
    return 'correction_no_op';
  }
  if (normalized.includes('recognizable') || normalized.includes('dish identity')) {
    return 'recipe_identity_changed';
  }
  if (normalized.includes('ingredients or instructions')) {
    return 'recipe_content_not_changed';
  }
  if (normalized.includes('without changing ingredients or quantities')) {
    return 'nutrition_ingredient_change_missing';
  }
  return 'correction_validation_failed';
}
