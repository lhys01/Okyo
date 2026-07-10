import type { Recipe } from '../types.js';

export type RecipeAdaptationGoal =
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

export type RecipeAdaptationConfidence = 'low' | 'medium' | 'high';

export type RecipeAdaptationChangeType =
  | 'ingredient'
  | 'step'
  | 'shopping'
  | 'timing'
  | 'equipment'
  | 'flavor'
  | 'leftovers'
  | 'safety';

export type RecipeAdaptationChange = {
  id: string;
  type: RecipeAdaptationChangeType;
  label: string;
  detail: string;
  priority: 'primary' | 'optional';
  goal: RecipeAdaptationGoal;
};

export type RecipeAdaptationRequest = {
  recipe: Recipe;
  goals: RecipeAdaptationGoal[];
  context?: {
    source?: RecipeAdaptationSource;
    skillLevel?: string;
    timePreference?: string;
    budgetPreference?: string;
    availableIngredients?: string[];
    dislikes?: string[];
    equipment?: string[];
  };
};

export type RecipeAdaptationPlan = {
  version: 1;
  mode: 'plan';
  summary: string;
  goals: RecipeAdaptationGoal[];
  changes: RecipeAdaptationChange[];
  tradeoffs: string[];
  warnings: string[];
  pantryIdeas: string[];
  budgetIdeas: string[];
  speedIdeas: string[];
  healthIdeas: string[];
  proteinIdeas: string[];
  confidence: RecipeAdaptationConfidence;
};

export type RecipeAdaptationResponse = {
  ok: true;
  adaptation: RecipeAdaptationPlan;
};
