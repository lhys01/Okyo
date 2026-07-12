import { OKYO_API_BASE_URL } from './config';
import { authenticatedFetch } from './authenticatedClient';
import type { Recipe } from '../mocks';
import type { RecipeAdaptationGoal as LocalRecipeAdaptationGoal } from '../utils/makeItMine';

const recipeAdaptationTimeoutMs = 8000;

export type BackendRecipeAdaptationGoal =
  | 'faster'
  | 'cheaper'
  | 'healthier'
  | 'lighter'
  | 'beginner'
  | 'higherProtein'
  | 'pantryFriendly'
  | 'leftovers'
  | 'lessSpicy'
  | 'moreSpicy'
  | 'moreFlavor';

export type RecipeAdaptationSource = 'scan' | 'foodIdea' | 'savedRecipe' | 'manual';

export type RecipeAdaptationContext = {
  source?: RecipeAdaptationSource;
  skillLevel?: string;
  timePreference?: string;
  budgetPreference?: string;
  availableIngredients?: string[];
  dislikes?: string[];
  equipment?: string[];
};

export type BackendRecipeAdaptationChange = {
  id?: string;
  type?: string;
  label?: string;
  detail?: string;
  priority?: 'primary' | 'optional';
  goal?: BackendRecipeAdaptationGoal;
};

export type RecipeAdaptationPlan = {
  version: 1;
  mode: 'plan';
  summary: string;
  goals: BackendRecipeAdaptationGoal[];
  changes: BackendRecipeAdaptationChange[];
  tradeoffs: string[];
  warnings: string[];
  pantryIdeas: string[];
  budgetIdeas: string[];
  speedIdeas: string[];
  healthIdeas: string[];
  proteinIdeas: string[];
  confidence: 'low' | 'medium' | 'high';
};

type RecipeAdaptationPayload =
  | { ok: true; adaptation?: Partial<RecipeAdaptationPlan>; data?: { adaptation?: Partial<RecipeAdaptationPlan> } }
  | { ok: false; error?: { code?: string; message?: string; details?: unknown } };

const backendGoalByLocalGoal: Record<LocalRecipeAdaptationGoal, BackendRecipeAdaptationGoal> = {
  faster: 'faster',
  cheaper: 'cheaper',
  beginner: 'beginner',
  pantry: 'pantryFriendly',
  healthier: 'healthier',
  lighter: 'lighter',
  higher_protein: 'higherProtein',
  less_spicy: 'lessSpicy',
  more_spicy: 'moreSpicy',
  more_flavor: 'moreFlavor',
  leftovers: 'leftovers',
};

export async function adaptRecipeWithBackend(
  recipe: Recipe,
  goal: LocalRecipeAdaptationGoal,
  context?: RecipeAdaptationContext,
): Promise<RecipeAdaptationPlan> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), recipeAdaptationTimeoutMs);
  const backendGoal = backendGoalByLocalGoal[goal];

  try {
    const response = await authenticatedFetch(`${OKYO_API_BASE_URL}/v1/recipes/adapt`, {
      body: JSON.stringify({ recipe, goals: [backendGoal], context }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: controller.signal,
    });
    const payload = await response.json() as RecipeAdaptationPayload;
    if (!response.ok || !payload.ok) {
      throw new Error(payload.ok ? `Recipe adaptation failed with ${response.status}` : payload.error?.message ?? 'Recipe adaptation failed');
    }
    const adaptation = payload.adaptation ?? payload.data?.adaptation;
    if (!adaptation || adaptation.version !== 1 || adaptation.mode !== 'plan') {
      throw new Error('Recipe adaptation response was missing a versioned plan.');
    }
    return mapBackendPlan(adaptation);
  } finally {
    clearTimeout(timeout);
  }
}

export function getRecipeAdaptationKey(
  recipe: Recipe,
  goal: LocalRecipeAdaptationGoal,
  context?: RecipeAdaptationContext,
) {
  const ingredientCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0;
  const stepCount = Array.isArray(recipe.steps) ? recipe.steps.length : 0;
  const structuredStepCount = Array.isArray(recipe.structuredSteps) ? recipe.structuredSteps.length : 0;
  return [
    recipe.id,
    recipe.title,
    recipe.totalTimeMinutes ?? recipe.prepTimeMinutes + recipe.cookTimeMinutes,
    ingredientCount,
    stepCount,
    structuredStepCount,
    goal,
    context?.source ?? '',
    context?.skillLevel ?? '',
    context?.timePreference ?? '',
    context?.budgetPreference ?? '',
  ].join('|');
}

function mapBackendPlan(plan: Partial<RecipeAdaptationPlan>): RecipeAdaptationPlan {
  return {
    version: 1,
    mode: 'plan',
    summary: getSafeString(plan.summary, 'Okyo would adjust this recipe while keeping the original saved as-is.'),
    goals: getSafeGoals(plan.goals),
    changes: getSafeChanges(plan.changes),
    tradeoffs: getSafeList(plan.tradeoffs),
    warnings: getSafeList(plan.warnings),
    pantryIdeas: getSafeList(plan.pantryIdeas),
    budgetIdeas: getSafeList(plan.budgetIdeas),
    speedIdeas: getSafeList(plan.speedIdeas),
    healthIdeas: getSafeList(plan.healthIdeas),
    proteinIdeas: getSafeList(plan.proteinIdeas),
    confidence: getSafeConfidence(plan.confidence),
  };
}

function getSafeChanges(value: unknown): BackendRecipeAdaptationChange[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const changes: BackendRecipeAdaptationChange[] = [];
  for (const change of value) {
    const candidate = change as BackendRecipeAdaptationChange;
    const detail = getSafeString(candidate.detail, '');
    if (!detail) {
      continue;
    }
    changes.push({
      id: getSafeString(candidate.id, detail),
      type: getSafeString(candidate.type, 'step'),
      label: getSafeString(candidate.label, 'Preview change'),
      detail,
      priority: candidate.priority === 'optional' ? 'optional' : 'primary',
      goal: candidate.goal,
    });
  }
  return changes;
}

function getSafeGoals(value: unknown): BackendRecipeAdaptationGoal[] {
  return Array.isArray(value)
    ? value.filter((goal): goal is BackendRecipeAdaptationGoal => typeof goal === 'string' && Object.values(backendGoalByLocalGoal).includes(goal as BackendRecipeAdaptationGoal))
    : [];
}

function getSafeConfidence(value: unknown): RecipeAdaptationPlan['confidence'] {
  if (value === 'high' || value === 'low') {
    return value;
  }
  return 'medium';
}

function getSafeList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function getSafeString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
