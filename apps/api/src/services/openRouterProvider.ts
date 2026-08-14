import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { z } from 'zod';

import type { AiConfig } from '../config/aiConfig.js';
import type { Recipe, RecipeIngredient, RecipeMode, RecipeStep, ScanImageMetadata } from '../types.js';
import type { FoodImageAnalysis, RecipeGenerationPreferences } from './aiService.js';
import type { CorrectionGenerationContext } from './correctionIntent.js';
import { formatCorrectionRecipeReferences } from './correctionPatch.js';
import { isEpicureEnabled } from '../config/openRouter.js';
import { deriveDishAnatomy, deriveDishContract } from './dishAnatomy.js';
import { deriveFlavorPlan, flavorPlanPrompt } from './flavorPlan.js';
import { getLaminatedCroissantProofDiagnostics, validateRecipeQuality } from './recipeQualityValidator.js';
import { deriveRecipeStepTime, hasUnspecifiedPassiveWait } from './recipeTime.js';
import {
  buildEpicurePromptSection,
  enrichRecipeContext,
  type EnrichedRecipeContext,
} from './epicureService.js';

const openRouterEndpoint = 'https://openrouter.ai/api/v1/chat/completions';

// Recipe text model failover chain. Primary set via OPENROUTER_TEXT_MODEL.
const RECIPE_FALLBACK_MODELS = [
  'google/gemini-3.1-flash-lite',
  'google/gemini-3.5-flash',
];
const RECIPE_FAILOVER_DELAYS_MS = [2000, 5000, 10000];

const RICH_COOKING_INSTRUCTION_GUIDANCE =
  'Write practical, user-facing cooking instructions. For complex steps, usually use 2–5 concise sentences; simple actions may stay short. State exactly what to do, including useful cuts or preparation, technique, heat or temperature when relevant, grounded timing, and when to move on. Include a concrete visual, texture, or consistency cue. Add one brief mistake or safety note only when genuinely useful. Do not pad, repeat ingredient-chip text, invent timing, or use vague phrases such as "cook until done", "season to taste", "prepare the ingredients", or "mix everything". Keep doneWhen as one concise observable cue.';

export type OpenRouterFailureReason =
  | 'openrouter_missing_key'
  | 'openrouter_http_error'
  | 'openrouter_timeout'
  | 'openrouter_empty_content'
  | 'openrouter_output_truncated'
  | 'openrouter_invalid_json'
  | 'openrouter_invalid_schema'
  | 'openrouter_network_error'
  | 'openrouter_unknown_error';

export type OpenRouterFailureInfo = {
  reason: OpenRouterFailureReason;
  aiEnabled: boolean;
  hasOpenRouterKey: boolean;
  model: string;
  provider: string;
  timeoutMs: number;
  maxOutputTokens: number;
  httpStatus?: number;
  openRouterErrorMessage?: string;
};

export class OpenRouterProviderError extends Error {
  readonly failure: OpenRouterFailureInfo;

  constructor(failure: OpenRouterFailureInfo) {
    super(failure.openRouterErrorMessage ?? failure.reason);
    this.name = 'OpenRouterProviderError';
    this.failure = failure;
  }
}

const recipeValidationFailureCodes = new Set([
  'unsafe_temperature_poultry',
  'no_usable_steps',
  'steps_not_array',
  'step_not_structured',
  'step_missing_instruction',
  'step_missing_title',
  'step_missing_ingredients',
  'step_missing_tools',
  'stepNumber_missing',
  'stepNumber_not_sequential',
]);

function getHardRecipeValidationIssues(issues: string[]): string[] {
  return issues.filter((issue) => recipeValidationFailureCodes.has(issue.split(':', 1)[0]));
}

export function isRecipeValidationFailure(error: unknown): boolean {
  if (error instanceof Error && error.name === 'RecipeValidationError') {
    return true;
  }
  if (!(error instanceof OpenRouterProviderError) || error.failure.reason !== 'openrouter_invalid_schema') {
    return false;
  }

  const message = error.failure.openRouterErrorMessage ?? error.message;
  return message.includes('Recipe remained invalid after repair') ||
    message.includes('Recipe remained invalid after combined repair') ||
    message.includes('Recipe steps were structurally invalid after repair') ||
    message.includes('Recipe remained invalid after deterministic restoration') ||
    [...recipeValidationFailureCodes].some((code) => message.includes(code));
}

type SafeRecord = Record<string, unknown>;

export type OpenRouterRequestMetrics = {
  providerCallCount: number;
  deterministicRepairMs: number;
  combinedRepairMs: number;
  normalizationMs: number;
  stages: string[];
  attempts: Array<{
    attempt: number;
    stage: string;
    finishReason?: string | null;
    schemaParseResult?: 'success' | 'failure';
    schemaSelected?: 'complete_recipe' | 'correction_patch' | 'legacy_recipe_fallback';
    schemaIssuePaths?: string[];
    schemaSubcodes?: string[];
    topLevelKeys?: string[];
    outputCharacterCount?: number;
    patchKeysPresent?: boolean;
    legacyRecipeKeysPresent?: boolean;
    rawOperationNames?: string[];
    normalizedOperationNames?: string[];
    fieldLiftingActions?: string[];
    inheritedSourceFields?: string[];
    failureReason?: OpenRouterFailureReason;
    httpStatus?: number;
  }>;
};

const openRouterMetricsStorage = new AsyncLocalStorage<OpenRouterRequestMetrics>();

export async function runWithOpenRouterMetrics<T>(fn: () => Promise<T>): Promise<T> {
  return openRouterMetricsStorage.run({
    providerCallCount: 0,
    deterministicRepairMs: 0,
    combinedRepairMs: 0,
    normalizationMs: 0,
    stages: [],
    attempts: [],
  }, fn);
}

export function getOpenRouterMetrics(): OpenRouterRequestMetrics {
  const metrics = openRouterMetricsStorage.getStore();
  return metrics
    ? {
        ...metrics,
        stages: [...metrics.stages],
        attempts: metrics.attempts.map((attempt) => ({ ...attempt })),
      }
    : {
        providerCallCount: 0,
        deterministicRepairMs: 0,
        combinedRepairMs: 0,
        normalizationMs: 0,
        stages: [],
        attempts: [],
      };
}

function recordOpenRouterCall(stage: string | undefined) {
  const metrics = openRouterMetricsStorage.getStore();
  if (!metrics) return;
  metrics.providerCallCount += 1;
  const normalizedStage = stage ?? 'unknown';
  metrics.stages.push(normalizedStage);
  metrics.attempts.push({
    attempt: metrics.providerCallCount,
    stage: normalizedStage,
  });
}

function recordOpenRouterFinish(finishReason: string | null | undefined) {
  const attempt = openRouterMetricsStorage.getStore()?.attempts.at(-1);
  if (!attempt) return;
  attempt.finishReason = finishReason;
}

function recordOpenRouterFailure(error: OpenRouterProviderError) {
  const attempt = openRouterMetricsStorage.getStore()?.attempts.at(-1);
  if (!attempt) return;
  attempt.failureReason = error.failure.reason;
  attempt.httpStatus = error.failure.httpStatus;
}

function recordRecipeSchemaParse(result: 'success' | 'failure') {
  const attempt = openRouterMetricsStorage.getStore()?.attempts.at(-1);
  if (!attempt) return;
  attempt.schemaParseResult = result;
}

function recordCorrectionSchemaDiagnostics(input: {
  schemaSelected: 'correction_patch' | 'legacy_recipe_fallback';
  issuePaths?: string[];
  subcodes?: string[];
  topLevelKeys: string[];
  outputCharacterCount: number;
  patchKeysPresent: boolean;
  legacyRecipeKeysPresent: boolean;
  rawOperationNames?: string[];
  normalizedOperationNames?: string[];
  fieldLiftingActions?: string[];
  inheritedSourceFields?: string[];
}) {
  const attempt = openRouterMetricsStorage.getStore()?.attempts.at(-1);
  if (!attempt) return;
  attempt.schemaSelected = input.schemaSelected;
  attempt.schemaIssuePaths = input.issuePaths;
  attempt.schemaSubcodes = input.subcodes;
  attempt.topLevelKeys = input.topLevelKeys;
  attempt.outputCharacterCount = input.outputCharacterCount;
  attempt.patchKeysPresent = input.patchKeysPresent;
  attempt.legacyRecipeKeysPresent = input.legacyRecipeKeysPresent;
  attempt.rawOperationNames = input.rawOperationNames;
  attempt.normalizedOperationNames = input.normalizedOperationNames;
  attempt.fieldLiftingActions = input.fieldLiftingActions;
  attempt.inheritedSourceFields = input.inheritedSourceFields;
}

function addDeterministicRepairMs(durationMs: number) {
  const metrics = openRouterMetricsStorage.getStore();
  if (!metrics) return;
  metrics.deterministicRepairMs += durationMs;
}

function addCombinedRepairMs(durationMs: number) {
  const metrics = openRouterMetricsStorage.getStore();
  if (!metrics) return;
  metrics.combinedRepairMs += durationMs;
}

function addNormalizationMs(durationMs: number) {
  const metrics = openRouterMetricsStorage.getStore();
  if (!metrics) return;
  metrics.normalizationMs += durationMs;
}

export const openRouterVisionOutputSchema = z.object({
  inputKind: z.enum(['prepared_dish', 'raw_ingredients', 'not_food', 'unclear']).optional(),
  dishName: z.string().optional(),
  scanState: z.string().optional(),
  broadDishCategory: z.string().optional(),
  dishCategory: z.string().optional(),
  cuisine: z.string().optional(),
  confidence: z.union([z.number(), z.string()]).optional(),
  isFoodImage: z.union([z.boolean(), z.string()]).optional(),
  foodDetected: z.union([z.boolean(), z.string()]).optional(),
  isRestaurantMeal: z.union([z.boolean(), z.string()]).optional(),
  rejectionReason: z.string().optional(),
  visibleIngredients: z.array(z.string()).default([]),
  likelyIngredients: z.array(z.string()).default([]),
  possibleDishNames: z.array(z.string()).optional().default([]),
  visibleComponents: z.object({
    protein: z.string().optional().default(''),
    sauce: z.string().optional().default(''),
    baseStarch: z.string().optional().default(''),
    vegetables: z.string().optional().default(''),
    toppingsGarnish: z.string().optional().default(''),
    cookingMethod: z.string().optional().default(''),
  }).optional().default({}),
  restaurantPriceEstimate: z.union([z.number(), z.string()]).optional(),
  homemadeCostEstimate: z.union([z.number(), z.string()]).optional(),
  confidenceReason: z.string().optional(),
  // Inline Epicure fields — returned by vision when Epicure is enabled, eliminating a
  // separate sequential AI call. .catch(undefined): any malformed model output degrades
  // gracefully to undefined rather than failing the whole vision parse.
  epicureSuggestions: z.object({
    complementaryIngredients: z.array(z.string()).optional().default([]),
    healthySubstitutions: z.record(z.string()).optional().default({}),
    budgetSubstitutions: z.record(z.string()).optional().default({}),
  }).optional().catch(undefined),
});

const recipeStepSchema = z.object({
  // Canonical single-recipe step contract (required by the prompt, enforced by
  // validateRecipeStructure — NOT by zod, so we can surface field-level issue
  // codes for the repair pass instead of one opaque parse failure).
  stepNumber: z.number().optional(),
  step: z.string().optional().default(''),
  ingredients: z.array(z.string()).optional().default([]),
  tools: z.array(z.string()).optional().default([]),
  phase: z.number().optional(),
  title: z.string().optional().default(''),
  // Legacy field names kept optional so older outputs and saved-recipe re-parse
  // still map cleanly (getStepText / toStructuredStep read these as fallbacks).
  instruction: z.string().optional().default(''),
  text: z.string().optional().default(''),
  creates: z.array(z.string()).optional(),
  requires: z.array(z.string()).optional(),
  lookFor: z.string().optional(),
  doneWhen: z.string().optional(),
  chefTip: z.string().optional(),
  ingredientsUsed: z.array(z.string()).optional(),
  toolsUsed: z.array(z.string()).optional(),
  stepImagePrompt: z.string().optional(),
  stepImagePromptData: z.object({
    subject: z.string().optional().default(''),
    action: z.string().optional().default(''),
    vessel: z.string().optional().default(''),
    visualState: z.string().optional().default(''),
    cameraAngle: z.string().optional().default(''),
    style: z.string().optional().default(''),
  }).optional(),
  commonQuestion: z.string().optional(),
  commonQuestionAnswer: z.string().optional(),
  decisionPoint: z.string().optional(),
  ifYes: z.string().optional(),
  ifNo: z.string().optional(),
  why: z.string().optional(),
  commonMistake: z.string().optional(),
  estimatedMinutes: z.number().optional(),
  activeMinutes: z.number().optional(),
  passiveMinutes: z.number().optional(),
  elapsedMinutes: z.number().optional(),
  timeEstimate: z.string().optional().default(''),
  visualCue: z.string().optional().default(''),
  whyItMatters: z.string().optional().default(''),
  safetyNote: z.string().optional().default(''),
  flavorBoost: z.string().optional().default(''),
  cookingTerm: z.object({
    term: z.string().optional().default(''),
    meaning: z.string().optional().default(''),
  }).optional(),
});

// Models sometimes return list-like text fields as arrays; coerce instead of failing the whole recipe.
const flexibleText = z.union([z.string(), z.array(z.string())])
  .optional()
  .default('')
  .transform((value) => (Array.isArray(value) ? value.filter(Boolean).join(', ') : value));

const correctionAppliedChangeSchema = z.object({
  beforeIngredient: z.string().optional().default(''),
  afterIngredient: z.string().optional().default(''),
  reason: z.string().optional().default(''),
  supportsRequirementIndexes: z.array(z.number().int().positive()).optional().default([]),
  affectedStepIndexes: z.array(z.number().int().positive()).optional().default([]),
});

const correctionRequirementIndexesSchema = z.array(z.number().int().positive()).optional().default([]);
const correctionIngredientResultBaseSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  quantity: z.string().min(1).optional(),
  pantryItem: z.boolean().optional(),
});
const correctionIngredientOperationSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('add'),
    sourceIngredientId: z.never().optional(),
    result: correctionIngredientResultBaseSchema.extend({
      id: z.string().min(1), name: z.string().min(1), quantity: z.string().min(1),
    }),
    supportsRequirementIndexes: correctionRequirementIndexesSchema,
  }),
  z.object({
    operation: z.literal('remove'),
    sourceIngredientId: z.string().min(1),
    supportsRequirementIndexes: correctionRequirementIndexesSchema,
  }),
  z.object({
    operation: z.literal('replace'),
    sourceIngredientId: z.string().min(1),
    result: correctionIngredientResultBaseSchema.extend({
      name: z.string().min(1), quantity: z.string().min(1),
    }),
    supportsRequirementIndexes: correctionRequirementIndexesSchema,
  }),
  z.object({
    operation: z.literal('change_quantity'),
    sourceIngredientId: z.string().min(1),
    result: correctionIngredientResultBaseSchema.extend({ quantity: z.string().min(1) }),
    supportsRequirementIndexes: correctionRequirementIndexesSchema,
  }),
  z.object({
    operation: z.literal('change_descriptor'),
    sourceIngredientId: z.string().min(1),
    result: correctionIngredientResultBaseSchema.extend({ name: z.string().min(1) }),
    supportsRequirementIndexes: correctionRequirementIndexesSchema,
  }),
]);

const correctionStepResultSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().optional(),
  text: z.string().min(1),
  ingredientReferences: z.array(z.string().min(1)).default([]),
});
const correctionStepOperationSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('add'),
    sourceStepId: z.never().optional(),
    result: correctionStepResultSchema,
  }),
  z.object({
    operation: z.literal('remove'),
    sourceStepId: z.string().min(1),
  }),
  z.object({
    operation: z.literal('replace'),
    sourceStepId: z.string().min(1),
    result: correctionStepResultSchema,
  }),
]);

const correctionMetadataPatchSchema = z.object({
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  prepTimeMinutes: z.number().finite().positive().nullable().optional(),
  cookTimeMinutes: z.number().finite().positive().nullable().optional(),
  totalTimeMinutes: z.number().finite().positive().nullable().optional(),
  servings: z.number().finite().positive().nullable().optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).nullable().optional(),
  estimatedHomemadeCost: z.number().finite().nonnegative().nullable().optional(),
  equipment: z.array(z.string()).nullable().optional(),
  substitutions: z.array(z.string()).nullable().optional(),
  spicePairings: z.array(z.string()).nullable().optional(),
  pantryNote: z.string().nullable().optional(),
  storageAndReheating: z.string().nullable().optional(),
});

const correctionPatchNutritionSchema = z.object({
  calories: z.number().finite().nonnegative().max(5000),
  proteinGrams: z.number().finite().nonnegative().max(300),
  carbohydratesGrams: z.number().finite().nonnegative().max(500),
  fatGrams: z.number().finite().nonnegative().max(300),
  fiberGrams: z.number().finite().nonnegative().max(150).optional(),
});
export const correctionPatchProviderOutputSchema = z.object({
  ingredientOperations: z.array(correctionIngredientOperationSchema).default([]),
  stepOperations: z.array(correctionStepOperationSchema).default([]),
  nutritionEstimate: correctionPatchNutritionSchema.optional(),
  metadataPatch: correctionMetadataPatchSchema.optional(),
});
export type CorrectionPatchProviderOutput = z.infer<typeof correctionPatchProviderOutputSchema>;

const recipeVariantSchema = z.object({
  title: flexibleText,
  description: flexibleText,
  equipment: z.array(z.union([
    z.string(),
    z.record(z.unknown()).transform((obj) => {
      const r = obj as Record<string, unknown>;
      return String(r.name ?? r.item ?? r.tool ?? r.equipment ?? Object.values(r)[0] ?? '').trim();
    }),
  ])).optional().default([]),
  // ponytail: coerce ingredient objects → strings; model ignores prompt despite repeated instruction
  ingredients: z.array(
    z.union([
      z.string(),
      z.record(z.unknown()).transform((obj) => {
        const q = String((obj as Record<string, unknown>).quantity ?? (obj as Record<string, unknown>).amount ?? '');
        const n = String((obj as Record<string, unknown>).name ?? '');
        return [q, n].filter(Boolean).join(' ').trim();
      }),
    ])
  ).optional().default([]),
  ingredientGroups: z.array(z.object({
    component: z.string().optional().default(''),
    items: z.array(z.string()).optional().default([]),
  })).optional().default([]),
  steps: z.array(z.union([z.string(), recipeStepSchema])).optional().default([]),
  avoidMistake: flexibleText,
  mistakeWarning: flexibleText,
  substitutions: z.array(z.union([
    z.string(),
    z.record(z.unknown()).transform((obj) => {
      const r = obj as Record<string, unknown>;
      const from = String(r.ingredient ?? r.name ?? r.from ?? '');
      const to = String(r.substitute ?? r.replacement ?? r.to ?? '');
      const note = String(r.note ?? r.description ?? '');
      return [from && `${from}:`, to, note].filter(Boolean).join(' ').trim();
    }),
  ])).optional().default([]),
  storageAndReheating: flexibleText,
  storage: flexibleText,
  groceryItems: z.array(z.object({
    name: z.string().optional().default(''),
    quantity: z.string().optional().default(''),
    category: z.string().optional().default(''),
    pantryStaple: z.union([z.boolean(), z.string()]).optional(),
    sourceIngredient: z.string().optional().default(''),
    shoppingNote: z.string().optional().default(''),
  })).optional().default([]),
  spicePairings: z.array(z.union([
    z.string(),
    z.record(z.unknown()).transform((obj) => {
      const r = obj as Record<string, unknown>;
      const spice = String(r.spice ?? r.name ?? r.ingredient ?? '');
      const note = String(r.note ?? r.description ?? r.pairing ?? '');
      return [spice, note].filter(Boolean).join(' — ').trim();
    }),
  ])).optional().default([]),
  cookingTerms: z.array(z.object({
    term: z.string().optional().default(''),
    meaning: z.string().optional().default(''),
  })).optional().default([]),
  prepTime: z.union([z.string(), z.number()]).optional().default('').transform(String),
  cookTime: z.union([z.string(), z.number()]).optional().default('').transform(String),
  totalTime: z.union([z.string(), z.number()]).optional().default('').transform(String),
  activeTime: z.union([z.string(), z.number()]).optional().default('').transform(String),
  servings: z.union([z.number(), z.string()]).optional(),
  restaurantPriceEstimate: z.union([z.number(), z.string()]).optional(),
  skillLevel: z.string().optional().default(''),
  difficulty: z.string().optional().default(''),
  nutritionEstimate: z.object({
    calories: z.number().finite().nonnegative().max(5000),
    proteinGrams: z.number().finite().nonnegative().max(300),
    carbohydratesGrams: z.number().finite().nonnegative().max(500),
    fatGrams: z.number().finite().nonnegative().max(300),
    fiberGrams: z.number().finite().nonnegative().max(150).optional(),
  }).optional(),
  appliedChanges: z.array(correctionAppliedChangeSchema).optional().default([]),
  ingredientOperations: z.array(correctionIngredientOperationSchema).optional().default([]),
  stepOperations: z.array(correctionStepOperationSchema).optional().default([]),
  metadataPatch: correctionMetadataPatchSchema.optional(),
});

// One scan -> one canonical recipe. The AI returns a single recipe object
// (the dish plus its fields/steps), never per-mode variants. The current mode
// selector is presentation-only and does not request separate generations.
export const openRouterRecipeOutputSchema = recipeVariantSchema.extend({
  dishName: z.string().optional().default(''),
});

export type OpenRouterVisionOutput = z.input<typeof openRouterVisionOutputSchema>;
export type OpenRouterRecipeOutput = z.infer<typeof openRouterRecipeOutputSchema>;
export type OpenRouterRecipeVariant = z.infer<typeof recipeVariantSchema>;

type RecipeArrayFieldDefinition = {
  path: string;
  kind: 'string[]' | 'object[]' | 'number[]';
  commaSafe?: 'shortText' | 'amountedIngredients';
};

export const recipeArrayFieldDefinitions = [
  { path: 'equipment', kind: 'string[]', commaSafe: 'shortText' },
  { path: 'ingredients', kind: 'string[]', commaSafe: 'amountedIngredients' },
  { path: 'substitutions', kind: 'string[]' },
  { path: 'spicePairings', kind: 'string[]' },
  { path: 'ingredientGroups', kind: 'object[]' },
  { path: 'ingredientGroups.items', kind: 'string[]', commaSafe: 'amountedIngredients' },
  { path: 'steps', kind: 'object[]' },
  { path: 'steps.ingredients', kind: 'string[]', commaSafe: 'shortText' },
  { path: 'steps.tools', kind: 'string[]', commaSafe: 'shortText' },
  { path: 'steps.creates', kind: 'string[]', commaSafe: 'shortText' },
  { path: 'steps.requires', kind: 'string[]', commaSafe: 'shortText' },
  { path: 'steps.ingredientsUsed', kind: 'string[]', commaSafe: 'shortText' },
  { path: 'steps.toolsUsed', kind: 'string[]', commaSafe: 'shortText' },
  { path: 'groceryItems', kind: 'object[]' },
  { path: 'cookingTerms', kind: 'object[]' },
  { path: 'appliedChanges', kind: 'object[]' },
  { path: 'appliedChanges.supportsRequirementIndexes', kind: 'number[]' },
  { path: 'appliedChanges.affectedStepIndexes', kind: 'number[]' },
  { path: 'ingredientOperations', kind: 'object[]' },
  { path: 'stepOperations', kind: 'object[]' },
  { path: 'metadataPatch.equipment', kind: 'string[]', commaSafe: 'shortText' },
  { path: 'metadataPatch.substitutions', kind: 'string[]' },
  { path: 'metadataPatch.spicePairings', kind: 'string[]' },
] as const satisfies readonly RecipeArrayFieldDefinition[];

export const normalizedRecipeStringArrayFields = recipeArrayFieldDefinitions
  .filter((definition) => definition.kind === 'string[]')
  .map((definition) => definition.path);

const recipeArrayFieldDefinitionMap = new Map<string, RecipeArrayFieldDefinition>(
  recipeArrayFieldDefinitions.map((definition) => [definition.path, definition]),
);

export function normalizeRecipeProviderOutputShape(value: unknown): unknown {
  const normalized = normalizeRecipeNode(normalizeRecipeRootAliases(value), '');
  const record = getRecord(normalized);
  if (!record || (Array.isArray(record.ingredients) && record.ingredients.length > 0)) return normalized;
  const groups = Array.isArray(record.ingredientGroups) ? record.ingredientGroups : [];
  const groupedIngredients = groups.flatMap((group) => {
    const items = getRecord(group)?.items;
    return Array.isArray(items) ? items.filter((item): item is string => typeof item === 'string') : [];
  });
  return groupedIngredients.length > 0 ? { ...record, ingredients: groupedIngredients } : normalized;
}

function normalizeRecipeRootAliases(value: unknown): unknown {
  const source = getRecord(value);
  if (!source) return value;

  const normalized: SafeRecord = { ...source };
  copyRecipeAlias(normalized, 'title', ['dishName', 'name', 'recipeName']);
  copyRecipeAlias(normalized, 'description', ['summary', 'recipeDescription']);
  copyRecipeAlias(normalized, 'ingredients', ['ingredientList']);
  copyRecipeAlias(normalized, 'steps', ['instructions', 'directions']);
  copyRecipeAlias(normalized, 'equipment', ['tools', 'requiredEquipment']);
  copyRecipeAlias(normalized, 'servings', ['serves', 'yield']);
  copyRecipeAlias(normalized, 'prepTime', ['prepTimeMinutes']);
  copyRecipeAlias(normalized, 'cookTime', ['cookTimeMinutes']);
  copyRecipeAlias(normalized, 'totalTime', ['totalTimeMinutes']);
  copyRecipeAlias(normalized, 'activeTime', ['activeTimeMinutes']);

  const servings = normalizeRecipeLikeServings(normalized.servings);
  if (servings !== undefined) normalized.servings = servings;

  const nutritionSource = normalized.nutritionEstimate ?? normalized.nutrition ?? normalized.macros;
  if (nutritionSource !== undefined) {
    const nutritionEstimate = normalizeRecipeLikeNutrition(nutritionSource);
    if (nutritionEstimate) normalized.nutritionEstimate = nutritionEstimate;
    else delete normalized.nutritionEstimate;
  }

  return normalized;
}

function copyRecipeAlias(record: SafeRecord, target: string, aliases: string[]) {
  if (hasRecipeLikeValue(record[target])) return;
  const value = aliases.map((alias) => record[alias]).find(hasRecipeLikeValue);
  if (value !== undefined) record[target] = value;
}

function hasRecipeLikeValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function normalizeRecipeLikeServings(value: unknown): number | string | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== 'string') return undefined;
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : value.trim() || undefined;
}

function normalizeRecipeLikeNutrition(value: unknown): SafeRecord | undefined {
  const source = getRecord(value);
  if (!source) return undefined;
  const calories = getRecipeLikeNumber(source.calories ?? source.kcal);
  const proteinGrams = getRecipeLikeNumber(source.proteinGrams ?? source.protein);
  const carbohydratesGrams = getRecipeLikeNumber(
    source.carbohydratesGrams ?? source.carbohydrateGrams ?? source.carbohydrates ?? source.carbs,
  );
  const fatGrams = getRecipeLikeNumber(source.fatGrams ?? source.fat);
  if (
    calories === undefined || calories < 0 || calories > 5000 ||
    proteinGrams === undefined || proteinGrams < 0 || proteinGrams > 300 ||
    carbohydratesGrams === undefined || carbohydratesGrams < 0 || carbohydratesGrams > 500 ||
    fatGrams === undefined || fatGrams < 0 || fatGrams > 300
  ) {
    return undefined;
  }
  const fiberGrams = getRecipeLikeNumber(source.fiberGrams ?? source.fiber);
  return {
    calories,
    proteinGrams,
    carbohydratesGrams,
    fatGrams,
    ...(fiberGrams !== undefined && fiberGrams >= 0 && fiberGrams <= 150 ? { fiberGrams } : {}),
  };
}

function getRecipeLikeNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const match = value.trim().match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeRecipeNode(value: unknown, path: string): unknown {
  const definition = recipeArrayFieldDefinitionMap.get(path);
  if (definition?.kind === 'string[]') {
    return normalizeStringArrayValue(value, definition);
  }
  if (definition?.kind === 'object[]') {
    return normalizeObjectArrayValue(value, path);
  }
  if (definition?.kind === 'number[]') {
    return Array.isArray(value) ? value : [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeRecipeNode(item, path));
  }

  const record = getRecord(value);
  if (!record) {
    return value;
  }

  return normalizeRecipeRecordChildren(record, path);
}

function normalizeRecipeRecordChildren(record: SafeRecord, path: string): SafeRecord {
  const normalized: SafeRecord = path === 'steps'
    ? normalizeRecipeStepAliases(record)
    : path === 'ingredientGroups'
      ? normalizeIngredientGroupAliases(record)
      : { ...record };
  for (const [key, childValue] of Object.entries(normalized)) {
    const childPath = path ? `${path}.${key}` : key;
    normalized[key] = normalizeRecipeNode(childValue, childPath);
  }
  return normalized;
}

function normalizeRecipeStepAliases(source: SafeRecord): SafeRecord {
  const normalized: SafeRecord = { ...source };
  copyRecipeAlias(normalized, 'step', ['text', 'instruction', 'description']);
  copyRecipeAlias(normalized, 'title', ['name']);
  copyRecipeAlias(normalized, 'ingredients', ['ingredientsUsed']);
  copyRecipeAlias(normalized, 'tools', ['toolsUsed']);
  copyRecipeAlias(normalized, 'timeEstimate', ['duration']);
  for (const key of ['stepNumber', 'phase', 'estimatedMinutes', 'activeMinutes', 'passiveMinutes', 'elapsedMinutes']) {
    if (normalized[key] === undefined) continue;
    const numeric = getRecipeLikeNumber(normalized[key]);
    if (numeric === undefined) delete normalized[key];
    else normalized[key] = numeric;
  }
  return normalized;
}

function normalizeIngredientGroupAliases(source: SafeRecord): SafeRecord {
  const normalized: SafeRecord = { ...source };
  copyRecipeAlias(normalized, 'component', ['name', 'title', 'group']);
  copyRecipeAlias(normalized, 'items', ['ingredients']);
  return normalized;
}

function normalizeObjectArrayValue(value: unknown, path: string): unknown[] {
  const values = Array.isArray(value)
    ? value
    : getRecord(value)
      ? [value]
      : path === 'steps' && typeof value === 'string'
        ? [value]
      : [];

  return values.flatMap((item): unknown[] => {
    if (path === 'steps' && typeof item === 'string') {
      const text = item.trim();
      return text ? [text] : [];
    }
    const record = getRecord(item);
    return record ? [normalizeRecipeRecordChildren(record, path)] : [];
  });
}

function normalizeStringArrayValue(value: unknown, definition: RecipeArrayFieldDefinition): unknown[] {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? splitListLikeString(value, definition)
      : [];

  const seen = new Set<string>();
  const normalized: unknown[] = [];
  for (const item of rawItems) {
    const normalizedItem = normalizeRecipeStringArrayItem(item, definition);
    if (normalizedItem === undefined) continue;
    if (typeof normalizedItem !== 'string') {
      normalized.push(normalizedItem);
      continue;
    }
    const cleaned = normalizedItem.replace(/^[\s\-*•‣▪]+/, '').trim();
    if (!cleaned) {
      continue;
    }
    const key = cleaned.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(cleaned);
  }
  return normalized;
}

function normalizeRecipeStringArrayItem(
  value: unknown,
  definition: RecipeArrayFieldDefinition,
): unknown {
  if (typeof value === 'string') return value;
  const record = getRecord(value);
  if (!record) return value;

  if (definition.commaSafe === 'amountedIngredients') {
    const name = String(record.name ?? record.ingredient ?? record.item ?? '').trim();
    const quantity = String(record.quantity ?? record.amount ?? record.measurement ?? '').trim();
    return [quantity, name].filter(Boolean).join(' ').trim() || undefined;
  }

  if (
    definition.path === 'equipment' ||
    definition.path.startsWith('steps.')
  ) {
    return String(
      record.name ?? record.ingredient ?? record.item ?? record.tool ?? record.equipment ?? '',
    ).trim() || undefined;
  }

  return value;
}

function splitListLikeString(value: string, definition: RecipeArrayFieldDefinition): string[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  const lineItems = trimmed
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•‣▪]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
  if (lineItems.length > 1) {
    return lineItems;
  }

  const bulletItems = trimmed
    .split(/\s+[•‣▪]\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (bulletItems.length > 1) {
    return bulletItems;
  }

  if (definition.commaSafe && isClearlyCommaSeparatedList(trimmed, definition.commaSafe)) {
    return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [trimmed];
}

function isClearlyCommaSeparatedList(value: string, mode: NonNullable<RecipeArrayFieldDefinition['commaSafe']>): boolean {
  if (!value.includes(',')) {
    return false;
  }

  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2 || parts.some((part) => /[.!?;:]/.test(part))) {
    return false;
  }

  if (mode === 'amountedIngredients') {
    return parts.every((part) => hasIngredientAmount(part));
  }

  return parts.every((part) => {
    const words = part.split(/\s+/).filter(Boolean);
    return words.length > 0 && words.length <= 5 && !/\b(?:and|or|but|because|until|while|when|with)\b/i.test(part);
  });
}

type OpenRouterContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type OpenRouterMessage = {
  role: 'system' | 'user';
  content: string | OpenRouterContentPart[];
};

export async function analyzeFoodImageWithOpenRouter(input: {
  config: AiConfig;
  image?: ScanImageMetadata;
  mode: RecipeMode;
}) {
  const imageUrl = getSafeImageUrl(input.image);
  logOpenRouterDebug('api_openrouter_has_image_payload', {
    hasImagePayload: Boolean(imageUrl),
    imagePayloadLength: imageUrl?.length ?? 0,
  });
  logOpenRouterDebug('openrouter_vision_payload', {
    imagePayloadAttached: Boolean(imageUrl),
    imagePayloadLength: imageUrl?.length ?? 0,
    imageUriKind: imageUrl ? 'provider_visible' : input.image?.uri ? 'local_or_private_uri_not_sent' : 'none',
    model: input.config.openRouterVisionModel,
  });

  let firstOutput: z.infer<typeof openRouterVisionOutputSchema>;
  try {
    firstOutput = await callVisionOnce(input, getVisionPrompt(input.image, input.mode), 'vision');
  } catch (error) {
    if (!isRetryableVisionOutputError(error)) {
      throw error;
    }

    const retryReason = getOpenRouterErrorReason(error);
    logOpenRouterDebug('openrouter_scan_quality_retry', {
      retryReason,
      retryPrompt: 'compact_vision',
      stage: 'vision_initial_output',
    });
    await waitMs(3500);
    firstOutput = await callVisionOnce(input, getCompactVisionRetryPrompt(input.image, input.mode), 'vision_initial_retry');
    logOpenRouterDebug('openrouter_scan_quality_retry_result', {
      retryReason,
      retryDishName: firstOutput.dishName,
      retryScanState: firstOutput.scanState,
    });
  }
  const firstQuality = evaluateVisionQuality(firstOutput);
  // Loose ingredients are a valid model classification, not a low-quality
  // prepared-dish guess. Return it directly so the API can reject it without
  // asking a retry model to invent a meal.
  if (firstOutput.inputKind === 'raw_ingredients') {
    return firstOutput;
  }
  const retryReason = getVisionQualityRetryReason(firstQuality);
  logOpenRouterDebug('openrouter_scan_quality_check', {
    dishName: firstOutput.dishName,
    scanState: firstOutput.scanState,
    confidencePercent: firstQuality.confidencePercent,
    foodVisible: firstQuality.foodVisible,
    genericName: firstQuality.generic,
    drinkMismatch: firstQuality.drinkMismatch,
    lowVisibleFoodConfidence: firstQuality.lowVisibleFoodConfidence,
    needsRetry: firstQuality.needsRetry,
    retryReason,
  });

  if (!firstQuality.needsRetry) {
    return firstOutput;
  }

  // Quality loop: one focused retry when food/drink is visible but the name is
  // generic or contradicts visible drink clues. For too_unclear, use a more
  // direct prompt and accept any result that finds food. Failures keep the first result.
  const isTooUnclearRetry = firstOutput.scanState === 'too_unclear';
  const retryPrompt = isTooUnclearRetry
    ? getCompactVisionRetryPrompt(input.image, input.mode)
    : getFocusedVisionRetryPrompt(input.image, input.mode, firstOutput);
  try {
    const retryOutput = await callVisionOnce(input, retryPrompt, 'vision_quality_retry');
    const retryQuality = evaluateVisionQuality(retryOutput);
    const useRetry = isTooUnclearRetry
      ? retryQuality.foodVisible
      : (retryQuality.foodVisible && !retryQuality.generic && !retryQuality.drinkMismatch);
    logOpenRouterDebug('openrouter_scan_quality_retry', {
      originalDishName: firstOutput.dishName,
      retryReason,
      retryDishName: retryOutput.dishName,
      finalDishName: useRetry ? retryOutput.dishName : firstOutput.dishName,
      retryGeneric: retryQuality.generic,
      retryDrinkMismatch: retryQuality.drinkMismatch,
      retryLowVisibleFoodConfidence: retryQuality.lowVisibleFoodConfidence,
      retryConfidencePercent: retryQuality.confidencePercent,
      retryScanState: retryOutput.scanState,
      usedRetry: useRetry,
    });

    return useRetry ? retryOutput : firstOutput;
  } catch (error) {
    logOpenRouterDebug('openrouter_scan_quality_retry_failed', {
      originalDishName: firstOutput.dishName,
      retryReason,
      message: error instanceof OpenRouterProviderError ? error.failure.reason : 'unknown',
    });
    return firstOutput;
  }
}

// Timeouts are excluded: the first attempt already spent the full timeout budget,
// and the mobile client aborts at 60s total. Everything else transient is worth
// one retry. Free-tier models rate-limit (HTTP 429) and hiccup often.
const retryableVisionOutputReasons = new Set<OpenRouterFailureReason>([
  'openrouter_empty_content',
  'openrouter_http_error',
  'openrouter_invalid_json',
  'openrouter_invalid_schema',
  'openrouter_network_error',
  'openrouter_output_truncated',
  'openrouter_unknown_error',
]);

function isRetryableVisionOutputError(error: unknown) {
  return error instanceof OpenRouterProviderError && retryableVisionOutputReasons.has(error.failure.reason);
}

function getOpenRouterErrorReason(error: unknown) {
  return error instanceof OpenRouterProviderError ? error.failure.reason : 'unknown';
}

async function callVisionOnce(
  input: { config: AiConfig; image?: ScanImageMetadata; mode: RecipeMode },
  promptText: string,
  stage: string,
) {
  const content: OpenRouterContentPart[] = [{ type: 'text', text: promptText }];
  const imageUrl = getSafeImageUrl(input.image);
  if (imageUrl) {
    content.push({ type: 'image_url', image_url: { url: imageUrl } });
  }

  const json = await callOpenRouterJson({
    config: input.config,
    messages: [
      {
        role: 'system',
        content: 'You are Okyo, a cautious food analysis assistant and food reverse-engineering specialist. Your job is to detect EVERY distinct food component visible — not just the dominant item. Return ONLY valid JSON in the assistant message content. Do not put JSON in reasoning. Do not return markdown. Do not explain.',
      },
      {
        role: 'user',
        content,
      },
    ],
    model: input.config.openRouterVisionModel,
    maxTokens: Math.min(input.config.maxOutputTokens, 900),
    stage,
  });

  const output = openRouterVisionOutputSchema.safeParse(json);
  if (!output.success) {
    throw createOpenRouterError(input.config, input.config.openRouterVisionModel, 'openrouter_invalid_schema', {
      openRouterErrorMessage: getSchemaErrorMessage(output.error),
    });
  }

  logOpenRouterDebug('openrouter_vision_output', {
    broadDishCategory: output.data.broadDishCategory ?? output.data.dishCategory,
    confidence: output.data.confidence,
    dishName: output.data.dishName,
    foodDetected: output.data.foodDetected ?? output.data.isFoodImage,
    scanState: output.data.scanState,
    stage,
  });

  return output.data;
}

// Names that are too generic to be useful when real food or drink is visible.
const genericDishNames = new Set([
  'dish', 'food', 'meal', 'plate', 'bowl', 'platter', 'drink', 'beverage',
  'food item', 'food plate', 'food dish', 'food bowl',
  'restaurant dish', 'restaurant plate', 'restaurant meal', 'restaurant food',
  'generic food plate', 'homestyle food plate',
  'mixed restaurant plate', 'mixed plate', 'mixed platter', 'mixed food plate',
  'generic meal', 'unknown', 'unknown dish', 'unknown food dish', 'unclear dish',
]);

export function isGenericDishName(value: string | undefined | null) {
  const normalized = (value ?? '')
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^(a|an|the)\s+/, '')
    .trim();

  return !normalized || genericDishNames.has(normalized);
}

const drinkClueRegex = /\b(smoothie|milkshake|shake|latte|matcha|iced coffee|cold brew|frappe|frappuccino|boba|bubble tea|juice|lemonade|hot chocolate)\b/;

export function isDrinkAnalysisText(value: string) {
  const normalized = value.toLowerCase();
  return drinkClueRegex.test(normalized) || normalized.includes('drink/beverage');
}

type VisionQuality = {
  confidencePercent: number;
  drinkMismatch: boolean;
  foodVisible: boolean;
  generic: boolean;
  lowVisibleFoodConfidence: boolean;
  needsRetry: boolean;
};

function evaluateVisionQuality(output: z.infer<typeof openRouterVisionOutputSchema>): VisionQuality {
  const confidencePercent = getLooseConfidencePercent(output.confidence);
  const scanState = (output.scanState ?? '').toLowerCase();
  const foodVisible = parseLooseBoolean(output.isFoodImage) ||
    parseLooseBoolean(output.foodDetected) ||
    ['clear_food', 'food_present_uncertain_dish', 'partial_food'].includes(scanState);
  const generic = isGenericDishName(output.dishName);
  const supportText = [
    output.dishName,
    output.broadDishCategory,
    output.cuisine,
    output.confidenceReason,
    ...(output.visibleIngredients ?? []),
    ...(output.likelyIngredients ?? []),
    ...Object.values(output.visibleComponents ?? {}),
  ].filter((value) => typeof value === 'string').join(' ').toLowerCase();
  const looksLikeDrink = drinkClueRegex.test(supportText);
  const nameSaysPlate = /\b(plate|platter)\b/.test((output.dishName ?? '').toLowerCase());
  const drinkMismatch = looksLikeDrink && nameSaysPlate;
  const lowVisibleFoodConfidence = foodVisible && confidencePercent > 0 && confidencePercent < 40;
  const needsRetry = output.scanState === 'too_unclear' || (foodVisible && (drinkMismatch || lowVisibleFoodConfidence || (generic && confidencePercent < 88)));

  return { confidencePercent, drinkMismatch, foodVisible, generic, lowVisibleFoodConfidence, needsRetry };
}

function getVisionQualityRetryReason(quality: VisionQuality) {
  if (!quality.needsRetry) {
    return undefined;
  }
  if (quality.drinkMismatch) {
    return 'drink_named_as_plate';
  }
  if (quality.generic) {
    return 'visible_food_generic_name';
  }
  if (quality.lowVisibleFoodConfidence) {
    return 'visible_food_low_confidence';
  }

  return 'vision_quality';
}

function getLooseConfidencePercent(value: number | string | undefined) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.min(100, parsed <= 1 ? parsed * 100 : parsed);
}

function parseLooseBoolean(value: boolean | string | undefined) {
  if (typeof value === 'boolean') {
    return value;
  }

  return typeof value === 'string' && value.trim().toLowerCase() === 'true';
}

// ─── Recipe cache ─────────────────────────────────────────────────────────────
// ponytail: global in-memory, resets on restart — Redis when multi-instance scale requires it
const recipeCache = new Map<string, { recipe: OpenRouterRecipeOutput; expiresAt: number }>();
const RECIPE_CACHE_TTL_MS = (() => {
  const days = Number(process.env.RECIPE_CACHE_TTL_DAYS);
  return (Number.isFinite(days) && days > 0 ? days : 7) * 24 * 60 * 60 * 1000;
})();

function getRecipeCacheKey(analysis: FoodImageAnalysis, mode: RecipeMode): string {
  const data = JSON.stringify({
    d: analysis.dishName.trim().toLowerCase(),
    i: [...analysis.visibleIngredients].sort().map((s) => s.trim().toLowerCase()),
    m: mode,
    c: analysis.broadDishCategory.trim().toLowerCase(),
  });
  return createHash('sha1').update(data).digest('hex');
}

function buildStepImagePrompt(step: z.infer<typeof recipeStepSchema>, dishName: string): string {
  const subject = step.ingredients?.[0] ?? dishName;
  const action = (step.title ?? 'preparing').toLowerCase();
  const vessel = step.tools?.[0] ?? 'bowl';
  return `Close-up food photography, ${subject} ${action} in ${vessel}, warm restaurant lighting, 45-degree camera angle, shallow depth of field, no text, no watermark.`;
}

function addStepImagePrompts(recipe: OpenRouterRecipeOutput, dishName: string): OpenRouterRecipeOutput {
  if (!recipe.steps) return recipe;
  return {
    ...recipe,
    steps: recipe.steps.map((step) => {
      if (typeof step === 'string') return step;
      return step.stepImagePrompt ? step : { ...step, stepImagePrompt: buildStepImagePrompt(step, dishName) };
    }),
  };
}

function storeRecipeCache(key: string, recipe: OpenRouterRecipeOutput, dish: string): OpenRouterRecipeOutput {
  const processed = addStepImagePrompts(recipe, dish);
  recipeCache.set(key, { recipe: processed, expiresAt: Date.now() + RECIPE_CACHE_TTL_MS });
  logOpenRouterDebug('recipe_cache_store', { key: key.slice(0, 8), dish });
  return processed;
}

function finalizeGeneratedRecipe(
  recipe: OpenRouterRecipeOutput,
  cacheKey: string,
  dish: string,
  isCorrection: boolean,
): OpenRouterRecipeOutput {
  return isCorrection
    ? addStepImagePrompts(recipe, dish)
    : storeRecipeCache(cacheKey, recipe, dish);
}

function getRecipeModelChain(config: AiConfig): string[] {
  // Fail-closed: Fable 5 never silently falls back to the cheap Gemini chain
  // (or a paid fallback) on failure. If it fails, the scan fails — no
  // cross-provider/cross-model downgrade happens without the user knowing.
  if (config.isFableActive) {
    return [config.openRouterTextModel];
  }

  const models = [config.openRouterTextModel, ...RECIPE_FALLBACK_MODELS];
  const paid = process.env.RECIPE_PAID_FALLBACK_MODEL?.trim();
  if (paid) models.push(paid);
  return [...new Set(models)];
}

export async function generateRecipeWithOpenRouter(input: {
  analysis: FoodImageAnalysis;
  config: AiConfig;
  correction?: CorrectionGenerationContext;
  mode?: RecipeMode;
  preferences?: RecipeGenerationPreferences;
}) {
  // ── Epicure enrichment (additive) ───────────────────────────────────────────
  // Runs BEFORE recipe generation. When the feature flag is off, no key is set,
  // or the call fails, enrichRecipeContext returns null and the recipe prompt is
  // built exactly as before — recipe generation never breaks or blocks on this.
  const mode: RecipeMode = input.mode ?? 'Normal';

  // Corrections are original-recipe-specific and must never reuse an ordinary
  // scan result with the same dish/mode cache key.
  const cacheKey = getRecipeCacheKey(input.analysis, mode);
  // Never serve a cached recipe generated without the caller's dietary
  // restrictions/dislikes to a request that has them — restrictions are a
  // safety constraint, not a style preference the cache is allowed to ignore.
  const hasPersonalization = hasMeaningfulPreferences(input.preferences);
  const skipCache = Boolean(input.correction) || hasPersonalization;
  const cached = skipCache ? undefined : recipeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    logOpenRouterDebug('recipe_cache_hit', { key: cacheKey.slice(0, 8), dish: input.analysis.dishName, mode });
    return cached.recipe;
  }
  logOpenRouterDebug('recipe_cache_miss', { key: cacheKey.slice(0, 8), dish: input.analysis.dishName, mode });

  let enrichment: EnrichedRecipeContext | null = null;
  const visionEpicure = input.analysis.epicureSuggestions;
  if (visionEpicure?.complementaryIngredients?.length) {
    // Vision already returned Epicure data inline — no separate API call needed.
    // Saves ~8-12s vs the previous sequential enrichRecipeContext() call.
    enrichment = {
      detectedIngredients: [...input.analysis.visibleIngredients, ...input.analysis.likelyIngredients].slice(0, 12),
      complementaryIngredients: visionEpicure.complementaryIngredients,
      healthySubstitutions: visionEpicure.healthySubstitutions ?? {},
      budgetSubstitutions: visionEpicure.budgetSubstitutions ?? {},
    };
    logOpenRouterDebug('epicure_from_vision', {
      complementaryCount: visionEpicure.complementaryIngredients.length,
      healthySubCount: Object.keys(visionEpicure.healthySubstitutions ?? {}).length,
      budgetSubCount: Object.keys(visionEpicure.budgetSubstitutions ?? {}).length,
    });
  } else {
    try {
      enrichment = await enrichRecipeContext({
        dishName: input.analysis.dishName,
        ingredients: [...input.analysis.visibleIngredients, ...input.analysis.likelyIngredients],
        mode,
      });
    } catch (enrichError) {
      logOpenRouterDebug('epicure_enrichment_unexpected_error', {
        reason: enrichError instanceof Error ? enrichError.message : 'unknown',
      });
      enrichment = null;
    }
  }

  const recipePrompt = getRecipePrompt(input.analysis, enrichment, mode, input.correction, input.preferences);
  const epicureSectionChars = enrichment ? buildEpicurePromptSection(enrichment, mode).length : 0;
  const fullPromptChars = recipePrompt.length;
  const basePromptChars = fullPromptChars - (epicureSectionChars > 0 ? epicureSectionChars + 1 : 0);
  console.log('[prompt_size_comparison]', {
    dish: input.analysis.dishName,
    mode,
    basePromptChars,
    epicureSectionChars,
    fullPromptChars,
    epicureAdded: epicureSectionChars > 0,
    epicurePct: basePromptChars > 0
      ? `+${((epicureSectionChars / basePromptChars) * 100).toFixed(1)}%`
      : '0%',
    estimatedBasePromptTokens: Math.ceil(basePromptChars / 4),
    estimatedFullPromptTokens: Math.ceil(fullPromptChars / 4),
  });

  const retryReasons: OpenRouterFailureReason[] = [
    'openrouter_empty_content',
    'openrouter_http_error',
    'openrouter_invalid_json',
    'openrouter_invalid_schema',
    'openrouter_network_error',
    'openrouter_output_truncated',
    'openrouter_unknown_error',
  ];
  const isFocusedCorrectionRepair = Boolean(input.correction?.missedRequirements?.length);
  const isDrink = isDrinkAnalysisText(input.correction
    ? `${input.correction.originalRecipe.title} ${input.correction.originalRecipe.description}`
    : [
        input.analysis.dishName,
        input.analysis.broadDishCategory,
        ...input.analysis.visibleIngredients,
        ...input.analysis.likelyIngredients,
      ].join(' '));

  let firstOutput: OpenRouterRecipeOutput;
  let usedRecipeRetry = false;
  try {
    firstOutput = await callRecipeStage(input, recipePrompt, input.config.maxOutputTokens, 'recipe');
  } catch (firstError) {
    const shouldRetry = !isFocusedCorrectionRepair &&
      firstError instanceof OpenRouterProviderError &&
      (input.correction
        ? isSafeCorrectionAutomaticRetry(firstError)
        : retryReasons.includes(firstError.failure.reason)) &&
      getOpenRouterMetrics().providerCallCount < 3;

    if (!shouldRetry) {
      throw firstError;
    }
    usedRecipeRetry = true;

    logOpenRouterDebug('openrouter_recipe_retry', {
      firstReason: firstError.failure.reason,
      firstErrorMessage: firstError.failure.openRouterErrorMessage,
      model: input.config.openRouterTextModel,
      retryPrompt: 'compact',
      retryMaxTokens: 900,
    });

    await waitMs(input.correction ? 250 : 3500);
    try {
      firstOutput = await callRecipeStage(
        input,
        getCompactRecipeRetryPrompt(input.analysis, input.correction, firstError instanceof Error ? firstError.message : undefined),
        900,
        'recipe_retry',
      );
    } catch (retryError) {
      // Patch-format failures are isolated from semantic correction failures.
      // After the bounded patch attempt + retry, use the complete-recipe
      // compatibility path so harmless provider formatting differences do not
      // strand an otherwise valid correction.
      if (input.correction && isCorrectionPatchSchemaFailure(firstError) && isCorrectionPatchSchemaFailure(retryError)) {
        firstOutput = await callRecipeStage(
          input,
          getLegacyCorrectionFallbackPrompt(input.analysis, input.correction),
          input.config.maxOutputTokens,
          'recipe_legacy_fallback',
          true,
        );
      } else {
        throw retryError;
      }
    }
  }

  const deterministicStartedAt = Date.now();
  if (!(input.correction && hasStructuredCorrectionPatchOutput(firstOutput))) {
    firstOutput = applyDeterministicRecipeRepair(firstOutput, firstOutput, input.analysis);
    firstOutput = applyDeterministicLaminationWaitRepair(firstOutput, input.analysis);
  }
  addDeterministicRepairMs(Date.now() - deterministicStartedAt);

  // Strip fields the model generates despite prompt bans — deterministic, no
  // prompt-compliance required.
  if (!isPlatterAnalysis(input.analysis) && firstOutput.ingredientGroups?.length) {
    firstOutput = { ...firstOutput, ingredientGroups: [] };
  }
  if (firstOutput.groceryItems?.length) {
    firstOutput = {
      ...firstOutput,
      groceryItems: firstOutput.groceryItems.map(({ name, quantity, category }) => ({ name, quantity, category, sourceIngredient: '', shoppingNote: '' })),
    };
  }

  // Structured correction patches are applied against the latest canonical
  // recipe by the service layer. They intentionally do not carry a second
  // regenerated full recipe, so the ordinary full-recipe quality gate is not
  // applicable to this response shape.
  if (input.correction && hasStructuredCorrectionPatchOutput(firstOutput)) {
    return finalizeGeneratedRecipe(firstOutput, cacheKey, input.analysis.dishName, true);
  }

  const issues = getRecipeValidationIssues(firstOutput, isDrink, input.analysis);
  if (issues.length === 0) {
    return finalizeGeneratedRecipe(firstOutput, cacheKey, input.analysis.dishName, skipCache);
  }
  const initialHardIssues = getHardRecipeValidationIssues(issues);

  // Explicit correction requirements are verified by the service layer after
  // this candidate is normalized. Do not spend a correction attempt on
  // optional recipe-quality polish; that would consume the bounded correction
  // retry budget before the requested change has been verified.
  if (input.correction && initialHardIssues.length === 0) {
    logRecipeQualityDiagnostic(input.analysis, issues, false);
    return finalizeGeneratedRecipe(firstOutput, cacheKey, input.analysis.dishName, true);
  }

  if (usedRecipeRetry || isFocusedCorrectionRepair || getOpenRouterMetrics().providerCallCount >= 3) {
    logOpenRouterDebug('openrouter_recipe_combined_check', {
      dishName: input.analysis.dishName,
      issues,
      deterministicRepairMs: getOpenRouterMetrics().deterministicRepairMs,
      willModelRepair: false,
      reason: usedRecipeRetry
        ? 'retry_already_used'
        : isFocusedCorrectionRepair
          ? 'focused_repair_must_be_single_attempt'
          : 'provider_call_cap',
    });
    if (initialHardIssues.length === 0) {
      logRecipeQualityDiagnostic(input.analysis, issues, false);
      return finalizeGeneratedRecipe(firstOutput, cacheKey, input.analysis.dishName, skipCache);
    }
    logRecipeQualityRejection(input.analysis, initialHardIssues, false, initialHardIssues);
    throw createOpenRouterError(input.config, input.config.openRouterTextModel, 'openrouter_invalid_schema', {
      openRouterErrorMessage: `Recipe remained invalid after retry/deterministic cleanup: ${initialHardIssues.join(', ')}`,
    });
  }

  logOpenRouterDebug('openrouter_recipe_combined_check', {
    dishName: input.analysis.dishName,
    issues,
    deterministicRepairMs: getOpenRouterMetrics().deterministicRepairMs,
    willModelRepair: true,
  });

  try {
    const combinedStartedAt = Date.now();
    const repaired = await callRecipeStage(
      input,
      getCombinedRecipeRepairPrompt(input.analysis, firstOutput, issues, input.correction),
      input.config.maxOutputTokens,
      'recipe_combined_repair',
    );
    addCombinedRepairMs(Date.now() - combinedStartedAt);
    const normalizedRepair = normalizeRecipeOutputForValidation(repaired, input.analysis);
    const mergedRepair = mergeRecipeRepairOutput(firstOutput, normalizedRepair, input.analysis);
    const restoredRepair = applyDeterministicLaminationWaitRepair(
      applyDeterministicRecipeRepair(mergedRepair, firstOutput, input.analysis),
      input.analysis,
    );
    let finalRepair = restoredRepair;
    let repairedIssues = getRecipeValidationIssues(finalRepair, isDrink, input.analysis);
    let deterministicProofRepairRan = false;
    if (repairedIssues.length > 0 && repairedIssues.every((issue) => issue === 'missing_final_proof' || issue === 'invalid_final_proof_duration')) {
      finalRepair = applyDeterministicProofRepair(finalRepair, input.analysis);
      repairedIssues = getRecipeValidationIssues(finalRepair, isDrink, input.analysis);
      deterministicProofRepairRan = true;
    }
    const repairedHardIssues = getHardRecipeValidationIssues(repairedIssues);
    const initialSoftIssues = issues.filter((issue) => !initialHardIssues.includes(issue));
    const repairedSoftIssues = repairedIssues.filter((issue) => !repairedHardIssues.includes(issue));
    const usedRepair = repairedIssues.length === 0 || (
      repairedHardIssues.length === 0 && repairedSoftIssues.length <= initialSoftIssues.length
    );
    logOpenRouterDebug('openrouter_recipe_combined_repair_result', {
      beforeIssues: issues,
      afterIssues: repairedIssues,
      beforeHardIssues: initialHardIssues,
      afterHardIssues: repairedHardIssues,
      usedRepair,
      deterministicProofRepairRan,
      originalIngredientCount: firstOutput.ingredients.length,
      repairIngredientCount: normalizedRepair.ingredients.length,
      finalIngredientCount: finalRepair.ingredients.length,
      combinedRepairMs: getOpenRouterMetrics().combinedRepairMs,
    });
    if (repairedHardIssues.length === 0) {
      logRecipeQualityDiagnostic(input.analysis, repairedIssues, true);
      const bestCandidate = usedRepair ? finalRepair : firstOutput;
      return finalizeGeneratedRecipe(bestCandidate, cacheKey, input.analysis.dishName, skipCache);
    }
    logRecipeQualityRejection(input.analysis, initialHardIssues, true, repairedHardIssues);
    throw createOpenRouterError(input.config, input.config.openRouterTextModel, 'openrouter_invalid_schema', {
      openRouterErrorMessage: `Recipe remained invalid after combined repair: ${repairedHardIssues.join(', ')}`,
    });
  } catch (repairError) {
    logOpenRouterDebug('openrouter_recipe_combined_repair_failed', {
      reason: repairError instanceof OpenRouterProviderError ? repairError.failure.reason : 'unknown',
    });
    if (initialHardIssues.length === 0) {
      logRecipeQualityDiagnostic(input.analysis, issues, true);
      return finalizeGeneratedRecipe(firstOutput, cacheKey, input.analysis.dishName, skipCache);
    }
    throw repairError;
  }
}

export async function generateRecipeEditWithOpenRouter(input: {
  analysis: FoodImageAnalysis;
  config: AiConfig;
  currentRecipe: Recipe;
  editMessage: string;
  previousCandidate?: Recipe;
  retryReason?: string;
  dietaryAllergies?: string[];
  dietaryRestrictions?: string[];
  dietaryDislikes?: string[];
  goalContext?: RecipeGenerationPreferences['goalContext'];
}): Promise<OpenRouterRecipeOutput> {
  const editConfig = {
    ...input.config,
    maxOutputTokens: Math.max(input.config.maxOutputTokens, 2048),
  };
  const stage = input.previousCandidate ? 'recipe_edit_retry' : 'recipe_edit';
  const prompt = getRecipeEditPrompt(input);
  let output: OpenRouterRecipeOutput;
  let schemaRetryRan = false;

  try {
    output = await callRecipeStage(
      { analysis: input.analysis, config: editConfig },
      prompt,
      editConfig.maxOutputTokens,
      stage,
    );
  } catch (error) {
    if (!(error instanceof OpenRouterProviderError) ||
        !isSafeCorrectionAutomaticRetry(error) ||
        getOpenRouterMetrics().providerCallCount >= 3) {
      throw error;
    }
    schemaRetryRan = true;
    const reason = error.failure.openRouterErrorMessage ?? error.failure.reason;
    output = await callRecipeStage(
      { analysis: input.analysis, config: editConfig },
      `${prompt}\nYour previous response could not be parsed because ${JSON.stringify(reason)}. Return the complete revised recipe using the simple JSON shape above.`,
      editConfig.maxOutputTokens,
      `${stage}_schema_retry`,
    );
  }

  let issues = getRecipeEditOutputIssues(output);
  if (!output.title.trim()) {
    output = { ...output, title: input.currentRecipe.title, dishName: input.currentRecipe.title };
    issues = getRecipeEditOutputIssues(output);
  }
  if (issues.length > 0 && !schemaRetryRan && getOpenRouterMetrics().providerCallCount < 3) {
    schemaRetryRan = true;
    output = await callRecipeStage(
      { analysis: input.analysis, config: editConfig },
      `${prompt}\nThe prior response was not a usable complete recipe (${issues.join(', ')}). Return the complete revised recipe object only.`,
      editConfig.maxOutputTokens,
      `${stage}_structure_retry`,
    );
    issues = getRecipeEditOutputIssues(output);
  }

  if (issues.length > 0) {
    throw createOpenRouterError(
      input.config,
      input.config.openRouterTextModel,
      'openrouter_invalid_schema',
      { openRouterErrorMessage: `Complete recipe edit was unusable: ${issues.join(', ')}` },
    );
  }

  const revisedAnalysis: FoodImageAnalysis = {
    ...input.analysis,
    dishName: output.title.trim() || input.analysis.dishName,
    possibleDishNames: output.title.trim() ? [output.title.trim()] : input.analysis.possibleDishNames,
    visibleIngredients: [],
    likelyIngredients: output.ingredients,
    mealDescription: undefined,
  };
  output = applyDeterministicRecipeRepair(output, output, revisedAnalysis);
  output = applyDeterministicLaminationWaitRepair(output, revisedAnalysis);
  return addStepImagePrompts(output, revisedAnalysis.dishName);
}

function hasStructuredCorrectionPatchOutput(output: OpenRouterRecipeOutput): boolean {
  return output.ingredientOperations.length > 0 ||
    output.stepOperations.length > 0 ||
    Boolean(output.metadataPatch);
}

function isCorrectionPatchSchemaFailure(error: unknown): boolean {
  if (!(error instanceof OpenRouterProviderError)) return false;
  if (error.failure.reason === 'openrouter_invalid_schema') {
    return /correction_patch_|correction_patch_hybrid_response/.test(error.failure.openRouterErrorMessage ?? '');
  }
  return ['openrouter_invalid_json', 'openrouter_empty_content', 'openrouter_output_truncated'].includes(error.failure.reason);
}

function proofRepairGuidance(issues: string[]): string[] {
  const guidance: string[] = [];
  if (issues.includes('missing_final_proof')) {
    guidance.push('FINAL PROOF REQUIRED: Preserve all valid ingredients and steps and preserve the plain, unfilled croissant identity. Add exactly one final proof/rise step after shaping and before the final egg wash or baking. Make it 45–60 minutes elapsed and include an observable cue such as visibly puffy, expanded, or lightly jiggly. Update activeMinutes, passiveMinutes, elapsedMinutes, prep time, active time, and total time.');
  }
  if (issues.includes('invalid_final_proof_duration')) {
    guidance.push('FINAL PROOF DURATION INVALID: Preserve the existing proof step and its placement, but replace its duration with at least 30 minutes elapsed, include a visibly puffy/expanded/lightly jiggly completion cue, and update activeMinutes, passiveMinutes, elapsedMinutes, prep time, active time, and total time.');
  }
  if (issues.includes('missing_lamination_wait_duration')) {
    guidance.push('LAMINATION WAIT DURATION REQUIRED: Preserve the croissant ingredients and all valid steps. In the lamination step, state the actual waiting time for every repeated chill, for example: “Repeat this process 3 times, chilling the dough for 30 minutes between folds.” Recompute activeMinutes, passiveMinutes, elapsedMinutes, prep time, active time, and total time.');
  }
  return guidance;
}

function applyDeterministicProofRepair(output: OpenRouterRecipeOutput, analysis: FoodImageAnalysis): OpenRouterRecipeOutput {
  const context = [
    analysis.dishName,
    analysis.broadDishCategory,
    analysis.mealDescription,
    ...analysis.visibleIngredients,
    ...analysis.likelyIngredients,
    ...Object.values(analysis.visibleComponents),
    ...output.ingredients,
  ].filter(Boolean).join(' ').toLowerCase();
  if (!/\bcroissant\b/.test(context) || /\bpuff\s+pastry\b/.test(context) || !/\b(?:yeast|laminat(?:ed|ion)|laminate)\b/.test(context)) return output;

  const sourceSteps = Array.isArray(output.steps) ? output.steps : [];
  const proofPattern = /\b(?:proof|final proof|rise|rising|let .* rise|leave .* rise|rest .* puffy|allow .* expand)\b/i;
  const sourceTexts = sourceSteps.map(getProviderStepSearchText);
  const originalDiagnostics = getLaminatedCroissantProofDiagnostics(sourceTexts);
  if (originalDiagnostics.shapingIndex < 0) return output;
  const shapedSteps = sourceSteps.filter((_, index) => index <= originalDiagnostics.shapingIndex);
  const postShapingSteps = sourceSteps.filter((_, index) => index > originalDiagnostics.shapingIndex);
  const validFinalProof = postShapingSteps.some((step, index) => {
    const text = getProviderStepSearchText(step);
    if (!proofPattern.test(text)) return false;
    const absoluteIndex = originalDiagnostics.shapingIndex + 1 + index;
    const beforeBarrier = [originalDiagnostics.eggWashIndex, originalDiagnostics.bakeIndex]
      .filter((barrierIndex) => barrierIndex > originalDiagnostics.shapingIndex)
      .sort((a, b) => a - b)[0];
    return (beforeBarrier === undefined || absoluteIndex < beforeBarrier) && deriveRecipeStepTime(text).elapsedMinutes >= 30;
  });
  if (validFinalProof) return output;
  const misplacedFinalProofPattern = /\bfinal\s+proof\b|\bproof\b[^.;]{0,60}\bshaped\s+croissants?\b/i;
  const proofRemoved = [
    ...shapedSteps.filter((step, index) => index === originalDiagnostics.shapingIndex || !misplacedFinalProofPattern.test(getProviderStepSearchText(step))),
    ...postShapingSteps.filter((step) => !proofPattern.test(getProviderStepSearchText(step))),
  ];
  const proofRemovedTexts = proofRemoved.map(getProviderStepSearchText);
  const diagnostics = getLaminatedCroissantProofDiagnostics(proofRemovedTexts);
  const barrier = [diagnostics.eggWashIndex, diagnostics.bakeIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0];
  const insertionIndex = barrier === undefined ? proofRemoved.length : Math.max(diagnostics.shapingIndex + 1, barrier);
  const proofIngredient = output.ingredients.find((ingredient) => /dough|croissant|butter|yeast/i.test(ingredient)) ?? output.ingredients[0] ?? 'croissant dough';
  const proofText = 'Cover the shaped croissants and let them proof at room temperature for 45–60 minutes, until visibly puffy.';
  const proofTime = deriveRecipeStepTime(proofText);
  const proofStep = {
    stepNumber: insertionIndex + 1,
    phase: 4,
    title: 'Final Proof',
    step: proofText,
    ingredients: [proofIngredient],
    tools: ['baking sheet'],
    estimatedMinutes: proofTime.elapsedMinutes,
    timeEstimate: '45–60 minutes',
  } as OpenRouterRecipeOutput['steps'][number];
  const repairedSteps = [
    ...proofRemoved.slice(0, insertionIndex),
    proofStep,
    ...proofRemoved.slice(insertionIndex),
  ].map((step, index) => typeof step === 'string' ? step : { ...step, stepNumber: index + 1 });
  return { ...output, steps: repairedSteps };
}

function getLegacyCorrectionFallbackPrompt(
  analysis: FoodImageAnalysis,
  correction?: CorrectionGenerationContext,
): string {
  const correctionSection = getCorrectionPromptSection(correction);
  return [
    correctionSection,
    'COMPATIBILITY FALLBACK: return one complete corrected recipe JSON object using the complete recipe schema.',
    'Use the current recipe and preserve all unrelated ingredients, steps, servings, image context, and previous successful edits.',
    'Apply every mandatory correction requirement. Do not return a patch object, markdown, or explanations.',
    `Dish: ${analysis.dishName}.`,
  ].filter(Boolean).join('\n');
}

// Fail-closed structural enforcement. Returns a structurally valid recipe or
// throws OpenRouterProviderError — never a fabricated/templated recipe.
async function enforceRecipeStructure(
  input: { analysis: FoodImageAnalysis; config: AiConfig },
  output: OpenRouterRecipeOutput,
): Promise<OpenRouterRecipeOutput> {
  output = normalizeRecipeOutputForValidation(output, input.analysis);
  const issues = validateRecipeStructure(output);
  if (issues.length === 0) {
    return output;
  }

  logOpenRouterDebug('openrouter_recipe_structure_invalid', {
    dishName: input.analysis.dishName,
    issues,
    willRepair: true,
  });

  await waitMs(250);
  const repaired = await callRecipeStage(
    input,
    getRecipeStructureRepairPrompt(input.analysis, issues),
    input.config.maxOutputTokens,
    'recipe_structure_repair',
  );
  const normalizedRepair = normalizeRecipeOutputForValidation(repaired, input.analysis);
  const mergedRepair = mergeRecipeRepairOutput(output, normalizedRepair, input.analysis);
  const restoredRepair = restoreRecipeIngredientsForValidation(mergedRepair, output, input.analysis);
  const repairedIssues = validateRecipeStructure(restoredRepair);
  if (repairedIssues.length > 0) {
    throw createOpenRouterError(input.config, input.config.openRouterTextModel, 'openrouter_invalid_schema', {
      openRouterErrorMessage: `Recipe steps were structurally invalid after repair: ${repairedIssues.join(', ')}`,
    });
  }
  return restoredRepair;
}

function getRecipeValidationIssues(
  output: OpenRouterRecipeOutput,
  isDrink: boolean,
  analysis: FoodImageAnalysis,
): string[] {
  return [...new Set([
    ...validateRecipeStructure(output),
    ...getRecipeQualityIssues(output, isDrink, analysis),
  ])];
}

function logRecipeQualityRejection(
  analysis: FoodImageAnalysis,
  firstValidationIssueCodes: string[],
  focusedRepairRan: boolean,
  finalValidationIssueCodes: string[],
): void {
  const anatomy = analysis.anatomy ?? deriveDishAnatomy(analysis);
  console.warn('[recipe_quality_rejection]', JSON.stringify({
    source: analysis.mealDescription ? 'describe_idea' : 'scan',
    dishName: analysis.dishName,
    dishFamily: anatomy.dishFamily,
    primaryComponentRoles: anatomy.primaryComponents.map((component) => component.role),
    firstValidationIssueCodes,
    focusedRepairRan,
    finalValidationIssueCodes,
    finalHttpStatus: 422,
  }));
}

function logRecipeQualityDiagnostic(
  analysis: FoodImageAnalysis,
  softIssues: string[],
  focusedRepairRan: boolean,
): void {
  if (softIssues.length === 0) return;
  const anatomy = analysis.anatomy ?? deriveDishAnatomy(analysis);
  console.warn('[recipe-quality]', JSON.stringify({
    source: analysis.mealDescription ? 'describe_idea' : 'scan',
    dishName: analysis.dishName,
    dishFamily: anatomy.dishFamily,
    softIssues,
    focusedRepairRan,
    delivered: true,
  }));
}

function applyDeterministicRecipeRepair(
  candidate: OpenRouterRecipeOutput,
  original: OpenRouterRecipeOutput,
  analysis: FoodImageAnalysis,
): OpenRouterRecipeOutput {
  const normalized = normalizeRecipeOutputForValidation(candidate, analysis);
  const ingredients = dedupeIngredients([
    ...normalized.ingredients.map(ensureIngredientAmount),
    ...flattenIngredientGroups(normalized.ingredientGroups).map(ensureIngredientAmount),
  ]);
  const sourceIngredients = dedupeIngredients([
    ...original.ingredients,
    ...flattenIngredientGroups(original.ingredientGroups),
    ...ingredients,
  ].map(ensureIngredientAmount));
  const repairedSteps = normalizeProviderStepsDeterministically(normalized.steps, sourceIngredients);
  const repaired = restoreRecipeIngredientsForValidation({
    ...normalized,
    ingredients,
    steps: repairedSteps,
  }, {
    ...original,
    ingredients: sourceIngredients,
  }, analysis);

  return normalizeRecipeOutputForValidation({
    ...repaired,
    steps: normalizeProviderStepsDeterministically(repaired.steps, repaired.ingredients),
  }, analysis);
}

function applyDeterministicLaminationWaitRepair(
  output: OpenRouterRecipeOutput,
  analysis: FoodImageAnalysis,
): OpenRouterRecipeOutput {
  const context = [
    analysis.dishName,
    analysis.broadDishCategory,
    analysis.mealDescription,
    ...analysis.visibleIngredients,
    ...analysis.likelyIngredients,
    ...Object.values(analysis.visibleComponents),
    ...output.ingredients,
  ].filter(Boolean).join(' ').toLowerCase();
  if (!/\bcroissant\b/.test(context) || /\bpuff\s+pastry\b/.test(context) || !/\b(?:yeast|laminat(?:ed|ion)|laminate)\b/.test(context)) return output;

  let changed = false;
  const steps = output.steps.map((rawStep) => {
    const text = getProviderStepText(rawStep);
    if (!/\b(?:laminat(?:e|ion)|fold)\b/i.test(text) || !hasUnspecifiedPassiveWait(text)) return rawStep;
    const repairedText = `Roll out the dough and fold it into thirds for 4 minutes total. ${text
      .replace(/\bchilling\s+between\b[^.;]*/gi, 'chilling the dough for 30 minutes after each round')
      .replace(/\bchill\s+between\b[^.;]*/gi, 'chill the dough for 30 minutes after each round')
      .replace(/\brefrigerat(?:e|ing)\s+between\b[^.;]*/gi, 'refrigerate the dough for 30 minutes between rounds')
      .replace(/\brest(?:ing)?\s+between\b[^.;]*/gi, 'rest the dough for 30 minutes between rounds')
      .replace(/\ballow the dough to chill\s+between\b[^.;]*/gi, 'allow the dough to chill for 30 minutes between rounds')}`;
    if (repairedText === text) return rawStep;
    changed = true;
    return typeof rawStep === 'string'
      ? repairedText
      : {
        ...rawStep,
        step: repairedText,
        instruction: repairedText,
        text: repairedText,
        activeMinutes: 4,
        passiveMinutes: 90,
        elapsedMinutes: 94,
        estimatedMinutes: 94,
        timeEstimate: '4 minutes hands-on + 90 minutes chilling',
      };
  });
  if (!changed) return output;

  // Keep the provider-facing candidate internally consistent as soon as the
  // repair changes a step. The canonical Recipe conversion reconciles again,
  // but the quality pass must not carry a stale headline total forward.
  const repairedStepElapsed = steps.reduce((total, rawStep) => {
    if (typeof rawStep === 'string') return total + deriveRecipeStepTime(rawStep).elapsedMinutes;
    const derived = deriveRecipeStepTime(getProviderStepText(rawStep), rawStep.estimatedMinutes);
    const active = Number.isFinite(rawStep.activeMinutes) ? Math.max(0, rawStep.activeMinutes ?? 0) : derived.activeMinutes;
    const passive = Number.isFinite(rawStep.passiveMinutes) ? Math.max(0, rawStep.passiveMinutes ?? 0) : derived.passiveMinutes;
    return total + Math.max(
      1,
      Number.isFinite(rawStep.elapsedMinutes) ? rawStep.elapsedMinutes ?? 0 : derived.elapsedMinutes,
      active + passive,
    );
  }, 0);
  const reportedTotal = Number(output.totalTime);
  return {
    ...output,
    totalTime: String(Math.max(
      Number.isFinite(reportedTotal) ? reportedTotal : 0,
      repairedStepElapsed,
    )),
    steps,
  };
}

function normalizeProviderStepsDeterministically(
  steps: OpenRouterRecipeOutput['steps'],
  ingredients: string[],
): OpenRouterRecipeOutput['steps'] {
  return steps.map((step, index) => {
    const rawText = getProviderStepText(step);
    const stepRefs = typeof step === 'object' && step
      ? getStepIngredientReferences([step])
      : inferStepIngredientReferences(rawText, ingredients);
    const repairedRefs = stepRefs.length > 0 ? stepRefs : [getIngredientSearchName(ingredients[0] ?? 'ingredient') || 'ingredient'];
    const repairedText = repairStepInstructionText(rawText, repairedRefs);
    const tools = typeof step === 'object' && step && Array.isArray(step.tools) && step.tools.some((value) => typeof value === 'string' && value.trim())
      ? step.tools
      : typeof step === 'object' && step && Array.isArray(step.toolsUsed) && step.toolsUsed.some((value) => typeof value === 'string' && value.trim())
        ? step.toolsUsed
        : [inferStepTool(repairedText)];

    if (typeof step === 'object' && step) {
      return {
        ...step,
        stepNumber: index + 1,
        phase: typeof step.phase === 'number' ? step.phase : inferStepPhase(index, steps.length),
        title: step.title?.trim() || deriveStepTitle(repairedText, index),
        step: repairedText,
        ingredients: repairedRefs,
        tools,
      };
    }

    return {
      stepNumber: index + 1,
      phase: inferStepPhase(index, steps.length),
      title: deriveStepTitle(repairedText, index),
      step: repairedText,
      instruction: '',
      text: '',
      ingredients: repairedRefs,
      tools,
      timeEstimate: '',
      visualCue: '',
      whyItMatters: '',
      safetyNote: '',
      flavorBoost: '',
    };
  });
}

export function repairStepInstructionText(text: string, ingredientRefs: string[]): string {
  const ingredients = formatIngredientReferences(ingredientRefs);
  const base = text.trim();
  if (!base || vagueStepPattern.test(base.toLowerCase())) {
    return `Handle ${ingredients} as directed.`;
  }

  return base;
}

function inferStepIngredientReferences(text: string, ingredients: string[]): string[] {
  return ingredients
    .map(getIngredientSearchName)
    .filter((name) => name && containsIngredientMention(text.toLowerCase(), name));
}

function formatIngredientReferences(references: string[]): string {
  const cleaned = references.map(getIngredientSearchName).filter(Boolean).slice(0, 3);
  if (cleaned.length === 0) return 'the ingredients';
  if (cleaned.length === 1) return cleaned[0];
  return `${cleaned.slice(0, -1).join(', ')} and ${cleaned[cleaned.length - 1]}`;
}

function inferStepTool(text: string): string {
  if (/\bboil|pasta|water\b/i.test(text)) return 'large pot';
  if (/\bwhisk|sauce|cream\b/i.test(text)) return 'whisk';
  if (/\bcut|slice|chop|mince\b/i.test(text)) return 'chef knife';
  if (/\bserve|plate|bowl\b/i.test(text)) return 'serving bowl';
  return 'skillet';
}

function inferStepPhase(index: number, total: number): number {
  if (index === 0) return 1;
  if (index === 1) return 2;
  if (index >= total - 1) return 6;
  if (index >= total - 2) return 5;
  return 3;
}

function deriveStepTitle(text: string, index: number): string {
  const words = text
    .replace(/[^a-zA-Z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
  return words.length > 0 ? words.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase()).join(' ') : `Step ${index + 1}`;
}

function mergeRecipeRepairOutput(
  original: OpenRouterRecipeOutput,
  repair: OpenRouterRecipeOutput,
  analysis: FoodImageAnalysis,
): OpenRouterRecipeOutput {
  const merged: OpenRouterRecipeOutput = { ...original };

  for (const key of Object.keys(repair) as (keyof OpenRouterRecipeOutput)[]) {
    const value = repair[key];
    if (Array.isArray(value)) {
      continue;
    }
    if (typeof value === 'string') {
      if (value.trim()) {
        (merged as SafeRecord)[key] = value;
      }
      continue;
    }
    if (value !== undefined && value !== null) {
      (merged as SafeRecord)[key] = value;
    }
  }

  merged.steps = repair.steps.length > 0 ? repair.steps : original.steps;
  merged.ingredients = chooseCompleteIngredientList(original.ingredients, repair.ingredients, merged.steps);
  merged.ingredientGroups = chooseIngredientGroups(original.ingredientGroups, repair.ingredientGroups);

  for (const key of [
    'equipment',
    'substitutions',
    'groceryItems',
    'spicePairings',
    'cookingTerms',
    'appliedChanges',
  ] as const) {
    if (repair[key].length > 0) {
      (merged as SafeRecord)[key] = repair[key];
    }
  }

  return normalizeRecipeOutputForValidation(merged, analysis);
}

function chooseCompleteIngredientList(
  original: string[],
  repair: string[],
  steps: OpenRouterRecipeOutput['steps'],
): string[] {
  const normalizedOriginal = normalizeProviderIngredientList(original);
  const normalizedRepair = normalizeProviderIngredientList(repair);
  if (
    hasCompleteIngredientList(normalizedRepair, steps) &&
    normalizedRepair.length >= Math.min(normalizedOriginal.length, 4)
  ) {
    return normalizedRepair;
  }
  return normalizedOriginal.length > 0 ? normalizedOriginal : normalizedRepair;
}

function chooseIngredientGroups(
  original: OpenRouterRecipeOutput['ingredientGroups'],
  repair: OpenRouterRecipeOutput['ingredientGroups'],
): OpenRouterRecipeOutput['ingredientGroups'] {
  const originalItems = flattenIngredientGroups(original);
  const repairItems = flattenIngredientGroups(repair);
  if (repair.length > 0 && hasCompleteIngredientList(repairItems, []) && repairItems.length >= Math.min(originalItems.length, 4)) {
    return repair;
  }
  return original.length > 0 ? original : repair;
}

function restoreRecipeIngredientsForValidation(
  candidate: OpenRouterRecipeOutput,
  original: OpenRouterRecipeOutput,
  analysis: FoodImageAnalysis,
): OpenRouterRecipeOutput {
  const normalized = normalizeRecipeOutputForValidation(candidate, analysis);
  const restored = dedupeIngredients(normalized.ingredients.map(ensureIngredientAmount));
  const sourceIngredients = dedupeIngredients([
    ...original.ingredients,
    ...flattenIngredientGroups(original.ingredientGroups),
    ...candidate.ingredients,
    ...flattenIngredientGroups(candidate.ingredientGroups),
  ].map(ensureIngredientAmount));

  for (const stepIngredient of getStepIngredientReferences(normalized.steps)) {
    if (ingredientListContainsReference(restored, stepIngredient)) {
      continue;
    }
    const sourced = findIngredientForReference(sourceIngredients, stepIngredient);
    restored.push(sourced ?? quantifyIngredientReference(stepIngredient));
  }

  for (const source of sourceIngredients) {
    if (restored.length >= 4) {
      break;
    }
    if (!ingredientListContainsReference(restored, getIngredientSearchName(source))) {
      restored.push(source);
    }
  }

  return normalizeRecipeOutputForValidation({ ...normalized, ingredients: dedupeIngredients(restored) }, analysis);
}

function hasCompleteIngredientList(ingredients: string[], steps: OpenRouterRecipeOutput['steps']): boolean {
  const normalized = normalizeProviderIngredientList(ingredients);
  if (normalized.length < 4) {
    return false;
  }
  const missingAmounts = normalized.filter((value) => !hasIngredientAmount(value));
  if (missingAmounts.length > Math.max(1, Math.floor(normalized.length / 3))) {
    return false;
  }
  return getStepIngredientReferences(steps).every((reference) => ingredientListContainsReference(normalized, reference));
}

function flattenIngredientGroups(groups: OpenRouterRecipeOutput['ingredientGroups']): string[] {
  return groups.flatMap((group) => group.items).map((item) => item.trim()).filter(Boolean);
}

function getStepIngredientReferences(steps: OpenRouterRecipeOutput['steps']): string[] {
  const references = steps.flatMap((step) => {
    if (typeof step === 'string') {
      return [];
    }
    const ingredients = Array.isArray(step.ingredients) && step.ingredients.length > 0
      ? step.ingredients
      : Array.isArray(step.ingredientsUsed)
        ? step.ingredientsUsed
        : [];
    return ingredients;
  });
  return dedupeIngredients(references.map(getIngredientSearchName).filter(Boolean));
}

function ingredientListContainsReference(ingredients: string[], reference: string): boolean {
  const needle = getIngredientSearchName(reference);
  return ingredients.some((ingredient) => {
    const haystack = getIngredientSearchName(ingredient);
    return haystack === needle || haystack.includes(needle) || needle.includes(haystack);
  });
}

function findIngredientForReference(ingredients: string[], reference: string): string | undefined {
  return ingredients.find((ingredient) => ingredientListContainsReference([ingredient], reference));
}

function quantifyIngredientReference(reference: string): string {
  const name = getIngredientSearchName(reference) || reference.trim();
  if (!name) {
    return '1 ingredient';
  }
  if (hasIngredientAmount(name)) {
    return name;
  }
  if (/\b(salt|pepper|seasoning|spice|herbs?)\b/i.test(name)) {
    return `1/2 tsp ${name}`;
  }
  if (/\b(oil|butter|cream|milk|sauce|broth|water|lemon juice)\b/i.test(name)) {
    return `2 tbsp ${name}`;
  }
  return `1 cup ${name}`;
}

function ensureIngredientAmount(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || hasIngredientAmount(trimmed)) {
    return trimmed;
  }
  return quantifyIngredientReference(trimmed);
}

function getIngredientSearchName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d+\s+\d+\/\d+\b/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\/\d+\b/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\b/g, ' ')
    .replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, ' ')
    .replace(/\b(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|half|quarter|pinch|dash|handful|some|to taste)\b/g, ' ')
    .replace(/\b(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|pounds?|lbs?|grams?|g|kg|ml|milliliters?|l|liters?|cloves?|cans?|packages?|sticks?|slices?)\b/g, ' ')
    .replace(/\b(?:fresh|frozen|large|small|medium|diced|chopped|minced|grated|shredded|softened|melted|divided|plus more)\b/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeIngredients(ingredients: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const ingredient of ingredients) {
    const trimmed = ingredient.trim();
    if (!trimmed) {
      continue;
    }
    const key = getIngredientSearchName(trimmed) || trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

// Strict structural validation of the single recipe. Returns issue codes (empty
// = valid). Enforces the mandatory step contract: a non-empty array of
// structured steps, each with an instruction, title, at least one ingredient and
// one tool, and a sequential stepNumber starting at 1.
export function validateRecipeStructure(output: OpenRouterRecipeOutput): string[] {
  const issues: string[] = [];
  const steps = Array.isArray(output.steps) ? output.steps : null;
  if (!steps) {
    return ['steps_not_array'];
  }
  if (steps.length < 4) {
    // Step count is a quality signal, not a usability requirement. An empty
    // instruction set is still technically unusable and remains hard-blocked.
    if (steps.length === 0) issues.push('no_usable_steps');
  }

  const nonEmpty = (values: unknown): boolean =>
    Array.isArray(values) && values.some((v) => typeof v === 'string' && v.trim().length > 0);

  for (const step of steps) {
    if (typeof step === 'string' || !step || typeof step !== 'object') {
      issues.push('step_not_structured');
      continue;
    }
    const instruction = (step.step || step.instruction || step.text || '').trim();
    if (!instruction) issues.push('step_missing_instruction');
    if (!(step.title || '').trim()) issues.push('step_missing_title');
    if (!nonEmpty(step.ingredients) && !nonEmpty(step.ingredientsUsed)) issues.push('step_missing_ingredients');
    if (!nonEmpty(step.tools) && !nonEmpty(step.toolsUsed)) issues.push('step_missing_tools');
  }

  const numbers = steps.map((step) =>
    typeof step === 'object' && step && typeof step.stepNumber === 'number' ? step.stepNumber : undefined);
  if (numbers.some((n) => n === undefined)) {
    issues.push('stepNumber_missing');
  } else if (!numbers.every((n, index) => n === index + 1)) {
    issues.push('stepNumber_not_sequential');
  }

  return [...new Set(issues)];
}

async function callRecipeStage(
  input: {
    analysis: FoodImageAnalysis;
    config: AiConfig;
    correction?: CorrectionGenerationContext;
  },
  userPrompt: string,
  maxTokens: number,
  stage: string,
  forceLegacyRecipe = false,
): Promise<OpenRouterRecipeOutput> {
  const forceCompleteRecipe = forceLegacyRecipe || Boolean(input.correction?.forceCompleteRecipe);
  const json = await callOpenRouterJsonWithFailover(
    {
      config: input.config,
      messages: [
        {
          role: 'system',
          content: stage.startsWith('recipe_edit')
            ? 'You edit recipes. Return JSON only.'
            : input.correction && !forceCompleteRecipe
              ? 'You are a professional chef assistant applying a safe correction to an existing recipe. Return only the requested structured correction patch JSON. Preserve unrelated fields. Use the supplied source IDs exactly. No markdown, reasoning, or explanations.'
              : 'You are a professional chef assistant and food reverse-engineering specialist generating ONE complete canonical Recipe object for a beginner cook. When the dish is a platter or multi-component meal, cover every distinct component. Every step MUST include stepNumber, phase, title, step, ingredients, and tools. Return ONLY valid JSON. No markdown, no reasoning, no explanations.',
        },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: Math.min(input.config.maxOutputTokens, maxTokens),
      stage,
    },
    input.correction
      ? [input.config.openRouterTextModel]
      : getRecipeModelChain(input.config),
  );
  logRecipeEditRawShape(stage, json);

  const correctionPatchKeysPresent = input.correction && !forceCompleteRecipe && hasCorrectionPatchKeys(json);
  if (correctionPatchKeysPresent) {
    if (hasLegacyRecipeKeys(json)) {
      const hybridError = createOpenRouterError(input.config, input.config.openRouterTextModel, 'openrouter_invalid_schema', {
        openRouterErrorMessage: 'correction_patch_hybrid_response',
      });
      recordCorrectionSchemaDiagnostics({
        schemaSelected: 'correction_patch',
        issuePaths: ['root: patch response contains legacy recipe fields'],
        subcodes: ['correction_patch_hybrid_response'],
        topLevelKeys: getSafeTopLevelKeys(json),
        outputCharacterCount: JSON.stringify(json).length,
        patchKeysPresent: true,
        legacyRecipeKeysPresent: true,
      });
      recordRecipeSchemaParse('failure');
      recordOpenRouterFailure(hybridError);
      throw hybridError;
    }
    const patchResult = parseCorrectionPatchProviderOutput(json, input.correction?.originalRecipe);
    recordCorrectionSchemaDiagnostics({
      schemaSelected: 'correction_patch',
      issuePaths: patchResult.success ? undefined : patchResult.issuePaths,
      subcodes: patchResult.success ? undefined : patchResult.subcodes,
      topLevelKeys: getSafeTopLevelKeys(json),
      outputCharacterCount: JSON.stringify(json).length,
      patchKeysPresent: true,
      legacyRecipeKeysPresent: hasLegacyRecipeKeys(json),
      rawOperationNames: patchResult.rawOperationNames,
      normalizedOperationNames: patchResult.normalizedOperationNames,
      fieldLiftingActions: patchResult.fieldLiftingActions,
      inheritedSourceFields: patchResult.inheritedSourceFields,
    });
    if (!patchResult.success) {
      recordRecipeSchemaParse('failure');
      const error = createOpenRouterError(input.config, input.config.openRouterTextModel, 'openrouter_invalid_schema', {
        openRouterErrorMessage: patchResult.subcodes.join(', '),
      });
      recordOpenRouterFailure(error);
      throw error;
    }
    const contentIssues = validateCorrectionPatchContent(patchResult.data, input.correction!);
    if (contentIssues.length > 0) {
      recordRecipeSchemaParse('failure');
      recordCorrectionSchemaDiagnostics({
        schemaSelected: 'correction_patch',
        issuePaths: contentIssues,
        subcodes: contentIssues,
        topLevelKeys: getSafeTopLevelKeys(json),
        outputCharacterCount: JSON.stringify(json).length,
        patchKeysPresent: true,
        legacyRecipeKeysPresent: hasLegacyRecipeKeys(json),
        rawOperationNames: patchResult.rawOperationNames,
        normalizedOperationNames: patchResult.normalizedOperationNames,
        fieldLiftingActions: patchResult.fieldLiftingActions,
        inheritedSourceFields: patchResult.inheritedSourceFields,
      });
      const error = createOpenRouterError(input.config, input.config.openRouterTextModel, 'openrouter_invalid_schema', {
        openRouterErrorMessage: contentIssues.join(', '),
      });
      recordOpenRouterFailure(error);
      throw error;
    }
    recordRecipeSchemaParse('success');
    return patchResult.data as unknown as OpenRouterRecipeOutput;
  }

  const normalizationStartedAt = Date.now();
  let normalizedJson: unknown;
  try {
    normalizedJson = normalizeRecipeProviderOutputShape(json);
  } catch {
    addNormalizationMs(Date.now() - normalizationStartedAt);
    recordRecipeSchemaParse('failure');
    const error = createOpenRouterError(
      input.config,
      input.config.openRouterTextModel,
      'openrouter_invalid_schema',
      { openRouterErrorMessage: 'Provider recipe normalization failed.' },
    );
    recordOpenRouterFailure(error);
    throw error;
  }
  addNormalizationMs(Date.now() - normalizationStartedAt);
  if (input.correction) {
    recordCorrectionSchemaDiagnostics({
      schemaSelected: 'legacy_recipe_fallback',
      topLevelKeys: getSafeTopLevelKeys(json),
      outputCharacterCount: JSON.stringify(json).length,
      patchKeysPresent: false,
      legacyRecipeKeysPresent: hasLegacyRecipeKeys(json),
    });
  }

  const output = openRouterRecipeOutputSchema.safeParse(normalizedJson);
  if (!output.success) {
    recordRecipeSchemaParse('failure');
    if (stage.startsWith('recipe_edit')) {
      logOpenRouterDebug('recipe_edit_schema_failure', {
        stage,
        issuePaths: output.error.issues
          .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
          .slice(0, 12),
      });
    }
    if (input.correction) {
      recordCorrectionSchemaDiagnostics({
        schemaSelected: 'legacy_recipe_fallback',
        issuePaths: output.error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`).slice(0, 8),
        subcodes: ['correction_patch_legacy_fallback_invalid'],
        topLevelKeys: getSafeTopLevelKeys(json),
        outputCharacterCount: JSON.stringify(json).length,
        patchKeysPresent: false,
        legacyRecipeKeysPresent: hasLegacyRecipeKeys(json),
      });
    }
    const error = createOpenRouterError(input.config, input.config.openRouterTextModel, 'openrouter_invalid_schema', {
      openRouterErrorMessage: getSchemaErrorMessage(output.error),
    });
    recordOpenRouterFailure(error);
    throw error;
  }
  recordRecipeSchemaParse('success');
  return output.data;
}

function hasCorrectionPatchKeys(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.some((key) => ['ingredientOperations', 'stepOperations', 'metadataPatch'].includes(key)) ||
    (keys.includes('nutritionEstimate') && !hasLegacyRecipeKeys(value));
}

function hasLegacyRecipeKeys(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value as Record<string, unknown>).some((key) =>
    ['title', 'description', 'ingredients', 'steps', 'servings', 'difficulty'].includes(key));
}

function getSafeTopLevelKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>).slice(0, 40);
}

function logRecipeEditRawShape(stage: string, value: unknown) {
  if (!stage.startsWith('recipe_edit')) return;
  const record = getRecord(value);
  const ingredients = record?.ingredients;
  const steps = record?.steps ?? record?.instructions ?? record?.directions;
  const nutrition = getRecord(record?.nutritionEstimate ?? record?.nutrition ?? record?.macros);
  logOpenRouterDebug('recipe_edit_raw_shape', {
    stage,
    topLevelKeys: getSafeTopLevelKeys(value),
    ingredientShape: getSafeCollectionShape(ingredients),
    stepShape: getSafeCollectionShape(steps),
    nutritionKeys: nutrition ? Object.keys(nutrition).slice(0, 20) : [],
    timingKeys: record
      ? Object.keys(record).filter((key) => /^(?:prep|cook|total|active|passive).*time/i.test(key)).slice(0, 20)
      : [],
  });
}

function getSafeCollectionShape(value: unknown): string {
  if (!Array.isArray(value)) return getValueType(value);
  const first = value[0];
  if (first === undefined) return 'array(empty)';
  const firstRecord = getRecord(first);
  return firstRecord
    ? `array(object:${Object.keys(firstRecord).slice(0, 12).join(',')})`
    : `array(${getValueType(first)})`;
}

export function normalizeCorrectionPatchProviderOutput(value: unknown, sourceRecipe?: Recipe): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const source = value as Record<string, unknown>;
  const trim = (item: unknown) => typeof item === 'string' ? item.trim() : item;
  const sourceIngredients = sourceRecipe?.ingredients ?? [];
  const sourceSteps = sourceRecipe?.structuredSteps?.length
    ? sourceRecipe.structuredSteps
    : (sourceRecipe?.steps ?? []).map((text, index) => ({ stepNumber: index + 1, text, title: `Step ${index + 1}` }));
  const sourceIngredient = (id: string | undefined) => {
    const match = id?.match(/^ingredient-(\d+)$/);
    return match ? sourceIngredients[Number(match[1]) - 1] : undefined;
  };
  const sourceStep = (id: string | undefined) => {
    const match = id?.match(/^step-(\d+)$/);
    return match ? sourceSteps[Number(match[1]) - 1] : undefined;
  };
  const nameTokens = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const relatedNames = (left: string, right: string) => {
    const leftSet = new Set(nameTokens(left));
    const rightSet = new Set(nameTokens(right));
    const overlap = [...leftSet].filter((token) => rightSet.has(token)).length;
    return overlap >= Math.min(2, Math.min(leftSet.size, rightSet.size));
  };
  const canonicalIngredientOperation = (operation: unknown, record: Record<string, unknown>, source?: RecipeIngredient): string => {
    const normalized = String(operation ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const direct: Record<string, string> = {
      add: 'add', insert: 'add', append: 'add', create: 'add',
      remove: 'remove', delete: 'remove', omit: 'remove',
      replace: 'replace', substitute: 'replace', swap: 'replace',
      change_quantity: 'change_quantity', update_quantity: 'change_quantity', adjust_quantity: 'change_quantity', increase_quantity: 'change_quantity', decrease_quantity: 'change_quantity',
      change_descriptor: 'change_descriptor', update_descriptor: 'change_descriptor',
    };
    if (direct[normalized]) return direct[normalized];
    if (normalized.endsWith('_ingredient')) {
      const stripped = normalized.slice(0, -'_ingredient'.length);
      if (direct[stripped]) return direct[stripped];
      if (['modify', 'update', 'edit', 'change'].includes(stripped)) {
        return canonicalIngredientOperation(stripped, record, source);
      }
    }
    if (['modify', 'update', 'edit', 'change'].includes(normalized)) {
      const result = record.result && typeof record.result === 'object' ? record.result as Record<string, unknown> : record;
      const name = result.name ?? record.name;
      const quantity = result.quantity ?? record.quantity;
      if (!record.sourceIngredientId && (name || quantity)) return 'add';
      if (record.sourceIngredientId && !name && !quantity) return 'remove';
      if (quantity && !name) return 'change_quantity';
      if (name && source && relatedNames(source.name, String(name))) return 'change_descriptor';
      if (name) return 'replace';
    }
    return normalized;
  };
  const canonicalStepOperation = (operation: unknown, record: Record<string, unknown>): string => {
    const normalized = String(operation ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (['add', 'insert', 'append', 'create'].includes(normalized)) return 'add';
    if (['remove', 'delete', 'omit'].includes(normalized)) return 'remove';
    if (['replace', 'update', 'modify', 'edit', 'change'].includes(normalized)) return 'replace';
    if (normalized.endsWith('_step')) return canonicalStepOperation(normalized.slice(0, -5), record);
    return normalized;
  };
  const normalizeOperation = (operation: unknown): unknown => {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) return operation;
    const record = operation as Record<string, unknown>;
    const sourceIngredientId = trim(record.sourceIngredientId) as string | undefined;
    const sourceStepId = trim(record.sourceStepId) as string | undefined;
    const source = sourceIngredient(sourceIngredientId);
    const sourceStepValue = sourceStep(sourceStepId);
    const rawResult = record.result && typeof record.result === 'object' && !Array.isArray(record.result)
      ? record.result as Record<string, unknown> : {};
    const canonicalOperation = sourceStepId || record.text !== undefined || record.ingredientReferences !== undefined
      ? canonicalStepOperation(record.operation, record)
      : canonicalIngredientOperation(record.operation, record, source);
    const isStep = Boolean(sourceStepId || record.text !== undefined || record.ingredientReferences !== undefined || rawResult.text !== undefined || rawResult.ingredientReferences !== undefined);
    const sourceStepIngredientNames = sourceStepValue && 'ingredientsUsed' in sourceStepValue
      ? sourceStepValue.ingredientsUsed
      : undefined;
    const liftedResult = isStep
      ? {
          ...rawResult,
          ...(record.text !== undefined ? { text: record.text } : {}),
          ...(record.title !== undefined ? { title: record.title } : {}),
          ...(record.ingredientReferences !== undefined ? { ingredientReferences: record.ingredientReferences } : {}),
          ...(sourceStepValue && canonicalOperation === 'replace' ? {
            title: rawResult.title ?? record.title ?? sourceStepValue.title,
            ingredientReferences: rawResult.ingredientReferences ?? record.ingredientReferences ?? sourceStepIngredientNames?.map((name: string) => {
              const index = sourceIngredients.findIndex((ingredient) => relatedNames(ingredient.name, name));
              return index >= 0 ? `ingredient-${index + 1}` : undefined;
            }).filter(Boolean),
          } : {}),
        }
      : {
          ...rawResult,
          ...(record.name !== undefined ? { name: record.name } : {}),
          ...(record.quantity !== undefined ? { quantity: record.quantity } : {}),
          ...(source && (canonicalOperation === 'change_descriptor' || canonicalOperation === 'replace') && rawResult.quantity === undefined && record.quantity === undefined
            ? { quantity: source.quantity } : {}),
          ...(source && canonicalOperation === 'change_quantity' && rawResult.name === undefined && record.name === undefined
            ? { name: source.name } : {}),
        };
    return {
      ...record,
      operation: canonicalOperation,
      sourceIngredientId,
      sourceStepId,
      supportsRequirementIndexes: Array.isArray(record.supportsRequirementIndexes)
        ? record.supportsRequirementIndexes : undefined,
      result: canonicalOperation === 'remove' ? undefined : Object.fromEntries(Object.entries(liftedResult).map(([key, item]) => [key, trim(item)])),
    };
  };
  const nutrition = source.nutritionEstimate && typeof source.nutritionEstimate === 'object' && !Array.isArray(source.nutritionEstimate)
    ? Object.fromEntries(Object.entries(source.nutritionEstimate as Record<string, unknown>).map(([key, item]) => [
        key,
        typeof item === 'string' && item.trim() !== '' && Number.isFinite(Number(item)) ? Number(item) : item,
      ]))
    : source.nutritionEstimate;
  const metadata = source.metadataPatch && typeof source.metadataPatch === 'object' && !Array.isArray(source.metadataPatch)
    ? Object.fromEntries(Object.entries(source.metadataPatch as Record<string, unknown>).map(([key, item]) => [
        key,
        item === null || (typeof item === 'string' && item.trim() === '') ? undefined : trim(item),
      ]))
    : undefined;
  return {
    ingredientOperations: source.ingredientOperations === undefined ? [] :
      Array.isArray(source.ingredientOperations) ? source.ingredientOperations.map(normalizeOperation) : source.ingredientOperations,
    stepOperations: source.stepOperations === undefined ? [] :
      Array.isArray(source.stepOperations) ? source.stepOperations.map(normalizeOperation) : source.stepOperations,
    ...(nutrition === undefined ? {} : { nutritionEstimate: nutrition }),
    ...(metadata === undefined ? {} : { metadataPatch: metadata }),
  };
}

export function parseCorrectionPatchProviderOutput(value: unknown, sourceRecipe?: Recipe):
  | { success: true; data: CorrectionPatchProviderOutput; rawOperationNames?: string[]; normalizedOperationNames?: string[]; fieldLiftingActions?: string[]; inheritedSourceFields?: string[] }
  | { success: false; issuePaths: string[]; subcodes: string[]; rawOperationNames?: string[]; normalizedOperationNames?: string[]; fieldLiftingActions?: string[]; inheritedSourceFields?: string[] } {
  const rawRecord = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  const rawOperations = [
    ...(Array.isArray(rawRecord?.ingredientOperations) ? rawRecord.ingredientOperations : []),
    ...(Array.isArray(rawRecord?.stepOperations) ? rawRecord.stepOperations : []),
  ].filter((operation): operation is Record<string, unknown> => Boolean(operation && typeof operation === 'object' && !Array.isArray(operation)));
  const rawOperationNames = rawOperations.map((operation) => String(operation.operation ?? '')).filter(Boolean);
  const normalized = normalizeCorrectionPatchProviderOutput(value, sourceRecipe);
  const parsed = correctionPatchProviderOutputSchema.safeParse(normalized);
  const normalizedRecord = normalized && typeof normalized === 'object' ? normalized as Record<string, unknown> : undefined;
  const normalizedOperations = [
    ...(Array.isArray(normalizedRecord?.ingredientOperations) ? normalizedRecord.ingredientOperations : []),
    ...(Array.isArray(normalizedRecord?.stepOperations) ? normalizedRecord.stepOperations : []),
  ].filter((operation): operation is Record<string, unknown> => Boolean(operation && typeof operation === 'object' && !Array.isArray(operation)));
  const normalizedOperationNames = normalizedOperations.map((operation) => String(operation.operation ?? '')).filter(Boolean);
  const fieldLiftingActions: string[] = [];
  const inheritedSourceFields: string[] = [];
  rawOperations.forEach((operation, index) => {
    if (operation.text !== undefined || operation.name !== undefined || operation.quantity !== undefined || operation.ingredientReferences !== undefined) {
      fieldLiftingActions.push(`operation-${index + 1}`);
    }
  });
  normalizedOperations.forEach((operation, index) => {
    const result = operation.result && typeof operation.result === 'object' ? operation.result as Record<string, unknown> : {};
    if (result.quantity !== undefined && rawOperations[index]?.quantity === undefined && rawOperations[index]?.result && typeof rawOperations[index].result === 'object' && (rawOperations[index].result as Record<string, unknown>).quantity === undefined) inheritedSourceFields.push(`operation-${index + 1}:quantity`);
    if (result.name !== undefined && rawOperations[index]?.name === undefined && rawOperations[index]?.result && typeof rawOperations[index].result === 'object' && (rawOperations[index].result as Record<string, unknown>).name === undefined) inheritedSourceFields.push(`operation-${index + 1}:name`);
  });
  if (parsed.success) return { success: true, data: parsed.data, rawOperationNames, normalizedOperationNames, fieldLiftingActions, inheritedSourceFields };
  const issuePaths = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`).slice(0, 8);
  const subcodes = parsed.error.issues.map((issue) => {
    const path = issue.path.join('.');
    if (path.includes('ingredientOperations') && path.includes('sourceIngredientId')) return 'correction_patch_missing_source_id';
    if (path.includes('ingredientOperations') && path.includes('result')) return 'correction_patch_missing_result';
    if (path.includes('stepOperations') && path.includes('sourceStepId')) return 'correction_patch_missing_source_id';
    if (path.includes('stepOperations') && path.includes('result')) return 'correction_patch_missing_result';
    if (path.includes('operation')) return 'correction_patch_operation_invalid';
    return 'correction_patch_schema_invalid';
  });
  return { success: false, issuePaths, subcodes: [...new Set(subcodes)], rawOperationNames, normalizedOperationNames, fieldLiftingActions, inheritedSourceFields };
}

function validateCorrectionPatchContent(
  patch: CorrectionPatchProviderOutput,
  correction: CorrectionGenerationContext,
): string[] {
  const issues: string[] = [];
  const hasIngredientOps = patch.ingredientOperations.length > 0;
  const hasStepOps = patch.stepOperations.length > 0;
  const hasMetadata = Boolean(patch.metadataPatch && Object.keys(patch.metadataPatch).length > 0);
  if (!hasIngredientOps && !hasStepOps && !hasMetadata) issues.push('correction_patch_missing_operations');
  if (correction.nutritionRequirements.length > 0) {
    if (!patch.nutritionEstimate) issues.push('correction_patch_nutrition_missing');
    if (!hasIngredientOps) issues.push('correction_patch_ingredient_operations_missing');
    if (!hasStepOps) issues.push('correction_patch_step_operations_missing');
  }
  if (patch.ingredientOperations.some((operation) => operation.operation === 'remove') && !hasStepOps) {
    issues.push('correction_patch_step_operations_missing');
  }
  return [...new Set(issues)];
}

// Detects recipe output that is too vague to cook from. Returns a list of issue
// codes (empty = good enough). Drives the one-shot repair retry above.
function getRecipeQualityIssues(output: OpenRouterRecipeOutput, isDrink: boolean, analysis?: FoodImageAnalysis): string[] {
  const issues: string[] = [];
  const ingredients = (Array.isArray(output.ingredients) ? output.ingredients : [])
    .map((value) => (typeof value === 'string' ? value : '').trim())
    .filter(Boolean);
  const stepTexts = (Array.isArray(output.steps) ? output.steps : [])
    .map((value) => {
      if (typeof value === 'string') return value.trim();
      return [
        value?.step,
        value?.instruction,
        value?.text,
        value?.doneWhen,
        value?.safetyNote,
      ].filter((text): text is string => typeof text === 'string' && text.trim().length > 0).join(' ').trim();
    })
    .filter(Boolean);
  const allText = `${output.title ?? ''} ${output.description ?? ''} ${ingredients.join(' ')} ${stepTexts.join(' ')}`.toLowerCase();

  if (/\bmain ingredient\b/.test(allText)) {
    issues.push('vague_main_ingredient');
  }
  if (ingredients.length < 4) {
    issues.push('too_few_ingredients');
  }
  const vagueStandalone = ingredients.filter((value) => standaloneVagueIngredient.test(value.toLowerCase().trim()));
  if (vagueStandalone.length > 0) {
    issues.push('vague_ingredient_name');
  }
  const missingAmounts = ingredients.filter((value) => !hasIngredientAmount(value));
  if (missingAmounts.length > Math.max(1, Math.floor(ingredients.length / 3))) {
    issues.push('ingredients_missing_amounts');
  }
  if (stepTexts.some((step) => vagueStepPattern.test(step.toLowerCase()))) {
    issues.push('vague_step');
  }
  if (isDrink && stepTexts.some((step) => /\b(oven|skillet|saut[eé]|bake|roast|sear|pan-fry|°f|°c|internal temp)\b/i.test(step))) {
    issues.push('drink_uses_cooking_language');
  }
  if (analysis && hasUnsafePoultryTemperature(stepTexts, analysis, ingredients)) {
    issues.push('unsafe_temperature_poultry');
  }
  if (analysis) {
    const anatomy = analysis.anatomy ?? deriveDishAnatomy(analysis);
    const anatomyContract = anatomy && (anatomy.dishFamily === 'filled_pastry' || deriveDishContract(analysis, anatomy).signatureKey)
      ? deriveDishContract(analysis, anatomy)
      : undefined;
    issues.push(...validateRecipeQuality({
      title: output.title,
      description: output.description,
      ingredients,
      ingredientGroups: output.ingredientGroups,
      steps: output.steps.map((step) => typeof step === 'string' ? step : {
        title: step.title,
        step: step.step,
        instruction: step.instruction,
        text: step.text,
        ingredients: step.ingredients,
        ingredientsUsed: step.ingredientsUsed,
      }),
    }, analysis, analysis.flavorPlan, anatomyContract));
  }

  return issues;
}

const standaloneVagueIngredient = /^(the\s+)?(main ingredients?|protein|proteins|vegetables?|veggies|sauce|sauces|seasoning|seasonings|spice|spices|toppings?|ingredients|filling|stuff)$/;
const vagueStepPattern = /\bcook until done\b|\bprepare the ingredients\b|\bmix everything\b|\bseason to taste\b|\b(cook|add|prepare|make) the (main ingredient|protein|vegetables|sauce)\b/;

function hasIngredientAmount(value: string): boolean {
  const text = value.toLowerCase();
  if (/\d/.test(text)) {
    return true;
  }
  return /\b(a|an|one|two|three|four|half|pinch|dash|handful|to taste|some)\b/.test(text);
}

function normalizeRecipeOutputForValidation(
  output: OpenRouterRecipeOutput,
  analysis: FoodImageAnalysis,
): OpenRouterRecipeOutput {
  const stepTexts = (Array.isArray(output.steps) ? output.steps : []).map(getProviderStepText);
  const ingredients = addMissingWaterIngredient(normalizeProviderIngredientList(output.ingredients), stepTexts);

  return {
    ...output,
    ingredients,
    steps: (Array.isArray(output.steps) ? output.steps : []).map((rawStep) => normalizeProviderStepForValidation(
      rawStep,
      analysis,
      ingredients,
    )),
  };
}

function normalizeProviderStepForValidation(
  rawStep: OpenRouterRecipeOutput['steps'][number],
  analysis: FoodImageAnalysis,
  ingredients: string[],
): OpenRouterRecipeOutput['steps'][number] {
  if (typeof rawStep === 'string') {
    return correctPoultrySafetyTemperaturesInText(rawStep, analysis, ingredients);
  }

  const instruction = correctPoultrySafetyTemperaturesInText(getProviderStepText(rawStep), analysis, ingredients);
  const normalizedIngredients = Array.isArray(rawStep.ingredients)
    ? rawStep.ingredients.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  const stepIngredients = stepGenuinelyRequiresWater(instruction) &&
    !normalizedIngredients.some((value) => ingredientNameMatches(value, 'water'))
    ? [...normalizedIngredients, 'water']
    : normalizedIngredients;

  return {
    ...rawStep,
    step: rawStep.step ? instruction : rawStep.step,
    instruction: rawStep.instruction
      ? correctPoultrySafetyTemperaturesInText(rawStep.instruction, analysis, ingredients)
      : rawStep.instruction,
    text: rawStep.text
      ? correctPoultrySafetyTemperaturesInText(rawStep.text, analysis, ingredients)
      : rawStep.text,
    ingredients: stepIngredients,
    doneWhen: rawStep.doneWhen
      ? correctPoultrySafetyTemperaturesInText(rawStep.doneWhen, analysis, ingredients)
      : rawStep.doneWhen,
    safetyNote: rawStep.safetyNote
      ? correctPoultrySafetyTemperaturesInText(rawStep.safetyNote, analysis, ingredients)
      : rawStep.safetyNote,
  };
}

function getProviderStepText(rawStep: OpenRouterRecipeOutput['steps'][number] | undefined): string {
  if (typeof rawStep === 'string') {
    return rawStep;
  }
  if (!rawStep || typeof rawStep !== 'object') {
    return '';
  }
  return rawStep.step || rawStep.instruction || rawStep.text || '';
}

function getProviderStepSearchText(rawStep: OpenRouterRecipeOutput['steps'][number] | undefined): string {
  if (typeof rawStep === 'string') return rawStep;
  if (!rawStep || typeof rawStep !== 'object') return '';
  return [rawStep.title, getProviderStepText(rawStep)].filter(Boolean).join(' ');
}

function normalizeProviderIngredientList(ingredients: string[]): string[] {
  return ingredients
    .map((ingredient) => (typeof ingredient === 'string' ? ingredient.trim() : ''))
    .filter(Boolean);
}

function addMissingWaterIngredient(ingredients: string[], stepTexts: string[]): string[] {
  if (ingredients.some((ingredient) => ingredientNameMatches(ingredient, 'water'))) {
    return ingredients;
  }

  const waterIngredient = inferWaterIngredient(stepTexts);
  return waterIngredient ? [...ingredients, waterIngredient] : ingredients;
}

function inferWaterIngredient(stepTexts: string[]): string | undefined {
  const text = stepTexts.join(' ');
  if (!containsIngredientMention(text.toLowerCase(), 'water')) {
    return undefined;
  }

  const quantified = text.match(
    /\b((?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞]|one|two|three|four|five|six|seven|eight|nine|ten|half|quarter|a)\s*(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|ml|milliliters?|l|liters?)?)\s+(?:cold\s+|warm\s+|hot\s+|boiling\s+)?(?:pasta\s+)?water\b/i,
  );
  if (quantified?.[1]) {
    return `${quantified[1].trim()} water`;
  }

  if (/\b(?:bring|boil|cook|simmer)\b[\s\S]*\bwater\b/i.test(text) ||
    /\bwater\b[\s\S]*\b(?:boil|simmer|cook|reserve)\b/i.test(text)) {
    return '8 cups water';
  }

  if (/\b(?:splash|loosen|thin)\b[\s\S]*\bwater\b/i.test(text) ||
    /\bwater\b[\s\S]*\b(?:loosen|thin)\b/i.test(text)) {
    return '2 tbsp water';
  }

  return undefined;
}

function stepGenuinelyRequiresWater(stepText: string): boolean {
  return containsIngredientMention(stepText.toLowerCase(), 'water') &&
    (/\b(?:bring|boil|cook|simmer|reserve|add|stir|splash|loosen|thin)\b[\s\S]*\bwater\b/i.test(stepText) ||
      /\bwater\b[\s\S]*\b(?:boil|simmer|cook|reserve|loosen|thin)\b/i.test(stepText));
}

function containsIngredientMention(text: string, ingredient: string): boolean {
  return new RegExp(`\\b${ingredient.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
}

function ingredientNameMatches(value: string, name: string): boolean {
  return containsIngredientMention(value.toLowerCase(), name);
}

function correctPoultrySafetyTemperaturesInText(
  text: string,
  analysis: FoodImageAnalysis,
  ingredients: string[],
): string {
  if (!isPoultryRecipe(analysis, ingredients) || !text.trim()) {
    return text;
  }
  return text.replace(/\b(\d{2,3})\s*°?\s*([fc])\b/gi, (match, rawValue: string, rawUnit: string, offset: number) => {
    if (!isUnsafePoultryTemperature(Number(rawValue), rawUnit) ||
      !isInternalTemperatureContext(text, offset)) {
      return match;
    }
    return rawUnit.toLowerCase() === 'f' ? '165°F' : '74°C';
  });
}

function hasUnsafePoultryTemperature(
  texts: string[],
  analysis: FoodImageAnalysis,
  ingredients: string[],
): boolean {
  if (!isPoultryRecipe(analysis, ingredients)) {
    return false;
  }
  return texts.some((text) => {
    for (const match of text.matchAll(/\b(\d{2,3})\s*°?\s*([fc])\b/gi)) {
      if (isUnsafePoultryTemperature(Number(match[1]), match[2]) &&
        isInternalTemperatureContext(text, match.index ?? 0)) {
        return true;
      }
    }
    return false;
  });
}

function isPoultryRecipe(analysis: FoodImageAnalysis, ingredients: string[]): boolean {
  const text = `${analysis.dishName} ${analysis.broadDishCategory} ${ingredients.join(' ')}`.toLowerCase();
  return /\b(chicken|poultry|turkey|duck)\b/.test(text);
}

function isUnsafePoultryTemperature(value: number, unit: string): boolean {
  const normalizedUnit = unit.toLowerCase();
  if (normalizedUnit === 'f') return value >= 90 && value < 165;
  if (normalizedUnit === 'c') return value >= 45 && value < 74;
  return false;
}

function isInternalTemperatureContext(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 70), index);
  const after = text.slice(index, Math.min(text.length, index + 70));
  return /\b(?:internal|inside|thermometer|thickest part|center|centre|reaches?|temperature|cook(?:ed)?\s+(?:to|until))\b/i.test(
    `${before} ${after}`,
  );
}

function getRecipeRepairPrompt(
  analysis: FoodImageAnalysis,
  badOutput: OpenRouterRecipeOutput,
  issues: string[],
): string {
  return [
    `Your previous recipe JSON for "${analysis.dishName}" had quality problems: ${issues.join(', ')}.`,
    'Rewrite it so a beginner can cook it with zero guessing. Return ONLY valid minified JSON, same single-recipe shape as before.',
    'Return exactly ONE recipe object: {"dishName":"...","title":"...", ...recipe fields..., "steps":[...]}. No modes, no variants, no "selectedMode".',
    'Fix every problem: NEVER write "the main ingredient" or "main ingredient" — name the actual food. Every ingredient must start with an exact amount and a real grocery name. Cooking steps should include grounded timing and a visual cue when they genuinely apply; prep, assembly, garnish, and serving steps must not invent durations. No "cook until done", "prepare the ingredients", "season to taste", or "mix everything".',
    'PHASE ORDER IS MANDATORY: Every step object MUST include "phase" (integer 1-6). Steps must be in phase order — 1 Preparation, 2 Setup, 3 Cooking, 4 Assembly, 5 Finishing, 6 Serving. Phase numbers must never decrease. Phase 6 Serving MUST be the final step and can NEVER appear before phase 3 Cooking.',
    `STEP CONTRACT IS MANDATORY: Every step object MUST include "stepNumber" (integer, starts at 1, strictly sequential, no gaps), "title" (2-4 word action phrase), "step" (a clear practical instruction; use 2–5 concise sentences for complex steps and shorter text for simple actions), "ingredients" (array of ingredient names used in this step — never empty), and "tools" (array of tool names used in this step — never empty, no duplicates). ${RICH_COOKING_INSTRUCTION_GUIDANCE}`,
    'Keep 6-12 ingredients and 8-14 steps (6-8 for drinks or salads).',
    `Food: ${JSON.stringify({
      dishName: analysis.dishName,
      cuisine: analysis.cuisine,
      broadDishCategory: analysis.broadDishCategory,
      visibleIngredients: analysis.visibleIngredients,
      likelyIngredients: analysis.likelyIngredients.slice(0, 8),
      visibleComponents: analysis.visibleComponents,
    })}`,
    `DISH ANATOMY CONTRACT: ${JSON.stringify(deriveDishContract(analysis, analysis.anatomy ?? deriveDishAnatomy(analysis)))}`,
    flavorPlanPrompt(analysis.flavorPlan ?? deriveFlavorPlan(analysis)),
    ...(analysis.mealDescription ? [`User meal description: ${JSON.stringify(analysis.mealDescription)}. Treat it as the source of truth for the dish concept; do not invent a different meal.`] : []),
  ].join('\n');
}

function getCombinedRecipeRepairPrompt(
  analysis: FoodImageAnalysis,
  badOutput: OpenRouterRecipeOutput,
  issues: string[],
  correction?: CorrectionGenerationContext,
): string {
  const correctionSection = getCorrectionPromptSection(correction);
  return [
    ...(correctionSection ? [correctionSection] : []),
    `Your previous recipe JSON for "${analysis.dishName}" still has these validation problems after deterministic cleanup: ${issues.join(', ')}.`,
    ...proofRepairGuidance(issues),
    'Return ONLY valid minified JSON. Return either a patch with the fields you are changing OR a complete recipe object. Do not return markdown or explanations.',
    'If you return ingredients or ingredientGroups, they must be complete valid replacements, not partial lists. Otherwise omit them so the original complete list can be preserved.',
    'Fix all structural and quality problems in this single response. There will be no second repair pass.',
    'Every ingredient must start with an exact amount and real grocery name. Preserve core visible/likely ingredients unless truly unsafe or impossible.',
    'Every step object must include stepNumber, phase, title, step, ingredients, and tools. stepNumber starts at 1 and is sequential. ingredients/tools cannot be empty.',
    'Every step sentence must include real ingredient names. Include a time or visible completion cue when it is grounded in the action; never invent timing for chopping, mixing, plating, garnish, or serving. Never write "cook until done", "season to taste", "prepare the ingredients", or "mix everything".',
    'Keep food safety strict: poultry internal temperature must be 165°F / 74°C, and do not weaken raw-fish or ingredient-closure requirements.',
    `Current recipe: ${JSON.stringify(badOutput)}`,
    `Food: ${JSON.stringify({
      dishName: analysis.dishName,
      cuisine: analysis.cuisine,
      broadDishCategory: analysis.broadDishCategory,
      visibleIngredients: analysis.visibleIngredients,
      likelyIngredients: analysis.likelyIngredients.slice(0, 8),
      visibleComponents: analysis.visibleComponents,
    })}`,
    `DISH ANATOMY CONTRACT: ${JSON.stringify(deriveDishContract(analysis, analysis.anatomy ?? deriveDishAnatomy(analysis)))}`,
    flavorPlanPrompt(analysis.flavorPlan ?? deriveFlavorPlan(analysis)),
    ...(correctionSection ? [correctionSection] : []),
  ].join('\n');
}

function getCorrectionPromptSection(correction: CorrectionGenerationContext | undefined): string {
  if (!correction) {
    return '';
  }

  const original = correction.originalRecipe;
  const originalSnapshot = {
    title: original.title,
    description: original.description,
    ingredients: original.ingredients.map((ingredient) =>
      `${ingredient.quantity} ${ingredient.name}`.trim()),
    nutritionEstimate: original.nutritionEstimate,
    servings: original.servings,
    prepTimeMinutes: original.prepTimeMinutes,
    cookTimeMinutes: original.cookTimeMinutes,
    totalTimeMinutes: original.totalTimeMinutes,
    equipment: original.equipment,
    substitutions: original.substitutions,
    spicePairings: original.spicePairings,
    pantryNote: original.pantryNote,
    storageAndReheating: original.storageAndReheating,
    steps: original.structuredSteps?.map((step) => ({
      title: step.title,
      instruction: step.text,
      ingredients: step.ingredientsUsed,
      tools: step.toolsUsed,
    })) ?? original.steps,
  };
  const previousCandidate = correction.previousCandidate
    ? {
        title: correction.previousCandidate.title,
        description: correction.previousCandidate.description,
        ingredients: correction.previousCandidate.ingredients.map((ingredient) =>
          `${ingredient.quantity} ${ingredient.name}`.trim()),
        nutritionEstimate: correction.previousCandidate.nutritionEstimate,
        servings: correction.previousCandidate.servings,
        prepTimeMinutes: correction.previousCandidate.prepTimeMinutes,
        cookTimeMinutes: correction.previousCandidate.cookTimeMinutes,
        totalTimeMinutes: correction.previousCandidate.totalTimeMinutes,
        equipment: correction.previousCandidate.equipment,
        steps: correction.previousCandidate.steps,
      }
    : undefined;
  const failedRequirementIndexes = new Set(
    (correction.missedValidationIssues ?? [])
      .map((issue) => issue.requirementIndex)
      .filter((index): index is number => index !== undefined),
  );
  const requirementStatus = correction.intents.map((intent, index) =>
    `Requirement ${index + 1} (${intent.type}): ${failedRequirementIndexes.has(index + 1) ? 'FAILED — repair this.' : 'PASSING/PRESERVE — do not regress.'}`,
  );

  return [
    'MANDATORY USER CORRECTION — this is a hard constraint, not a suggestion.',
    `Verbatim user instruction: ${JSON.stringify(correction.note)}`,
    `Normalized interpretation for classification only: ${JSON.stringify(correction.normalizedNote)}`,
    'Use the verbatim instruction as the source of truth; the normalized interpretation only clarifies likely intent and spelling.',
    `Parsed ordered requirements: ${correction.intents.map(
      (intent, index) => `${index + 1}. ${intent.type}`,
    ).join('; ')}.`,
    'ALL parsed requirements below are mandatory. A recipe that satisfies only some requirements is invalid:',
    ...(correction.forceCompleteRecipe
      ? [
          'FINAL CORRECTION FALLBACK: Return one complete canonical recipe JSON object. Do not return a patch, partial object, explanation, or metadata-only change.',
          'Regenerate from the original canonical recipe and the original user correction. Satisfy every failed requirement while preserving every requirement that already passed.',
          'Requirement status:',
          ...requirementStatus,
        ]
      : []),
    correction.forceCompleteRecipe
      ? 'Canonical recipe references for source context:'
      : 'Canonical patch references:',
    ...formatCorrectionRecipeReferences(correction.originalRecipe).slice(1),
    'Copy the current canonical recipe and change only what is needed to satisfy every normalized requirement. Preserve unrelated ingredients, steps, metadata, and prior successful edits.',
    'Update ingredients and cooking instructions only where the requested change makes them necessary. A generic step may remain unchanged when it is still accurate.',
    ...(correction.nutritionRequirements.length
      ? [
          'Exact calculated per-serving nutrition targets:',
          ...correction.nutritionRequirements.map(formatNutritionTargetForPrompt),
          'Meet every numeric target through context-appropriate ingredient or quantity changes and update every affected cooking step. Do not choose a fixed food from these instructions.',
          'Keep servings unchanged unless the verbatim user instruction explicitly requests a serving change.',
        ]
      : []),
    'The server computes the authoritative final diff and verifies the resulting recipe; provider explanations are not evidence.',
    ...correction.requirements.map((requirement, index) => `${index + 1}. ${requirement}`),
    ...(correction.missedRequirements?.length
      ? [
          'ONE FOCUSED REPAIR: The previous candidate missed only these mandatory requirements:',
          ...correction.missedRequirements.map((requirement) => `- ${requirement}`),
          ...(correction.missedValidationIssues?.length
            ? [
                'Exact server validation issues (these are authoritative; repair only these issues):',
                ...correction.missedValidationIssues.map((issue) => `- ${JSON.stringify(issue)}`),
              ]
            : []),
          ...(correction.previousRequirementEvaluations?.length
            ? [
                'Exact previous-candidate requirement results:',
                ...correction.previousRequirementEvaluations.map(
                  formatNutritionEvaluationForPrompt,
                ),
              ]
            : []),
          ...(correction.previousRequirementEvaluations?.some(
            (evaluation) =>
              evaluation.numericTargetPassed &&
              (!evaluation.ingredientEvidencePassed || !evaluation.stepEvidencePassed),
          )
            ? [
                'The listed numeric nutrition targets already pass. Preserve those passing macro values.',
                'Add a real, verifiable ingredient formulation or quantity change and reference that changed ingredient in the affected cooking steps.',
                'Do not return the same candidate unchanged.',
              ]
            : []),
          ...(correction.previousIngredientChanges?.length
            ? [
                'Detected ingredient changes in the rejected candidate:',
                ...correction.previousIngredientChanges.map((change) =>
                  `- ${change.kind}: ${change.normalizedBeforeName ?? '(none)'} -> ${change.normalizedAfterName ?? '(none)'}; step evidence ${change.referencedInSteps ? 'PASS' : 'FAIL'}.`),
              ]
            : []),
          ...(correction.previousPatch
            ? [
                'The previous structured patch was invalid. Correct only the failed operations:',
                `Previous patch: ${JSON.stringify(correction.previousPatch)}`,
                ...(correction.previousPatchIssues?.length
                  ? [`Patch issue codes: ${correction.previousPatchIssues.join(', ')}`]
                  : []),
              ]
            : []),
          'repair only those misses, preserve every already-satisfied requirement, and keep all other candidate fields unchanged.',
          'Use the previous candidate as the repair base.',
          'Use the original recipe only to confirm identity, earlier revisions, and fields that the correction never needed to change.',
          `Previous rejected candidate: ${JSON.stringify(previousCandidate)}`,
        ]
      : []),
    'Do not change unrelated ingredient quantities, servings, recipe identity, or cooking method.',
    `Original recipe to preserve except where required: ${JSON.stringify(originalSnapshot)}`,
  ].join('\n');
}

function formatNutritionTargetForPrompt(
  target: CorrectionGenerationContext['nutritionRequirements'][number],
): string {
  const unit = target.nutrient === 'calorie' ? 'kcal' : 'g';
  const comparison = target.direction === 'more'
    ? `at least ${formatPromptNumber(target.targetValue)} ${unit}`
    : `at most ${formatPromptNumber(target.targetValue)} ${unit}`;
  return [
    `- Requirement ${target.requirementIndex} (${target.nutrient}, ${target.direction}):`,
    `original ${formatPromptNumber(target.originalValue)} ${unit};`,
    `corrected value MUST be ${comparison}.`,
  ].join(' ');
}

function formatNutritionEvaluationForPrompt(
  evaluation: NonNullable<
    CorrectionGenerationContext['previousRequirementEvaluations']
  >[number],
): string {
  const unit = evaluation.nutrient === 'calorie' ? 'kcal' : 'g';
  const target = evaluation.direction === 'more'
    ? `at least ${formatPromptNumber(evaluation.targetValue)} ${unit}`
    : `at most ${formatPromptNumber(evaluation.targetValue)} ${unit}`;
  const candidateValue = evaluation.candidateValue === null
    ? 'missing'
    : `${formatPromptNumber(evaluation.candidateValue)} ${unit}`;
  const calorieFacts =
    evaluation.macroDerivedCalories === null ||
    evaluation.displayedCalories === null ||
    evaluation.calorieTolerance === null
      ? 'calorie facts unavailable'
      : [
          `displayed ${formatPromptNumber(evaluation.displayedCalories)} kcal`,
          `macro-derived ${formatPromptNumber(evaluation.macroDerivedCalories)} kcal`,
          `allowed difference ${formatPromptNumber(evaluation.calorieTolerance)} kcal`,
          `calorie consistency ${evaluation.calorieConsistencyPassed ? 'PASS' : 'FAIL'}`,
        ].join(', ');
  return [
    `- Requirement ${evaluation.requirementIndex} (${evaluation.nutrient}, ${evaluation.direction}):`,
    `candidate ${candidateValue}; required ${target}; numeric target ${evaluation.numericTargetPassed ? 'PASS' : 'FAIL'};`,
    `ingredient or quantity evidence ${evaluation.ingredientEvidencePassed ? 'PASS' : 'FAIL'};`,
    `step evidence ${evaluation.stepEvidencePassed ? 'PASS' : 'FAIL'};`,
    `servings stable ${evaluation.servingsStable ? 'PASS' : 'FAIL'};`,
    `${calorieFacts}.`,
  ].join(' ');
}

function formatPromptNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

async function callOpenRouterJson(input: {
  config: AiConfig;
  maxTokens: number;
  messages: OpenRouterMessage[];
  model: string;
  stage?: string;
}) {
  if (!input.config.openRouterApiKey) {
    throw createOpenRouterError(input.config, input.model, 'openrouter_missing_key', {
      openRouterErrorMessage: 'OpenRouter API key is missing.',
    });
  }

  recordOpenRouterCall(input.stage);

  logOpenRouterDebug('openrouter_call_start', {
    model: input.model,
    provider: input.config.provider,
    maxTokens: input.maxTokens,
    stage: input.stage ?? 'unknown',
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.config.timeoutMs);
  const startedAt = Date.now(); // [scan_timing] per-call latency

  try {
    const response = await fetch(openRouterEndpoint, {
      body: JSON.stringify({
        max_tokens: input.maxTokens,
        messages: input.messages,
        model: input.model,
        // Keep reasoning models from spending the whole budget thinking.
        // OpenRouter ignores this for models without reasoning support.
        // include_reasoning:false is the OpenRouter-native param (hides reasoning from content tokens).
        // reasoning:{enabled:false} is the OpenAI-format equivalent kept for provider compat.
        include_reasoning: false,
        reasoning: { enabled: false },
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
      headers: {
        Authorization: `Bearer ${input.config.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://okyo.local',
        'X-Title': 'Okyo',
      },
      method: 'POST',
      signal: controller.signal,
    });

    logOpenRouterDebug('api_openrouter_response_status', {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    });
    if (!response.ok) {
      const errorMessage = await getOpenRouterErrorMessage(response);
      console.error('openrouter_http_error', {
        model: input.model,
        stage: input.stage ?? 'unknown',
        status: response.status,
        message: errorMessage,
        durationMs: Date.now() - startedAt,
      });
      throw createOpenRouterError(input.config, input.model, 'openrouter_http_error', {
        httpStatus: response.status,
        openRouterErrorMessage: errorMessage,
      });
    }

    const responseJson = await parseResponseJson(response, input.config, input.model);
    const responseShape = getOpenRouterResponseShape(responseJson);
    const usage = getRecord(responseJson)?.usage;
    const promptTokens = typeof (usage as Record<string, unknown> | undefined)?.prompt_tokens === 'number'
      ? (usage as Record<string, unknown>).prompt_tokens as number : undefined;
    const completionTokens = typeof (usage as Record<string, unknown> | undefined)?.completion_tokens === 'number'
      ? (usage as Record<string, unknown>).completion_tokens as number : undefined;
    const totalTokens = typeof (usage as Record<string, unknown> | undefined)?.total_tokens === 'number'
      ? (usage as Record<string, unknown>).total_tokens as number : undefined;
    logOpenRouterDebug('openrouter_response_shape', responseShape);
    console.log('[token_usage]', {
      model: input.model,
      stage: input.stage ?? 'unknown',
      promptTokens,
      completionTokens,
      totalTokens,
      maxTokens: input.maxTokens,
      finishReason: responseShape.finishReason,
      durationMs: Date.now() - startedAt,
    });
    logOpenRouterDebug('openrouter_call_finish', {
      model: input.model,
      provider: input.config.provider,
      maxTokens: input.maxTokens,
      stage: input.stage ?? 'unknown',
      finishReason: responseShape.finishReason,
    });
    recordOpenRouterFinish(responseShape.finishReason);
    const assistantText = extractAssistantTextFromOpenRouterResponse(responseJson, input.config, input.model);
    logOpenRouterDebug('api_openrouter_response_text_preview', {
      length: assistantText.length,
      preview: assistantText.slice(0, 300),
    });
    return parseJsonContent(
      assistantText,
      input.config,
      input.model,
      responseShape.finishReason,
    );
  } catch (error) {
    if (error instanceof OpenRouterProviderError) {
      recordOpenRouterFailure(error);
      throw error;
    }

    if (isAbortError(error)) {
      throw createOpenRouterError(input.config, input.model, 'openrouter_timeout', {
        openRouterErrorMessage: 'OpenRouter request timed out.',
      });
    }

    if (error instanceof TypeError) {
      throw createOpenRouterError(input.config, input.model, 'openrouter_network_error', {
        openRouterErrorMessage: getSafeErrorMessage(error),
      });
    }

    throw createOpenRouterError(input.config, input.model, 'openrouter_unknown_error', {
      openRouterErrorMessage: getSafeErrorMessage(error),
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function askOkyoWithOpenRouter(input: {
  config: AiConfig;
  question: string;
  recipe: Recipe;
  currentStep?: RecipeStep;
  dietaryAllergies?: string[];
  dietaryRestrictions?: string[];
  dietaryDislikes?: string[];
  goalContext?: RecipeGenerationPreferences['goalContext'];
}): Promise<{ answer: string; suggestedCorrection?: string }> {
  const result = await callOpenRouterJson({
    config: input.config,
    maxTokens: Math.min(input.config.maxOutputTokens, 500),
    model: input.config.openRouterTextModel,
    stage: 'ask_okyo',
    messages: [
      {
        role: 'system',
        content: 'You are Okyo, a concise cooking assistant. Answer only from the supplied recipe and current step. Prioritize immediate food safety and observable cues. Never claim certainty about doneness from time alone. Return JSON only: {"answer":"2-4 short practical sentences","suggestedCorrection":"optional recipe edit instruction"}. Include suggestedCorrection only when the recipe itself should change.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          question: input.question,
          recipe: input.recipe,
          currentStep: input.currentStep,
          preferences: {
            dietaryAllergies: input.dietaryAllergies ?? [],
            dietaryRestrictions: input.dietaryRestrictions ?? [],
            dietaryDislikes: input.dietaryDislikes ?? [],
            goals: input.goalContext ?? {},
          },
        }),
      },
    ],
  });
  const parsed = z.object({ answer: z.string().trim().min(1).max(1200), suggestedCorrection: z.string().trim().max(300).optional() }).parse(result);
  return parsed.suggestedCorrection
    ? parsed
    : { answer: parsed.answer };
}

// ─── Model failover and backoff ───────────────────────────────────────────────

type CallJsonBase = {
  config: AiConfig;
  maxTokens: number;
  messages: OpenRouterMessage[];
  stage?: string;
};

function isFailoverError(error: unknown): boolean {
  if (!(error instanceof OpenRouterProviderError)) return false;
  const { reason, httpStatus } = error.failure;
  return reason === 'openrouter_timeout' ||
    reason === 'openrouter_network_error' ||
    (reason === 'openrouter_http_error' && [429, 402, 404, 503].includes(httpStatus ?? 0));
}

function isSafeCorrectionAutomaticRetry(error: OpenRouterProviderError): boolean {
  const { reason, httpStatus } = error.failure;
  if (
    reason === 'openrouter_timeout' ||
    reason === 'openrouter_network_error' ||
    reason === 'openrouter_empty_content' ||
    reason === 'openrouter_output_truncated' ||
    reason === 'openrouter_invalid_json' ||
    reason === 'openrouter_invalid_schema'
  ) {
    return true;
  }
  return reason === 'openrouter_http_error' && (
    httpStatus === 408 ||
    httpStatus === 429 ||
    (typeof httpStatus === 'number' && httpStatus >= 500)
  );
}

function isBackoffError(error: unknown): boolean {
  if (!(error instanceof OpenRouterProviderError)) return false;
  return error.failure.reason === 'openrouter_http_error' &&
    [429, 503].includes(error.failure.httpStatus ?? 0);
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenRouterJsonWithFailover(base: CallJsonBase, models: string[]): Promise<unknown> {
  const configuredModels = models.map((model) => model.trim()).filter(Boolean);
  if (configuredModels.length === 0) {
    throw createOpenRouterError(base.config, base.config.openRouterTextModel || 'configured-recipe-model', 'openrouter_invalid_schema', {
      openRouterErrorMessage: 'No configured recipe model is available for this request.',
    });
  }
  let lastError: unknown = createOpenRouterError(base.config, configuredModels[0], 'openrouter_unknown_error', {
    openRouterErrorMessage: 'Recipe provider did not return a response.',
  });
  let failoverCount = 0;
  for (let i = 0; i < configuredModels.length; i++) {
    if (base.stage !== 'vision' && getOpenRouterMetrics().providerCallCount >= 3) {
      throw lastError;
    }
    const model = configuredModels[i];
    logOpenRouterDebug('recipe_model_attempt', { model, attempt: i + 1, stage: base.stage });
    try {
      const result = await callOpenRouterJson({ ...base, model });
      if (i > 0) {
        logOpenRouterDebug('recipe_model_success', { model, attempt: i + 1, stage: base.stage });
      }
      console.log('[failover_summary]', {
        stage: base.stage,
        succeededAt: model,
        attemptNumber: i + 1,
        failoverCount,
      });
      return result;
    } catch (error) {
      lastError = error;
      failoverCount++;
      const info = error instanceof OpenRouterProviderError ? error.failure : null;
      logOpenRouterDebug('recipe_model_failed', {
        model, attempt: i + 1, stage: base.stage,
        reason: info?.reason ?? 'unknown',
        httpStatus: info?.httpStatus,
      });
      if (!isFailoverError(error)) throw error;
      if (i < configuredModels.length - 1) {
        logOpenRouterDebug('recipe_model_fallback', { from: model, to: configuredModels[i + 1], attempt: i + 2, stage: base.stage });
        if (isBackoffError(error)) {
          await waitMs(RECIPE_FAILOVER_DELAYS_MS[i] ?? RECIPE_FAILOVER_DELAYS_MS[RECIPE_FAILOVER_DELAYS_MS.length - 1]);
        }
      }
    }
  }
  throw lastError;
}

const visionJsonContract = '{"inputKind": "prepared_dish" | "raw_ingredients" | "not_food" | "unclear", "scanState": "clear_food" | "food_present_uncertain_dish" | "partial_food" | "not_food" | "too_unclear", "dishName": string, "possibleDishNames": string[], "broadDishCategory": string, "cuisine": string, "confidence": number, "isFoodImage": boolean, "isRestaurantMeal": boolean, "rejectionReason": string, "visibleIngredients": string[], "likelyIngredients": string[], "visibleComponents": {"protein": string, "sauce": string, "baseStarch": string, "vegetables": string, "toppingsGarnish": string, "cookingMethod": string}, "restaurantPriceEstimate": number, "homemadeCostEstimate": number, "confidenceReason": string}';

// Extends the base contract with inline Epicure fields. Used only in the primary vision
// call when Epicure is enabled — saves one sequential AI call (~8-12s) vs the old flow.
const visionJsonContractWithEpicure = '{"inputKind": "prepared_dish" | "raw_ingredients" | "not_food" | "unclear", "scanState": "clear_food" | "food_present_uncertain_dish" | "partial_food" | "not_food" | "too_unclear", "dishName": string, "possibleDishNames": string[], "broadDishCategory": string, "cuisine": string, "confidence": number, "isFoodImage": boolean, "isRestaurantMeal": boolean, "rejectionReason": string, "visibleIngredients": string[], "likelyIngredients": string[], "visibleComponents": {"protein": string, "sauce": string, "baseStarch": string, "vegetables": string, "toppingsGarnish": string, "cookingMethod": string}, "restaurantPriceEstimate": number, "homemadeCostEstimate": number, "confidenceReason": string, "epicureSuggestions": {"complementaryIngredients": string[], "healthySubstitutions": {"ingredient": "substitute"}, "budgetSubstitutions": {"ingredient": "substitute"}}}';

export function getVisionPrompt(image: ScanImageMetadata | undefined, mode: RecipeMode) {
  const epicureEnabled = isEpicureEnabled();
  const contract = epicureEnabled ? visionJsonContractWithEpicure : visionJsonContract;
  return [
    'Analyze this photo as a prepared or completed dish the user wants to recreate with Okyo.',
    'Return ONLY valid JSON in the assistant message content. Do not put JSON in reasoning. Do not return markdown. Do not explain.',
    'Return JSON only with exactly these fields:',
    contract,
    'First classify inputKind. prepared_dish means an assembled dish, plated meal, finished snack/dessert, or finished drink ready to eat or serve. raw_ingredients means loose ingredients, a grocery haul, pantry/fridge contents, or separate uncooked components with no prepared dish.',
    'For raw_ingredients, do not invent or suggest a meal. Set inputKind raw_ingredients, rejectionReason "Scan a prepared dish you would like to recreate.", and return the remaining contract fields conservatively.',
    'Drinks count as prepared dishes: smoothies, milkshakes, lattes, iced coffee, matcha, juices, lemonade, boba/bubble tea, and hot chocolate are valid results, as are soups, desserts, and pastries.',
    'When a prepared dish is visible, ignore table clutter, plates, utensils, hands, napkins, packaging, captions, UI chrome, and restaurant background unless they help identify it.',
    'Real restaurant photos are allowed to be messy: dim lighting, busy tables, multiple items, dark or charred food, shiny sauce, garnish, angled phone photos, partial plates, takeout containers, screenshots of food posts, hands, cups, napkins, menus, utensils, and cluttered backgrounds are normal.',
    'Ignore plates, utensils, table surfaces, cups, napkins, hands, menus, packaging, captions, UI chrome, and background unless they help identify the food. Focus on edible food.',
    'If multiple dishes or components are visible — platters, bento boxes, sushi boards, combo meals, tasting sets — enumerate EVERY distinct item in visibleIngredients. Do not collapse a platter into one dish name. List each component separately: "salmon nigiri", "tuna nigiri", "california roll", "spicy mayo", "pickled ginger", "wasabi", "edamame", etc. Prefer over-inclusion over under-inclusion.',
    'For sushi: detect each roll variety, each nigiri fish, each specialty roll, each sauce, each condiment, each garnish, and each side dish as a separate entry in visibleIngredients.',
    'If the exact dish is uncertain, identify a broad useful food category and give a lower-confidence best guess. Use broad category names instead of failure.',
    'Do not reject just because food is dark, charred, saucy, cluttered, garnished, partially visible, cropped, or photographed at an angle. Return lower confidence instead.',
    'dishName must be the MOST SPECIFIC name the image supports, built from what is visible. Examples: purple blended drink in a cup -> "Berry Smoothie"; green iced drink -> "Iced Matcha Latte"; creamy red-sauced pasta -> "Creamy Tomato Pasta"; burger with melted cheese -> "Cheeseburger"; bowl of rice with grilled chicken -> "Grilled Chicken Rice Bowl"; layered cake slice -> "Chocolate Cake".',
    'Generic names like "Mixed Restaurant Plate", "Restaurant Plate", "Food Plate", "Meal", "Dish", "Plate", "Bowl", "Drink", or "Unknown Dish" are WRONG whenever any specific food or drink is identifiable. Prefer a specific guess with lower confidence over a generic name. Only use a broad name like "Mixed Restaurant Plate" when the image truly shows several distinct meal components on one platter and no single dish dominates.',
    'The dishName must match the visible components. If the image shows a drink in a cup or glass (smoothie, latte, shake, juice), the dishName must say smoothie/latte/shake/juice — never call a drink a plate or bowl.',
    'Set broadDishCategory to one of: pizza, pasta/noodles, rice bowl, burger/sandwich, tacos/wrap, grilled meat, fried food, seafood, salad, soup/stew, dessert, breakfast item, drink/beverage, mixed platter, unknown food dish.',
    'Identify cuisine only when there are strong visual clues. Otherwise use "Homestyle".',
    'Use visibleComponents to describe visible protein, sauce, base/starch, vegetables, toppings/garnish, and cooking method. Empty string is okay when not visible. For platters, visibleComponents should describe the overall composition.',
    'visibleIngredients MUST list every distinct food item visible — individual roll types, proteins, sauces, condiments, garnishes, sides, and drinks. Each entry is one specific item with an estimated quantity when possible, e.g. "6 salmon nigiri", "8 california roll pieces", "1 tablespoon spicy mayo", "small mound pickled ginger". Minimum 5 entries for any platter. This is the complete inventory a cook needs to recreate the whole dish.',
    'Return a best-guess dishName even if the exact restaurant dish name is unknown. Build the name from visible components: descriptor + main item, like "Spicy Chicken Rice Bowl", "Creamy Tomato Rigatoni", "Loaded Cheeseburger", "Berry Smoothie", "Iced Matcha Latte", or "Grilled Salmon Plate". Do not invent exact menu names or brand names.',
    'When uncertain, include 2-4 possibleDishNames that are specific alternates of the same visible food, like ["Berry Smoothie", "Acai Smoothie", "Mixed Fruit Smoothie"] or ["Beef Burrito Bowl", "Chicken Rice Bowl", "Carnitas Bowl"]. Alternates must not be generic names.',
    'scanState rules: clear_food means food and dish are clear; food_present_uncertain_dish means food is clear but exact dish/cuisine is uncertain; partial_food means food is visible but partial/low-quality/ambiguous; not_food means clearly no food; too_unclear means too blurry/dark/blocked to identify food safely.',
    'Confidence score rules: 80-95 clear dish, 60-79 food clear but exact dish uncertain, 40-59 food visible but ambiguous or partial, below 40 retry/clarification needed. If food is visible and confidence is 40-79, keep isFoodImage true and use scanState food_present_uncertain_dish or partial_food.',
    'Reject when food is clearly absent, the image is too unclear, or the image shows only raw/loose ingredients rather than a prepared dish. Do not reject a prepared dish just because its exact name is uncertain.',
    'Only use not_food when no food or drink is visible. If food or a drink is visible, not_food is wrong.',
    'Only use too_unclear when food cannot reasonably be identified at all because the image is truly blurry, blocked, or unreadable. If food is visible but the exact dish is unclear, use partial_food or food_present_uncertain_dish instead.',
    'If the image is not food, set scanState not_food, isFoodImage false, isRestaurantMeal false, and rejectionReason to a short user-friendly reason.',
    'If the image is too blurry/dark/blocked to know whether food is visible, set scanState too_unclear, isFoodImage false, confidence below 40, and rejectionReason to ask for a clearer food photo.',
    'If food is visible but uncertain, do NOT say "could not recognize" or "failed"; provide a broad best guess with lower confidence instead of failure.',
    'confidence may be 0-100. Use lower confidence when the image is unclear, partial, or screenshot-like.',
    'restaurantPriceEstimate is a cautious estimate for a comparable prepared dish at a typical restaurant or takeout counter, not an exact live menu price. Base it on the visible dish, likely portion, ingredients, and preparation complexity. Use 0 only when no responsible estimate is possible.',
    'homemadeCostEstimate may be a cautious grocery-cost estimate for making a similar recipe at home.',
    'Use cautious estimates. Never present food identification, cost, or ingredients as exact.',
    'Do not give exact nutrition claims. Do not give unsafe cooking advice.',
    'If no actual image is available, return a cautious low-confidence result based only on metadata.',
    ...(epicureEnabled ? [
      'epicureSuggestions: return up to 5 complementaryIngredients (common accompaniments for this dish), up to 3 healthySubstitutions (healthier swap for a key ingredient, as {"original":"swap"}), and up to 3 budgetSubstitutions (cheaper swap, same format). Only include swaps that make sense for this specific dish.',
    ] : []),
    `Requested recipe mode: ${mode}.`,
    `Image metadata: ${JSON.stringify(getSafeImageMetadata(image))}`,
  ].join('\n');
}

function getCompactVisionRetryPrompt(image: ScanImageMetadata | undefined, mode: RecipeMode) {
  return [
    'Analyze this image for Okyo as a prepared dish the user wants to recreate.',
    'Return ONLY valid JSON. No markdown. No explanation.',
    'Use exactly this JSON shape:',
    visionJsonContract,
    'First classify inputKind. If the image contains only loose/raw ingredients, set raw_ingredients and do not invent a dish. If no food or drink is visible, use not_food. If too blurry or dark, use unclear and scanState too_unclear.',
    'If a prepared dish or finished drink is visible, give the most specific honest name supported by the image, with lower confidence if uncertain.',
    'Drinks must be named as drinks, such as smoothie, latte, shake, juice, boba, coffee, or matcha. Never call a drink a plate or bowl.',
    'Avoid generic names like Food Plate, Restaurant Plate, Meal, Dish, Bowl, Drink, or Unknown Dish when a more specific visible guess is possible.',
    'restaurantPriceEstimate is a cautious comparable prepared-dish estimate, not a live menu price. Use 0 only when no responsible estimate is possible.',
    `Requested recipe mode: ${mode}.`,
    `Image metadata: ${JSON.stringify(getSafeImageMetadata(image))}`,
  ].join('\n');
}

function getFocusedVisionRetryPrompt(
  image: ScanImageMetadata | undefined,
  mode: RecipeMode,
  firstOutput: z.infer<typeof openRouterVisionOutputSchema>,
) {
  const clues = [
    ...(firstOutput.visibleIngredients ?? []),
    ...(firstOutput.likelyIngredients ?? []),
    ...Object.values(firstOutput.visibleComponents ?? {}),
  ].filter((value) => typeof value === 'string' && value.trim()).slice(0, 8);

  return [
    'Look at this food or drink photo again. A previous analysis returned a name that was too generic to be useful.',
    `Previous guess: "${firstOutput.dishName ?? 'none'}". Visible clues from the previous pass: ${clues.join(', ') || 'none recorded'}.`,
    'Return ONLY valid JSON. No markdown. No explanations. Use exactly these fields:',
    visionJsonContract,
    'Name the MOST SPECIFIC dish or drink the image supports, built from visible components: descriptor + main item, like "Berry Smoothie", "Iced Matcha Latte", "Creamy Tomato Pasta", "Cheeseburger", "Grilled Chicken Rice Bowl", or "Chocolate Cake".',
    'If the image shows a drink in a cup or glass (smoothie, milkshake, latte, iced coffee, juice, boba), the dishName MUST say so. Never call a drink a plate, bowl, or meal.',
    'Generic names like "Mixed Restaurant Plate", "Food Plate", "Meal", "Dish", "Plate", or "Bowl" are wrong when any specific food or drink is identifiable. Prefer a specific guess with lower confidence.',
    'Include 2-4 possibleDishNames that are specific alternates of the same visible food or drink.',
    'Stay honest: keep scanState accurate, lower confidence instead of inventing details, return only a cautious comparable prepared-dish estimate (never a claimed live menu price), and use not_food only when no food or drink is visible at all.',
    `Requested recipe mode: ${mode}.`,
    `Image metadata: ${JSON.stringify(getSafeImageMetadata(image))}`,
  ].join('\n');
}

const PLATTER_WORDS = ['platter', 'board', 'bento', 'sushi', 'dim sum', 'mezze', 'tapas', 'charcuterie', 'sampler', 'assortment', 'spread'];

function isPlatterAnalysis(analysis: FoodImageAnalysis): boolean {
  const text = `${analysis.dishName} ${analysis.broadDishCategory}`.toLowerCase();
  return analysis.broadDishCategory === 'mixed platter' ||
    PLATTER_WORDS.some((w) => text.includes(w)) ||
    (analysis.detectedComponents?.length ?? 0) >= 4;
}

function getRecipeEditPrompt(input: {
  currentRecipe: Recipe;
  editMessage: string;
  previousCandidate?: Recipe;
  retryReason?: string;
  dietaryAllergies?: string[];
  dietaryRestrictions?: string[];
  dietaryDislikes?: string[];
  goalContext?: RecipeGenerationPreferences['goalContext'];
}): string {
  const currentRecipe = getEditableRecipeSnapshot(input.currentRecipe);
  const previousCandidate = input.previousCandidate
    ? getEditableRecipeSnapshot(input.previousCandidate)
    : undefined;

  return [
    'Edit this recipe according to the user\'s request. Infer their intent naturally. Apply every requested change. Preserve everything that does not need to change.',
    `User\'s exact edit message: ${JSON.stringify(input.editMessage)}`,
    'Return the complete revised recipe. Apply all requested changes and preserve unrelated parts. Do not return a patch or persistent IDs.',
    buildPreferencesPromptSection({
      dietaryAllergies: input.dietaryAllergies,
      dietaryRestrictions: input.dietaryRestrictions,
      dietaryDislikes: input.dietaryDislikes,
      goalContext: input.goalContext,
    }),
    'Use this simple JSON shape: {"title":"Recipe title","description":"Short description","servings":2,"ingredients":["1 cup ingredient"],"equipment":["bowl"],"steps":[{"title":"Mix","step":"Mix for 5 minutes.","activeMinutes":5,"passiveMinutes":0,"elapsedMinutes":5}],"prepTime":"5 minutes","cookTime":"0 minutes","totalTime":"5 minutes","nutritionEstimate":{"calories":250,"proteinGrams":20,"carbohydratesGrams":25,"fatGrams":8}}.',
    'Unknown culinary terms are valid. When nutrition changes, change ingredients or quantities plausibly and update the estimate.',
    `Current complete recipe: ${JSON.stringify(currentRecipe)}`,
    ...(previousCandidate
      ? [
          `Previous revised recipe: ${JSON.stringify(previousCandidate)}`,
          `Why it needs one correction: ${JSON.stringify(input.retryReason ?? 'The previous revision did not clearly apply the requested edit.')}`,
          'Correct the previous revised recipe so it fully satisfies the user\'s request. Preserve every requested change it already applied.',
        ]
      : []),
  ].join('\n');
}

function getEditableRecipeSnapshot(recipe: Recipe) {
  return {
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    prepTimeMinutes: recipe.prepTimeMinutes,
    cookTimeMinutes: recipe.cookTimeMinutes,
    totalTimeMinutes: recipe.totalTimeMinutes,
    activeTimeMinutes: recipe.activeTimeMinutes,
    passiveTimeMinutes: recipe.passiveTimeMinutes,
    ingredients: recipe.ingredients.map((ingredient) => ({
      name: ingredient.name,
      quantity: ingredient.quantity,
    })),
    ingredientGroups: recipe.ingredientGroups,
    equipment: recipe.equipment,
    steps: recipe.structuredSteps?.length
      ? recipe.structuredSteps.map((step, index) => ({
          stepNumber: index + 1,
          phase: step.phase,
          title: step.title,
          step: step.text,
          ingredients: step.ingredientsUsed,
          tools: step.toolsUsed,
          activeMinutes: step.activeMinutes,
          passiveMinutes: step.passiveMinutes,
          elapsedMinutes: step.elapsedMinutes,
          timeEstimate: step.timeEstimate,
        }))
      : recipe.steps,
    substitutions: recipe.substitutions,
    pantryNote: recipe.pantryNote,
    storageAndReheating: recipe.storageAndReheating,
    spicePairings: recipe.spicePairings,
    cookingTerms: recipe.cookingTerms,
    nutritionEstimate: recipe.nutritionEstimate,
  };
}

function getRecipeEditOutputIssues(output: OpenRouterRecipeOutput): string[] {
  const issues: string[] = [];
  if (!output.title.trim()) issues.push('missing_title');
  if (!output.ingredients.some((ingredient) => ingredient.trim())) issues.push('missing_ingredients');
  if (!output.steps.some((step) => getProviderStepText(step).trim())) issues.push('missing_instructions');
  return issues;
}

function hasMeaningfulPreferences(preferences: RecipeGenerationPreferences | undefined): boolean {
  if (!preferences) return false;
  return Boolean(
    preferences.recipePriority ||
    preferences.cookingFrictionFollowUp ||
    preferences.dietaryAllergies?.length ||
    preferences.dietaryRestrictions?.length ||
    Boolean(preferences.goalContext?.primaryGoal) ||
    preferences.dietaryDislikes?.length,
  );
}

const RECIPE_PRIORITY_GUIDANCE: Record<string, string> = {
  spend_less: 'The user wants to spend less on food — favor cheaper, common ingredients over premium ones.',
  recreate_dishes: 'The user most values a faithful, practical reconstruction of the identified dish.',
  know_ingredients: 'The user most values a complete, clear ingredient list with usable amounts.',
  simpler_steps: 'The user most values straightforward instructions with each action easy to follow.',
  cook_faster_or_easier: 'The user wants to cook faster or easier — favor fewer steps and simpler technique.',
};

const FOLLOW_UP_GUIDANCE: Record<string, string> = {
  too_many_steps: 'Minimize step count specifically — combine steps where safe.',
  too_much_cleanup: 'Minimize dishes/cookware and cleanup — favor one-pan or one-pot approaches when it fits the dish.',
  too_much_time: 'Minimize total active + cook time — favor quicker cooking methods.',
};

// Builds the personalization block appended to the recipe-generation prompt.
// Allergies (Step 06: a distinct field) are stated as the highest-severity,
// medical-safety constraint; restrictions are a separate hard, non-negotiable
// recipe constraint (not framed as an allergy); dislikes are a soft
// preference the model may override only if there's no reasonable
// alternative. Never merged into one ambiguous list. Returns '' when there's
// nothing to say, so the base prompt is byte-identical to today's for
// requests without preferences.
function buildPreferencesPromptSection(preferences: RecipeGenerationPreferences | undefined): string {
  if (!hasMeaningfulPreferences(preferences)) {
    return '';
  }

  const lines: string[] = [];

  if (preferences?.dietaryRestrictions?.length) {
    lines.push(
      `HARD DIETARY RESTRICTION — SAFETY CRITICAL: the recipe MUST NOT include, or be cooked using equipment cross-contaminated with, any of: ${preferences.dietaryRestrictions.join(', ')}. This is a non-negotiable allergy/restriction constraint, not a preference. If the dish cannot be made safely, substitute ingredients rather than including a restricted one.`,
    );
  }

  if (preferences?.dietaryDislikes?.length) {
    lines.push(
      `Soft preference — avoid if reasonably possible: ${preferences.dietaryDislikes.join(', ')}. Only include one of these if there is no reasonable substitute for the dish to work.`,
    );
  }

  if (preferences?.recipePriority && RECIPE_PRIORITY_GUIDANCE[preferences.recipePriority]) {
    lines.push(RECIPE_PRIORITY_GUIDANCE[preferences.recipePriority]);
  }

  if (preferences?.cookingFrictionFollowUp && FOLLOW_UP_GUIDANCE[preferences.cookingFrictionFollowUp]) {
    lines.push(FOLLOW_UP_GUIDANCE[preferences.cookingFrictionFollowUp]);
  }

  if (preferences?.goalContext) {
    const context = preferences.goalContext;
    if (context.primaryGoal) lines.push(`Primary goal: ${context.primaryGoal.replace(/_/g, ' ')}.`);
    if (context.handsOnTimeMinutes) lines.push(`Prefer no more than about ${context.handsOnTimeMinutes} minutes of hands-on cooking.`);
    if (context.defaultServings) lines.push(`Default serving size: ${context.defaultServings}.`);
    if (context.cookingPriority) lines.push(`Cooking priority: ${context.cookingPriority.replace(/_/g, ' ')}.`);
    if (context.orderingFriction) lines.push(`The user commonly orders food because: ${context.orderingFriction.replace(/_/g, ' ')}. Solve for that friction when practical.`);
    if (context.healthPriorities?.length) lines.push(`Health priorities: ${context.healthPriorities.map((value) => value.replace(/_/g, ' ')).join(', ')}.`);
    if (context.trackingPreference) lines.push(`Nutrition detail preference: ${context.trackingPreference.replace(/_/g, ' ')}.`);
    if (context.nutritionTargets) lines.push(`Nutrition context: around ${context.nutritionTargets.calories} calories, ${context.nutritionTargets.proteinGrams}g protein, ${context.nutritionTargets.carbsGrams}g carbs, and ${context.nutritionTargets.fatGrams}g fat per day. Use this to suggest practical portions or swaps; do not make medical claims.`);
  }

  return lines.join(' ');
}

function getRecipePrompt(
  analysis: FoodImageAnalysis,
  enrichment: EnrichedRecipeContext | null = null,
  mode: RecipeMode = 'Normal',
  correction?: CorrectionGenerationContext,
  preferences?: RecipeGenerationPreferences,
) {
  const isUncertainFood = analysis.scanState === 'food_present_uncertain_dish' || analysis.scanState === 'partial_food';
  const isPlatter = isPlatterAnalysis(analysis);
  const isDrink = isDrinkAnalysisText([
    analysis.dishName,
    analysis.broadDishCategory,
    ...analysis.visibleIngredients,
    ...analysis.likelyIngredients,
  ].join(' '));

  // Optional Epicure section. Empty string when enrichment is null → the base
  // prompt is unchanged, preserving exact prior behavior.
  const epicureSection = buildEpicurePromptSection(enrichment, mode);

  // Explicit component list for platter prompts. Enumerating each detected component
  // eliminates the component-coverage repair call in the common case.
  const platterComponentNames = isPlatter
    ? (analysis.detectedComponents ?? []).map((c) => c.name).filter(Boolean).slice(0, 8)
    : [];
  const correctionSection = getCorrectionPromptSection(correction);
  const preferencesSection = buildPreferencesPromptSection(preferences);

  if (correction) {
    return [
      correctionSection,
      'PATCH-FIRST RESPONSE CONTRACT: Return exactly one JSON object with ingredientOperations, stepOperations, optional nutritionEstimate, and optional metadataPatch.',
      'ingredientOperations operations: add, remove, replace, change_quantity, or change_descriptor. Non-add operations require sourceIngredientId. Added results require a new stable id, name, and quantity. Each operation must include supportsRequirementIndexes.',
      'stepOperations operations: add, remove, or replace. Non-add operations require sourceStepId. Added/replaced results require text and ingredientReferences using the supplied or newly-added ingredient IDs.',
      'metadataPatch may update only fields required by the correction: title, description, prepTimeMinutes, cookTimeMinutes, totalTimeMinutes, servings, difficulty, estimatedHomemadeCost, equipment, substitutions, spicePairings, pantryNote, storageAndReheating.',
      'When an ingredient is removed or replaced, remove its stale references from steps, substitutions, spicePairings, notes, and other user-visible metadata.',
      'Return arrays even when empty. Return nutritionEstimate whenever ingredients or quantities materially change.',
      'Do not return complete recipe fields in this patch response. Do not return markdown or explanations.',
    ].join('\n');
  }

  return [
    ...(correctionSection ? [correctionSection] : []),
    `Create a compact homemade recipe JSON for "${analysis.dishName}".`,
    analysis.mealDescription
      ? 'The user description names the prepared dish they want to recreate. Treat it as a dish request, never as pantry inventory or a request to invent a meal from ingredients.'
      : 'Reconstruct the prepared dish identified in the photo. Do not optimize around assumed pantry, fridge, leftover, or ingredient inventory.',
    correction
      ? 'The mandatory user correction overrides conflicting scan assumptions. Preserve the original recipe everywhere the correction does not require a change.'
      : `The recipe MUST be a homemade version of "${analysis.dishName}" as scanned. Do not switch dishes or add alcohol.`,
    'Return ONLY valid minified JSON. No markdown, no prose, no reasoning, no extra text.',
    'Return exactly ONE recipe object starting with {. One recipe only — no modes, variants, or multiple recipes.',
    `Recipe fields: dishName, title, description, ingredients, equipment, steps, avoidMistake, substitutions, storageAndReheating, spicePairings, prepTime, cookTime, totalTime, servings, skillLevel, restaurantPriceEstimate, nutritionEstimate${correction ? ', appliedChanges' : ''}${isPlatter ? ', ingredientGroups' : ''}.`,
    'restaurantPriceEstimate: a cautious number for a comparable prepared dish at a restaurant or takeout counter, not a live menu price. Base it on the dish, portion, ingredients, and complexity; omit it if no responsible estimate is possible.',
    correction
      ? 'nutritionEstimate is REQUIRED. Use cautious numeric per-serving estimates: calories, proteinGrams, carbohydratesGrams, fatGrams, and optional fiberGrams.'
      : 'nutritionEstimate is optional. When included, use cautious numeric per-serving estimates: calories, proteinGrams, carbohydratesGrams, fatGrams, and optional fiberGrams. Omit it when the description does not support a reasonable estimate.',
    isPlatter
      ? platterComponentNames.length > 0
        ? `REQUIRED COMPONENTS — generate exactly one ingredientGroup per item listed (2-4 ingredients each with exact amounts): ${platterComponentNames.map((c, i) => `${i + 1}. ${c}`).join(', ')}. ingredientGroups shape: [{"component":"<name>","items":["2 cups rice",...]},...] Steps: 1-2 concise steps per component.`
        : 'ingredientGroups: [{component:"<name>",items:["exact amount ingredient",...]},...] — one per distinct visible component. Cover the main components with 8-16 ingredients and 8-12 concise steps total.'
      : 'Do NOT include ingredientGroups — omit it entirely.',
    'Limits: ingredient count MUST match complexity — plain/whole foods 1-4, simple snacks/assembly 3-7, full cooked dishes 8-16. Steps: 2-4 for plain whole foods (fruit, boiled egg, toast), 6-8 for assembly, 8-12 for full cooked dishes. Substitutions max 3, equipment max 5, spicePairings max 2. Drinks: 6-8 steps.',
    'BANNED WORDING (never use, anywhere): "main ingredient", standalone "protein"/"vegetables"/"sauce"/"seasoning"/"toppings", "cook until done", "prepare the ingredients", "mix everything", "season to taste" with no amount. Always name the actual food.',
    'PROTEIN REALISM: Never use "shark" for a fish-shaped or ambiguous fried item — use "white fish fillets". Use common grocery-store proteins (cod, tilapia, chicken, ground pork). Do not infer exotic animals from novelty-shaped food.',
    'MUSUBI FORMAT: Spam musubi = rectangular rice block + Spam slice on top + nori strip wrapped around the outside. It is NOT rolled sushi. Never create roll-slicing, bamboo mat, or "slice rolls" steps for musubi. Name it "Spam Musubi". Steps must follow: cook rice → season rice → sear Spam → make glaze → cut nori strips → shape rice blocks → assemble → serve. Max 8 steps.',
    'MANGO STICKY RICE FORMAT: Ingredients MUST be exactly: sticky rice (glutinous), ripe mangoes, coconut milk (ONE can only — never both coconut milk AND coconut cream as separate items), sugar, salt. Optional: sesame seeds or toasted coconut flakes. MAX 7 ingredients total. Never list "coconut sauce" AND "coconut cream" as separate ingredients — they are the same thing. Never list "ripe mangoes" AND "diced mango" — pick one. Steps: soak/rinse rice → steam rice → warm coconut milk + sugar + salt → fold sauce into rice → slice mango → plate and drizzle. Max 7 steps.',
    'COOKABLE NOT VISIBLE: Do not list only the visible toppings. Infer the hidden essentials needed to actually cook a believable home version — cooking oil/fat, salt, seasoning, sauce COMPONENTS (not just "sauce"), and aromatics. Every recipe must be cookable from the ingredient list alone. Dumplings/wontons need wrapper-or-frozen-base + filling-or-shortcut + aromatics + sauce. Pick ONE coherent strategy: either a from-scratch version (wrappers + filling) OR a shortcut version (e.g. frozen dumplings) — never mix both.',
    'NO DUPLICATE INGREDIENTS: Each ingredient concept appears exactly once. soy sauce appears once with the total quantity for the whole recipe. RICE SEASONING: use either "seasoned rice vinegar" (1 ingredient) OR separate rice vinegar + sugar + salt (3 ingredients) — never both strategies in the same recipe.',
    'STEP HYGIENE: Never create standalone steps titled "Combine Ingredients", "Heat Mixture", "Cool and Store", or "Gather Ingredients" — fold these into the adjacent cooking step. Storage notes belong in storageAndReheating, not in steps. Never duplicate a step or append the same timing/completion phrase to unrelated steps. Serving and garnish steps should not contain fake durations.',
    'SIMPLE FOODS: Plain fruit (watermelon cubes, berries, grapes, banana, sliced melon) = the fruit itself only. Do NOT add feta, mint, honey, nuts, granola, yogurt, dressing, or any chef addition unless clearly visible in the scan or named in the title. Watermelon cubes → ["4 cups watermelon, cubed"], optionally ["1 lime", "1/4 tsp Tajín or salt"]. Never create a salad from a plain fruit scan. Same rule for plain boiled eggs and plain toast.',
    'Ingredients: STRINGS ONLY — ["2 large eggs", "1 tbsp olive oil"]. Each element is a plain string starting with an exact amount. Never output ingredient objects.',
    'COOKING PHASES: 1=Prep, 2=Setup, 3=Cook, 4=Assembly, 5=Finish, 6=Serve. Phases MUST NOT decrease. Phase 6 = ONLY the final serve/plate action — garnish, fresh herbs, and cheese are phase 5.',
    'Steps shape: {"stepNumber":1,"phase":1,"title":"Sear Chicken","step":"Sear the chicken 3–4 minutes per side.","ingredients":["chicken","oil"],"tools":["skillet"],"lookFor":"Deep golden edges","doneWhen":"Center reaches 165°F/74°C","commonMistake":"Do not crowd the pan.","cookingTerm":{"term":"sear","meaning":"Brown food quickly over fairly high heat."}}',
    `Every step requires the core 6 keys: stepNumber, phase, title, step, ingredients, tools. stepNumber starts 1 and increments by 1. Cooking steps should also include lookFor and doneWhen when an observable cue is useful; include at most one high-relevance commonMistake or chefTip, and cookingTerm only for genuinely unfamiliar technique words. The step text must be concise but may use 2–5 sentences for complex actions, with exact actions, grounded timing or temperature, and visual or texture cues; do not invent timing for prep, assembly, garnish, or serving. ingredients/tools are non-empty arrays. ${RICH_COOKING_INSTRUCTION_GUIDANCE}`,
    'Never write vague steps. Say exactly what to do, the time, and a visual/textural cue.',
    isDrink
      ? 'DRINK: title must say smoothie/latte/shake/juice. Steps: measure, blend or brew, taste, adjust, pour, garnish. No oven, no meat temperatures.'
      : 'Meat and seafood: include safe internal temperature (165°F/74°C chicken, 160°F/71°C ground meat, 145°F/63°C pork/fish).',
    'Text limits: description 1-2 sentences (concise and direct, with no source-attribution claims). avoidMistake 1 sentence. storageAndReheating 1 sentence.',
    'ACCESSIBLE, ECONOMICAL, LOW-WASTE: Prefer ordinary grocery-store ingredients and common kitchen tools. Avoid expensive niche ingredients used only once unless essential to the dish. Reuse overlapping ingredients where sensible, and make garnish optional rather than required when it does not affect the dish.',
    isUncertainFood
      ? 'Scan uncertain — make a best-guess recipe based only on visible components.'
      : 'Scan is clear — keep the recipe wording honest and direct.',
    `Food: ${JSON.stringify({
      dishName: analysis.dishName,
      cuisine: analysis.cuisine,
      broadDishCategory: analysis.broadDishCategory,
      scanState: analysis.scanState,
      visibleIngredients: analysis.visibleIngredients,
      likelyIngredients: analysis.likelyIngredients.slice(0, 8),
      visibleComponents: analysis.visibleComponents,
    })}`,
    // Appended only when Epicure produced suggestions; otherwise absent entirely.
    ...(epicureSection ? [epicureSection] : []),
    ...(correctionSection ? [correctionSection] : []),
    // Appended only when the caller collected onboarding preferences; older
    // requests without them see a byte-identical prompt to before.
    ...(preferencesSection ? [preferencesSection] : []),
  ].join('\n');
}

function getCompactRecipeRetryPrompt(
  analysis: FoodImageAnalysis,
  correction?: CorrectionGenerationContext,
  schemaFailure?: string,
) {
  const correctionSection = getCorrectionPromptSection(correction);
  if (correction) {
    return [
      correctionSection,
      'PATCH-SCHEMA RETRY. Return only ingredientOperations, stepOperations, optional nutritionEstimate, and optional metadataPatch.',
      'Use only supplied source IDs or explicit new IDs for additions. Include supportsRequirementIndexes on ingredient operations.',
      'Do not return complete recipe fields, markdown, or explanations.',
      ...(schemaFailure ? [`Previous safe schema failure: ${schemaFailure.slice(0, 600)}`] : []),
      'Preserve unrelated recipe data and satisfy every required correction in this one patch.',
    ].join('\n');
  }
  return [
    ...(correctionSection ? [correctionSection] : []),
    'JSON only. No markdown. No explanations. Write real recipe text in every field; never output placeholder dots.',
    'Return ONE recipe object: {"dishName","title","description","ingredients","steps","prepTime","cookTime","totalTime","servings","skillLevel","restaurantPriceEstimate","avoidMistake","substitutions","storageAndReheating","spicePairings"}. restaurantPriceEstimate is a cautious comparable prepared-dish estimate, never a live menu price.',
    'ingredients: 6 strings, each an exact amount plus grocery name like "2 large eggs" or "1 cup all-purpose flour" — use real ingredients for this specific dish, not examples.',
    `steps: 6-8 step OBJECTS. Exact shape: {"stepNumber":1,"phase":3,"title":"Sear Chicken","step":"Detailed beginner-friendly instruction with exact action, grounded cue, and transition cue","ingredients":["names used in this step"],"tools":["tools used"]}. stepNumber starts 1, sequential. phase 1-6. ingredients/tools never empty. ${RICH_COOKING_INSTRUCTION_GUIDANCE}`,
    'spicePairings: up to 2 strings.',
    `Dish: ${analysis.dishName}. Visible: ${analysis.visibleIngredients.slice(0, 4).join(', ')}.`,
    ...(correctionSection ? [correctionSection] : []),
  ].join('\n');
}

function getRecipeStructureRepairPrompt(analysis: FoodImageAnalysis, issues: string[]): string {
  return [
    `Your previous recipe JSON for "${analysis.dishName}" had structural problems: ${issues.join(', ')}.`,
    'Return ONLY valid minified JSON — ONE recipe object, no modes or variants.',
    'The "steps" field MUST be an array of 8-14 step OBJECTS (6-8 for drinks or salads). Copy this exact step shape: {"stepNumber":1,"phase":1,"title":"Prep Onion","step":"Finely dice 1 medium onion on a cutting board into 5mm pieces.","ingredients":["onion"],"tools":["chef knife","cutting board"]}',
    `Every step object MUST include all 6 keys: "stepNumber" (integer — starts at 1, sequential, no gaps), "phase" (integer 1-6: 1=Prep,2=Setup,3=Cook,4=Assembly,5=Finish,6=Serve), "title" (2-4 word action phrase), "step" (a clear practical instruction with amount where relevant and an action-appropriate time, temperature, visual, or texture cue; use 2–5 concise sentences for complex steps), "ingredients" (non-empty array), "tools" (non-empty array). ${RICH_COOKING_INSTRUCTION_GUIDANCE}`,
    'Never output a step as a plain string. Never leave ingredients or tools empty. Keep ingredients specific and tools real.',
    `Food: ${JSON.stringify({
      dishName: analysis.dishName,
      cuisine: analysis.cuisine,
      broadDishCategory: analysis.broadDishCategory,
      visibleIngredients: analysis.visibleIngredients.slice(0, 5),
      likelyIngredients: analysis.likelyIngredients.slice(0, 5),
    })}`,
  ].join('\n');
}

async function parseResponseJson(response: Response, config: AiConfig, model: string) {
  try {
    return await response.json() as unknown;
  } catch (error) {
    // A request-timeout abort can fire mid-body-read and surface here. We keep the
    // 'invalid_json' reason on purpose so the existing fast compact-retry still
    // fires ('openrouter_timeout' is intentionally NOT retried — see retryReasons),
    // but we record the likely cause so telemetry isn't misleading: a too-slow
    // model reads as "body read aborted (likely timeout)", not "malformed JSON".
    const likelyTimeout = isAbortError(error);
    throw createOpenRouterError(config, model, 'openrouter_invalid_json', {
      httpStatus: response.status,
      openRouterErrorMessage: likelyTimeout
        ? 'OpenRouter response body read was aborted (likely request timeout).'
        : 'OpenRouter response body was not valid JSON.',
    });
  }
}

function parseJsonContent(
  content: string,
  config: AiConfig,
  model: string,
  finishReason: string | null | undefined,
) {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? findFirstJsonObject(trimmed) ?? trimmed;

  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    if (finishReason === 'length') {
      throw createOpenRouterError(config, model, 'openrouter_output_truncated', {
        openRouterErrorMessage: 'OpenRouter response was truncated before valid JSON completed.',
      });
    }

    throw createOpenRouterError(config, model, 'openrouter_invalid_json', {
      openRouterErrorMessage: 'OpenRouter message content did not contain valid JSON.',
    });
  }
}

function getSafeImageUrl(image: ScanImageMetadata | undefined) {
  if (!image || image.placeholder) {
    return undefined;
  }

  if (image.dataUrl?.startsWith('data:image/')) {
    return image.dataUrl;
  }

  if (image.uri?.startsWith('https://') || image.uri?.startsWith('http://')) {
    return image.uri;
  }

  return undefined;
}

function getSafeImageMetadata(image: ScanImageMetadata | undefined) {
  if (!image) {
    return null;
  }

  return {
    fileName: image.fileName,
    dataUrlSizeBytes: image.dataUrlSizeBytes,
    height: image.height,
    hasDataUrl: Boolean(image.dataUrl),
    mimeType: image.mimeType,
    placeholder: image.placeholder,
    source: image.source,
    conversionError: image.conversionError,
    uriKind: getSafeImageUrl(image) ? 'sendable' : image.uri ? 'local_or_private_uri_not_sent' : 'none',
    width: image.width,
  };
}

function extractAssistantTextFromOpenRouterResponse(response: unknown, config: AiConfig, model: string) {
  const shape = getOpenRouterResponseShape(response);
  logOpenRouterDebug('openrouter_assistant_content_shape', shape);

  const firstChoice = getFirstChoice(response);
  const message = getRecord(firstChoice?.message);
  const content = message?.content;

  if (typeof content === 'string' && content.trim()) {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content.map(extractTextBlock).filter(Boolean).join('\n').trim();
    if (text) {
      return text;
    }
  }

  // A length-cut response with no final content means the model spent the whole
  // budget reasoning. Its reasoning text is not a finished answer — treat as
  // truncated so the compact retry (or the honest failure path) takes over.
  if (shape.finishReason === 'length') {
    throw createOpenRouterError(config, model, 'openrouter_output_truncated', {
      openRouterErrorMessage: 'Model hit the token limit before returning final content.',
    });
  }

  const reasoning = message?.reasoning;
  if (typeof reasoning === 'string' && reasoning.trim()) {
    return reasoning;
  }

  const reasoningDetails = extractTextFromReasoningDetails(message?.reasoning_details);
  if (reasoningDetails) {
    return reasoningDetails;
  }

  const fallbackText = getFirstString(
    message?.text,
    message?.output_text,
    message?.content_text,
    firstChoice?.text,
    firstChoice?.output_text,
  );
  if (fallbackText) {
    return fallbackText;
  }

  throw createOpenRouterError(config, model, 'openrouter_empty_content', {
    openRouterErrorMessage: 'OpenRouter response did not include usable assistant text.',
  });
}

function getOpenRouterResponseShape(response: unknown) {
  const firstChoice = getFirstChoice(response);
  const message = getRecord(firstChoice?.message);
  const content = message?.content;
  const choices = getRecord(response)?.choices;
  const finishReasonRaw = firstChoice?.finish_reason ?? firstChoice?.finishReason;

  return {
    hasChoices: Array.isArray(choices),
    choiceCount: Array.isArray(choices) ? choices.length : 0,
    hasMessage: Boolean(message),
    contentType: getValueType(content),
    contentIsNull: content === null,
    hasReasoning: typeof message?.reasoning === 'string' && message.reasoning.length > 0,
    hasReasoningDetails: Boolean(message?.reasoning_details),
    finishReason: typeof finishReasonRaw === 'string' || finishReasonRaw === null ? finishReasonRaw : undefined,
  };
}

function getFirstChoice(response: unknown): SafeRecord | undefined {
  const choices = getRecord(response)?.choices;
  if (!Array.isArray(choices)) {
    return undefined;
  }

  return getRecord(choices[0]);
}

function extractTextBlock(value: unknown) {
  const block = getRecord(value);
  if (!block) {
    return undefined;
  }

  return getFirstString(block.text, block.content, block.output_text);
}

function extractTextFromReasoningDetails(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const text = value.map((item) => {
    if (typeof item === 'string') {
      return item;
    }

    const block = getRecord(item);
    return block ? getFirstString(block.text, block.content, block.summary, block.output_text) : undefined;
  }).filter(Boolean).join('\n').trim();

  return text || undefined;
}

function getFirstString(...values: unknown[]) {
  const text = values.find((value) => typeof value === 'string' && value.trim());
  return typeof text === 'string' ? text : undefined;
}

function getRecord(value: unknown): SafeRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as SafeRecord : undefined;
}

function getValueType(value: unknown) {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === null) {
    return 'null';
  }

  return typeof value;
}

function createOpenRouterError(
  config: AiConfig,
  model: string,
  reason: OpenRouterFailureReason,
  details: Pick<OpenRouterFailureInfo, 'httpStatus' | 'openRouterErrorMessage'> = {},
) {
  return new OpenRouterProviderError({
    reason,
    aiEnabled: config.enabled,
    hasOpenRouterKey: Boolean(config.openRouterApiKey),
    model,
    provider: config.provider,
    timeoutMs: config.timeoutMs,
    maxOutputTokens: config.maxOutputTokens,
    httpStatus: details.httpStatus,
    openRouterErrorMessage: sanitizeProviderMessage(details.openRouterErrorMessage),
  });
}

async function getOpenRouterErrorMessage(response: Response) {
  const body = await response.text();
  const trimmed = body.trim();
  if (!trimmed) {
    return `OpenRouter returned HTTP ${response.status}.`;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const message = getNestedErrorMessage(parsed);
    return message ?? `OpenRouter returned HTTP ${response.status}.`;
  } catch {
    return trimmed;
  }
}

function getNestedErrorMessage(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const directMessage = record.message;
  if (typeof directMessage === 'string') {
    return directMessage;
  }

  const error = record.error;
  if (error && typeof error === 'object') {
    return getNestedErrorMessage(error);
  }

  return undefined;
}

function findFirstJsonObject(value: string) {
  let depth = 0;
  let startIndex = -1;
  let isInString = false;
  let isEscaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (isInString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        isInString = false;
      }
      continue;
    }

    if (char === '"') {
      isInString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        startIndex = index;
      }
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        return value.slice(startIndex, index + 1);
      }
    }
  }

  return undefined;
}

function getSchemaErrorMessage(error: z.ZodError) {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ');
}

function sanitizeProviderMessage(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, 'data:image/[redacted];base64,[redacted]').slice(0, 600);
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return sanitizeProviderMessage(error.message);
  }

  return 'Unknown OpenRouter error.';
}

function logOpenRouterDebug(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(event, details);
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

// ─── Coaching Repair ──────────────────────────────────────────────────────────

const stepCoachingPatchSchema = z.object({
  steps: z.array(z.object({
    index: z.number(),
    decisionPoint: z.string().optional(),
    ifYes: z.string().optional(),
    ifNo: z.string().optional(),
    why: z.string().optional(),
    commonMistake: z.string().optional(),
    chefTip: z.string().optional(),
    commonQuestion: z.string().optional(),
    commonQuestionAnswer: z.string().optional(),
    lookFor: z.string().optional(),
    doneWhen: z.string().optional(),
  })),
});

export type StepCoachingPatch = z.infer<typeof stepCoachingPatchSchema>['steps'][number];

// Sends specific weak coaching fields back to the AI for targeted improvement.
// Caller identifies exactly which steps and fields need work; this function
// repairs only those, keeping the prompt small and the fixes precise.
export async function repairStepCoachingWithAI(input: {
  steps: RecipeStep[];
  weaknesses: { stepIndex: number; weakFields: string[] }[];
  dishName: string;
  config: AiConfig;
}): Promise<StepCoachingPatch[]> {
  const weakStepData = input.weaknesses.map(({ stepIndex, weakFields }) => {
    const step = input.steps[stepIndex];
    // Only include existing values that are actually set — null values waste tokens
    // and add noise. Primary recipes have none, so existing is omitted entirely.
    const existing: Record<string, string> = {};
    if (step.why || step.whyItMatters) existing.why = step.why || step.whyItMatters || '';
    if (step.chefTip) existing.chefTip = step.chefTip;
    if (step.commonQuestion) existing.commonQuestion = step.commonQuestion;
    if (step.decisionPoint) existing.decisionPoint = step.decisionPoint;
    if (step.lookFor) existing.lookFor = step.lookFor;
    if (step.doneWhen) existing.doneWhen = step.doneWhen;
    return {
      index: stepIndex,
      phase: step.phase ?? null,
      title: step.title ?? '',
      text: step.text.slice(0, 120),
      needs: weakFields,
      ...(Object.keys(existing).length > 0 ? { existing } : {}),
    };
  });

  const fieldRules = [
    '"why": one sentence naming the ingredient/technique and the specific outcome it achieves. Never "This step is important." or "For best results."',
    '"chefTip": one non-obvious technique sentence naming the actual ingredient. Never "Cook carefully." or "Watch the heat."',
    '"commonQuestion": a real beginner question at this exact step. Best: "Is this cooked?", "What should this look like?", "Can I use [substitute]?", "What if I don\'t have [tool]?". Only on cooking/timing steps.',
    '"commonQuestionAnswer": one direct answer. Required if commonQuestion is set.',
    '"decisionPoint": a yes/no observable check answerable by looking or tasting. MUST use visual vocab: color, texture, movement. "Is the bottom golden brown?", "Does the sauce coat a spoon?", "Are the onions translucent?" Only on Phase 3–5 steps.',
    '"ifYes": short direct action. "Flip now." "Reduce heat and add cream." Required if decisionPoint set.',
    '"ifNo": action + time. "Cook 1–2 more minutes, then check again." Required if decisionPoint set.',
    '"lookFor": ingredient + observable state (color/texture/movement/sound/temp). e.g. "Garlic turns golden and fragrant." or "Reads 165°F/74°C." Never vague: "looks done".',
    '"doneWhen": unambiguous completion signal — color/texture/physical test/temp. e.g. "No pink remains and juices run clear." or "Temp 165°F/74°C." Never time-only: "Cook 5 minutes."',
  ].join('\n');

  const prompt = [
    `Fix specific coaching gaps in a "${input.dishName}" recipe. Return ONLY valid JSON, no markdown.`,
    `Return: {"steps":[{"index":N,...only the fields listed in "needs" for that step...},...]}`,
    `Only return the ${weakStepData.length} steps listed. Return EVERY field listed in each step's "needs" array — never omit a requested field. Omit fields that are NOT in "needs".`,
    `Field rules:\n${fieldRules}`,
    `Steps to fix:\n${JSON.stringify(weakStepData)}`,
  ].join('\n');

  const maxTokens = Math.min(
    input.config.maxOutputTokens,
    Math.max(1000, input.weaknesses.reduce((t, w) => t + w.weakFields.length * 120, 0)),
  );

  const json = await callOpenRouterJsonWithFailover(
    {
      config: input.config,
      messages: [
        { role: 'system', content: 'You are Okyo, a recipe coaching assistant. Return ONLY valid JSON.' },
        { role: 'user', content: prompt },
      ],
      maxTokens,
      stage: 'coaching_repair',
    },
    getRecipeModelChain(input.config),
  );

  const output = stepCoachingPatchSchema.safeParse(json);
  if (!output.success) {
    throw createOpenRouterError(input.config, input.config.openRouterTextModel, 'openrouter_invalid_schema', {
      openRouterErrorMessage: getSchemaErrorMessage(output.error),
    });
  }
  return output.data.steps;
}

// ── Component coverage repair ─────────────────────────────────────────────────

const componentRepairOutputSchema = z.object({
  ingredientGroups: z.array(z.object({
    component: z.string().optional().default(''),
    items: z.array(z.string()).optional().default([]),
  })).optional().default([]),
  ingredients: z.array(z.string()).optional().default([]),
  steps: z.array(z.union([z.string(), recipeStepSchema])).optional().default([]),
});

export type ComponentRepairOutput = z.infer<typeof componentRepairOutputSchema>;

// Generates ingredient groups, ingredients, steps, and grocery items for platter
// components that the initial recipe generation omitted. Throws on AI failure so
// the caller can fall back to the original recipe gracefully.
export async function callComponentRepairWithOpenRouter(input: {
  analysis: FoodImageAnalysis;
  config: AiConfig;
  missingComponents: string[];
  existingIngredientGroups: Array<{ component: string; items: unknown[] }>;
}): Promise<ComponentRepairOutput> {
  const existing = input.existingIngredientGroups.map((g) => g.component).filter(Boolean).join(', ');
  const prompt = [
    `The recipe for "${input.analysis.dishName}" is missing these platter components: ${input.missingComponents.join(', ')}.`,
    `Already covered — DO NOT regenerate: ${existing || 'none'}.`,
    'For EACH missing component only, generate:',
    '• One ingredientGroups entry with 2–6 ingredients (each with exact amounts)',
    '• Flat ingredient strings for the ingredients array',
    '• 1–3 preparation step objects per component',
    'Return ONLY valid JSON: {"ingredientGroups":[{"component":"<name>","items":["<amt> <ing>",...]},...],"ingredients":["<amt> <ing>",...],"steps":[{"stepNumber":N,"title":"...","step":"...","ingredients":["..."],"tools":["..."]},...]}',
    'Never copy existing components. Name every ingredient specifically — never "main ingredient" or "protein".',
    `Context: ${JSON.stringify({ dish: input.analysis.dishName, cuisine: input.analysis.cuisine, missing: input.missingComponents })}`,
  ].join('\n');

  const json = await callOpenRouterJsonWithFailover(
    {
      config: input.config,
      messages: [
        {
          role: 'system',
          content: 'You are a professional chef assistant. Fill in missing platter recipe components. Return ONLY valid JSON. No markdown. No explanations.',
        },
        { role: 'user', content: prompt },
      ],
      maxTokens: Math.min(input.config.maxOutputTokens, 2400),
      stage: 'component_coverage_repair',
    },
    getRecipeModelChain(input.config),
  );

  const output = componentRepairOutputSchema.safeParse(json);
  if (!output.success) {
    throw createOpenRouterError(input.config, input.config.openRouterTextModel, 'openrouter_invalid_schema', {
      openRouterErrorMessage: getSchemaErrorMessage(output.error),
    });
  }
  return output.data;
}
