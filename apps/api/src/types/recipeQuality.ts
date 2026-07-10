import type { Recipe } from '../types.js';

export type RecipeQualitySeverity = 'info' | 'warning' | 'fix';

export type RecipeQualityIssue = {
  id: string;
  label: string;
  detail: string;
  severity: RecipeQualitySeverity;
};

export type RecipeQualityStatus = 'great' | 'good' | 'needs_attention' | 'risky';

export type RecipeQualityReport = {
  version: 1;
  status: RecipeQualityStatus;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  summary: string;
  issues: RecipeQualityIssue[];
  fixesApplied: string[];
  missingIngredients: string[];
  missingSteps: string[];
  vagueInstructions: string[];
  timeRealityCheck?: string;
  difficultyNote?: string;
  pantryStaples: string[];
  budgetIdeas: string[];
  speedIdeas: string[];
  healthIdeas: string[];
  whatCouldGoWrong: string[];
};

export type RecipeCheckSource = 'scan' | 'foodIdea' | 'savedRecipe' | 'manual';

export type RecipeCheckRequest = {
  recipe: Recipe;
  context?: {
    source?: RecipeCheckSource;
    userGoal?: string;
    timePreference?: string;
    skillLevel?: string;
  };
};

export type RecipeCheckResponse = {
  ok: true;
  report: RecipeQualityReport;
};
