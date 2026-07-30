import type { ScanImageMetadata, ScanSource, ScanStatus } from '../api/types';
import type { Recipe, RecipeMode, ScanResult } from '../mocks';
import { normalizeRecipeForCanonicalStorage } from '../utils/recipeIntegrity';

export type CanonicalRecipeOrigin =
  | 'scan'
  | 'description'
  | 'recommendation'
  | 'library'
  | 'restaurant-pack';

export type RecipeCompletionState = 'ready' | 'cooking' | 'completed';
export type RecipePresentationMode = 'Normal' | 'Lighter' | 'Healthier' | 'More Protein';
export const RECIPE_PRESENTATION_MODES: RecipePresentationMode[] = [
  'Normal',
  'Lighter',
  'Healthier',
  'More Protein',
];

export type CanonicalRecipe = Recipe & {
  recipeId: string;
  sourceRecipeId: string;
  origin: CanonicalRecipeOrigin;
  originalImage: ScanImageMetadata | null;
  detectedDishName: string;
  correctedDishName: string | null;
  selectedMode: RecipeMode;
  selectedPresentationMode: RecipePresentationMode;
  completionState: RecipeCompletionState;
  identificationConfirmedAt?: string;
  isSaved: boolean;
  createdAt: string;
  scanCompletedAt: string;
  savedAt?: string;
  cookingCompletedAt?: string;
  scanResult: ScanResult | null;
};

export type CanonicalRecipeCollections = {
  recipesById: Record<string, CanonicalRecipe>;
  recentRecipeIds: string[];
  savedRecipeIds: string[];
  groceryRecipeIds: string[];
};

export type CanonicalScanStatus =
  | ScanStatus
  | 'pending'
  | 'cancelled'
  | 'timed_out'
  | 'malformed';

type CommitSuccessfulScanInput = {
  activeScanSessionId: string | null;
  scanSessionId: string;
  status: CanonicalScanStatus;
  source: ScanSource;
  scan: ScanResult | null;
  recipe: Recipe | null;
  image: ScanImageMetadata | null;
  selectedMode: RecipeMode;
  completedAt?: string;
};

export function getEmptyCanonicalRecipeCollections(): CanonicalRecipeCollections {
  return {
    recipesById: {},
    recentRecipeIds: [],
    savedRecipeIds: [],
    groceryRecipeIds: [],
  };
}

export function commitSuccessfulScan(
  collections: CanonicalRecipeCollections,
  input: CommitSuccessfulScanInput,
): CanonicalRecipeCollections {
  const normalizedRecipe = input.recipe
    ? normalizeRecipeForCanonicalStorage(input.recipe)
    : null;
  if (
    input.status !== 'success' ||
    input.source === 'mock' ||
    !input.scan ||
    !normalizedRecipe ||
    !isUsableCanonicalRecipe(normalizedRecipe) ||
    input.activeScanSessionId !== input.scanSessionId
  ) {
    return collections;
  }

  const recipeId = getCanonicalScanRecipeId(input.scanSessionId);
  const existing = resolveCanonicalRecipe(collections.recipesById, recipeId);
  if (existing) {
    return {
      ...collections,
      recentRecipeIds: putReferenceFirst(collections.recentRecipeIds, recipeId),
    };
  }

  const completedAt = input.completedAt ?? new Date().toISOString();
  const canonicalRecipe = createCanonicalScanRecipe({
    completedAt,
    image: input.image,
    recipe: normalizedRecipe,
    recipeId,
    scan: input.scan,
    selectedMode: input.selectedMode,
    source: input.source,
  });

  return {
    ...collections,
    recipesById: {
      ...collections.recipesById,
      [recipeId]: canonicalRecipe,
    },
    recentRecipeIds: putReferenceFirst(collections.recentRecipeIds, recipeId),
  };
}

export function registerCanonicalRecipe(
  collections: CanonicalRecipeCollections,
  recipe: Recipe,
  origin: Exclude<CanonicalRecipeOrigin, 'scan' | 'description'>,
  createdAt = new Date().toISOString(),
): CanonicalRecipeCollections {
  const recipeId = recipe.id.trim();
  if (!recipeId || !isUsableCanonicalRecipe(recipe) || isMockOrDemoRecipe(recipe)) {
    return collections;
  }

  const existing = resolveCanonicalRecipe(collections.recipesById, recipeId);
  if (existing) {
    return collections;
  }

  const canonicalRecipe: CanonicalRecipe = {
    ...recipe,
    id: recipeId,
    recipeId,
    sourceRecipeId: recipe.id,
    origin,
    originalImage: null,
    detectedDishName: recipe.title,
    correctedDishName: null,
    selectedMode: recipe.mode,
    selectedPresentationMode: getInitialPresentationMode(recipe.mode),
    completionState: 'ready',
    isSaved: false,
    createdAt,
    scanCompletedAt: createdAt,
    scanResult: null,
  };

  return {
    ...collections,
    recipesById: {
      ...collections.recipesById,
      [recipeId]: canonicalRecipe,
    },
  };
}

export function saveCanonicalRecipe(
  collections: CanonicalRecipeCollections,
  recipeId: string,
  savedAt = new Date().toISOString(),
): CanonicalRecipeCollections {
  const recipe = resolveCanonicalRecipe(collections.recipesById, recipeId);
  if (!recipe || isMockOrDemoRecipe(recipe)) {
    return collections;
  }

  return {
    ...collections,
    recipesById: {
      ...collections.recipesById,
      [recipeId]: {
        ...recipe,
        isSaved: true,
        savedAt: recipe.savedAt ?? savedAt,
      },
    },
    savedRecipeIds: appendUniqueReference(collections.savedRecipeIds, recipeId),
  };
}

export function removeCanonicalSavedRecipe(
  collections: CanonicalRecipeCollections,
  recipeId: string,
): CanonicalRecipeCollections {
  const recipe = resolveCanonicalRecipe(collections.recipesById, recipeId);

  return {
    ...collections,
    recipesById: recipe
      ? {
          ...collections.recipesById,
          [recipeId]: {
            ...recipe,
            isSaved: false,
            savedAt: undefined,
          },
        }
      : collections.recipesById,
    savedRecipeIds: collections.savedRecipeIds.filter((id) => id !== recipeId),
  };
}

export function toggleCanonicalRecipeLiked(
  collections: CanonicalRecipeCollections,
  recipeId: string,
  likedAt = new Date().toISOString(),
): CanonicalRecipeCollections {
  return collections.savedRecipeIds.includes(recipeId)
    ? removeCanonicalSavedRecipe(collections, recipeId)
    : saveCanonicalRecipe(collections, recipeId, likedAt);
}

export function addCanonicalRecipeToGrocery(
  collections: CanonicalRecipeCollections,
  recipeId: string,
): CanonicalRecipeCollections {
  if (!resolveCanonicalRecipe(collections.recipesById, recipeId)) {
    return collections;
  }

  return {
    ...collections,
    groceryRecipeIds: appendUniqueReference(collections.groceryRecipeIds, recipeId),
  };
}

export function updateCanonicalRecipe(
  collections: CanonicalRecipeCollections,
  recipeId: string,
  update: Partial<Recipe>,
): CanonicalRecipeCollections {
  const recipe = resolveCanonicalRecipe(collections.recipesById, recipeId);
  if (!recipe) {
    return collections;
  }

  return {
    ...collections,
    recipesById: {
      ...collections.recipesById,
      [recipeId]: {
        ...recipe,
        ...update,
        id: recipeId,
        recipeId,
        originalImage: recipe.originalImage,
        imageUri: recipe.imageUri,
        imageUrl: recipe.imageUrl,
      },
    },
  };
}

export function confirmCanonicalRecipeIdentification(
  collections: CanonicalRecipeCollections,
  recipeId: string,
  confirmedAt = new Date().toISOString(),
): CanonicalRecipeCollections {
  const recipe = resolveCanonicalRecipe(collections.recipesById, recipeId);
  if (!recipe || recipe.identificationConfirmedAt) {
    return collections;
  }

  return {
    ...collections,
    recipesById: {
      ...collections.recipesById,
      [recipeId]: {
        ...recipe,
        identificationConfirmedAt: confirmedAt,
      },
    },
  };
}

export function correctCanonicalRecipe(
  collections: CanonicalRecipeCollections,
  recipeId: string,
  correctedRecipe: Recipe,
  correctedScan: ScanResult,
): CanonicalRecipeCollections {
  const recipe = resolveCanonicalRecipe(collections.recipesById, recipeId);
  const normalizedRecipe = normalizeRecipeForCanonicalStorage(correctedRecipe);
  if (
    !recipe ||
    !normalizedRecipe ||
    !isUsableCanonicalRecipe(normalizedRecipe)
  ) {
    return collections;
  }

  const stableScan: ScanResult = {
    ...correctedScan,
    recipeId,
  };
  const merged: CanonicalRecipe = {
    ...recipe,
    ...normalizedRecipe,
    id: recipeId,
    recipeId,
    sourceRecipeId: normalizedRecipe.id,
    origin: recipe.origin,
    originalImage: recipe.originalImage,
    imageStatus: recipe.imageStatus,
    imageUri: recipe.imageUri,
    imageUrl: recipe.imageUrl,
    detectedDishName: recipe.detectedDishName,
    correctedDishName: correctedScan.dishName || correctedRecipe.title,
    mode: recipe.selectedMode,
    selectedMode: recipe.selectedMode,
    selectedPresentationMode: recipe.selectedPresentationMode,
    completionState: recipe.completionState,
    identificationConfirmedAt: recipe.identificationConfirmedAt ?? new Date().toISOString(),
    isSaved: recipe.isSaved,
    createdAt: recipe.createdAt,
    scanCompletedAt: recipe.scanCompletedAt,
    savedAt: recipe.savedAt,
    cookingCompletedAt: recipe.cookingCompletedAt,
    scanResult: stableScan,
  };

  return {
    ...collections,
    recipesById: {
      ...collections.recipesById,
      [recipeId]: merged,
    },
  };
}

export function setCanonicalRecipeMode(
  collections: CanonicalRecipeCollections,
  recipeId: string,
  selectedMode: RecipeMode,
): CanonicalRecipeCollections {
  const recipe = resolveCanonicalRecipe(collections.recipesById, recipeId);
  if (!recipe) {
    return collections;
  }

  return {
    ...collections,
    recipesById: {
      ...collections.recipesById,
      [recipeId]: {
        ...recipe,
        selectedMode,
      },
    },
  };
}

export function setCanonicalRecipePresentationMode(
  collections: CanonicalRecipeCollections,
  recipeId: string,
  selectedPresentationMode: RecipePresentationMode,
): CanonicalRecipeCollections {
  const recipe = resolveCanonicalRecipe(collections.recipesById, recipeId);
  if (!recipe || recipe.selectedPresentationMode === selectedPresentationMode) {
    return collections;
  }

  return {
    ...collections,
    recipesById: {
      ...collections.recipesById,
      [recipeId]: {
        ...recipe,
        selectedPresentationMode,
      },
    },
  };
}

export function setCanonicalRecipeCompletion(
  collections: CanonicalRecipeCollections,
  recipeId: string,
  completionState: RecipeCompletionState,
  completedAt = new Date().toISOString(),
): CanonicalRecipeCollections {
  const recipe = resolveCanonicalRecipe(collections.recipesById, recipeId);
  if (!recipe) {
    return collections;
  }

  return {
    ...collections,
    recipesById: {
      ...collections.recipesById,
      [recipeId]: {
        ...recipe,
        completionState,
        cookingCompletedAt: completionState === 'completed'
          ? recipe.cookingCompletedAt ?? completedAt
          : recipe.cookingCompletedAt,
      },
    },
  };
}

export function resolveCanonicalRecipe(
  recipesById: Record<string, CanonicalRecipe>,
  recipeId: string | null | undefined,
): CanonicalRecipe | null {
  if (!recipeId) {
    return null;
  }

  const recipe = recipesById[recipeId];
  return recipe?.recipeId === recipeId && recipe.id === recipeId ? recipe : null;
}

export function resolveCanonicalRecipes(
  recipesById: Record<string, CanonicalRecipe>,
  recipeIds: string[],
): CanonicalRecipe[] {
  return recipeIds.flatMap((recipeId) => {
    const recipe = resolveCanonicalRecipe(recipesById, recipeId);
    return recipe ? [recipe] : [];
  });
}

export function resolveRecentRecipes(
  recipesById: Record<string, CanonicalRecipe>,
  recentRecipeIds: string[],
): CanonicalRecipe[] {
  return resolveCanonicalRecipes(recipesById, recentRecipeIds)
    .filter((recipe) => recipe.origin === 'scan' || recipe.origin === 'description')
    .sort((a, b) => getTimestamp(b.scanCompletedAt) - getTimestamp(a.scanCompletedAt));
}

export function getRecipeIngredientPreview(recipe: Pick<Recipe, 'ingredients'>, limit = 3) {
  return recipe.ingredients
    .map((ingredient) => ingredient.name.trim())
    .filter(Boolean)
    .slice(0, limit)
    .join(' · ');
}

export function isUsableCanonicalRecipe(recipe: Recipe | null | undefined): recipe is Recipe {
  return Boolean(
    recipe &&
    typeof recipe.id === 'string' &&
    recipe.id.trim() &&
    typeof recipe.title === 'string' &&
    recipe.title.trim() &&
    Array.isArray(recipe.ingredients) &&
    recipe.ingredients.some((ingredient) => ingredient?.name?.trim()) &&
    Array.isArray(recipe.steps) &&
    recipe.steps.some((step) => typeof step === 'string' && step.trim()),
  );
}

export function isMockOrDemoRecipe(recipe: Recipe | null | undefined) {
  if (!recipe) {
    return false;
  }

  const searchable = [
    recipe.id,
    recipe.scanResultId,
    recipe.confidenceNote,
  ].filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  return searchable.includes('mock') || searchable.includes('demo');
}

export function getCanonicalScanRecipeId(scanSessionId: string) {
  return `recipe-${scanSessionId}`;
}

function createCanonicalScanRecipe(input: {
  completedAt: string;
  image: ScanImageMetadata | null;
  recipe: Recipe;
  recipeId: string;
  scan: ScanResult;
  selectedMode: RecipeMode;
  source: ScanSource;
}): CanonicalRecipe {
  const originalImage = getPersistableImage(input.image);
  const imageUri = getRealImageUri(originalImage) ?? input.recipe.imageUri;
  const stableScan: ScanResult = {
    ...input.scan,
    recipeId: input.recipeId,
  };

  return {
    ...input.recipe,
    id: input.recipeId,
    recipeId: input.recipeId,
    sourceRecipeId: input.recipe.id,
    origin: input.source === 'description' ? 'description' : 'scan',
    originalImage,
    imageStatus: imageUri ? 'ready' : input.recipe.imageStatus,
    imageUri,
    imageUrl: imageUri ?? input.recipe.imageUrl,
    detectedDishName: input.scan.dishName,
    correctedDishName: null,
    selectedMode: input.selectedMode,
    selectedPresentationMode: getInitialPresentationMode(input.selectedMode),
    completionState: 'ready',
    isSaved: false,
    createdAt: input.completedAt,
    scanCompletedAt: input.completedAt,
    scanResult: stableScan,
  };
}

export function getInitialPresentationMode(mode: RecipeMode): RecipePresentationMode {
  switch (mode) {
    case 'Healthier':
      return 'Healthier';
    case 'Lighter':
      return 'Lighter';
    case 'More Protein':
      return 'More Protein';
    case 'Normal':
    default:
      return 'Normal';
  }
}

function getPersistableImage(image: ScanImageMetadata | null): ScanImageMetadata | null {
  if (!image) {
    return null;
  }

  const { dataUrl: _dataUrl, ...persistableImage } = image;
  return persistableImage;
}

function getRealImageUri(image: ScanImageMetadata | null) {
  return image && !image.placeholder && typeof image.uri === 'string' && image.uri.trim()
    ? image.uri.trim()
    : undefined;
}

function appendUniqueReference(recipeIds: string[], recipeId: string) {
  return recipeIds.includes(recipeId) ? recipeIds : [...recipeIds, recipeId];
}

function putReferenceFirst(recipeIds: string[], recipeId: string) {
  return [recipeId, ...recipeIds.filter((id) => id !== recipeId)];
}

function getTimestamp(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
