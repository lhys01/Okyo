import {
  mockBadges,
  mockGroceryLists,
  mockLeaderboardEntries,
  mockRecipes,
  mockRestaurantPacks,
  mockScanResults,
  mockShareCards,
  mockXpEvents,
} from './mockData.js';
import type {
  AwardedXpEvent,
  CompletedChallenge,
  Recipe,
  RecipeMode,
  ScanResult,
  XpEventDefinition,
} from './types.js';

// In-memory demo store — no DB yet, so cap growth to bound process memory
// under repeated-request abuse. Oldest entries drop first (FIFO).
const MAX_SAVED_RECIPES = 500;
const MAX_COMPLETED_CHALLENGES = 2000;
const MAX_AWARDED_XP_EVENTS = 5000;

const savedRecipes: Recipe[] = [];
const completedChallenges: CompletedChallenge[] = [];
const awardedXpEvents: AwardedXpEvent[] = [];

function pushBounded<T>(list: T[], item: T, maxSize: number): void {
  list.push(item);
  if (list.length > maxSize) {
    list.splice(0, list.length - maxSize);
  }
}

// Deferred coaching store: recipes awaiting on-demand coaching enrichment.
// Keyed by recipe.id. TTL = 1 day (survives the typical user session).
const GENERATED_RECIPE_TTL_MS = 24 * 60 * 60 * 1000;
const GENERATED_RECIPE_MAX_ENTRIES = 2000;
const generatedRecipeStore = new Map<string, { recipe: Recipe; expiresAt: number }>();

export function storeGeneratedRecipe(recipe: Recipe): void {
  generatedRecipeStore.set(recipe.id, { recipe, expiresAt: Date.now() + GENERATED_RECIPE_TTL_MS });

  const now = Date.now();
  for (const [key, entry] of generatedRecipeStore) {
    if (entry.expiresAt <= now) {
      generatedRecipeStore.delete(key);
    }
  }
  if (generatedRecipeStore.size > GENERATED_RECIPE_MAX_ENTRIES) {
    const overflow = generatedRecipeStore.size - GENERATED_RECIPE_MAX_ENTRIES;
    const oldestKeys = [...generatedRecipeStore.keys()].slice(0, overflow);
    for (const key of oldestKeys) {
      generatedRecipeStore.delete(key);
    }
  }
}

export function getGeneratedRecipe(recipeId: string): Recipe | null {
  const entry = generatedRecipeStore.get(recipeId);
  if (!entry || Date.now() > entry.expiresAt) {
    generatedRecipeStore.delete(recipeId);
    return null;
  }
  return entry.recipe;
}

export function getScan(scanId: string) {
  return mockScanResults.find((scan) => scan.id === scanId);
}

export function getRecipe(recipeId: string) {
  return (
    mockRecipes.find((recipe) => recipe.id === recipeId) ??
    mockRecipes.find((recipe) => recipe.id.startsWith(`${recipeId}-`))
  );
}

export function saveRecipe(recipe: Recipe) {
  if (!savedRecipes.some((savedRecipe) => savedRecipe.id === recipe.id)) {
    pushBounded(savedRecipes, recipe, MAX_SAVED_RECIPES);
  }

  return savedRecipes;
}

export function getLibrary() {
  return [...savedRecipes];
}

export function createChallenge(input: {
  recipeId: string;
  mode: RecipeMode;
  rating: CompletedChallenge['rating'];
  matchScore?: number;
}) {
  const recipe = getRecipe(input.recipeId);

  if (!recipe) {
    return null;
  }

  const matchScore = input.matchScore ?? getMatchScoreForRating(input.rating);
  const bonusXp = matchScore >= 8 ? 25 : 0;
  const savingsXp = recipe.estimatedSavings >= 25 ? 25 : 0;
  const xpEarned = 40 + bonusXp + savingsXp;
  const challenge: CompletedChallenge = {
    id: `challenge-${recipe.id}-${Date.now()}`,
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    mode: input.mode,
    rating: input.rating,
    completedAt: new Date().toISOString(),
    matchScore,
    moneySaved: recipe.estimatedSavings,
    xpEarned,
    badgeUnlocked: getBadgeForChallenge(recipe.title, input.mode, input.rating, recipe.estimatedSavings),
  };

  pushBounded(completedChallenges, challenge, MAX_COMPLETED_CHALLENGES);
  return challenge;
}

export function awardXp(eventType: string, sourceId?: string) {
  const definition = findXpDefinition(eventType);
  const event: AwardedXpEvent = {
    id: `xp-${eventType}-${sourceId ?? 'manual'}-${Date.now()}`,
    eventType,
    points: definition?.points ?? 0,
    awardedAt: new Date().toISOString(),
    sourceId,
  };

  pushBounded(awardedXpEvents, event, MAX_AWARDED_XP_EVENTS);
  return event;
}

export function getSavingsSummary() {
  const savedRecipeSavings = savedRecipes.reduce((total, recipe) => total + recipe.estimatedSavings, 0);
  const challengeSavings = completedChallenges.reduce((total, challenge) => total + challenge.moneySaved, 0);
  const totalEstimatedSaved = savedRecipeSavings + challengeSavings;
  const completedDupeCount = savedRecipes.length + completedChallenges.length;

  return {
    totalEstimatedSaved,
    savedRecipeSavings,
    challengeSavings,
    savedRecipeCount: savedRecipes.length,
    completedChallengeCount: completedChallenges.length,
    averageSavingsPerDupe: completedDupeCount > 0 ? totalEstimatedSaved / completedDupeCount : 0,
  };
}

export function getWeeklyRankings() {
  const xp = awardedXpEvents.reduce((total, event) => total + event.points, 0);

  return {
    xp,
    leaderboardEntries: mockLeaderboardEntries,
    badges: mockBadges,
    awardedXpEvents,
    completedChallenges,
  };
}

export function getRestaurantPacks() {
  return mockRestaurantPacks;
}

export function getRestaurantPack(packId: string) {
  return mockRestaurantPacks.find((pack) => pack.id === packId);
}

export function getXpDefinitions(): XpEventDefinition[] {
  return mockXpEvents;
}

function findXpDefinition(eventType: string) {
  return mockXpEvents.find((event) => event.id === eventType);
}

function getMatchScoreForRating(rating: CompletedChallenge['rating']) {
  switch (rating) {
    case 'Nailed it':
      return 9.2;
    case 'Pretty close':
      return 8.1;
    case 'Needs work':
      return 6.4;
    case 'Not close':
      return 4.2;
  }
}

function getBadgeForChallenge(
  recipeTitle: string,
  mode: RecipeMode,
  rating: CompletedChallenge['rating'],
  savings: number,
) {
  if (rating === 'Nailed it') {
    return 'nailed-it';
  }
  if (savings >= 25) {
    return 'budget-beast';
  }
  if (recipeTitle.toLowerCase().includes('rigatoni') || recipeTitle.toLowerCase().includes('pasta')) {
    return 'pasta-hacker';
  }
  if (mode === 'Healthy') {
    return 'healthy-swap-pro';
  }

  return 'first-dupe';
}
