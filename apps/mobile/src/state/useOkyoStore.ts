import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AiDebugMetadata, ScanImageMetadata, ScanRejectionType, ScanSource, ScanStatus } from '../api/types';
import {
  type Recipe,
  type RecipeMode,
  type ScanResult,
} from '../mocks';
import { copyToDocuments } from '../utils/scanImageStorage';
import { migrateOkyoPersistedState } from './persistedStateMigration';

export type LatestScanFailure = {
  status: Exclude<ScanStatus, 'success' | 'partial'>;
  rejectionType: ScanRejectionType;
  rejectionReason: string;
};

export type LatestScanSession = {
  scanSessionId: string;
  latestScanStatus: ScanStatus | 'pending';
  latestScanResult: ScanResult | null;
  latestScanFailure: LatestScanFailure | null;
  latestScanRecipe: Recipe | null;
  selectedScanImage: ScanImageMetadata | null;
  latestAiDebugMetadata: AiDebugMetadata | null;
  source: ScanSource;
  updatedAt: string;
};

type LatestScanSessionWrite = Omit<LatestScanSession, 'updatedAt'> & {
  reason: string;
};

type LatestScanClear = {
  reason: string;
  source: string;
};

type SavedRecipeContextWrite = {
  recipe: Recipe;
  reason: string;
  source: string;
};

export type CookingProgress = { recipeId: string; stepIndex: number; completed: boolean };

type OkyoState = {
  scanSessionId: string | null;
  latestScanSession: LatestScanSession | null;
  latestScanResult: ScanResult | null;
  latestScanStatus: ScanStatus | 'pending' | null;
  latestScanFailure: LatestScanFailure | null;
  latestScanRecipe: Recipe | null;
  selectedScanImage: ScanImageMetadata | null;
  latestAiDebugMetadata: AiDebugMetadata | null;
  selectedMode: RecipeMode;
  savedRecipes: Recipe[];
  recentScanRecipes: Recipe[];
  groceryRecipeIds: string[];
  groceryCheckedItemIds: string[];
  groceryClearedItemIds: string[];
  cookingProgress: CookingProgress | null;
  beginLatestScanSession: (scanSession: LatestScanSessionWrite) => void;
  writeLatestScanSession: (scanSession: LatestScanSessionWrite) => void;
  clearLatestScan: (clear: LatestScanClear) => void;
  writeSavedRecipeContext: (context: SavedRecipeContextWrite) => void;
  setLatestScanResult: (scanResult: ScanResult | null) => void;
  setLatestScanStatus: (status: ScanStatus | 'pending' | null) => void;
  setLatestScanFailure: (failure: LatestScanFailure | null) => void;
  setLatestScanRecipe: (recipe: Recipe | null) => void;
  setSelectedScanImage: (image: ScanImageMetadata | null) => void;
  setLatestAiDebugMetadata: (metadata: AiDebugMetadata | null) => void;
  setSelectedMode: (mode: RecipeMode) => void;
  saveRecipe: (recipe: Recipe) => void;
  removeSavedRecipe: (recipeId: string) => void;
  addRecipeToGrocery: (recipeId: string) => void;
  removeRecipeFromGrocery: (recipeId: string) => void;
  toggleGroceryItem: (itemId: string) => void;
  clearCompletedGroceryItems: () => void;
  setCookingProgress: (progress: CookingProgress | null) => void;
  clearSavedData: () => void;
};

export const useOkyoStore = create<OkyoState>()(
  persist(
    (set, get) => ({
      scanSessionId: null,
      latestScanSession: null,
      latestScanResult: null,
      latestScanStatus: null,
      latestScanFailure: null,
      latestScanRecipe: null,
      selectedScanImage: null,
      latestAiDebugMetadata: null,
      selectedMode: 'Restaurant Copy',
      savedRecipes: [],
      recentScanRecipes: [],
      groceryRecipeIds: [],
      groceryCheckedItemIds: [],
      groceryClearedItemIds: [],
      cookingProgress: null,
      beginLatestScanSession: (scanSession) => {
        let outgoingScanImageUri: string | undefined;
        set((state) => {
          outgoingScanImageUri = getScanImageUriForCleanup(state);
          if (hasAnyLatestScanState(state)) {
            logScanStateClear({
              previousScanSessionId: state.scanSessionId,
              previousStatus: state.latestScanStatus,
              reason: scanSession.reason,
              source: 'beginLatestScanSession',
            });
          }

          const latestScanSession = createLatestScanSession(scanSession);
          logScanStateWrite({ ...getLatestScanSessionSummary(latestScanSession), reason: scanSession.reason });

          return getLatestScanSessionState(latestScanSession);
        });
        if (outgoingScanImageUri) {
          deleteUnusedScanImage(outgoingScanImageUri, useOkyoStore.getState().savedRecipes);
        }
      },
      writeLatestScanSession: (scanSession) =>
        set((state) => {
          if (state.scanSessionId && state.scanSessionId !== scanSession.scanSessionId) {
            logScanStateWrite({
              ignored: true,
              reason: scanSession.reason,
              scanSessionId: scanSession.scanSessionId,
              activeScanSessionId: state.scanSessionId,
              status: scanSession.latestScanStatus,
            });
            return state;
          }
          if (
            state.latestScanSession?.scanSessionId === scanSession.scanSessionId &&
            state.latestScanSession.latestScanStatus === 'success' &&
            scanSession.latestScanStatus === 'pending'
          ) {
            logScanStateWrite({
              ignored: true,
              reason: scanSession.reason,
              scanSessionId: scanSession.scanSessionId,
              activeScanSessionId: state.scanSessionId,
              status: scanSession.latestScanStatus,
              previousStatus: state.latestScanSession.latestScanStatus,
            });
            return state;
          }

          const latestScanSession = createLatestScanSession(scanSession);
          logScanStateWrite({ ...getLatestScanSessionSummary(latestScanSession), reason: scanSession.reason });

          return {
            ...getLatestScanSessionState(latestScanSession),
            recentScanRecipes: addRecentScanRecipe(state.recentScanRecipes, latestScanSession.latestScanRecipe),
          };
        }),
      clearLatestScan: (clear) => {
        let outgoingScanImageUri: string | undefined;
        set((state) => {
          outgoingScanImageUri = getScanImageUriForCleanup(state);
          logScanStateClear({
            previousScanSessionId: state.scanSessionId,
            previousStatus: state.latestScanStatus,
            reason: clear.reason,
            source: clear.source,
          });

          return getClearedLatestScanState();
        });
        if (outgoingScanImageUri) {
          deleteUnusedScanImage(outgoingScanImageUri, useOkyoStore.getState().savedRecipes);
        }
      },
      writeSavedRecipeContext: (context) =>
        set((state) => {
          logScanStateClear({
            previousScanSessionId: state.scanSessionId,
            previousStatus: state.latestScanStatus,
            preservedScanSessionId: state.latestScanSession?.scanSessionId ?? null,
            reason: context.reason,
            scope: 'legacy_saved_recipe_context',
            source: context.source,
          });

          return {
            latestAiDebugMetadata: null,
            latestScanFailure: null,
            latestScanRecipe: context.recipe,
            latestScanResult: null,
            latestScanStatus: null,
            latestScanSession: null,
            selectedScanImage: null,
          };
        }),
      setLatestScanResult: (scanResult) => set({ latestScanResult: scanResult }),
      setLatestScanStatus: (status) => set({ latestScanStatus: status }),
      setLatestScanFailure: (failure) => set({ latestScanFailure: failure }),
      setLatestScanRecipe: (recipe) => set({ latestScanRecipe: recipe }),
      setSelectedScanImage: (image) => set({ selectedScanImage: image }),
      setLatestAiDebugMetadata: (metadata) => set({ latestAiDebugMetadata: metadata }),
      setSelectedMode: (mode) => set({ selectedMode: mode }),
      saveRecipe: (recipe) => {
        set((state) => {
          const existingRecipe = state.savedRecipes.find((savedRecipe) => savedRecipe.id === recipe.id);
          if (!existingRecipe) {
            return { savedRecipes: [...state.savedRecipes, { ...recipe, savedAt: new Date().toISOString() }] };
          }

          const realRecipeImageUri = getRecipeRealImageUri(recipe);
          if (!realRecipeImageUri) {
            return { savedRecipes: state.savedRecipes };
          }

          return {
            savedRecipes: state.savedRecipes.map((savedRecipe) =>
              savedRecipe.id === recipe.id
                ? attachRecipeImageUri(savedRecipe, realRecipeImageUri)
                : savedRecipe,
            ),
          };
        });

        const state = get();
        const imageUri = getRecipeRealImageUri(recipe);
        if (!imageUri || imageUri.includes('/okyo-scan-images/')) return;
        const scanImage = state.selectedScanImage?.uri === imageUri
          ? state.selectedScanImage
          : { uri: imageUri, mimeType: 'image/jpeg', placeholder: false };
        void copyToDocuments(scanImage, { requestId: state.scanSessionId ?? undefined })
          .then((persistedImage) => {
            if (!persistedImage.uri || persistedImage.uri === imageUri) return;
            set((latestState) => ({
              savedRecipes: latestState.savedRecipes.map((savedRecipe) =>
                savedRecipe.id === recipe.id
                  ? attachRecipeImageUri(savedRecipe, persistedImage.uri!)
                  : savedRecipe,
              ),
            }));
          });
      },
      removeSavedRecipe: (recipeId) => {
        let imageUri: string | undefined;
        set((state) => {
          const recipe = state.savedRecipes.find((r) => r.id === recipeId);
          imageUri = recipe?.imageUri;
          return {
            groceryRecipeIds: state.groceryRecipeIds.filter((id) => id !== recipeId),
            savedRecipes: state.savedRecipes.filter((r) => r.id !== recipeId),
          };
        });
        if (imageUri?.includes('/okyo-scan-images/')) {
          FileSystem.deleteAsync(imageUri, { idempotent: true }).catch((error: unknown) => {
            logDev('okyo_scan_image_delete_failed', { recipeId, uri: imageUri, error: String(error) });
          });
        }
      },
      addRecipeToGrocery: (recipeId) => set((state) => ({
        groceryRecipeIds: state.groceryRecipeIds.includes(recipeId)
          ? state.groceryRecipeIds
          : [...state.groceryRecipeIds, recipeId],
      })),
      removeRecipeFromGrocery: (recipeId) => set((state) => ({
        groceryRecipeIds: state.groceryRecipeIds.filter((id) => id !== recipeId),
      })),
      toggleGroceryItem: (itemId) => set((state) => ({
        groceryCheckedItemIds: state.groceryCheckedItemIds.includes(itemId)
          ? state.groceryCheckedItemIds.filter((id) => id !== itemId)
          : [...state.groceryCheckedItemIds, itemId],
      })),
      clearCompletedGroceryItems: () => set((state) => ({
        groceryCheckedItemIds: [],
        groceryClearedItemIds: [...new Set([...state.groceryClearedItemIds, ...state.groceryCheckedItemIds])].slice(-1000),
      })),
      setCookingProgress: (cookingProgress) => set({ cookingProgress }),
      clearSavedData: () => {
        set((state) => {
          logScanStateClear({
            previousScanSessionId: state.scanSessionId,
            previousStatus: state.latestScanStatus,
            reason: 'clear_saved_data',
            source: 'useOkyoStore.clearSavedData',
          });

          return {
            savedRecipes: [],
            recentScanRecipes: [],
            groceryRecipeIds: [],
            groceryCheckedItemIds: [],
            groceryClearedItemIds: [],
            cookingProgress: null,
            ...getClearedLatestScanState(),
          };
        });
        const dir = `${FileSystem.documentDirectory}okyo-scan-images/`;
        FileSystem.deleteAsync(dir, { idempotent: true }).catch((error: unknown) => {
          logDev('okyo_scan_images_dir_delete_failed', { dir, error: String(error) });
        });
      },
    }),
    {
      name: 'okyo-local-state',
      version: 3,
      // Defensive: if AsyncStorage returns a corrupted/unexpected shape (bad
      // JSON survived parsing as e.g. a string or array), fall back to
      // defaults rather than crashing app startup. Version 2 also removes
      // persisted fields that belonged to retired mock product surfaces.
      migrate: migrateOkyoPersistedState,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        scanSessionId: state.scanSessionId,
        latestScanSession: state.latestScanSession,
        latestScanResult: state.latestScanResult,
        latestScanStatus: state.latestScanStatus,
        latestScanFailure: state.latestScanFailure,
        latestScanRecipe: state.latestScanRecipe,
        selectedScanImage: state.selectedScanImage,
        latestAiDebugMetadata: state.latestAiDebugMetadata,
        selectedMode: state.selectedMode,
        savedRecipes: state.savedRecipes,
        recentScanRecipes: state.recentScanRecipes,
        groceryRecipeIds: state.groceryRecipeIds,
        groceryCheckedItemIds: state.groceryCheckedItemIds,
        groceryClearedItemIds: state.groceryClearedItemIds,
        cookingProgress: state.cookingProgress,
      }),
    },
  ),
);

function addRecentScanRecipe(current: Recipe[], recipe: Recipe | null): Recipe[] {
  if (!recipe?.id || !recipe.title?.trim()) return Array.isArray(current) ? current : [];
  const existing = Array.isArray(current) ? current : [];
  return [{ ...recipe }, ...existing.filter((item) => item?.id !== recipe.id)].slice(0, 12);
}

function createLatestScanSession(scanSession: LatestScanSessionWrite): LatestScanSession {
  const realScanImageUri = getRealScanImageUri(scanSession.selectedScanImage);
  const latestScanRecipe = attachScanImageUri(scanSession.latestScanRecipe, realScanImageUri);

  return {
    ...scanSession,
    latestScanRecipe,
    updatedAt: new Date().toISOString(),
  };
}

function getRealScanImageUri(image: ScanImageMetadata | null | undefined) {
  return typeof image?.uri === 'string' && image.uri.trim().length > 0 && !image.placeholder
    ? image.uri.trim()
    : null;
}

function attachScanImageUri<T extends Recipe | null>(recipe: T, imageUri: string | null): T {
  if (!recipe || !imageUri) {
    return recipe;
  }

  return attachRecipeImageUri(recipe, imageUri) as T;
}

function attachRecipeImageUri(recipe: Recipe, imageUri: string): Recipe {
  return {
    ...recipe,
    imageStatus: 'ready',
    imageUri,
    imageUrl: imageUri,
  };
}

function getRecipeRealImageUri(recipe: Recipe) {
  return typeof recipe.imageUri === 'string' && recipe.imageUri.trim().length > 0
    ? recipe.imageUri.trim()
    : null;
}

function getLatestScanSessionState(latestScanSession: LatestScanSession) {
  return {
    scanSessionId: latestScanSession.scanSessionId,
    latestScanSession,
    latestScanResult: latestScanSession.latestScanResult,
    latestScanStatus: latestScanSession.latestScanStatus,
    latestScanFailure: latestScanSession.latestScanFailure,
    latestScanRecipe: latestScanSession.latestScanRecipe,
    selectedScanImage: latestScanSession.selectedScanImage,
    latestAiDebugMetadata: latestScanSession.latestAiDebugMetadata,
  };
}

function getClearedLatestScanState() {
  return {
    scanSessionId: null,
    latestScanSession: null,
    latestScanFailure: null,
    latestScanResult: null,
    latestScanStatus: null,
    latestScanRecipe: null,
    selectedScanImage: null,
    latestAiDebugMetadata: null,
  };
}

function hasAnyLatestScanState(state: Pick<
  OkyoState,
  | 'scanSessionId'
  | 'latestScanSession'
  | 'latestScanResult'
  | 'latestScanStatus'
  | 'latestScanRecipe'
  | 'selectedScanImage'
>) {
  return Boolean(
    state.scanSessionId ||
    state.latestScanSession ||
    state.latestScanResult ||
    state.latestScanStatus ||
    state.latestScanRecipe ||
    state.selectedScanImage
  );
}

function getLatestScanSessionSummary(scanSession: LatestScanSession) {
  return {
    scanSessionId: scanSession.scanSessionId,
    status: scanSession.latestScanStatus,
    scanResultExists: Boolean(scanSession.latestScanResult),
    recipeExists: Boolean(scanSession.latestScanRecipe),
    selectedScanImageExists: Boolean(scanSession.selectedScanImage),
    source: scanSession.source,
  };
}

function logScanStateWrite(details: Record<string, unknown>) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  console.log('okyo_scan_state_write', details);
}

function logScanStateClear(details: Record<string, unknown>) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  console.log('okyo_scan_state_clear', details);
  console.log('okyo_scan_state_clear_reason', {
    reason: details.reason,
    source: details.source,
    previousScanSessionId: details.previousScanSessionId,
    previousStatus: details.previousStatus,
  });
}

function logDev(label: string, details: Record<string, unknown>) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  console.log(label, details);
}

// Returns the current scan image URI only if it is a file we own in Documents.
// Used to clean up unsaved scan images when a session ends.
function getScanImageUriForCleanup(state: Pick<OkyoState, 'selectedScanImage'>): string | undefined {
  const uri = state.selectedScanImage?.uri;
  if (!uri || state.selectedScanImage?.placeholder) {
    return undefined;
  }
  return uri.includes('/okyo-scan-images/') ? uri : undefined;
}

// Deletes a scan image file from Documents if no saved recipe references it.
// Called when a scan session ends (scan again, new scan, back to scan).
function deleteUnusedScanImage(uri: string, savedRecipes: Recipe[]) {
  const isReferenced = savedRecipes.some(
    (recipe) => (recipe as Recipe & { imageUri?: string }).imageUri === uri,
  );
  if (isReferenced) {
    logDev('okyo_scan_image_cleanup_skipped', { uri, reason: 'referenced_by_saved_recipe' });
    return;
  }
  FileSystem.deleteAsync(uri, { idempotent: true }).catch((error: unknown) => {
    logDev('okyo_scan_image_cleanup_failed', { uri, error: String(error) });
  });
}
