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
 * Keep durable user data while dropping fields from retired mock, paywall,
 * leaderboard, challenge, and onboarding experiments.
 */
export function migrateOkyoPersistedState(persistedState: unknown): Record<string, unknown> {
  if (!isRecord(persistedState)) {
    return {};
  }

  const next: Record<string, unknown> = {};

  if (typeof persistedState.hasCompletedOnboarding === 'boolean') {
    next.hasCompletedOnboarding = persistedState.hasCompletedOnboarding;
  }
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
  if (
    persistedState.userRestaurantPrice === null ||
    (typeof persistedState.userRestaurantPrice === 'number' &&
      Number.isFinite(persistedState.userRestaurantPrice) &&
      persistedState.userRestaurantPrice >= 0)
  ) {
    next.userRestaurantPrice = persistedState.userRestaurantPrice;
  }

  next.savedRecipes = Array.isArray(persistedState.savedRecipes)
    ? persistedState.savedRecipes.filter(isRecord)
    : [];
  next.savedFoodIdeas = Array.isArray(persistedState.savedFoodIdeas)
    ? persistedState.savedFoodIdeas.filter(isRecord)
    : [];
  next.xp = typeof persistedState.xp === 'number' && Number.isFinite(persistedState.xp)
    ? Math.max(0, Math.floor(persistedState.xp))
    : 0;
  next.lastDailyCheckInDate = typeof persistedState.lastDailyCheckInDate === 'string'
    ? persistedState.lastDailyCheckInDate
    : null;

  const awardedEvents = Array.isArray(persistedState.awardedXpEvents)
    ? persistedState.awardedXpEvents.filter((event): event is string => typeof event === 'string' && event.length > 0)
    : [];
  next.awardedXpEvents = [...new Set(awardedEvents)].slice(-5000);

  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
