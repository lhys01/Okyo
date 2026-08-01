import type { Recipe, RecipeIngredient } from '../types.js';

export type CorrectionIntent =
  | { type: 'add_ingredient'; note: string; ingredient: string }
  | { type: 'abstract_ingredient_addition'; note: string; requestedQuality: string }
  | { type: 'remove_ingredient'; note: string; ingredient: string }
  | { type: 'replace_ingredient'; note: string; removeIngredient: string; addIngredient: string }
  | { type: 'correct_dish_identity'; note: string; removeIngredient: string; addIngredient: string }
  | { type: 'dietary_restriction'; note: string; restriction: string }
  | { type: 'quantity_adjustment'; note: string; ingredient: string; direction: 'more' | 'less' | 'double' }
  | { type: 'sensory_adjustment'; note: string; adjustment: string }
  | { type: 'nutrition_goal'; note: string; direction: 'more' | 'less'; nutrient: string }
  | { type: 'nutrition_constraint'; note: string; nutrient: string; targetMinimum?: number; targetMaximum?: number }
  | { type: 'cooking_method_adjustment'; note: string; method: string }
  | { type: 'servings_adjustment'; note: string; servings: number }
  | { type: 'servings_scale'; note: string; multiplier: number }
  | { type: 'time_constraint'; note: string; targetMaximumMinutes: number }
  | { type: 'cost_adjustment'; note: string; direction: 'cheaper' | 'more_premium' }
  | { type: 'cuisine_or_style'; note: string; target: string }
  | { type: 'equipment_constraint'; note: string; target: string }
  | { type: 'general'; note: string };

export type CorrectionRequirementPlan = {
  note: string;
  normalizedNote: string;
  requirements: CorrectionIntent[];
};

export type NutritionRequirementTarget = {
  requirementIndex: number;
  type: 'nutrition_goal';
  nutrient: SupportedNutritionTarget;
  direction: 'more' | 'less';
  originalValue: number;
  targetValue: number;
  targetMinimum?: number;
  targetMaximum?: number;
};

export type NutritionRequirementEvaluation = NutritionRequirementTarget & {
  candidateValue: number | null;
  numericTargetPassed: boolean;
  ingredientEvidencePassed: boolean;
  stepEvidencePassed: boolean;
  servingsStable: boolean;
  macroDerivedCalories: number | null;
  displayedCalories: number | null;
  calorieTolerance: number | null;
  calorieConsistencyPassed: boolean;
  issueCodes: string[];
};

export type CorrectionAppliedChangeManifest = {
  beforeIngredient?: string;
  afterIngredient?: string;
  reason?: string;
  supportsRequirementIndexes: number[];
  affectedStepIndexes: number[];
};

export type CorrectionIngredientOperation = {
  operation: 'add' | 'remove' | 'replace' | 'change_quantity' | 'change_descriptor';
  sourceIngredientId?: string;
  result?: {
    id?: string;
    name?: string;
    quantity?: string;
    pantryItem?: boolean;
  };
  supportsRequirementIndexes: number[];
};

export type CorrectionStepOperation = {
  operation: 'add' | 'remove' | 'replace';
  sourceStepId?: string;
  result?: {
    id?: string;
    title?: string;
    text?: string;
    ingredientReferences?: string[];
  };
  text?: string;
  title?: string;
  ingredientReferences?: string[];
};

export type CorrectionMetadataPatch = {
  title?: string | null;
  description?: string | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  totalTimeMinutes?: number | null;
  servings?: number | null;
  difficulty?: Recipe['difficulty'] | null;
  estimatedHomemadeCost?: number | null;
  equipment?: string[] | null;
  substitutions?: string[] | null;
  spicePairings?: string[] | null;
  pantryNote?: string | null;
  storageAndReheating?: string | null;
};

export type CorrectionRecipePatch = {
  ingredientOperations: CorrectionIngredientOperation[];
  stepOperations: CorrectionStepOperation[];
  nutritionEstimate?: Recipe['nutritionEstimate'];
  metadataPatch?: CorrectionMetadataPatch;
};

export type IngredientChangeKind =
  | 'added'
  | 'removed'
  | 'quantity_changed'
  | 'substituted'
  | 'descriptor_changed';

export type IngredientChange = {
  kind: IngredientChangeKind;
  beforeName?: string;
  afterName?: string;
  normalizedBeforeName?: string;
  normalizedAfterName?: string;
  beforeQuantity?: string;
  afterQuantity?: string;
  affectedRequirementIndexes: number[];
  affectedStepIndexes: number[];
  referencedInSteps: boolean;
};

export type RejectedManifestChange = {
  normalizedBeforeName?: string;
  normalizedAfterName?: string;
  reasonCode:
    | 'manifest_change_not_found'
    | 'manifest_requirement_index_invalid'
    | 'manifest_step_index_invalid'
    | 'manifest_step_reference_missing';
};

export type IngredientChangeAnalysis = {
  changes: IngredientChange[];
  manifestIssues: string[];
  rejectedManifestChanges: RejectedManifestChange[];
};

export type CorrectionGenerationContext = {
  note: string;
  normalizedNote: string;
  intent: CorrectionIntent;
  intents: CorrectionIntent[];
  requirements: string[];
  nutritionRequirements: NutritionRequirementTarget[];
  originalRecipe: Recipe;
  missedRequirements?: string[];
  missedValidationIssues?: CorrectionValidationIssue[];
  previousCandidate?: Recipe;
  previousRequirementEvaluations?: NutritionRequirementEvaluation[];
  previousIngredientChanges?: IngredientChange[];
  previousPatch?: CorrectionRecipePatch;
  previousPatchIssues?: string[];
  forceCompleteRecipe?: boolean;
};

export type CorrectionValidationIssue = {
  code: string;
  message: string;
  requirementIndex?: number;
  ingredientIndex?: number;
  stepIndex?: number;
  details?: Record<string, string | number | boolean | null>;
};

export type CorrectionCandidateAssessment = {
  recipe: Recipe;
  issues: string[];
  providerRequirementEvaluations: NutritionRequirementEvaluation[];
  finalRequirementEvaluations: NutritionRequirementEvaluation[];
  caloriesReconciled: boolean;
  providerDisplayedCalories: number | null;
  reconciledCalories?: number;
  ingredientChangeAnalysis: IngredientChangeAnalysis;
};

export class CorrectionValidationError extends Error {
  readonly issues: string[];
  readonly validationIssues: CorrectionValidationIssue[];

  constructor(issues: string[] | CorrectionValidationIssue[]) {
    super('The generated recipe did not satisfy the requested correction.');
    this.name = 'CorrectionValidationError';
    this.validationIssues = issues.map((issue) => typeof issue === 'string'
      ? { code: 'correction_validation_failed', message: issue }
      : issue);
    this.issues = this.validationIssues.map((issue) => issue.message);
  }
}

export class CorrectionRequestValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super('Tell Kiko what you would like to change.');
    this.name = 'CorrectionRequestValidationError';
    this.issues = issues;
  }
}

const identityStopWords = new Set([
  'a',
  'an',
  'and',
  'dish',
  'easy',
  'fresh',
  'home',
  'homemade',
  'recipe',
  'style',
  'the',
  'with',
]);
const abstractPlaceholderTerms = new Set([
  'addition',
  'ingredient',
  'item',
  'option',
  'something',
]);
const ingredientDescriptorTerms = new Set([
  'chopped',
  'cooked',
  'diced',
  'divided',
  'fresh',
  'grated',
  'ground',
  'large',
  'medium',
  'minced',
  'optional',
  'raw',
  'shredded',
  'sliced',
  'small',
  'thinly',
]);
const ingredientQuantityTerms = new Set([
  'cup',
  'g',
  'gram',
  'kg',
  'lb',
  'ml',
  'oz',
  'ounce',
  'package',
  'pound',
  'tbsp',
  'teaspoon',
  'tablespoon',
  'tsp',
]);
const qualityRequestStopWords = new Set([
  'add',
  'addition',
  'dish',
  'ingredient',
  'less',
  'make',
  'more',
  'recipe',
  'sauce',
  'something',
  'the',
]);
const generalRequestStopWords = new Set([
  ...qualityRequestStopWords,
  'anything',
  'change',
  'correct',
  'edit',
  'give',
  'have',
  'i',
  'in',
  'it',
  'my',
  'of',
  'please',
  'this',
  'to',
  'want',
]);
const abstractIngredientConcepts = new Set([
  'topping',
  'vegetable',
]);
const nutritionConcepts = new Set([
  'calorie',
  'carbohydrate',
  'fat',
  'fiber',
  'protein',
]);
const compoundCorrectionConcepts = new Set([
  'nut',
]);
const correctionConceptAliases: ReadonlyArray<readonly [canonical: string, aliases: readonly string[]]> = [
  ['protein', ['protein', 'proteins']],
  ['fiber', ['fiber', 'fibers', 'fibre', 'fibres']],
  ['carbohydrate', ['carbohydrate', 'carbohydrates', 'carb', 'carbs']],
  ['calorie', ['calorie', 'calories']],
  ['fat', ['fat', 'fats']],
  ['sodium', ['sodium']],
  ['salt', ['salt']],
  ['salty', ['salty', 'saltier']],
  ['sweet', ['sweet', 'sweeter']],
  ['spicy', ['spicy', 'spicier']],
  ['sour', ['sour', 'sourer']],
  ['acidic', ['acidic', 'acidity']],
  ['crunchy', ['crunch', 'crunchy', 'crunchier']],
  ['crispy', ['crisp', 'crispy', 'crispier']],
  ['creamy', ['creamy', 'creamier']],
  ['light', ['light']],
  ['lighter', ['lighter']],
  ['healthy', ['healthy', 'healthier']],
  ['dairy', ['dairy']],
  ['gluten', ['gluten']],
  ['vegetarian', ['vegetarian']],
  ['vegan', ['vegan']],
  ['vegetable', ['vegetable', 'vegetables']],
  ['nut', ['nut', 'nuts']],
];
const exactCorrectionConcepts = new Map(
  correctionConceptAliases.flatMap(([canonical, aliases]) =>
    aliases.map((alias) => [alias, canonical] as const)),
);

export function parseCorrectionRequirements(value: string): CorrectionRequirementPlan {
  const note = value.trim();
  const normalizedNote = normalizeCorrectionText(note);
  const clauses = splitCompoundCorrection(normalizedNote);
  const parsedRequirements = clauses
    .map((clause) => ({ clause, intent: parseSingleCorrectionIntent(clause, note) }))
    .filter(({ intent }, index, entries) =>
      entries.findIndex(({ intent: candidate }) =>
        candidate.type === intent.type &&
        getCorrectionTargetConcept(candidate) === getCorrectionTargetConcept(intent)) === index);
  const requirements = coalesceAdjacentReplacement(parsedRequirements);

  return {
    note,
    normalizedNote,
    requirements: requirements.length > 0
      ? requirements
      : [{ type: 'general', note }],
  };
}

export function isActionableCorrectionPlan(plan: CorrectionRequirementPlan): boolean {
  return plan.requirements.some((intent) => intent.type !== 'general' || hasMeaningfulGeneralCorrection(plan.note));
}

function hasMeaningfulGeneralCorrection(note: string): boolean {
  const terms = normalizeCorrectionText(note)
    .split(' ')
    .filter((term) => term.length > 2 && !generalRequestStopWords.has(term));
  return terms.length > 0;
}

export function parseCorrectionIntent(value: string): CorrectionIntent {
  return parseCorrectionRequirements(value).requirements[0];
}

export function getCorrectionPlanConflictIssues(
  requirements: CorrectionIntent[],
): CorrectionValidationIssue[] {
  const issues: CorrectionValidationIssue[] = [];
  const removed = requirements
    .filter((requirement): requirement is Extract<CorrectionIntent, { type: 'remove_ingredient' }> =>
      requirement.type === 'remove_ingredient')
    .map((requirement) => normalizeFoodText(requirement.ingredient));
  const added = requirements
    .filter((requirement): requirement is Extract<CorrectionIntent, { type: 'add_ingredient' }> =>
      requirement.type === 'add_ingredient')
    .map((requirement) => normalizeFoodText(requirement.ingredient));

  if (removed.some((target) => ['all ingredient', 'every ingredient', 'everything'].includes(target))) {
    issues.push({
      code: 'correction_unsatisfiable',
      message: 'A cookable recipe cannot remove every ingredient.',
    });
  }
  if (removed.some((target) => added.includes(target)) || requirements.some((requirement) =>
    requirement.type === 'replace_ingredient' &&
    normalizeFoodText(requirement.removeIngredient) === normalizeFoodText(requirement.addIngredient))) {
    issues.push({
      code: 'correction_conflict',
      message: 'The same concept cannot be both removed and required in one correction.',
    });
  }

  const explicitServings = new Set(requirements.flatMap((requirement) =>
    requirement.type === 'servings_adjustment' ? [requirement.servings] : []));
  if (explicitServings.size > 1) {
    issues.push({
      code: 'correction_conflict',
      message: 'The correction requests conflicting serving counts.',
    });
  }
  return issues;
}

function parseSingleCorrectionIntent(value: string, originalNote = value.trim()): CorrectionIntent {
  const note = originalNote;
  const normalizedNote = normalizeCorrectionText(value);
  let match = normalizedNote.match(/^(?:(?:this|it)\s+is|(?:these|those)\s+are)\s+(.+?)\s+not\s+(.+)$/);
  if (match) {
    return {
      type: 'correct_dish_identity',
      note,
      addIngredient: cleanCorrectionTarget(match[1]),
      removeIngredient: cleanCorrectionTarget(match[2]),
    };
  }

  match = normalizedNote.match(/^(?:change|correct)\s+(?:this|it|the dish)\s+from\s+(.+?)\s+to\s+(.+)$/);
  if (match) {
    return {
      type: 'correct_dish_identity',
      note,
      removeIngredient: cleanCorrectionTarget(match[1]),
      addIngredient: cleanCorrectionTarget(match[2]),
    };
  }

  const restriction = getDietaryRestriction(normalizedNote);
  if (restriction) {
    return {
      type: 'dietary_restriction',
      note,
      restriction,
    };
  }

  match = normalizedNote.match(/^([a-z]+\sfree|vegan|vegetarian)$/);
  if (match) {
    return {
      type: 'dietary_restriction',
      note,
      restriction: cleanCorrectionTarget(match[1]).replace(/\s+free$/i, '-free'),
    };
  }

  const naturalNutritionGoal = getNaturalLanguageNutritionGoal(normalizedNote);
  if (naturalNutritionGoal) {
    return {
      type: 'nutrition_goal',
      note,
      ...naturalNutritionGoal,
    };
  }

  match = normalizedNote.match(/^(?:(?:make|keep)\s+(?:it|this|the recipe)\s+)?(?:under|below|no more than|max(?:imum)?(?: of)?)\s+(\d+(?:\.\d+)?)\s+(calories?|kcal|grams?\s+(?:protein|fiber|fat|carbohydrates?|carbs?))$/);
  if (match) {
    return {
      type: 'nutrition_constraint',
      note,
      nutrient: normalizeNutritionConstraintTarget(match[2]),
      targetMaximum: Number(match[1]),
    };
  }

  match = normalizedNote.match(/^(?:(?:make|keep)\s+(?:it|this|the recipe)\s+)?(?:at least|minimum(?: of)?)\s+(\d+(?:\.\d+)?)\s+(grams?\s+(?:protein|fiber|fat|carbohydrates?|carbs?))$/);
  if (match) {
    return {
      type: 'nutrition_constraint',
      note,
      nutrient: normalizeNutritionConstraintTarget(match[2]),
      targetMinimum: Number(match[1]),
    };
  }

  match = normalizedNote.match(/^(?:make\s+(?:it|this|the recipe)\s+(?:take\s+)?|take\s+)?(?:under|within|no more than|max(?:imum)?(?: of)?)\s+(\d+)\s*(?:minutes?|mins?)$/);
  if (match) {
    return { type: 'time_constraint', note, targetMaximumMinutes: Number(match[1]) };
  }

  match = normalizedNote.match(/^(?:double|halve)\s+(?:the\s+)?(?:servings?|yield|batch)$/);
  if (match) {
    return { type: 'servings_scale', note, multiplier: normalizedNote.startsWith('double') ? 2 : 0.5 };
  }

  match = normalizedNote.match(/^(more|less|fewer|higher|lower)\s+(.+)$/);
  if (match) {
    const direction = /^(?:less|fewer|lower)$/.test(match[1]) ? 'less' : 'more';
    const target = cleanCorrectionTarget(match[2]);
    const nutritionGoal = getNutritionGoal(target, direction);
    if (nutritionGoal) {
      return {
        type: 'nutrition_goal',
        note,
        ...nutritionGoal,
      };
    }
    if (direction === 'more' && abstractIngredientConcepts.has(normalizeFoodText(target))) {
      return {
        type: 'abstract_ingredient_addition',
        note,
        requestedQuality: target,
      };
    }
    if (containsSensoryConcept(target)) {
      return {
        type: 'sensory_adjustment',
        note,
        adjustment: `${direction} ${target}`,
      };
    }
    return {
      type: 'quantity_adjustment',
      note,
      direction,
      ingredient: target,
    };
  }

  match = normalizedNote.match(/^(?:use)\s+(.+?)\s+instead\s+of\s+(.+)$/);
  if (match) {
    return {
      type: 'replace_ingredient',
      note,
      addIngredient: cleanCorrectionTarget(match[1]),
      removeIngredient: cleanCorrectionTarget(match[2]),
    };
  }

  match = normalizedNote.match(/^(?:replace|swap)\s+(.+?)\s+(?:with|for)\s+(.+)$/);
  if (match) {
    return {
      type: 'replace_ingredient',
      note,
      removeIngredient: cleanCorrectionTarget(match[1]),
      addIngredient: cleanCorrectionTarget(match[2]),
    };
  }

  match = normalizedNote.match(/^(?:double)\s+(?:the\s+)?(.+)$/);
  if (match) {
    return {
      type: 'quantity_adjustment',
      note,
      direction: 'double',
      ingredient: cleanCorrectionTarget(match[1]),
    };
  }

  match = normalizedNote.match(/^(?:add|use)\s+(more|less)\s+(.+)$/);
  if (match) {
    const direction = match[1].toLowerCase() as 'more' | 'less';
    const target = cleanCorrectionTarget(match[2]);
    const nutritionGoal = getNutritionGoal(target, direction);
    if (nutritionGoal) {
      return {
        type: 'nutrition_goal',
        note,
        ...nutritionGoal,
      };
    }
    if (direction === 'more' && abstractIngredientConcepts.has(normalizeFoodText(target))) {
      return {
        type: 'abstract_ingredient_addition',
        note,
        requestedQuality: target,
      };
    }
    if (!containsSensoryConcept(target)) {
      return {
        type: 'quantity_adjustment',
        note,
        direction,
        ingredient: target,
      };
    }
    return {
      type: 'sensory_adjustment',
      note,
      adjustment: `${direction} ${target}`,
    };
  }

  match = normalizedNote.match(/^(?:increase|reduce|decrease)\s+(?:the\s+)?(?:amount\s+of\s+)?(.+)$/);
  if (match) {
    return {
      type: 'quantity_adjustment',
      note,
      direction: /^increase/.test(normalizedNote) ? 'more' : 'less',
      ingredient: cleanCorrectionTarget(match[1]),
    };
  }

  match = normalizedNote.match(/^(?:there\s+(?:are|is)|it\s+has)\s+no\s+(.+)$/);
  if (match) {
    return {
      type: 'remove_ingredient',
      note,
      ingredient: cleanCorrectionTarget(match[1]),
    };
  }

  match = normalizedNote.match(/^(?:no|without)\s+(.+)$/);
  if (match) {
    return {
      type: 'remove_ingredient',
      note,
      ingredient: cleanRemovalTarget(match[1]),
    };
  }

  match = normalizedNote.match(/^not\s+(.+)$/);
  if (match && containsSensoryConcept(match[1])) {
    return {
      type: 'sensory_adjustment',
      note,
      adjustment: `not ${cleanCorrectionTarget(match[1])}`,
    };
  }

  match = normalizedNote.match(/^(?:use\s+)?(?:only\s+)?(?:one|1)\s+(.+)$/);
  if (match && /\b(?:pan|pot|bowl|sheet|skillet|appliance|tool)\b/.test(match[1])) {
    return { type: 'equipment_constraint', note, target: `one ${cleanCorrectionTarget(match[1])}` };
  }

  match = normalizedNote.match(/^(?:add|include)\s+(a|an|some|something)\s+(.+)$/);
  if (match) {
    return {
      type: 'abstract_ingredient_addition',
      note,
      requestedQuality: cleanAbstractAdditionTarget(match[1], match[2]),
    };
  }

  match = normalizedNote.match(/^(?:add|include)\s+(.+)$/);
  if (match) {
    return {
      type: 'add_ingredient',
      note,
      ingredient: cleanCorrectionTarget(match[1]),
    };
  }

  match = normalizedNote.match(/^use\s+(.+?)(?:\s+instead)?$/);
  if (match) {
    return {
      type: 'add_ingredient',
      note,
      ingredient: cleanCorrectionTarget(match[1]),
    };
  }

  match = normalizedNote.match(/^(?:remove|omit|exclude|leave\s+out)\s+(?:the\s+)?(.+)$/);
  if (match) {
    return {
      type: 'remove_ingredient',
      note,
      ingredient: cleanCorrectionTarget(match[1]),
    };
  }

  match = normalizedNote.match(/^(?:(?:make|scale|adjust)\s+(?:it|this|the recipe)?\s*(?:enough for|to serve|serves?)|serve)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s+(?:people|servings?|persons?))?$/);
  if (match) {
    return { type: 'servings_adjustment', note, servings: parseServingCount(match[1]) };
  }

  if (/^(?:make\s+(?:it|this|the recipe)\s+)?cheaper$/.test(normalizedNote)) {
    return { type: 'cost_adjustment', note, direction: 'cheaper' };
  }

  match = normalizedNote.match(/^(?:make\s+(?:it|this|the recipe)\s+(?:taste\s+)?more\s+|make\s+(?:it|this|the recipe)\s+)([a-z][a-z\s]+?)(?:\s+style)?$/);
  if (match && !containsSensoryConcept(match[1]) && !getNutritionGoal(match[1], 'more')) {
    return { type: 'cuisine_or_style', note, target: cleanCorrectionTarget(match[1]) };
  }

  match = normalizedNote.match(/^turn\s+(?:it|this|the recipe)\s+into\s+(.+)$/);
  if (match) {
    return { type: 'cuisine_or_style', note, target: cleanCorrectionTarget(match[1]) };
  }

  match = normalizedNote.match(/^(?:make)\s+(?:it|this|the recipe)\s+(.+)$/);
  if (match) {
    const adjustment = cleanCorrectionTarget(match[1]);
    const nutritionGoal = getNutritionGoal(adjustment, getAdjustmentDirection(adjustment));
    if (nutritionGoal) {
      return {
        type: 'nutrition_goal',
        note,
        ...nutritionGoal,
      };
    }
    if (containsSensoryConcept(adjustment)) {
      return {
        type: 'sensory_adjustment',
        note,
        adjustment,
      };
    }
    return { type: 'general', note };
  }

  match = normalizedNote.match(/^(?:make)\s+(.+?)\s+(more|less)\s+(.+)$/);
  if (match) {
    return {
      type: 'sensory_adjustment',
      note,
      adjustment: `${cleanCorrectionTarget(match[1])} ${match[2].toLowerCase()} ${cleanCorrectionTarget(match[3])}`,
    };
  }

  match = normalizedNote.match(/^(?:give|bring)\s+(?:it|this|the recipe)\s+(more|less)\s+(.+)$/);
  if (match) {
    return {
      type: 'sensory_adjustment',
      note,
      adjustment: `${match[1]} ${cleanCorrectionTarget(match[2])}`,
    };
  }

  match = normalizedNote.match(
    /^(?:change|switch)\s+(?:the\s+)?cooking\s+method\s+to\s+(.+)$|^(?:cook|prepare)\s+(?:it|this|the recipe)\s+(?:by|using|with)\s+(.+)$/,
  );
  if (match) {
    return {
      type: 'cooking_method_adjustment',
      note,
      method: cleanCorrectionTarget(match[1] ?? match[2]),
    };
  }

  if (containsSensoryConcept(normalizedNote)) {
    return {
      type: 'sensory_adjustment',
      note,
      adjustment: cleanCorrectionTarget(normalizedNote),
    };
  }

  return { type: 'general', note };
}

function coalesceAdjacentReplacement(
  requirements: Array<{ clause: string; intent: CorrectionIntent }>,
): CorrectionIntent[] {
  const result: CorrectionIntent[] = [];
  for (let index = 0; index < requirements.length; index += 1) {
    const current = requirements[index]?.intent;
    const nextEntry = requirements[index + 1];
    const next = nextEntry?.intent;
    if (current?.type === 'remove_ingredient' && next?.type === 'add_ingredient' &&
        /^use\b/.test(nextEntry.clause)) {
      result.push({
        type: 'replace_ingredient',
        note: current.note,
        removeIngredient: current.ingredient,
        addIngredient: next.ingredient,
      });
      index += 1;
      continue;
    }
    if (current) result.push(current);
  }
  return result;
}

function cleanRemovalTarget(value: string): string {
  return cleanCorrectionTarget(value)
    .replace(/\s+because\s+(?:of\s+)?(?:an?\s+)?(?:allergy|intolerance|restriction).*$/i, '')
    .trim();
}

function parseServingCount(value: string): number {
  const wordCounts: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  return wordCounts[value] ?? Number(value);
}

export function getMandatoryCorrectionRequirements(
  intent: CorrectionIntent,
  originalRecipe?: Recipe,
): string[] {
  switch (intent.type) {
    case 'add_ingredient':
      return [
        `Add ${intent.ingredient} with a clear quantity to ingredients.`,
        `Use ${intent.ingredient} explicitly in at least one preparation or cooking step.`,
        `Recalculate per-serving nutrition for the added ${intent.ingredient}.`,
        `Keep the original dish and preserve unrelated ingredients, quantities, and servings.`,
        `Acknowledge ${intent.ingredient} in the title or description when it materially changes the dish.`,
      ];
    case 'abstract_ingredient_addition':
      return [
        `Choose a context-appropriate concrete ingredient that makes the recipe ${intent.requestedQuality}.`,
        'Add the chosen ingredient with a clear quantity and name that same concrete ingredient in a relevant preparation or cooking step.',
        `Do not use ${JSON.stringify(intent.requestedQuality)} or the user's abstract request as a placeholder ingredient name.`,
        `Make the connection to ${intent.requestedQuality} clear in the description or affected instruction.`,
        'Update preparation time, cook time, total time, and equipment only when the concrete change affects them.',
        'Keep every existing ingredient, quantity, serving count, dish identity, and prior correction unless the requested addition requires increasing one existing ingredient.',
        'Recalculate per-serving nutrition when the concrete addition materially changes it.',
      ];
    case 'remove_ingredient':
      return [
        `Remove ${intent.ingredient} from ingredients.`,
        `Remove ${intent.ingredient} from every cooking, finishing, and optional garnish step.`,
        'Recalculate per-serving nutrition and preserve unrelated ingredients, quantities, and servings.',
      ];
    case 'replace_ingredient':
      return [
        `Replace ${intent.removeIngredient} with ${intent.addIngredient} in ingredients.`,
        `Use ${intent.addIngredient}, not ${intent.removeIngredient}, in every relevant step.`,
        'Recalculate per-serving nutrition and preserve unrelated ingredients, quantities, and servings.',
      ];
    case 'correct_dish_identity':
      return [
        `Correct the dish identity from ${intent.removeIngredient} to ${intent.addIngredient}.`,
        `Use ${intent.addIngredient} in the title, description, ingredients, and steps.`,
        `Remove ${intent.removeIngredient} from the title, description, ingredients, and steps.`,
        'Recalculate per-serving nutrition while retaining the recognizable preparation where appropriate.',
      ];
    case 'dietary_restriction':
      return [
        `Make the recipe ${intent.restriction}.`,
        `Remove or replace every ingredient and instruction that conflicts with ${intent.restriction}.`,
        `Acknowledge ${intent.restriction} in the title or description so the constraint is unambiguous.`,
        'Use only necessary substitutions and preserve unrelated ingredients, quantities, servings, and dish identity.',
        'Recalculate per-serving nutrition.',
      ];
    case 'quantity_adjustment':
      return [
        `${intent.direction === 'double' ? 'Double' : `Use ${intent.direction}`} ${intent.ingredient}.`,
        `Update the ingredient quantity and every affected step without changing unrelated ingredients or servings.`,
        'Recalculate per-serving nutrition.',
      ];
    case 'sensory_adjustment':
      return [
        `Make the recipe ${intent.adjustment}.`,
        'Change a relevant ingredient, ingredient quantity, or cooking instruction so the requested adjustment is real.',
        `Make the connection to ${intent.adjustment} clear in the description or affected instruction.`,
        'Preserve unrelated ingredients, servings, dish identity, and cooking method.',
        'Return complete ingredients, nutrition, times, equipment, and steps.',
      ];
    case 'nutrition_goal':
      {
        const policy = originalRecipe
          ? getNutritionTargetPolicy(originalRecipe, intent)
          : null;
      return [
        `Adjust the recipe for ${intent.direction} ${intent.nutrient}.`,
        ...(policy
          ? [
              policy.direction === 'more'
                ? `Increase estimated per-serving ${policy.nutrient} from ${formatNutritionValue(policy.currentValue, policy.nutrient)} to at least ${formatNutritionValue(policy.targetValue, policy.nutrient)}.`
                : `Reduce estimated per-serving ${policy.nutrient} from ${formatNutritionValue(policy.currentValue, policy.nutrient)} to no more than ${formatNutritionValue(policy.targetValue, policy.nutrient)}.`,
            ]
          : []),
        'Choose context-appropriate concrete ingredient and instruction changes based on the current recipe.',
        'Do not change only the macro numbers: update ingredients or quantities and every affected preparation step.',
        'Regenerate complete estimated per-serving nutrition and keep calories approximately consistent with protein, carbohydrates, and fat.',
        'Preserve unrelated ingredients, servings, dish identity, and cooking method.',
      ];
      }
    case 'nutrition_constraint': {
      const target = intent.targetMaximum === undefined
        ? `at least ${intent.targetMinimum} ${intent.nutrient}`
        : `no more than ${intent.targetMaximum} ${intent.nutrient}`;
      return [
        `Make the final per-serving nutrition ${target}.`,
        'Use coherent ingredient or quantity changes rather than editing nutrition metadata alone.',
        'Update affected instructions and preserve unrelated recipe content.',
      ];
    }
    case 'cooking_method_adjustment':
      return [
        `Use this cooking-method adjustment: ${intent.method}.`,
        'Update the affected instructions, equipment, and times so the requested method is genuinely used.',
        'Preserve the recipe identity, unrelated ingredients, quantities, servings, and prior corrections.',
        'Recalculate per-serving nutrition only when the method or required ingredient changes materially affect it.',
      ];
    case 'servings_adjustment':
      return [
        `Make the recipe yield ${intent.servings} servings.`,
        'Scale ingredient quantities and update instructions only where the quantities are explicitly mentioned.',
        'Preserve the dish identity and unrelated recipe data.',
      ];
    case 'servings_scale': {
      const targetServings = originalRecipe
        ? Math.max(1, Math.round(originalRecipe.servings * intent.multiplier))
        : undefined;
      return [
        targetServings
          ? `Make the recipe yield ${targetServings} servings.`
          : `Scale the recipe servings by ${intent.multiplier}.`,
        `Scale every measurable ingredient quantity by ${intent.multiplier}.`,
        'Update explicit quantities in instructions and preserve the dish identity.',
      ];
    }
    case 'time_constraint':
      return [
        `Make the reconciled total recipe time no more than ${intent.targetMaximumMinutes} minutes.`,
        'Adjust only the necessary method, preparation, equipment, and timing fields while keeping the recipe cookable.',
      ];
    case 'cost_adjustment':
      return [
        `Make the recipe ${intent.direction === 'cheaper' ? 'cheaper' : 'more premium'}.`,
        'Make at least one meaningful ingredient, quantity, or method change and keep the dish recognizable.',
      ];
    case 'cuisine_or_style':
      return [
        `Apply this cuisine or style direction: ${intent.target}.`,
        'Make a coherent ingredient, flavor, or method change that visibly supports the requested style.',
      ];
    case 'equipment_constraint':
      return [
        `Respect this equipment constraint: ${intent.target}.`,
        'Update equipment and affected instructions without making the recipe incomplete.',
      ];
    case 'general':
      return [
        `Apply this instruction exactly: ${JSON.stringify(intent.note)}.`,
        'Interpret the verbatim request semantically in the context of the latest recipe.',
        'Make a meaningful recipe change that is visibly relevant to the request; do not return a no-op or unrelated rewrite.',
        'Change only fields needed to satisfy the instruction and preserve the original dish, servings, unrelated ingredients, and prior corrections otherwise.',
        'Return complete ingredients, nutrition, servings, times, equipment, and steps.',
      ];
  }
}

export function getMandatoryCorrectionRequirementsForPlan(
  intents: CorrectionIntent[],
  originalRecipe?: Recipe,
): string[] {
  return intents.flatMap((intent, intentIndex) =>
    getMandatoryCorrectionRequirements(intent, originalRecipe).map(
      (requirement) =>
        `Requirement ${intentIndex + 1} (${intent.type}): ${requirement}`,
    ));
}

export function getCorrectionIngredientHints(
  ingredientNames: string[],
  intent: CorrectionIntent,
): string[] {
  const without = (concepts: string[]) =>
    ingredientNames.filter((ingredient) => !concepts.some((concept) => containsConcept(ingredient, concept)));

  switch (intent.type) {
    case 'add_ingredient':
      return [...without([intent.ingredient]), intent.ingredient];
    case 'abstract_ingredient_addition':
      return ingredientNames;
    case 'remove_ingredient':
      return without([intent.ingredient]);
    case 'replace_ingredient':
    case 'correct_dish_identity':
      return [...without([intent.removeIngredient, intent.addIngredient]), intent.addIngredient];
    case 'dietary_restriction':
    case 'quantity_adjustment':
    case 'sensory_adjustment':
    case 'nutrition_goal':
    case 'nutrition_constraint':
    case 'cooking_method_adjustment':
    case 'servings_adjustment':
    case 'servings_scale':
    case 'time_constraint':
    case 'cost_adjustment':
    case 'cuisine_or_style':
    case 'equipment_constraint':
    case 'general':
      return ingredientNames;
  }
}

export function getCorrectionIngredientHintsForPlan(
  ingredientNames: string[],
  intents: CorrectionIntent[],
): string[] {
  return intents.reduce(
    (currentIngredients, intent) =>
      getCorrectionIngredientHints(currentIngredients, intent),
    ingredientNames,
  );
}

export function getCorrectionDishName(
  originalTitle: string,
  intent: CorrectionIntent,
  override?: string,
): string {
  if (override?.trim()) {
    return override.trim();
  }
  if (intent.type !== 'correct_dish_identity') {
    return originalTitle;
  }

  const escaped = intent.removeIngredient.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const replaced = originalTitle.replace(new RegExp(`\\b${escaped}\\b`, 'i'), intent.addIngredient);
  return replaced === originalTitle
    ? `${intent.addIngredient} ${originalTitle}`.trim()
    : replaced;
}

export function validateCorrectedRecipe(
  original: Recipe,
  candidate: Recipe,
  intentOrIntents: CorrectionIntent | CorrectionIntent[],
  manifest: CorrectionAppliedChangeManifest[] = [],
): string[] {
  const validationIssues = validateCompleteCorrectedRecipe(candidate);
  const intents = Array.isArray(intentOrIntents)
    ? intentOrIntents
    : [intentOrIntents];
  const ingredientText = getIngredientText(candidate);
  const stepText = getStepText(candidate);
  const titleDescription = `${candidate.title} ${candidate.description}`;
  const completeText = `${titleDescription} ${ingredientText} ${stepText}`;
  const ingredientDelta = getIngredientDelta(original.ingredients, candidate.ingredients);
  const ingredientChangeAnalysis = analyzeIngredientChanges(
    original,
    candidate,
    intents,
    manifest,
  );
  const planAllowsIngredientRemoval = intents.some((intent) =>
    intent.type === 'remove_ingredient' ||
    intent.type === 'replace_ingredient' ||
    intent.type === 'correct_dish_identity' ||
    intent.type === 'dietary_restriction');
  const planAllowsServingChange = intents.some((intent) =>
    intent.type === 'servings_adjustment' || intent.type === 'servings_scale');
  const planIngredientChangeLimit = Math.max(2, intents.length * 2);

  if (
    !intents.some((intent) => intent.type === 'correct_dish_identity') &&
    !preservesOriginalDishIdentity(original, completeText, intents)
  ) {
    validationIssues.push('The corrected result no longer resembles the original dish.');
  }

  intents.forEach((intent, intentIndex) => {
    const issues: string[] = [];
    const dynamicRemovedConcepts = getRemovedConceptsFromOriginal(original, intent);

    switch (intent.type) {
    case 'add_ingredient': {
      if (!containsConcept(ingredientText, intent.ingredient)) {
        issues.push(`${intent.ingredient} is missing from ingredients.`);
      }
      if (!containsConcept(stepText, intent.ingredient)) {
        issues.push(`${intent.ingredient} is missing from the cooking steps.`);
      }
      if (
        hasMaterialNutritionChange(original, candidate) &&
        !containsConcept(titleDescription, intent.ingredient)
      ) {
        issues.push(`The title or description does not acknowledge ${intent.ingredient}.`);
      }
      if (!hasAnyNutritionChange(original, candidate)) {
        issues.push(`Nutrition was not recalculated for ${intent.ingredient}.`);
      }
      break;
    }
    case 'abstract_ingredient_addition': {
      const concreteChanges = [
        ...ingredientDelta.added,
        ...ingredientDelta.changed.map((change) => change.after),
      ].filter((ingredient) => isConcreteIngredientChoice(ingredient.name, intent.requestedQuality));
      if (concreteChanges.length === 0) {
        issues.push(`No concrete ingredient was added or meaningfully increased for ${intent.requestedQuality}.`);
      } else if (!concreteChanges.some((ingredient) => ingredientAppearsInSteps(ingredient.name, stepText))) {
        issues.push('The provider-selected concrete ingredient is missing from the cooking steps.');
      }
      if (!containsQualityConcept(`${titleDescription} ${stepText}`, intent.requestedQuality)) {
        issues.push(`The recipe does not connect the concrete change to ${intent.requestedQuality}.`);
      }
      if (ingredientDelta.removed.length > 0 && !planAllowsIngredientRemoval) {
        issues.push('Existing ingredients were removed for an additive request.');
      }
      if (ingredientDelta.changed.length > Math.max(1, intents.length)) {
        issues.push('Too many existing ingredient quantities changed for an additive request.');
      }
      if (!planAllowsServingChange && candidate.servings !== original.servings) {
        issues.push('Servings changed even though the additive request did not require it.');
      }
      break;
    }
    case 'remove_ingredient':
      if (dynamicRemovedConcepts.some((concept) => containsConcept(ingredientText, concept))) {
        issues.push(`${intent.ingredient} is still present in ingredients.`);
      }
      if (dynamicRemovedConcepts.some((concept) => containsConcept(stepText, concept))) {
        issues.push(`${intent.ingredient} is still present in cooking or garnish steps.`);
      }
      break;
    case 'replace_ingredient':
      if (!containsConcept(ingredientText, intent.addIngredient)) {
        issues.push(`${intent.addIngredient} is missing from ingredients.`);
      }
      if (!containsConcept(stepText, intent.addIngredient)) {
        issues.push(`${intent.addIngredient} is missing from the cooking steps.`);
      }
      if (dynamicRemovedConcepts.some((concept) => containsConcept(ingredientText, concept))) {
        issues.push(`${intent.removeIngredient} is still present in ingredients.`);
      }
      if (dynamicRemovedConcepts.some((concept) => containsConcept(stepText, concept))) {
        issues.push(`${intent.removeIngredient} is still present in the cooking steps.`);
      }
      if (!hasAnyNutritionChange(original, candidate)) {
        issues.push('Nutrition was not recalculated for the ingredient replacement.');
      }
      break;
    case 'correct_dish_identity':
      for (const [field, text] of [
        ['title', candidate.title],
        ['description', candidate.description],
        ['ingredients', ingredientText],
        ['steps', stepText],
      ] as const) {
        if (!containsConcept(text, intent.addIngredient)) {
          issues.push(`${intent.addIngredient} is missing from the corrected ${field}.`);
        }
        if (dynamicRemovedConcepts.some((concept) => containsConcept(text, concept))) {
          issues.push(`${intent.removeIngredient} is still present in the corrected ${field}.`);
        }
      }
      if (!hasAnyNutritionChange(original, candidate)) {
        issues.push('Nutrition was not recalculated for the corrected dish identity.');
      }
      break;
    case 'dietary_restriction': {
      if (!containsConcept(titleDescription, intent.restriction)) {
        issues.push(`The title or description does not acknowledge ${intent.restriction}.`);
      }
      if (
        ingredientDelta.added.length === 0 &&
        ingredientDelta.changed.length === 0 &&
        ingredientDelta.removed.length === 0
      ) {
        issues.push(`The ${intent.restriction} request did not change the ingredients.`);
      }
      if (!hasInstructionChange(original, candidate)) {
        issues.push(`The ${intent.restriction} request did not update the affected instructions.`);
      }
      if (hasAddedIngredientMissingFromSteps(ingredientDelta, stepText)) {
        issues.push(`A ${intent.restriction} replacement ingredient is missing from the affected instructions.`);
      }
      if (
        ingredientDelta.removed.length > Math.max(3, planIngredientChangeLimit) ||
        ingredientDelta.changed.length > Math.max(3, planIngredientChangeLimit)
      ) {
        issues.push(`The ${intent.restriction} request rewrote too many unrelated ingredients.`);
      }
      if (!planAllowsServingChange && candidate.servings !== original.servings) {
        issues.push('Servings changed even though the dietary request did not require it.');
      }
      break;
    }
    case 'quantity_adjustment': {
      if (normalizeFoodText(intent.ingredient) === 'protein') {
        if (!hasProteinNutritionChange(original, candidate, intent.direction === 'less' ? 'less' : 'more')) {
          issues.push(`Per-serving protein did not move ${intent.direction === 'less' ? 'down' : 'up'}.`);
        }
      } else {
        const originalIngredient = findMatchingIngredient(original.ingredients, intent.ingredient);
        const candidateIngredient = findMatchingIngredient(candidate.ingredients, intent.ingredient);
        if (!candidateIngredient) {
          issues.push(`${intent.ingredient} is missing from ingredients.`);
        } else if (
          originalIngredient &&
          normalizeQuantity(originalIngredient.quantity) === normalizeQuantity(candidateIngredient.quantity)
        ) {
          issues.push(`The quantity of ${intent.ingredient} did not change.`);
        }
        if (!hasAnyNutritionChange(original, candidate)) {
          issues.push('Nutrition was not recalculated for the quantity adjustment.');
        }
      }
      break;
    }
    case 'sensory_adjustment':
      if (!hasIngredientOrInstructionChange(original, candidate)) {
        issues.push(`The requested ${intent.adjustment} adjustment was not applied to ingredients or instructions.`);
      }
      if (!containsQualityConcept(`${titleDescription} ${stepText}`, intent.adjustment)) {
        issues.push(`The recipe does not demonstrate the requested ${intent.adjustment} outcome.`);
      }
      if (hasAddedIngredientMissingFromSteps(ingredientDelta, stepText)) {
        issues.push('An ingredient added for the sensory adjustment is missing from the affected instructions.');
      }
      if (ingredientDelta.removed.length > 0 && !planAllowsIngredientRemoval) {
        issues.push('Existing ingredients were removed for the requested sensory adjustment.');
      }
      if (ingredientDelta.changed.length > planIngredientChangeLimit) {
        issues.push('Too many existing ingredients changed for the requested sensory adjustment.');
      }
      if (!planAllowsServingChange && candidate.servings !== original.servings) {
        issues.push('Servings changed even though the sensory adjustment did not require it.');
      }
      break;
    case 'nutrition_goal': {
      const supportingChanges = ingredientChangeAnalysis.changes.filter((change) =>
        change.affectedRequirementIndexes.includes(intentIndex + 1));
      if (supportingChanges.length === 0) {
        issues.push(`The ${intent.nutrient} goal changed nutrition without changing ingredients or quantities.`);
      }
      if (
        supportingChanges.length > 0 &&
        supportingChanges.some((change) => !change.referencedInSteps)
      ) {
        issues.push(`The ${intent.nutrient} goal did not update affected cooking instructions.`);
      }
      if (!hasNutritionGoalChange(original, candidate, intent)) {
        issues.push(`Per-serving ${intent.nutrient} did not make the required meaningful change.`);
      }
      if (hasAddedIngredientMissingFromSteps(ingredientDelta, stepText)) {
        issues.push(`An ingredient added for the ${intent.nutrient} goal is missing from the affected instructions.`);
      }
      if (hasChangedIngredientMissingFromSteps(ingredientDelta, stepText)) {
        issues.push(`An ingredient quantity changed for the ${intent.nutrient} goal is missing from the affected instructions.`);
      }
      if (ingredientDelta.removed.length > planIngredientChangeLimit) {
        issues.push('Too many existing ingredients were removed for the requested nutrition goal.');
      }
      if (ingredientDelta.changed.length > planIngredientChangeLimit) {
        issues.push('Too many existing ingredients changed for the requested nutrition goal.');
      }
      if (!planAllowsServingChange && candidate.servings !== original.servings) {
        issues.push('Servings changed even though the nutrition goal did not require it.');
      }
      break;
    }
    case 'nutrition_constraint': {
      const value = getNutritionConstraintValue(candidate, intent.nutrient);
      if (value === null ||
          (intent.targetMinimum !== undefined && value < intent.targetMinimum) ||
          (intent.targetMaximum !== undefined && value > intent.targetMaximum)) {
        issues.push(`Per-serving ${intent.nutrient} does not meet the requested numeric target.`);
      }
      if (!hasIngredientOrInstructionChange(original, candidate)) {
        issues.push(`The ${intent.nutrient} target changed metadata without changing the recipe.`);
      }
      break;
    }
    case 'cooking_method_adjustment':
      if (!hasInstructionChange(original, candidate)) {
        issues.push('The requested cooking method did not change the cooking instructions.');
      }
      if (!containsMethodConcept(
        `${titleDescription} ${stepText} ${(candidate.equipment ?? []).join(' ')}`,
        intent.method,
      )) {
        issues.push(`The corrected recipe does not use the requested ${intent.method} method.`);
      }
      if (ingredientDelta.removed.length > 0 && !planAllowsIngredientRemoval) {
        issues.push('Existing ingredients were removed for the cooking-method adjustment.');
      }
      if (ingredientDelta.changed.length > planIngredientChangeLimit) {
        issues.push('Too many ingredient quantities changed for the cooking-method adjustment.');
      }
      if (!planAllowsServingChange && candidate.servings !== original.servings) {
        issues.push('Servings changed even though the cooking method did not require it.');
      }
      break;
    case 'servings_adjustment':
      if (candidate.servings !== intent.servings) {
        issues.push(`The recipe does not yield ${intent.servings} servings.`);
      }
      break;
    case 'servings_scale':
      if (candidate.servings !== Math.max(1, Math.round(original.servings * intent.multiplier))) {
        issues.push(`The recipe servings were not scaled by ${intent.multiplier}.`);
      }
      break;
    case 'time_constraint':
      if (!candidate.totalTimeMinutes || candidate.totalTimeMinutes > intent.targetMaximumMinutes) {
        issues.push(`The recipe exceeds ${intent.targetMaximumMinutes} minutes.`);
      }
      break;
    case 'cost_adjustment':
      if (intent.direction === 'cheaper'
        ? candidate.estimatedHomemadeCost >= original.estimatedHomemadeCost
        : candidate.estimatedHomemadeCost <= original.estimatedHomemadeCost) {
        issues.push('The requested cost adjustment was not applied.');
      }
      break;
    case 'cuisine_or_style':
      if (!hasMeaningfulRecipeChange(original, candidate) || !containsConcept(completeText, intent.target)) {
        issues.push(`The recipe does not demonstrate ${intent.target}.`);
      }
      break;
    case 'equipment_constraint':
      if (!containsConcept(`${(candidate.equipment ?? []).join(' ')} ${stepText}`, intent.target.replace(/^one\s+/, ''))) {
        issues.push(`The recipe does not respect ${intent.target}.`);
      }
      break;
    case 'general': {
      if (!hasMeaningfulRecipeChange(original, candidate)) {
        issues.push('The correction did not change the recipe.');
      } else if (!hasGeneralRequestEvidence(original, candidate, intent.note)) {
        issues.push('The recipe changed, but the result does not demonstrate the requested edit.');
      }
      if (ingredientDelta.removed.length > 2 || ingredientDelta.changed.length > 3) {
        issues.push('The general edit changed too many existing ingredients.');
      }
      if (hasAddedIngredientMissingFromSteps(ingredientDelta, stepText)) {
        issues.push('An ingredient added by the general edit is missing from the affected instructions.');
      }
      if (!planAllowsServingChange && !requestsServingChange(intent.note) && candidate.servings !== original.servings) {
        issues.push('Servings changed even though the correction did not request it.');
      }
      break;
    }
    }

    validationIssues.push(...issues.map((issue) =>
      intents.length > 1
        ? `Requirement ${intentIndex + 1} (${intent.type}): ${issue}`
        : issue));
  });

  validationIssues.push(...validateNutritionDeltaCoherence(original, candidate, ingredientDelta));
  validationIssues.push(...validateStepIngredientReferences(candidate));
  validationIssues.push(...validateUnrelatedRecipePreservation(original, candidate, intents));
  validationIssues.push(...ingredientChangeAnalysis.manifestIssues);
  return [...new Set(validationIssues)];
}

function validateCompleteCorrectedRecipe(recipe: Recipe): string[] {
  const issues: string[] = [];
  if (!recipe.title.trim()) issues.push('The corrected title is missing.');
  if (!recipe.description.trim()) issues.push('The corrected description is missing.');
  if (!recipe.ingredients.length) issues.push('Corrected ingredients are missing.');
  if (!recipe.steps.length || !recipe.structuredSteps?.length) issues.push('Corrected cooking steps are missing.');
  if (!recipe.equipment?.length) issues.push('Corrected equipment is missing.');
  if (!isFiniteNonnegative(recipe.prepTimeMinutes)) issues.push('Corrected prep time is invalid.');
  if (!isFiniteNonnegative(recipe.cookTimeMinutes)) issues.push('Corrected cook time is invalid.');
  if (!isFinitePositive(recipe.totalTimeMinutes)) issues.push('Corrected total time is invalid.');
  if (!isFinitePositive(recipe.servings)) issues.push('Corrected servings are invalid.');
  if (!hasFiniteNutrition(recipe)) {
    issues.push('Corrected per-serving nutrition is missing or invalid.');
  } else if (!isNutritionMacroConsistent(recipe)) {
    issues.push('Corrected calories conflict with the displayed macronutrients.');
  }
  return issues;
}

function validateUnrelatedRecipePreservation(
  original: Recipe,
  candidate: Recipe,
  intents: CorrectionIntent[],
): string[] {
  if (intents.some((intent) =>
    intent.type === 'general' ||
    intent.type === 'correct_dish_identity' ||
    intent.type === 'dietary_restriction' ||
    intent.type === 'abstract_ingredient_addition' ||
    intent.type === 'sensory_adjustment' ||
    intent.type === 'nutrition_goal' ||
    intent.type === 'nutrition_constraint' ||
    intent.type === 'cooking_method_adjustment' ||
    intent.type === 'servings_adjustment' ||
    intent.type === 'servings_scale' ||
    intent.type === 'time_constraint' ||
    intent.type === 'cost_adjustment' ||
    intent.type === 'cuisine_or_style' ||
    intent.type === 'equipment_constraint')) {
    return [];
  }

  const allowedToChange = intents.flatMap(getAllowedIngredientChanges);
  const issues: string[] = [];
  if (candidate.servings !== original.servings) {
    issues.push('Servings changed even though the correction did not require it.');
  }

  for (const originalIngredient of original.ingredients) {
    if (allowedToChange.some((concept) => containsConcept(originalIngredient.name, concept))) {
      continue;
    }
    const matchingCandidate = findMatchingIngredient(candidate.ingredients, originalIngredient.name);
    if (!matchingCandidate) {
      issues.push(`Unrelated ingredient ${originalIngredient.name} was removed.`);
      continue;
    }
    if (normalizeQuantity(matchingCandidate.quantity) !== normalizeQuantity(originalIngredient.quantity)) {
      issues.push(`Unrelated quantity for ${originalIngredient.name} changed.`);
    }
  }

  return issues;
}

function getAllowedIngredientChanges(intent: CorrectionIntent): string[] {
  switch (intent.type) {
    case 'remove_ingredient':
      return [intent.ingredient];
    case 'replace_ingredient':
    case 'correct_dish_identity':
      return [intent.removeIngredient, intent.addIngredient];
    case 'quantity_adjustment':
      return [intent.ingredient];
    case 'dietary_restriction':
    case 'abstract_ingredient_addition':
    case 'add_ingredient':
    case 'sensory_adjustment':
    case 'nutrition_goal':
    case 'nutrition_constraint':
    case 'cooking_method_adjustment':
    case 'servings_adjustment':
    case 'servings_scale':
    case 'time_constraint':
    case 'cost_adjustment':
    case 'cuisine_or_style':
    case 'equipment_constraint':
    case 'general':
      return [];
  }
}

function preservesOriginalDishIdentity(
  original: Recipe,
  candidateText: string,
  intents: CorrectionIntent[],
): boolean {
  const excludedConcepts = intents.flatMap(getAllowedIngredientChanges);
  const identityTerms = normalizeFoodText(original.title)
    .split(' ')
    .filter((term) => term.length > 2 && !identityStopWords.has(term))
    .filter((term) => !excludedConcepts.some((concept) => containsConcept(term, concept)));

  return identityTerms.length === 0 || identityTerms.some((term) => containsConcept(candidateText, term));
}

function hasFiniteNutrition(recipe: Recipe): boolean {
  const nutrition = recipe.nutritionEstimate;
  if (!nutrition) return false;
  const values = [
    nutrition.calories,
    nutrition.proteinGrams,
    nutrition.carbohydratesGrams,
    nutrition.fatGrams,
    nutrition.fiberGrams,
  ].filter((value): value is number => value !== undefined);
  return values.every(isFiniteNonnegative);
}

const CALORIE_MACRO_RELATIVE_TOLERANCE = 0.1;
const CALORIE_MACRO_ABSOLUTE_TOLERANCE = 20;

export function getEstimatedCaloriesFromMacros(recipe: Recipe): number | null {
  const nutrition = recipe.nutritionEstimate;
  if (!nutrition) return null;
  return (
    nutrition.proteinGrams * 4 +
    nutrition.carbohydratesGrams * 4 +
    nutrition.fatGrams * 9
  );
}

export function getCalorieMacroTolerance(estimatedCalories: number): number {
  return Math.max(
    CALORIE_MACRO_ABSOLUTE_TOLERANCE,
    Math.abs(estimatedCalories) * CALORIE_MACRO_RELATIVE_TOLERANCE,
  );
}

export function isNutritionMacroConsistent(recipe: Recipe): boolean {
  if (!hasFiniteNutrition(recipe)) return false;
  const estimatedCalories = getEstimatedCaloriesFromMacros(recipe);
  if (estimatedCalories === null) return false;
  return Math.abs(recipe.nutritionEstimate!.calories - estimatedCalories) <=
    getCalorieMacroTolerance(estimatedCalories);
}

function validateNutritionDeltaCoherence(
  original: Recipe,
  candidate: Recipe,
  ingredientDelta: IngredientDelta,
): string[] {
  if (
    !isNutritionMacroConsistent(original) ||
    !isNutritionMacroConsistent(candidate)
  ) {
    return [];
  }

  const originalMacroCalories = getEstimatedCaloriesFromMacros(original);
  const candidateMacroCalories = getEstimatedCaloriesFromMacros(candidate);
  if (originalMacroCalories === null || candidateMacroCalories === null) {
    return [];
  }

  const macroCalorieDelta = candidateMacroCalories - originalMacroCalories;
  const displayedCalorieDelta =
    candidate.nutritionEstimate!.calories -
    original.nutritionEstimate!.calories;
  const deltaTolerance = Math.max(
    CALORIE_MACRO_ABSOLUTE_TOLERANCE,
    Math.abs(macroCalorieDelta) * 0.2,
  );
  const issues: string[] = [];

  if (
    hasIngredientChange(ingredientDelta) &&
    Math.abs(macroCalorieDelta) >= CALORIE_MACRO_ABSOLUTE_TOLERANCE &&
    Math.abs(displayedCalorieDelta - macroCalorieDelta) > deltaTolerance
  ) {
    issues.push(
      'The before-and-after calorie change is not supported by the displayed macronutrient change.',
    );
  }

  return issues;
}

function validateStepIngredientReferences(recipe: Recipe): string[] {
  const ingredientNames = recipe.ingredients.map((ingredient) => ingredient.name);
  const missingReferences = new Set<string>();
  for (const step of recipe.structuredSteps ?? []) {
    for (const reference of step.ingredientsUsed ?? []) {
      if (
        reference.trim() &&
        !ingredientNames.some((ingredientName) =>
          ingredientNamesMatch(reference, ingredientName))
      ) {
        missingReferences.add(reference.trim());
      }
    }
  }

  return [...missingReferences].map(
    (reference) =>
      `Cooking instructions reference ${reference}, which is absent from the ingredient list.`,
  );
}

function hasProteinNutritionChange(
  original: Recipe,
  candidate: Recipe,
  direction: 'more' | 'less',
): boolean {
  const before = original.nutritionEstimate;
  const after = candidate.nutritionEstimate;
  if (!before || !after || before.calories === after.calories) return false;
  return direction === 'more'
    ? after.proteinGrams > before.proteinGrams
    : after.proteinGrams < before.proteinGrams;
}

function hasAnyNutritionChange(original: Recipe, candidate: Recipe): boolean {
  const before = original.nutritionEstimate;
  const after = candidate.nutritionEstimate;
  if (!before || !after) return false;
  return (
    before.calories !== after.calories ||
    before.proteinGrams !== after.proteinGrams ||
    before.carbohydratesGrams !== after.carbohydratesGrams ||
    before.fatGrams !== after.fatGrams ||
    before.fiberGrams !== after.fiberGrams
  );
}

function hasMeaningfulRecipeChange(original: Recipe, candidate: Recipe): boolean {
  return JSON.stringify({
    title: original.title,
    description: original.description,
    ingredients: original.ingredients,
    nutrition: original.nutritionEstimate,
    servings: original.servings,
    prep: original.prepTimeMinutes,
    cook: original.cookTimeMinutes,
    total: original.totalTimeMinutes,
    equipment: original.equipment,
    steps: original.steps,
  }) !== JSON.stringify({
    title: candidate.title,
    description: candidate.description,
    ingredients: candidate.ingredients,
    nutrition: candidate.nutritionEstimate,
    servings: candidate.servings,
    prep: candidate.prepTimeMinutes,
    cook: candidate.cookTimeMinutes,
    total: candidate.totalTimeMinutes,
    equipment: candidate.equipment,
    steps: candidate.steps,
  });
}

function hasIngredientOrInstructionChange(original: Recipe, candidate: Recipe): boolean {
  return JSON.stringify({
    ingredients: original.ingredients,
    steps: original.steps,
    structuredSteps: original.structuredSteps,
  }) !== JSON.stringify({
    ingredients: candidate.ingredients,
    steps: candidate.steps,
    structuredSteps: candidate.structuredSteps,
  });
}

function hasInstructionChange(original: Recipe, candidate: Recipe): boolean {
  return JSON.stringify({
    steps: original.steps,
    structuredSteps: original.structuredSteps,
  }) !== JSON.stringify({
    steps: candidate.steps,
    structuredSteps: candidate.structuredSteps,
  });
}

function hasGeneralRequestEvidence(original: Recipe, candidate: Recipe, note: string): boolean {
  const requestedTerms = normalizeCorrectionText(note)
    .split(' ')
    .filter((term) => term.length > 2 && !generalRequestStopWords.has(term))
    .map(getQualityStem)
    .filter(Boolean);
  if (requestedTerms.length === 0) {
    return hasMeaningfulRecipeChange(original, candidate);
  }

  const changedText = getChangedRecipeText(original, candidate);
  const changedTerms = new Set(
    normalizeFoodText(changedText)
      .split(' ')
      .map(getQualityStem)
      .filter(Boolean),
  );
  return requestedTerms.some((term) => changedTerms.has(term));
}

function getChangedRecipeText(original: Recipe, candidate: Recipe): string {
  const ingredientDelta = getIngredientDelta(original.ingredients, candidate.ingredients);
  const changedParts = [
    ...ingredientDelta.added.map((ingredient) => `${ingredient.quantity} ${ingredient.name}`),
    ...ingredientDelta.changed.flatMap(({ before, after }) => [
      `${before.quantity} ${before.name}`,
      `${after.quantity} ${after.name}`,
    ]),
    ...ingredientDelta.removed.map((ingredient) => ingredient.name),
  ];
  if (original.title !== candidate.title) changedParts.push(candidate.title);
  if (original.description !== candidate.description) changedParts.push(candidate.description);
  if (hasInstructionChange(original, candidate)) {
    changedParts.push(getStepText(candidate));
  }
  if (JSON.stringify(original.equipment) !== JSON.stringify(candidate.equipment)) {
    changedParts.push(...(candidate.equipment ?? []));
  }
  return changedParts.join(' ');
}

function hasMaterialNutritionChange(original: Recipe, candidate: Recipe): boolean {
  const before = original.nutritionEstimate;
  const after = candidate.nutritionEstimate;
  if (!before || !after) return true;

  return (
    Math.abs(after.calories - before.calories) >= 20 ||
    Math.abs(after.proteinGrams - before.proteinGrams) >= 2 ||
    Math.abs(after.carbohydratesGrams - before.carbohydratesGrams) >= 3 ||
    Math.abs(after.fatGrams - before.fatGrams) >= 2
  );
}

type RawIngredientChange = {
  kind: IngredientChangeKind;
  before?: RecipeIngredient;
  after?: RecipeIngredient;
};

type IngredientDelta = {
  added: RecipeIngredient[];
  changed: Array<{ before: RecipeIngredient; after: RecipeIngredient }>;
  removed: RecipeIngredient[];
  changes: RawIngredientChange[];
};

export function analyzeIngredientChanges(
  original: Recipe,
  candidate: Recipe,
  intents: CorrectionIntent[],
  manifest: CorrectionAppliedChangeManifest[] = [],
): IngredientChangeAnalysis {
  const rawChanges = detectRawIngredientChanges(
    original.ingredients,
    candidate.ingredients,
  );
  const nutritionRequirementIndexes = intents.flatMap((intent, index) =>
    intent.type === 'nutrition_goal' ? [index + 1] : []);
  const manifestIssues: string[] = [];
  const rejectedManifestChanges: RejectedManifestChange[] = [];
  const manifestMatches = new Map<number, Set<number>>();

  manifest.forEach((entry, manifestIndex) => {
    const matchedChangeIndex = rawChanges.findIndex((change) =>
      manifestIngredientMatches(entry.beforeIngredient, change.before?.name) &&
      manifestIngredientMatches(entry.afterIngredient, change.after?.name));
    if (matchedChangeIndex < 0) {
      rejectManifestChange(
        entry,
        'manifest_change_not_found',
        manifestIssues,
        rejectedManifestChanges,
      );
      return;
    }

    const invalidRequirementIndex = entry.supportsRequirementIndexes.some(
      (index) => !Number.isInteger(index) || index < 1 || index > intents.length,
    );
    if (invalidRequirementIndex || entry.supportsRequirementIndexes.length === 0) {
      rejectManifestChange(
        entry,
        'manifest_requirement_index_invalid',
        manifestIssues,
        rejectedManifestChanges,
      );
      return;
    }

    const candidateSteps = getRecipeStepEntries(candidate);
    if (entry.affectedStepIndexes.some(
      (index) => !Number.isInteger(index) || index < 1 || index > candidateSteps.length,
    )) {
      rejectManifestChange(
        entry,
        'manifest_step_index_invalid',
        manifestIssues,
        rejectedManifestChanges,
      );
      return;
    }

    const change = rawChanges[matchedChangeIndex];
    if (
      entry.affectedStepIndexes.length > 0 &&
      entry.affectedStepIndexes.some((index) =>
        !stepSupportsIngredientChange(candidateSteps[index - 1].text, change))
    ) {
      rejectManifestChange(
        entry,
        'manifest_step_reference_missing',
        manifestIssues,
        rejectedManifestChanges,
      );
      return;
    }

    const indexes = manifestMatches.get(matchedChangeIndex) ?? new Set<number>();
    entry.supportsRequirementIndexes.forEach((index) => indexes.add(index));
    manifestMatches.set(matchedChangeIndex, indexes);
  });

  const changes = rawChanges.map((change, changeIndex): IngredientChange => {
    const candidateStepIndexes = getStepIndexesForIngredientChange(candidate, change);
    const originalStepIndexes = getStepIndexesForIngredientChange(original, change);
    const removedIntegrated =
      change.kind === 'removed' &&
      originalStepIndexes.length > 0 &&
      candidateStepIndexes.length === 0;
    const referencedInSteps = hasMandatoryStepEvidence(
      original,
      candidate,
      change,
      removedIntegrated,
    );
    const declaredRequirementIndexes = [...(manifestMatches.get(changeIndex) ?? [])];
    const affectedRequirementIndexes = manifest.length === 0
      ? nutritionRequirementIndexes
      : declaredRequirementIndexes;

    return {
      kind: change.kind,
      ...(change.before
        ? {
            beforeName: change.before.name,
            normalizedBeforeName: normalizeIngredientIdentity(change.before.name),
            beforeQuantity: normalizeQuantity(change.before.quantity),
          }
        : {}),
      ...(change.after
        ? {
            afterName: change.after.name,
            normalizedAfterName: normalizeIngredientIdentity(change.after.name),
            afterQuantity: normalizeQuantity(change.after.quantity),
          }
        : {}),
      affectedRequirementIndexes,
      affectedStepIndexes: change.kind === 'removed'
        ? originalStepIndexes
        : candidateStepIndexes,
      referencedInSteps,
    };
  });

  return {
    changes,
    manifestIssues,
    rejectedManifestChanges,
  };
}

export function areCorrectionCandidatesEffectivelyIdentical(
  left: Recipe,
  right: Recipe,
): boolean {
  const ingredientSnapshot = (recipe: Recipe) => recipe.ingredients
    .map((ingredient) => [
      normalizeIngredientIdentity(ingredient.name),
      normalizeQuantity(ingredient.quantity),
    ].join(':'))
    .sort();
  const stepSnapshot = (recipe: Recipe) => getRecipeStepEntries(recipe)
    .map((step) => normalizeFoodText(step.text));
  return JSON.stringify({
    title: normalizeFoodText(left.title),
    description: normalizeFoodText(left.description),
    ingredients: ingredientSnapshot(left),
    nutrition: left.nutritionEstimate,
    servings: left.servings,
    steps: stepSnapshot(left),
  }) === JSON.stringify({
    title: normalizeFoodText(right.title),
    description: normalizeFoodText(right.description),
    ingredients: ingredientSnapshot(right),
    nutrition: right.nutritionEstimate,
    servings: right.servings,
    steps: stepSnapshot(right),
  });
}

function rejectManifestChange(
  entry: CorrectionAppliedChangeManifest,
  reasonCode: RejectedManifestChange['reasonCode'],
  issues: string[],
  rejected: RejectedManifestChange[],
) {
  issues.push(`Correction change manifest could not be verified (${reasonCode}).`);
  rejected.push({
    ...(entry.beforeIngredient
      ? { normalizedBeforeName: normalizeIngredientIdentity(entry.beforeIngredient) }
      : {}),
    ...(entry.afterIngredient
      ? { normalizedAfterName: normalizeIngredientIdentity(entry.afterIngredient) }
      : {}),
    reasonCode,
  });
}

function manifestIngredientMatches(
  manifestName: string | undefined,
  actualName: string | undefined,
): boolean {
  if (!manifestName && !actualName) {
    return true;
  }
  if (!manifestName || !actualName) {
    return false;
  }
  return normalizeIngredientIdentity(manifestName) ===
    normalizeIngredientIdentity(actualName);
}

function getRecipeStepEntries(recipe: Recipe): Array<{ index: number; text: string }> {
  if (recipe.structuredSteps?.length) {
    return recipe.structuredSteps.map((step, index) => ({
      index: index + 1,
      text: [
        step.title ?? '',
        step.text,
        ...(step.ingredientsUsed ?? []),
      ].join(' '),
    }));
  }
  return recipe.steps.map((step, index) => ({ index: index + 1, text: step }));
}

function getStepIndexesForIngredientChange(
  recipe: Recipe,
  change: RawIngredientChange,
): number[] {
  return getRecipeStepEntries(recipe)
    .filter((step) => stepSupportsIngredientChange(step.text, change))
    .map((step) => step.index);
}

function hasMandatoryStepEvidence(
  original: Recipe,
  candidate: Recipe,
  change: RawIngredientChange,
  removedIntegrated: boolean,
): boolean {
  if (change.kind === 'added') {
    return Boolean(change.after && getRecipeStepEntries(candidate).some((step) =>
      ingredientAppearsInSteps(change.after!.name, step.text)));
  }
  if (change.kind === 'removed') {
    if (!removedIntegrated) return true;
    return Boolean(change.before && getRecipeStepEntries(candidate).every((step) =>
      !ingredientAppearsInSteps(change.before!.name, step.text)));
  }
  if (change.kind === 'substituted') {
    const oldWasExplicit = Boolean(change.before && getRecipeStepEntries(original).some((step) =>
      ingredientAppearsInSteps(change.before!.name, step.text)));
    return !oldWasExplicit || Boolean(change.after && getRecipeStepEntries(candidate).some((step) =>
      ingredientAppearsInSteps(change.after!.name, step.text)));
  }
  // Quantity and preparation-descriptor changes do not require cosmetic step
  // rewrites. A generic instruction such as "cook the filling" remains valid.
  return true;
}

function stepSupportsIngredientChange(
  stepText: string,
  change: RawIngredientChange,
): boolean {
  if (change.kind === 'removed') {
    return Boolean(
      change.before &&
      ingredientAppearsInSteps(change.before.name, stepText),
    );
  }
  if (!change.after) {
    return false;
  }
  return ingredientAppearsInSteps(
    change.after.name,
    stepText,
    change.before?.name,
  );
}

function detectRawIngredientChanges(
  originalIngredients: RecipeIngredient[],
  candidateIngredients: RecipeIngredient[],
): RawIngredientChange[] {
  const canonicalOriginal = originalIngredients.map(canonicalizeIngredient);
  const canonicalCandidate = candidateIngredients.map(canonicalizeIngredient);
  const unmatchedOriginal = new Set(canonicalOriginal.map((_, index) => index));
  const unmatchedCandidate = new Set(canonicalCandidate.map((_, index) => index));
  const changes: RawIngredientChange[] = [];

  for (const originalIndex of [...unmatchedOriginal]) {
    const before = canonicalOriginal[originalIndex];
    const identity = normalizeIngredientIdentity(before.name);
    const candidateIndex = [...unmatchedCandidate].find(
      (index) => normalizeIngredientIdentity(canonicalCandidate[index].name) === identity,
    );
    if (candidateIndex === undefined) {
      continue;
    }
    unmatchedOriginal.delete(originalIndex);
    unmatchedCandidate.delete(candidateIndex);
    const after = canonicalCandidate[candidateIndex];
    if (!quantitiesEquivalent(before.quantity, after.quantity)) {
      changes.push({ kind: 'quantity_changed', before, after });
    }
  }

  for (const originalIndex of [...unmatchedOriginal]) {
    const before = canonicalOriginal[originalIndex];
    const candidates = [...unmatchedCandidate]
      .map((candidateIndex) => ({
        candidateIndex,
        score: getIngredientNameSimilarity(
          before.name,
          canonicalCandidate[candidateIndex].name,
        ),
      }))
      .filter(({ score }) => score >= 0.5)
      .sort((left, right) => right.score - left.score);
    const best = candidates[0];
    if (!best) {
      continue;
    }
    unmatchedOriginal.delete(originalIndex);
    unmatchedCandidate.delete(best.candidateIndex);
    changes.push({
      kind: 'descriptor_changed',
      before,
      after: canonicalCandidate[best.candidateIndex],
    });
  }

  if (unmatchedOriginal.size === 1 && unmatchedCandidate.size === 1) {
    const originalIndex = [...unmatchedOriginal][0];
    const candidateIndex = [...unmatchedCandidate][0];
    changes.push({
      kind: 'substituted',
      before: canonicalOriginal[originalIndex],
      after: canonicalCandidate[candidateIndex],
    });
    unmatchedOriginal.clear();
    unmatchedCandidate.clear();
  }

  for (const originalIndex of unmatchedOriginal) {
    changes.push({ kind: 'removed', before: canonicalOriginal[originalIndex] });
  }
  for (const candidateIndex of unmatchedCandidate) {
    changes.push({ kind: 'added', after: canonicalCandidate[candidateIndex] });
  }

  return changes;
}

function getIngredientNameSimilarity(left: string, right: string): number {
  const leftTerms = new Set(getIngredientComparisonTerms(left));
  const rightTerms = new Set(getIngredientComparisonTerms(right));
  if (leftTerms.size === 0 || rightTerms.size === 0) {
    return 0;
  }
  const intersection = [...leftTerms].filter((term) => rightTerms.has(term)).length;
  return intersection / Math.min(leftTerms.size, rightTerms.size);
}

function normalizeIngredientIdentity(value: string): string {
  return [...new Set(getIngredientComparisonTerms(value))].sort().join(' ');
}

function getIngredientComparisonTerms(value: string): string[] {
  return normalizeFoodText(value)
    .split(' ')
    .filter(Boolean)
    .filter((term) => !ingredientDescriptorTerms.has(term))
    .filter((term) => !ingredientQuantityTerms.has(term))
    .filter((term) => !/^\d+(?:\.\d+)?$/.test(term));
}

function ingredientNameReferenceMatches(left: string, right: string): boolean {
  const leftTerms = getIngredientComparisonTerms(left);
  const rightTerms = getIngredientComparisonTerms(right);
  if (leftTerms.length === 0 || rightTerms.length === 0) {
    return false;
  }
  const leftSet = new Set(leftTerms);
  const rightSet = new Set(rightTerms);
  return leftTerms.every((term) => rightSet.has(term)) ||
    rightTerms.every((term) => leftSet.has(term));
}

function ingredientReferenceMatchesTerms(
  value: string,
  ingredientTerms: string[],
): boolean {
  const valueTerms = new Set(getIngredientComparisonTerms(value));
  if (valueTerms.size === 0 || ingredientTerms.length === 0) {
    return false;
  }
  return ingredientTerms.every((term) => valueTerms.has(term));
}

function quantitiesEquivalent(left: string, right: string): boolean {
  return normalizeQuantity(left) === normalizeQuantity(right);
}

function canonicalizeIngredient(ingredient: RecipeIngredient): RecipeIngredient {
  const name = ingredient.name.trim();
  const quantity = ingredient.quantity.trim();
  const nameAmount = extractLeadingIngredientAmount(name);
  const quantityLooksLikeAmount = looksLikeIngredientAmount(quantity);
  if (nameAmount && !quantityLooksLikeAmount) {
    return { ...ingredient, name: nameAmount.name, quantity: nameAmount.quantity };
  }
  if (!name && quantity) {
    const quantityAmount = extractLeadingIngredientAmount(quantity);
    if (quantityAmount) return { ...ingredient, name: quantityAmount.name, quantity: quantityAmount.quantity };
  }
  return { ...ingredient, name, quantity };
}

function extractLeadingIngredientAmount(value: string): { name: string; quantity: string } | null {
  const match = value.match(/^((?:\d+(?:\.\d+)?|\d+\/\d+)(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(?:cup|cups|tbsp|tablespoons?|tsp|teaspoons?|g|grams?|kg|ml|oz|ounces?|lb|pounds?|package|packages?)?|to\s+taste)\s+(.+)$/i);
  if (!match) return null;
  return { quantity: match[1].replace(/\s+/g, ' ').trim(), name: match[2].replace(/,\s*/g, ', ').trim() };
}

function looksLikeIngredientAmount(value: string): boolean {
  return /^(?:\d|to\s+taste|a\s+pinch|pinch|as\s+needed)/i.test(value.trim());
}

function hasAddedIngredientMissingFromSteps(delta: IngredientDelta, stepText: string): boolean {
  return delta.added.some((ingredient) => !ingredientAppearsInSteps(ingredient.name, stepText));
}

function hasChangedIngredientMissingFromSteps(delta: IngredientDelta, stepText: string): boolean {
  return delta.changed.some(({ before, after }) =>
    !ingredientAppearsInSteps(after.name, stepText, before.name));
}

function hasIngredientChange(delta: IngredientDelta): boolean {
  return delta.added.length > 0 || delta.changed.length > 0 || delta.removed.length > 0;
}

function getIngredientDelta(
  originalIngredients: RecipeIngredient[],
  candidateIngredients: RecipeIngredient[],
): IngredientDelta {
  const changes = detectRawIngredientChanges(originalIngredients, candidateIngredients);
  return {
    added: changes
      .filter((change) => change.kind === 'added' && change.after)
      .map((change) => change.after!),
    changed: changes
      .filter((change) =>
        change.before &&
        change.after &&
        change.kind !== 'added' &&
        change.kind !== 'removed')
      .map((change) => ({ before: change.before!, after: change.after! })),
    removed: changes
      .filter((change) => change.kind === 'removed' && change.before)
      .map((change) => change.before!),
    changes,
  };
}

function ingredientNamesMatch(left: string, right: string): boolean {
  return ingredientNameReferenceMatches(left, right);
}

function isConcreteIngredientChoice(name: string, requestedQuality: string): boolean {
  const nameTerms = normalizeFoodText(name).split(' ').filter(Boolean);
  const requestedTerms = new Set(normalizeFoodText(requestedQuality).split(' ').filter(Boolean));
  if (nameTerms.length === 0 || normalizeFoodText(name) === normalizeFoodText(requestedQuality)) {
    return false;
  }

  return nameTerms.some((term) =>
    !requestedTerms.has(term) &&
    !abstractPlaceholderTerms.has(term));
}

function ingredientAppearsInSteps(
  ingredientName: string,
  stepText: string,
  relatedIngredientName?: string,
): boolean {
  const ingredientTerms = getIngredientComparisonTerms(ingredientName);
  const relatedTerms = relatedIngredientName
    ? getIngredientComparisonTerms(relatedIngredientName)
    : [];
  const sharedTerms = ingredientTerms.filter((term) => relatedTerms.includes(term));
  return ingredientReferenceMatchesTerms(stepText, ingredientTerms) ||
    (sharedTerms.length > 0 && ingredientReferenceMatchesTerms(stepText, sharedTerms));
}

function containsQualityConcept(value: string, requestedQuality: string): boolean {
  const valueStems = new Set(
    normalizeFoodText(value)
      .split(' ')
      .map(getQualityStem)
      .filter(Boolean),
  );
  const requestedStems = normalizeFoodText(requestedQuality)
    .split(' ')
    .filter((term) => term.length > 2 && !qualityRequestStopWords.has(term))
    .map(getQualityStem)
    .filter(Boolean);
  return requestedStems.length > 0 && requestedStems.some((stem) => valueStems.has(stem));
}

function containsMethodConcept(value: string, requestedMethod: string): boolean {
  const valueStems = new Set(
    normalizeFoodText(value)
      .split(' ')
      .map(getCookingMethodStem)
      .filter(Boolean),
  );
  const requestedStems = normalizeFoodText(requestedMethod)
    .split(' ')
    .filter((term) => term.length > 2)
    .map(getCookingMethodStem)
    .filter(Boolean);
  return requestedStems.length > 0 && requestedStems.every((stem) => valueStems.has(stem));
}

function getCookingMethodStem(value: string): string {
  if (value.length > 5 && value.endsWith('ing')) {
    return value.slice(0, -3);
  }
  if (value.length > 4 && value.endsWith('ed')) {
    return value.slice(0, -2);
  }
  if (value.length > 3 && value.endsWith('e')) {
    return value.slice(0, -1);
  }
  return value;
}

function getQualityStem(value: string): string {
  let word = value;
  if (word.length > 6 && word.endsWith('iness')) word = `${word.slice(0, -5)}y`;
  else if (word.length > 5 && word.endsWith('ness')) word = word.slice(0, -4);
  if (word.length > 5 && word.endsWith('iest')) word = `${word.slice(0, -4)}y`;
  else if (word.length > 4 && word.endsWith('ier')) word = `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith('ity')) word = word.slice(0, -3);
  else if (word.length > 5 && word.endsWith('ic')) word = word.slice(0, -2);
  else if (word.length > 5 && word.endsWith('er')) word = word.slice(0, -2);
  if (word.length > 4 && word.endsWith('y')) word = word.slice(0, -1);
  return word;
}

function hasNutritionGoalChange(
  original: Recipe,
  candidate: Recipe,
  intent: Extract<CorrectionIntent, { type: 'nutrition_goal' }>,
): boolean {
  const policy = getNutritionTargetPolicy(original, intent);
  const afterValue = getNutritionValue(candidate, policy.nutrient);
  return isNutritionTargetMet(policy, afterValue);
}

export type SupportedNutritionTarget = 'protein' | 'fiber' | 'carbohydrate' | 'fat' | 'calorie';

export type NutritionTargetPolicy = {
  nutrient: SupportedNutritionTarget;
  direction: 'more' | 'less';
  currentValue: number;
  minimumChange: number;
  targetValue: number;
};

const nutritionTargetRules: Record<
  SupportedNutritionTarget,
  { more: { relative: number; absolute: number }; less: { relative: number; absolute: number } }
> = {
  protein: {
    more: { relative: 0.2, absolute: 3 },
    less: { relative: 0.1, absolute: 1 },
  },
  fiber: {
    more: { relative: 0.2, absolute: 2 },
    less: { relative: 0.1, absolute: 1 },
  },
  fat: {
    more: { relative: 0.1, absolute: 1 },
    less: { relative: 0.15, absolute: 2 },
  },
  carbohydrate: {
    more: { relative: 0.1, absolute: 5 },
    less: { relative: 0.1, absolute: 5 },
  },
  calorie: {
    more: { relative: 0.1, absolute: 30 },
    less: { relative: 0.1, absolute: 30 },
  },
};

export function getNutritionTargetPolicy(
  recipe: Recipe,
  intent: Extract<CorrectionIntent, { type: 'nutrition_goal' }>,
): NutritionTargetPolicy {
  const nutrient = getSupportedNutritionTarget(intent.nutrient);
  const currentValue = getNutritionValue(recipe, nutrient) ?? 0;
  const rule = nutritionTargetRules[nutrient][intent.direction];
  const relativeChange = currentValue * rule.relative;
  const boundedAbsoluteChange = intent.direction === 'less'
    ? Math.min(rule.absolute, currentValue * 0.5)
    : rule.absolute;
  const minimumChange = Math.max(relativeChange, boundedAbsoluteChange);
  const targetValue = intent.direction === 'more'
    ? currentValue + minimumChange
    : Math.max(0, currentValue - minimumChange);

  return {
    nutrient,
    direction: intent.direction,
    currentValue,
    minimumChange,
    targetValue,
  };
}

export function getNutritionRequirementTargets(
  recipe: Recipe,
  intents: CorrectionIntent[],
): NutritionRequirementTarget[] {
  return intents.flatMap((intent, intentIndex) => {
    if (intent.type !== 'nutrition_goal') {
      return [];
    }
    const policy = getNutritionTargetPolicy(recipe, intent);
    return [{
      requirementIndex: intentIndex + 1,
      type: 'nutrition_goal' as const,
      nutrient: policy.nutrient,
      direction: policy.direction,
      originalValue: policy.currentValue,
      targetValue: policy.targetValue,
      ...(policy.direction === 'more'
        ? { targetMinimum: policy.targetValue }
        : { targetMaximum: policy.targetValue }),
    }];
  });
}

export function evaluateNutritionRequirements(
  original: Recipe,
  candidate: Recipe,
  intents: CorrectionIntent[],
  manifest: CorrectionAppliedChangeManifest[] = [],
): NutritionRequirementEvaluation[] {
  const ingredientChangeAnalysis = analyzeIngredientChanges(
    original,
    candidate,
    intents,
    manifest,
  );
  const servingsStable = candidate.servings === original.servings;
  const macroDerivedCalories = hasFiniteNutritionMacros(candidate)
    ? getEstimatedCaloriesFromMacros(candidate)
    : null;
  const displayedCalories =
    candidate.nutritionEstimate &&
    isFiniteNonnegative(candidate.nutritionEstimate.calories)
      ? candidate.nutritionEstimate.calories
      : null;
  const calorieTolerance = macroDerivedCalories === null
    ? null
    : getCalorieMacroTolerance(macroDerivedCalories);
  const calorieConsistencyPassed =
    macroDerivedCalories !== null &&
    displayedCalories !== null &&
    calorieTolerance !== null &&
    Math.abs(displayedCalories - macroDerivedCalories) <= calorieTolerance;

  return getNutritionRequirementTargets(original, intents).map((target) => {
    const supportingChanges = ingredientChangeAnalysis.changes.filter((change) =>
      change.affectedRequirementIndexes.includes(target.requirementIndex));
    const ingredientEvidencePassed = supportingChanges.length > 0;
    const stepEvidencePassed =
      ingredientEvidencePassed &&
      supportingChanges.every((change) => change.referencedInSteps);
    const candidateValue = getNutritionValue(candidate, target.nutrient);
    const numericTargetPassed = isNutritionTargetMet({
      nutrient: target.nutrient,
      direction: target.direction,
      currentValue: target.originalValue,
      minimumChange: Math.abs(target.targetValue - target.originalValue),
      targetValue: target.targetValue,
    }, candidateValue);
    const issueCodes: string[] = [];
    if (!numericTargetPassed) {
      issueCodes.push(`${target.nutrient}_target_not_met`);
    }
    if (!ingredientEvidencePassed) {
      issueCodes.push('nutrition_ingredient_change_missing');
    }
    if (!stepEvidencePassed) {
      issueCodes.push('nutrition_step_evidence_missing');
    }
    if (!servingsStable) {
      issueCodes.push('servings_changed');
    }
    if (!calorieConsistencyPassed) {
      issueCodes.push('calorie_macro_conflict');
    }

    return {
      ...target,
      candidateValue,
      numericTargetPassed,
      ingredientEvidencePassed,
      stepEvidencePassed,
      servingsStable,
      macroDerivedCalories,
      displayedCalories,
      calorieTolerance,
      calorieConsistencyPassed,
      issueCodes,
    };
  });
}

export function assessAndReconcileCorrectionCandidate(
  original: Recipe,
  candidate: Recipe,
  intents: CorrectionIntent[],
  manifest: CorrectionAppliedChangeManifest[] = [],
): CorrectionCandidateAssessment {
  const ingredientChangeAnalysis = analyzeIngredientChanges(
    original,
    candidate,
    intents,
    manifest,
  );
  const providerRequirementEvaluations = evaluateNutritionRequirements(
    original,
    candidate,
    intents,
    manifest,
  );
  const providerDisplayedCalories =
    candidate.nutritionEstimate &&
    isFiniteNonnegative(candidate.nutritionEstimate.calories)
      ? candidate.nutritionEstimate.calories
      : null;
  const providerIssues = validateCorrectedRecipe(
    original,
    candidate,
    intents,
    manifest,
  );

  if (
    providerRequirementEvaluations.length === 0 ||
    providerRequirementEvaluations.every(
      (evaluation) => evaluation.calorieConsistencyPassed,
    ) ||
    !hasFiniteNutritionMacros(candidate)
  ) {
    return {
      recipe: candidate,
      issues: providerIssues,
      providerRequirementEvaluations,
      finalRequirementEvaluations: providerRequirementEvaluations,
      caloriesReconciled: false,
      providerDisplayedCalories,
      ingredientChangeAnalysis,
    };
  }

  const macroDerivedCalories = getEstimatedCaloriesFromMacros(candidate);
  if (macroDerivedCalories === null || !Number.isFinite(macroDerivedCalories)) {
    return {
      recipe: candidate,
      issues: providerIssues,
      providerRequirementEvaluations,
      finalRequirementEvaluations: providerRequirementEvaluations,
      caloriesReconciled: false,
      providerDisplayedCalories,
      ingredientChangeAnalysis,
    };
  }

  const reconciledCalories = roundEstimatedCalories(macroDerivedCalories);
  const reconciledCandidate: Recipe = {
    ...candidate,
    nutritionEstimate: {
      ...candidate.nutritionEstimate!,
      calories: reconciledCalories,
    },
  };
  const reconciledIssues = validateCorrectedRecipe(
    original,
    reconciledCandidate,
    intents,
    manifest,
  );
  const finalRequirementEvaluations = evaluateNutritionRequirements(
    original,
    reconciledCandidate,
    intents,
    manifest,
  );

  if (reconciledIssues.length > 0) {
    return {
      recipe: reconciledCandidate,
      issues: reconciledIssues,
      providerRequirementEvaluations,
      finalRequirementEvaluations,
      caloriesReconciled: true,
      providerDisplayedCalories,
      reconciledCalories,
      ingredientChangeAnalysis,
    };
  }

  return {
    recipe: reconciledCandidate,
    issues: [],
    providerRequirementEvaluations,
    finalRequirementEvaluations,
    caloriesReconciled: true,
    providerDisplayedCalories,
    reconciledCalories,
    ingredientChangeAnalysis,
  };
}

function isNutritionTargetMet(
  policy: NutritionTargetPolicy,
  candidateValue: number | null,
): boolean {
  if (candidateValue === null || !isFiniteNonnegative(candidateValue)) {
    return false;
  }
  if (policy.direction === 'less' && policy.currentValue <= 0) {
    return false;
  }
  return policy.direction === 'more'
    ? candidateValue >= policy.targetValue - 0.01
    : candidateValue <= policy.targetValue + 0.01;
}

function hasFiniteNutritionMacros(recipe: Recipe): boolean {
  const nutrition = recipe.nutritionEstimate;
  return Boolean(
    nutrition &&
    isFiniteNonnegative(nutrition.proteinGrams) &&
    isFiniteNonnegative(nutrition.carbohydratesGrams) &&
    isFiniteNonnegative(nutrition.fatGrams),
  );
}

function roundEstimatedCalories(value: number): number {
  return Math.max(0, Math.round(value / 5) * 5);
}

function getSupportedNutritionTarget(value: string): SupportedNutritionTarget {
  const normalized = normalizeFoodText(value);
  if (normalized === 'fiber') return 'fiber';
  if (normalized === 'fat') return 'fat';
  if (normalized === 'carbohydrate') return 'carbohydrate';
  if (normalized === 'calorie') return 'calorie';
  return 'protein';
}

function getNutritionValue(recipe: Recipe, nutrient: SupportedNutritionTarget): number | null {
  const nutrition = recipe.nutritionEstimate;
  if (!nutrition) return null;
  switch (nutrient) {
    case 'protein':
      return nutrition.proteinGrams;
    case 'fiber':
      return nutrition.fiberGrams ?? 0;
    case 'carbohydrate':
      return nutrition.carbohydratesGrams;
    case 'fat':
      return nutrition.fatGrams;
    case 'calorie':
      return nutrition.calories;
  }
}

function getNutritionConstraintValue(recipe: Recipe, nutrient: string): number | null {
  const normalized = normalizeFoodText(nutrient);
  if (!recipe.nutritionEstimate) return null;
  if (normalized === 'calorie' || normalized === 'kcal') return recipe.nutritionEstimate.calories;
  if (normalized === 'protein') return recipe.nutritionEstimate.proteinGrams;
  if (normalized === 'fiber') return recipe.nutritionEstimate.fiberGrams ?? 0;
  if (normalized === 'fat') return recipe.nutritionEstimate.fatGrams;
  if (normalized === 'carbohydrate' || normalized === 'carb') return recipe.nutritionEstimate.carbohydratesGrams;
  return null;
}

function formatNutritionValue(value: number, nutrient: SupportedNutritionTarget): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}${nutrient === 'calorie' ? ' kcal' : ' g'}`;
}

function getRemovedConceptsFromOriginal(original: Recipe, intent: CorrectionIntent): string[] {
  let removedConcept = '';
  if (intent.type === 'remove_ingredient') {
    removedConcept = intent.ingredient;
  } else if (intent.type === 'replace_ingredient' || intent.type === 'correct_dish_identity') {
    removedConcept = intent.removeIngredient;
  }
  if (!removedConcept) {
    return [];
  }

  const matchedIngredientNames = original.ingredients
    .map((ingredient) => ingredient.name)
    .filter((name) => containsConcept(name, removedConcept));
  return [...new Set([removedConcept, ...matchedIngredientNames])];
}

function getIngredientText(recipe: Recipe): string {
  return recipe.ingredients.map((ingredient) => `${ingredient.quantity} ${ingredient.name}`).join(' ');
}

function getStepText(recipe: Recipe): string {
  return [
    ...recipe.steps,
    ...(recipe.structuredSteps ?? []).flatMap((step) => [
      step.title ?? '',
      step.text,
      ...(step.ingredientsUsed ?? []),
    ]),
  ].join(' ');
}

function findMatchingIngredient(ingredients: RecipeIngredient[], concept: string): RecipeIngredient | undefined {
  return ingredients.find((ingredient) => containsConcept(ingredient.name, concept));
}

function containsConcept(value: string, concept: string): boolean {
  const normalizedValue = normalizeFoodText(value);
  const normalizedConcept = normalizeFoodText(concept);
  if (!normalizedValue || !normalizedConcept) {
    return false;
  }

  const paddedValue = ` ${normalizedValue} `;
  if (paddedValue.includes(` ${normalizedConcept} `)) {
    return true;
  }

  const valueTerms = new Set(normalizedValue.split(' '));
  const conceptTerms = normalizedConcept.split(' ').filter((term) => term.length > 1);
  return conceptTerms.length > 0 && conceptTerms.every((term) =>
    valueTerms.has(term) ||
    (compoundCorrectionConcepts.has(term) && [...valueTerms].some((valueTerm) =>
      valueTerm.length >= 5 &&
      valueTerm.length <= 8 &&
      valueTerm.endsWith(term))),
  );
}

function normalizeFoodText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singularizeSimpleWord)
    .join(' ');
}

export function normalizeCorrectionText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\b(it|this)'s\b/g, '$1 is')
    .replace(/[,;]\s*(?:and\s+)?/g, ' and ')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/[']/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeCorrectionConceptToken)
    .join(' ');
}

function splitCompoundCorrection(normalizedNote: string): string[] {
  const requirementStart =
    '(?:add|include|remove|omit|exclude|leave|replace|swap|use|make|increase|decrease|reduce|double|halve|more|less|fewer|higher|lower|lighter|spicy|sweet|salty|sour|acidic|crunchy|crispy|creamy|dairy|gluten|vegan|vegetarian|no|without|not|under|within|keep|turn|only)';
  const separator = '\u0000';
  const identityCorrection = normalizedNote.match(
    /^(?:(?:this|it) is|(?:these|those) are)\s+.+?\s+and\s+not\s+.+$/,
  );
  if (identityCorrection) {
    return [normalizedNote.replace(/\s+and\s+not\s+/, ' not ')];
  }
  return normalizedNote
    .replace(
      new RegExp(`\\s+(?:and|but)\\s+(?=${requirementStart}\\b)`, 'g'),
      separator,
    )
    .replace(
      new RegExp(`\\s+with\\s+(?=(?:more|less|fewer|higher|lower|lighter)\\b)`, 'g'),
      separator,
    )
    .split(separator)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

export function correctionUsedFuzzyNormalization(value: string): boolean {
  const tokens = value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return tokens.some((token) =>
    !exactCorrectionConcepts.has(token) &&
    normalizeCorrectionConceptToken(token) !== token);
}

export function getCorrectionTargetConcept(intent: CorrectionIntent): string {
  switch (intent.type) {
    case 'add_ingredient':
    case 'remove_ingredient':
    case 'quantity_adjustment':
      return intent.ingredient;
    case 'abstract_ingredient_addition':
      return intent.requestedQuality;
    case 'replace_ingredient':
    case 'correct_dish_identity':
      return `${intent.removeIngredient} -> ${intent.addIngredient}`;
    case 'dietary_restriction':
      return intent.restriction;
    case 'sensory_adjustment':
      return intent.adjustment;
    case 'nutrition_goal':
      return `${intent.direction} ${intent.nutrient}`;
    case 'nutrition_constraint':
      return intent.targetMaximum === undefined
        ? `${intent.nutrient} at least ${intent.targetMinimum}`
        : `${intent.nutrient} under ${intent.targetMaximum}`;
    case 'cooking_method_adjustment':
      return intent.method;
    case 'servings_adjustment':
      return 'servings';
    case 'servings_scale':
      return `servings x${intent.multiplier}`;
    case 'time_constraint':
      return `under ${intent.targetMaximumMinutes} minutes`;
    case 'cost_adjustment':
      return intent.direction;
    case 'cuisine_or_style':
    case 'equipment_constraint':
      return intent.target;
    case 'general':
      return 'general_edit';
  }
}

function normalizeCorrectionConceptToken(token: string): string {
  const exact = exactCorrectionConcepts.get(token);
  if (exact) {
    return exact;
  }
  if (
    token.length < 5 &&
    !/(.)\1/.test(token)
  ) {
    return token;
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  const bestCanonicals = new Set<string>();
  for (const [canonical, aliases] of correctionConceptAliases) {
    for (const alias of aliases) {
      if (Math.abs(alias.length - token.length) > 1) {
        continue;
      }
      if (alias.startsWith(token) || token.startsWith(alias)) {
        continue;
      }
      const distance = getRestrictedDamerauLevenshteinDistance(token, alias);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCanonicals.clear();
        bestCanonicals.add(canonical);
      } else if (distance === bestDistance) {
        bestCanonicals.add(canonical);
      }
    }
  }

  return bestDistance <= 1 && bestCanonicals.size === 1
    ? [...bestCanonicals][0]
    : token;
}

function getRestrictedDamerauLevenshteinDistance(left: string, right: string): number {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const distances = Array.from({ length: rows }, () => Array<number>(columns).fill(0));
  for (let row = 0; row < rows; row += 1) distances[row][0] = row;
  for (let column = 0; column < columns; column += 1) distances[0][column] = column;

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      distances[row][column] = Math.min(
        distances[row - 1][column] + 1,
        distances[row][column - 1] + 1,
        distances[row - 1][column - 1] + substitutionCost,
      );
      if (
        row > 1 &&
        column > 1 &&
        left[row - 1] === right[column - 2] &&
        left[row - 2] === right[column - 1]
      ) {
        distances[row][column] = Math.min(
          distances[row][column],
          distances[row - 2][column - 2] + substitutionCost,
        );
      }
    }
  }

  return distances[left.length][right.length];
}

function singularizeSimpleWord(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function normalizeQuantity(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/⁄/g, '/')
    .replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, (fraction) => unicodeFractionValues[fraction] ?? fraction)
    .replace(/\b(?:about|approximately|approx\.?)\b/g, '')
    .replace(/\bone\b/g, '1')
    .replace(/\btwo\b/g, '2')
    .replace(/\bthree\b/g, '3')
    .replace(/\bfour\b/g, '4')
    .replace(/tablespoons?/g, 'tbsp')
    .replace(/teaspoons?/g, 'tsp')
    .replace(/ounces?/g, 'oz')
    .replace(/pounds?/g, 'lb')
    .replace(/grams?/g, 'g')
    .replace(/milliliters?/g, 'ml')
    .replace(/cups?/g, 'cup')
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const mixedFraction = normalized.match(/^(\d+)\s+(\d+)\/(\d+)(.*)$/);
  if (mixedFraction) {
    const amount =
      Number(mixedFraction[1]) +
      Number(mixedFraction[2]) / Number(mixedFraction[3]);
    return `${formatNormalizedQuantityNumber(amount)}${mixedFraction[4]}`.trim();
  }
  const fraction = normalized.match(/^(\d+)\/(\d+)(.*)$/);
  if (fraction) {
    const amount = Number(fraction[1]) / Number(fraction[2]);
    return `${formatNormalizedQuantityNumber(amount)}${fraction[3]}`.trim();
  }
  const decimal = normalized.match(/^(\d+(?:\.\d+)?)(.*)$/);
  if (decimal) {
    return `${formatNormalizedQuantityNumber(Number(decimal[1]))}${decimal[2]}`.trim();
  }
  return normalized;
}

const unicodeFractionValues: Record<string, string> = {
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

function formatNormalizedQuantityNumber(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function getDietaryRestriction(note: string): string | null {
  const directMatch = note.match(
    /^(?:make|keep)\s+(?:it|this|the recipe)\s+(.+?(?:\sfree|vegan|vegetarian))$/,
  );
  const describedDishMatch = note.match(
    /^(?:make|keep)\s+.+?\s+([a-z]+(?:\sfree)|vegan|vegetarian)$/,
  );
  const nonSubstituteMatch = note.match(
    /^(?:use|choose)\s+(?:a\s+)?non\s+([a-z]+)\s+(?:substitute|alternative|replacement)$/,
  );
  const abstractVegetarianReplacement = note.match(
    /^(?:replace|swap)\s+.+\s+(?:with|for)\s+(?:a\s+)?(vegetarian|vegan)\s+(?:option|alternative|substitute)$/,
  );
  const restriction =
    directMatch?.[1] ??
    describedDishMatch?.[1] ??
    (nonSubstituteMatch?.[1] ? `${nonSubstituteMatch[1]} free` : undefined) ??
    abstractVegetarianReplacement?.[1];
  return restriction ? cleanCorrectionTarget(restriction).replace(/\s+free$/i, '-free') : null;
}

function normalizeNutritionConstraintTarget(value: string): string {
  return normalizeFoodText(value)
    .replace(/^gram\s+/, '')
    .replace(/^kcal$/, 'calorie');
}

function cleanAbstractAdditionTarget(prefix: string, value: string): string {
  const [requestedPart] = value.split(/\s+to\s+/i);
  const target = cleanCorrectionTarget(requestedPart);
  if (prefix.toLowerCase() === 'something') {
    return target;
  }
  const withoutPlaceholder = target
    .replace(/\s+(?:ingredient|addition|option|item)$/i, '')
    .trim();
  return withoutPlaceholder || target;
}

function getAdjustmentDirection(value: string): 'more' | 'less' {
  return /\b(?:less|lighter|lower|reduced?)\b/i.test(value) ? 'less' : 'more';
}

function getNaturalLanguageNutritionGoal(
  value: string,
): { direction: 'more' | 'less'; nutrient: string } | null {
  const terms = new Set(value.split(' '));
  if (terms.has('lighter')) {
    return { direction: 'less', nutrient: 'calorie' };
  }

  const nutrient = [...nutritionConcepts].find((concept) => terms.has(concept));
  if (!nutrient) {
    return null;
  }
  if (/\b(?:fewer|less|lower|lowered|decrease|decreased|reduce|reduced)\b/.test(value)) {
    return { direction: 'less', nutrient };
  }
  if (/\b(?:more|higher|increase|increased|boost|boosted|extra)\b/.test(value)) {
    return { direction: 'more', nutrient };
  }
  return null;
}

function getNutritionGoal(
  value: string,
  direction: 'more' | 'less',
): { direction: 'more' | 'less'; nutrient: string } | null {
  const normalized = normalizeFoodText(value);
  const terms = new Set(normalized.split(' '));
  for (const nutrient of ['protein', 'fiber', 'carbohydrate', 'fat', 'calorie']) {
    if (terms.has(nutrient)) {
      return { direction, nutrient };
    }
  }
  if (terms.has('lighter') || terms.has('light')) {
    return { direction: 'less', nutrient: 'calories' };
  }
  return null;
}

function containsSensoryConcept(value: string): boolean {
  const terms = new Set(normalizeCorrectionText(value).split(' '));
  return ['acidic', 'creamy', 'crispy', 'crunchy', 'salt', 'salty', 'sodium', 'sour', 'spicy', 'sweet']
    .some((concept) => terms.has(concept));
}

function requestsServingChange(value: string): boolean {
  return /\b(?:batch|portion|serving)\b/.test(normalizeCorrectionText(value));
}

function cleanCorrectionTarget(value: string): string {
  return value
    .trim()
    .replace(/^(?:a|an|the|some)\s+/i, '')
    .replace(/[.!]+$/g, '')
    .trim();
}

function isFiniteNonnegative(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isFinitePositive(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
