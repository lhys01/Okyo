import { randomUUID } from 'node:crypto';

import { getRuntimeSafetyConfig } from './config/runtimeSafety.js';
import { getRequestContext } from './observability/requestContext.js';
import type { AiConfig } from './config/aiConfig.js';
import type { FoodImageAnalysis } from './services/aiService.js';
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
  ScanSource,
  ScanResult,
  XpEventDefinition,
} from './types.js';

const savedRecipesByUser = new Map<string, Recipe[]>();
const completedChallengesByUser = new Map<string, CompletedChallenge[]>();
const awardedXpEventsByUser = new Map<string, AwardedXpEvent[]>();

// Deferred coaching store: recipes awaiting on-demand coaching enrichment.
// Keyed by recipe.id. TTL = 1 day (survives the typical user session).
const GENERATED_RECIPE_TTL_MS = 24 * 60 * 60 * 1000;
type GeneratedRecipeEntry = {
  recipe: Recipe;
  expiresAt: number;
  parentRevisionId?: string;
  rootRevisionId: string;
  supersededBy?: string;
  ownerKey?: string;
};
const generatedRecipeStore = new Map<string, GeneratedRecipeEntry>();

export const ANALYSIS_TTL_MS = 15 * 60 * 1000;

export type StoredAnalysisContext = {
  analysis: FoodImageAnalysis;
  config: AiConfig;
  mode: RecipeMode;
  source: ScanSource;
  fableActive?: boolean;
  uploadedImage: boolean;
  visionMs: number;
  scanStartedAt: number;
  expiresAt: number;
  ownerKey?: string;
};

const analysisStore = new Map<string, StoredAnalysisContext>();

export function storeAnalysisContext(
  context: Omit<StoredAnalysisContext, 'expiresAt'>,
  now = Date.now(),
): { analysisId: string; expiresAt: number } {
  pruneAnalysisContexts(now);
  const analysisId = randomUUID();
  const expiresAt = now + ANALYSIS_TTL_MS;
  analysisStore.set(analysisId, { ...context, expiresAt, ownerKey: getRequestContext()?.ownerKey });
  return { analysisId, expiresAt };
}

export function getAnalysisContext(
  analysisId: string,
  now = Date.now(),
): { status: 'found'; context: StoredAnalysisContext } | { status: 'expired' | 'missing' } {
  const context = analysisStore.get(analysisId);
  if (!context) return { status: 'missing' };
  if (context.ownerKey !== getRequestContext()?.ownerKey) return { status: 'missing' };
  if (context.expiresAt <= now) {
    analysisStore.delete(analysisId);
    return { status: 'expired' };
  }
  return { status: 'found', context };
}

export function deleteAnalysisContext(analysisId: string): void {
  const context = analysisStore.get(analysisId);
  if (context && context.ownerKey === getRequestContext()?.ownerKey) analysisStore.delete(analysisId);
}

export class StaleRecipeRevisionError extends Error {
  readonly sourceRecipeId: string;
  readonly latestSourceRecipeId?: string;

  constructor(sourceRecipeId: string, latestSourceRecipeId?: string) {
    super('The source recipe revision is no longer current.');
    this.name = 'StaleRecipeRevisionError';
    this.sourceRecipeId = sourceRecipeId;
    this.latestSourceRecipeId = latestSourceRecipeId;
  }
}

export function storeGeneratedRecipe(recipe: Recipe): void {
  pruneGeneratedRecipes();
  generatedRecipeStore.set(recipe.id, {
    recipe,
    expiresAt: Date.now() + GENERATED_RECIPE_TTL_MS,
    rootRevisionId: recipe.id,
    ownerKey: getRequestContext()?.ownerKey,
  });
}

export function getGeneratedRecipe(recipeId: string): Recipe | null {
  return getGeneratedRecipeEntry(recipeId)?.recipe ?? null;
}

export function getCurrentGeneratedRecipe(recipeId: string): Recipe | null {
  const entry = getGeneratedRecipeEntry(recipeId);
  if (!entry) {
    return null;
  }
  if (entry.supersededBy) {
    throw new StaleRecipeRevisionError(recipeId, entry.supersededBy);
  }
  return entry.recipe;
}

export function storeGeneratedRecipeRevision(
  parentRevisionId: string,
  candidate: Recipe,
): {
  parentRevisionId: string;
  recipe: Recipe;
  rootRevisionId: string;
} {
  pruneGeneratedRecipes();
  const parent = getGeneratedRecipeEntry(parentRevisionId);
  if (!parent) {
    throw new StaleRecipeRevisionError(parentRevisionId);
  }
  if (parent.supersededBy) {
    throw new StaleRecipeRevisionError(parentRevisionId, parent.supersededBy);
  }

  const revisionId = `recipe-revision-${randomUUID()}`;
  const recipe = { ...candidate, id: revisionId };
  parent.supersededBy = revisionId;
  generatedRecipeStore.set(revisionId, {
    recipe,
    expiresAt: Date.now() + GENERATED_RECIPE_TTL_MS,
    parentRevisionId,
    rootRevisionId: parent.rootRevisionId,
    ownerKey: parent.ownerKey,
  });
  return { parentRevisionId, recipe, rootRevisionId: parent.rootRevisionId };
}

export function getGeneratedRecipeRevisionMetadata(recipeId: string) {
  const entry = getGeneratedRecipeEntry(recipeId);
  if (!entry) {
    return null;
  }
  return {
    parentRevisionId: entry.parentRevisionId,
    rootRevisionId: entry.rootRevisionId,
    supersededBy: entry.supersededBy,
  };
}

function getGeneratedRecipeEntry(recipeId: string): GeneratedRecipeEntry | null {
  const entry = generatedRecipeStore.get(recipeId);
  if (!entry || Date.now() > entry.expiresAt) {
    generatedRecipeStore.delete(recipeId);
    return null;
  }
  // Unit tests and internal helpers may seed legacy entries outside a request.
  // Every HTTP-created entry has an ownerKey and remains request-scoped.
  const currentOwnerKey = getRequestContext()?.ownerKey;
  if (currentOwnerKey && entry.ownerKey && entry.ownerKey !== currentOwnerKey) return null;
  return entry;
}

function pruneAnalysisContexts(now: number): void {
  for (const [id, context] of analysisStore) {
    if (context.expiresAt <= now) analysisStore.delete(id);
  }
  const maxEntries = getRuntimeSafetyConfig().maxInMemoryAnalysisEntries;
  while (analysisStore.size >= maxEntries) {
    const oldest = analysisStore.keys().next().value;
    if (oldest === undefined) break;
    analysisStore.delete(oldest);
  }
}

function pruneGeneratedRecipes(now = Date.now()): void {
  for (const [id, entry] of generatedRecipeStore) {
    if (entry.expiresAt <= now) generatedRecipeStore.delete(id);
  }
  const maxEntries = getRuntimeSafetyConfig().maxInMemoryGeneratedRecipeEntries;
  while (generatedRecipeStore.size >= maxEntries) {
    const oldest = generatedRecipeStore.keys().next().value;
    if (oldest === undefined) break;
    generatedRecipeStore.delete(oldest);
  }
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

export function saveRecipe(recipe: Recipe, userId: string) {
  const savedRecipes = getUserCollection(savedRecipesByUser, userId);
  if (!savedRecipes.some((savedRecipe) => savedRecipe.id === recipe.id)) {
    savedRecipes.push(recipe);
  }

  return savedRecipes;
}

export function getLibrary(userId: string) {
  return [...getUserCollection(savedRecipesByUser, userId)];
}

export function createChallenge(input: {
  recipeId: string;
  mode: RecipeMode;
  rating: CompletedChallenge['rating'];
  matchScore?: number;
}, userId: string) {
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

  getUserCollection(completedChallengesByUser, userId).push(challenge);
  return challenge;
}

export function awardXp(userId: string, eventType: string, sourceId?: string) {
  const definition = findXpDefinition(eventType);
  const event: AwardedXpEvent = {
    id: `xp-${eventType}-${sourceId ?? 'manual'}-${Date.now()}`,
    eventType,
    points: definition?.points ?? 0,
    awardedAt: new Date().toISOString(),
    sourceId,
  };

  getUserCollection(awardedXpEventsByUser, userId).push(event);
  return event;
}

export function getSavingsSummary(userId: string) {
  const savedRecipes = getUserCollection(savedRecipesByUser, userId);
  const completedChallenges = getUserCollection(completedChallengesByUser, userId);
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

export function getWeeklyRankings(userId: string) {
  const awardedXpEvents = getUserCollection(awardedXpEventsByUser, userId);
  const completedChallenges = getUserCollection(completedChallengesByUser, userId);
  const xp = awardedXpEvents.reduce((total, event) => total + event.points, 0);

  return {
    xp,
    leaderboardEntries: mockLeaderboardEntries,
    badges: mockBadges,
    awardedXpEvents,
    completedChallenges,
  };
}

export function clearUserData(userId: string): void {
  const ownerKey = `user:${userId}`;
  const failures: unknown[] = [];
  const attempt = (operation: () => void) => {
    try { operation(); } catch (error) { failures.push(error); }
  };

  attempt(() => savedRecipesByUser.delete(userId));
  attempt(() => completedChallengesByUser.delete(userId));
  attempt(() => awardedXpEventsByUser.delete(userId));
  for (const [recipeId, entry] of generatedRecipeStore) {
    if (entry.ownerKey === ownerKey) attempt(() => generatedRecipeStore.delete(recipeId));
  }
  for (const [analysisId, context] of analysisStore) {
    if (context.ownerKey === ownerKey) attempt(() => analysisStore.delete(analysisId));
  }

  if (failures.length > 0) throw new Error('User data cleanup did not fully complete.');
}

function getUserCollection<T>(collections: Map<string, T[]>, userId: string): T[] {
  let collection = collections.get(userId);
  if (!collection) {
    collection = [];
    collections.set(userId, collection);
  }
  return collection;
}

export function getRestaurantPacks() {
  return mockRestaurantPacks.map(pack => ({ ...pack, provenance: 'static_example', pricesAreEstimates: true }));
}

export function getRestaurantPack(packId: string) {
  return getRestaurantPacks().find((pack) => pack.id === packId);
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
  if (mode === 'Healthier') {
    return 'healthy-swap-pro';
  }

  return 'first-dupe';
}
