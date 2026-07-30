import type { RecipeMode } from '../mocks';

export const CURRENT_RECIPE_MODES: readonly RecipeMode[] = [
  'Normal',
  'Lighter',
  'Healthier',
  'More Protein',
];

export function isCurrentRecipeMode(value: unknown): value is RecipeMode {
  return typeof value === 'string' &&
    CURRENT_RECIPE_MODES.includes(value as RecipeMode);
}

export function migrateLegacyRecipeMode(value: unknown): RecipeMode {
  return isCurrentRecipeMode(value) ? value : 'Normal';
}

// This guard intentionally accepts unknown runtime values. TypeScript cannot
// protect a request from old or malformed AsyncStorage data, so every network
// boundary uses this function immediately before serialization.
export function normalizeOutboundRecipeMode(value: unknown): RecipeMode {
  return migrateLegacyRecipeMode(value);
}

type UnknownRecord = Record<string, unknown>;

// Normalizes only mode-bearing fields and preserves every other persisted
// value byte-for-byte. This runs both during versioned migration and after
// hydration, so a same-version malformed state cannot remain active in memory.
export function normalizePersistedRecipeModeState<T>(value: T): T {
  if (!isRecord(value)) {
    return value;
  }

  const recipesById = isRecord(value.recipesById)
    ? Object.fromEntries(
        Object.entries(value.recipesById).map(([recipeId, recipe]) => [
          recipeId,
          normalizeRecipeRecord(recipe),
        ]),
      )
    : value.recipesById;

  return {
    ...value,
    selectedMode: migrateLegacyRecipeMode(value.selectedMode),
    recipesById,
    latestScanRecipe: normalizeRecipeRecord(value.latestScanRecipe),
    latestScanResult: normalizeScanResultRecord(value.latestScanResult),
    latestScanSession: normalizeLatestScanSession(value.latestScanSession),
    completedChallenges: Array.isArray(value.completedChallenges)
      ? value.completedChallenges.map(normalizeChallengeRecord)
      : value.completedChallenges,
  } as T;
}

function normalizeRecipeRecord(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const selectedMode = migrateLegacyRecipeMode(value.selectedMode ?? value.mode);
  return {
    ...value,
    mode: migrateLegacyRecipeMode(value.mode ?? selectedMode),
    ...('selectedMode' in value ? { selectedMode } : {}),
    ...('selectedPresentationMode' in value
      ? { selectedPresentationMode: migrateLegacyRecipeMode(value.selectedPresentationMode) }
      : {}),
    ...('scanResult' in value
      ? { scanResult: normalizeScanResultRecord(value.scanResult) }
      : {}),
  };
}

function normalizeScanResultRecord(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const modes = Array.isArray(value.modes)
    ? [...new Set(value.modes.map(migrateLegacyRecipeMode))]
    : value.modes;
  return {
    ...value,
    ...('modes' in value ? { modes } : {}),
  };
}

function normalizeLatestScanSession(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  return {
    ...value,
    latestScanRecipe: normalizeRecipeRecord(value.latestScanRecipe),
    latestScanResult: normalizeScanResultRecord(value.latestScanResult),
  };
}

function normalizeChallengeRecord(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  return {
    ...value,
    mode: migrateLegacyRecipeMode(value.mode),
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
