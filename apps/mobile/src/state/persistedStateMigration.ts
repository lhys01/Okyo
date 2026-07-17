const recipeModes = new Set(['Restaurant Copy', 'Budget', 'Healthy']);
const scanStatuses = new Set(['pending', 'success', 'partial', 'rejected', 'failed']);
const nullableObjectKeys = [
  'latestScanSession',
  'latestScanResult',
  'latestScanFailure',
  'latestScanRecipe',
  'selectedScanImage',
  'latestAiDebugMetadata',
] as const;

/**
 * Keep durable user data while dropping fields from retired product experiments.
 */
export function migrateOkyoPersistedState(
  persistedState: unknown,
  _persistedVersion?: number,
): Record<string, unknown> {
  if (!isRecord(persistedState)) {
    return {};
  }

  const next: Record<string, unknown> = {};

  if (typeof persistedState.scanSessionId === 'string' || persistedState.scanSessionId === null) {
    next.scanSessionId = persistedState.scanSessionId;
  }
  if (scanStatuses.has(String(persistedState.latestScanStatus))) {
    next.latestScanStatus = persistedState.latestScanStatus;
  } else if (persistedState.latestScanStatus === null) {
    next.latestScanStatus = null;
  }

  for (const key of nullableObjectKeys) {
    const value = persistedState[key];
    if (value === null || isRecord(value)) {
      next[key] = value;
    }
  }

  if (recipeModes.has(String(persistedState.selectedMode))) {
    next.selectedMode = persistedState.selectedMode;
  }
  const persistedRecipes = Array.isArray(persistedState.savedRecipes)
    ? persistedState.savedRecipes.filter(isRecord)
    : [];
  const legacyIdeaRecipes = Array.isArray(persistedState.savedFoodIdeas)
    ? persistedState.savedFoodIdeas
      .filter(isRecord)
      .map((idea) => idea.extractedRecipe)
      .filter(isRecord)
    : [];
  next.savedRecipes = dedupeRecordsById([...persistedRecipes, ...legacyIdeaRecipes]);
  next.recentScanRecipes = Array.isArray(persistedState.recentScanRecipes)
    ? persistedState.recentScanRecipes.filter(isRecord).slice(0, 12)
    : isRecord(persistedState.latestScanRecipe)
      ? [persistedState.latestScanRecipe]
      : [];
  const savedRecipeIds = new Set((next.savedRecipes as Record<string, unknown>[])
    .map((recipe) => recipe.id)
    .filter((id): id is string => typeof id === 'string'));
  next.groceryRecipeIds = Array.isArray(persistedState.groceryRecipeIds)
    ? [...new Set(persistedState.groceryRecipeIds.filter(
      (id): id is string => typeof id === 'string' && savedRecipeIds.has(id),
    ))]
    : [];
  next.groceryCheckedItemIds = Array.isArray(persistedState.groceryCheckedItemIds)
    ? [...new Set(persistedState.groceryCheckedItemIds.filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    ))].slice(-1000)
    : [];
  next.groceryClearedItemIds = Array.isArray(persistedState.groceryClearedItemIds)
    ? [...new Set(persistedState.groceryClearedItemIds.filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    ))].slice(-1000)
    : [];
  next.cookingProgress = isRecord(persistedState.cookingProgress) &&
    typeof persistedState.cookingProgress.recipeId === 'string' &&
    typeof persistedState.cookingProgress.stepIndex === 'number'
    ? {
      completed: persistedState.cookingProgress.completed === true,
      recipeId: persistedState.cookingProgress.recipeId,
      stepIndex: Math.max(0, Math.floor(persistedState.cookingProgress.stepIndex)),
    }
    : null;

  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function dedupeRecordsById(records: Record<string, unknown>[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (typeof record.id !== 'string' || seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}
