import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { analyticsEvents, track } from '../analytics/track';
import type { AiDebugMetadata, ScanImageMetadata, ScanRejectionType, ScanSource, ScanStatus } from '../api/types';
import {
  mockLeaderboardEntries,
  type LeaderboardEntry,
  type Recipe,
  type RecipeMode,
  type ScanResult,
} from '../mocks';

export type OnboardingGoal =
  | 'Save money'
  | 'Eat healthier'
  | 'Recreate restaurant meals'
  | 'Learn to cook'
  | 'Make food content';

export type OnboardingWeeklyGoal = '1_meal' | '3_meals' | '5_meals' | '7_meals';
export type OnboardingMealRoutinePreference =
  | 'quick_easy'
  | 'high_protein'
  | 'budget_meals'
  | 'restaurant_style';
export type OnboardingNotificationChoice = 'remind_me' | 'not_now';

export type CompletedChallenge = {
  id: string;
  recipeId: string;
  recipeTitle: string;
  mode: RecipeMode;
  rating: ChallengeRating;
  completedAt: string;
  matchScore: number;
  moneySaved: number;
  xpEarned: number;
  badgeUnlocked?: string;
};

export type ChallengeRating = 'Nailed it' | 'Pretty close' | 'Needs work' | 'Not close';

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

type OkyoState = {
  hasCompletedOnboarding: boolean;
  hasSeenOnboarding: boolean;
  onboardingGoal: OnboardingGoal | null;
  weeklyGoal: OnboardingWeeklyGoal | null;
  mealRoutinePreference: OnboardingMealRoutinePreference | null;
  notificationChoice: OnboardingNotificationChoice | null;
  firstOnboardingScanCompleted: boolean;
  firstOnboardingResultSeen: boolean;
  paywallShown: boolean;
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
  completedChallenges: CompletedChallenge[];
  totalMoneySaved: number;
  weeklyScanCount: number;
  isPremium: boolean;
  xp: number;
  unlockedBadges: string[];
  recentBadgeUnlock: string | null;
  awardedXpEvents: string[];
  leaderboardEntries: LeaderboardEntry[];
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setGoal: (goal: OnboardingGoal) => void;
  setWeeklyGoal: (goal: OnboardingWeeklyGoal) => void;
  setMealRoutinePreference: (preference: OnboardingMealRoutinePreference) => void;
  setNotificationChoice: (choice: OnboardingNotificationChoice) => void;
  markFirstOnboardingScanCompleted: () => void;
  markFirstOnboardingResultSeen: () => void;
  markPaywallShown: () => void;
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
  markRecipeCooked: (recipe: Recipe) => void;
  removeSavedRecipe: (recipeId: string) => void;
  completeChallenge: (challenge: CompletedChallenge) => void;
  incrementMoneySaved: (amount: number) => void;
  incrementWeeklyScanCount: () => void;
  addXP: (points: number) => void;
  awardXPOnce: (eventId: string, points: number) => void;
  unlockBadge: (badgeId: string) => void;
  clearRecentBadgeUnlock: () => void;
  setPremium: (isPremium: boolean) => void;
  clearSavedData: () => void;
};

export const useOkyoStore = create<OkyoState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      hasSeenOnboarding: false,
      onboardingGoal: null,
      weeklyGoal: null,
      mealRoutinePreference: null,
      notificationChoice: null,
      firstOnboardingScanCompleted: false,
      firstOnboardingResultSeen: false,
      paywallShown: false,
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
      completedChallenges: [],
      totalMoneySaved: 0,
      weeklyScanCount: 0,
      isPremium: false,
      xp: 0,
      unlockedBadges: [],
      recentBadgeUnlock: null,
      awardedXpEvents: [],
      leaderboardEntries: mockLeaderboardEntries,
      completeOnboarding: () => set({ hasCompletedOnboarding: true, hasSeenOnboarding: true }),
      resetOnboarding: () =>
        set({
          hasCompletedOnboarding: false,
          hasSeenOnboarding: false,
          weeklyGoal: null,
          mealRoutinePreference: null,
          notificationChoice: null,
          firstOnboardingScanCompleted: false,
          firstOnboardingResultSeen: false,
          paywallShown: false,
        }),
      setGoal: (goal) => set({ onboardingGoal: goal }),
      setWeeklyGoal: (goal) => set({ weeklyGoal: goal, hasSeenOnboarding: true }),
      setMealRoutinePreference: (preference) => set({ mealRoutinePreference: preference }),
      setNotificationChoice: (choice) => set({ notificationChoice: choice }),
      markFirstOnboardingScanCompleted: () => set({ firstOnboardingScanCompleted: true }),
      markFirstOnboardingResultSeen: () => set({ firstOnboardingResultSeen: true }),
      markPaywallShown: () => set({ paywallShown: true }),
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

          return {
            ...getLatestScanSessionState(latestScanSession),
          };
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
      saveRecipe: (recipe) =>
        set((state) => {
          const existingRecipe = state.savedRecipes.find((savedRecipe) => savedRecipe.id === recipe.id);
          const now = new Date().toISOString();
          if (!existingRecipe) {
            return { savedRecipes: [...state.savedRecipes, { ...recipe, savedAt: recipe.savedAt ?? now }] };
          }

          const realRecipeImageUri = getRecipeRealImageUri(recipe);

          return {
            savedRecipes: state.savedRecipes.map((savedRecipe) =>
              savedRecipe.id === recipe.id
                ? mergeSavedRecipe(savedRecipe, recipe, realRecipeImageUri)
                : savedRecipe,
            ),
          };
        }),
      markRecipeCooked: (recipe) =>
        set((state) => {
          const existingRecipe = state.savedRecipes.find((savedRecipe) => savedRecipe.id === recipe.id);
          const now = new Date().toISOString();
          const realRecipeImageUri = getRecipeRealImageUri(recipe);
          if (!existingRecipe) {
            const nextRecipe = realRecipeImageUri ? attachRecipeImageUri(recipe, realRecipeImageUri) : recipe;
            return {
              savedRecipes: [
                ...state.savedRecipes,
                {
                  ...nextRecipe,
                  savedAt: nextRecipe.savedAt ?? now,
                  cookedCount: 1,
                  lastCookedAt: now,
                },
              ],
            };
          }

          return {
            savedRecipes: state.savedRecipes.map((savedRecipe) => {
              if (savedRecipe.id !== recipe.id) {
                return savedRecipe;
              }

              const mergedRecipe = mergeSavedRecipe(savedRecipe, recipe, realRecipeImageUri);
              return {
                ...mergedRecipe,
                cookedCount: getSavedCookedCount(mergedRecipe) + 1,
                lastCookedAt: now,
                savedAt: mergedRecipe.savedAt ?? now,
              };
            }),
          };
        }),
      removeSavedRecipe: (recipeId) => {
        let imageUri: string | undefined;
        set((state) => {
          const recipe = state.savedRecipes.find((r) => r.id === recipeId);
          imageUri = recipe?.imageUri;
          return { savedRecipes: state.savedRecipes.filter((r) => r.id !== recipeId) };
        });
        if (imageUri?.includes('/okyo-scan-images/')) {
          FileSystem.deleteAsync(imageUri, { idempotent: true }).catch((error: unknown) => {
            logDev('okyo_scan_image_delete_failed', { recipeId, uri: imageUri, error: String(error) });
          });
        }
      },
      completeChallenge: (challenge) =>
        set((state) => ({
          completedChallenges: state.completedChallenges.some(
            (completedChallenge) => completedChallenge.id === challenge.id,
          )
            ? state.completedChallenges
            : [...state.completedChallenges, challenge],
        })),
      incrementMoneySaved: (amount) =>
        set((state) => ({
          totalMoneySaved: state.totalMoneySaved + amount,
        })),
      incrementWeeklyScanCount: () =>
        set((state) => ({
          weeklyScanCount: state.weeklyScanCount + 1,
        })),
      addXP: (points) =>
        set((state) => {
          track(analyticsEvents.XP_EVENT_RECORDED, { xpAmount: points });

          return {
            xp: state.xp + points,
          };
        }),
      awardXPOnce: (eventId, points) =>
        set((state) => {
          if (state.awardedXpEvents.includes(eventId)) {
            return state;
          }

          track(analyticsEvents.XP_EVENT_RECORDED, { eventId, xpAmount: points });

          const newEvents = [...state.awardedXpEvents, eventId];
          return {
            awardedXpEvents: newEvents.length > 5000 ? newEvents.slice(-5000) : newEvents,
            xp: state.xp + points,
          };
        }),
      unlockBadge: (badgeId) =>
        set((state) => {
          if (state.unlockedBadges.includes(badgeId)) {
            return state;
          }

          track(analyticsEvents.BADGE_UNLOCKED, { badgeName: badgeId });

          return {
            recentBadgeUnlock: badgeId,
            unlockedBadges: [...state.unlockedBadges, badgeId],
          };
        }),
      clearRecentBadgeUnlock: () => set({ recentBadgeUnlock: null }),
      setPremium: (isPremium) => set({ isPremium }),
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
            completedChallenges: [],
            totalMoneySaved: 0,
            xp: 0,
            unlockedBadges: [],
            recentBadgeUnlock: null,
            awardedXpEvents: [],
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
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        hasSeenOnboarding: state.hasSeenOnboarding,
        onboardingGoal: state.onboardingGoal,
        weeklyGoal: state.weeklyGoal,
        mealRoutinePreference: state.mealRoutinePreference,
        notificationChoice: state.notificationChoice,
        firstOnboardingScanCompleted: state.firstOnboardingScanCompleted,
        firstOnboardingResultSeen: state.firstOnboardingResultSeen,
        paywallShown: state.paywallShown,
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
        completedChallenges: state.completedChallenges,
        totalMoneySaved: state.totalMoneySaved,
        weeklyScanCount: state.weeklyScanCount,
        isPremium: state.isPremium,
        xp: state.xp,
        unlockedBadges: state.unlockedBadges,
        awardedXpEvents: state.awardedXpEvents,
        leaderboardEntries: state.leaderboardEntries,
      }),
    },
  ),
);

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

function mergeSavedRecipe(existingRecipe: Recipe, incomingRecipe: Recipe, imageUri: string | null): Recipe {
  const mergedRecipe = {
    ...existingRecipe,
    ...incomingRecipe,
    savedAt: existingRecipe.savedAt ?? incomingRecipe.savedAt,
    cookedCount: existingRecipe.cookedCount ?? incomingRecipe.cookedCount,
    lastCookedAt: existingRecipe.lastCookedAt ?? incomingRecipe.lastCookedAt,
  };

  return imageUri ? attachRecipeImageUri(mergedRecipe, imageUri) : mergedRecipe;
}

function getSavedCookedCount(recipe: Recipe) {
  return typeof recipe.cookedCount === 'number' && Number.isFinite(recipe.cookedCount)
    ? Math.max(0, recipe.cookedCount)
    : 0;
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
