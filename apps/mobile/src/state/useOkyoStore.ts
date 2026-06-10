import AsyncStorage from '@react-native-async-storage/async-storage';
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
  latestScanRecipes: Recipe[];
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
  onboardingGoal: OnboardingGoal | null;
  scanSessionId: string | null;
  latestScanSession: LatestScanSession | null;
  latestScanResult: ScanResult | null;
  latestScanRecipes: Recipe[];
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
  beginLatestScanSession: (scanSession: LatestScanSessionWrite) => void;
  writeLatestScanSession: (scanSession: LatestScanSessionWrite) => void;
  clearLatestScan: (clear: LatestScanClear) => void;
  writeSavedRecipeContext: (context: SavedRecipeContextWrite) => void;
  setLatestScanResult: (scanResult: ScanResult | null) => void;
  setLatestScanRecipes: (recipes: Recipe[]) => void;
  setLatestScanStatus: (status: ScanStatus | 'pending' | null) => void;
  setLatestScanFailure: (failure: LatestScanFailure | null) => void;
  setLatestScanRecipe: (recipe: Recipe | null) => void;
  setSelectedScanImage: (image: ScanImageMetadata | null) => void;
  setLatestAiDebugMetadata: (metadata: AiDebugMetadata | null) => void;
  setSelectedMode: (mode: RecipeMode) => void;
  saveRecipe: (recipe: Recipe) => void;
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
      onboardingGoal: null,
      scanSessionId: null,
      latestScanSession: null,
      latestScanResult: null,
      latestScanRecipes: [],
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
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      resetOnboarding: () => set({ hasCompletedOnboarding: false }),
      setGoal: (goal) => set({ onboardingGoal: goal }),
      beginLatestScanSession: (scanSession) =>
        set((state) => {
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
        }),
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
      clearLatestScan: (clear) =>
        set((state) => {
          logScanStateClear({
            previousScanSessionId: state.scanSessionId,
            previousStatus: state.latestScanStatus,
            reason: clear.reason,
            source: clear.source,
          });

          return getClearedLatestScanState();
        }),
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
            latestScanRecipes: [context.recipe],
            latestScanResult: null,
            latestScanStatus: null,
            selectedScanImage: null,
          };
        }),
      setLatestScanResult: (scanResult) => set({ latestScanResult: scanResult }),
      setLatestScanRecipes: (recipes) => set({ latestScanRecipes: recipes }),
      setLatestScanStatus: (status) => set({ latestScanStatus: status }),
      setLatestScanFailure: (failure) => set({ latestScanFailure: failure }),
      setLatestScanRecipe: (recipe) => set({ latestScanRecipe: recipe }),
      setSelectedScanImage: (image) => set({ selectedScanImage: image }),
      setLatestAiDebugMetadata: (metadata) => set({ latestAiDebugMetadata: metadata }),
      setSelectedMode: (mode) => set({ selectedMode: mode }),
      saveRecipe: (recipe) =>
        set((state) => ({
          savedRecipes: state.savedRecipes.some((savedRecipe) => savedRecipe.id === recipe.id)
            ? state.savedRecipes
            : [...state.savedRecipes, recipe],
        })),
      removeSavedRecipe: (recipeId) =>
        set((state) => ({
          savedRecipes: state.savedRecipes.filter((recipe) => recipe.id !== recipeId),
        })),
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

          return {
            awardedXpEvents: [...state.awardedXpEvents, eventId],
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
      clearSavedData: () =>
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
        }),
    }),
    {
      name: 'okyo-local-state',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        onboardingGoal: state.onboardingGoal,
        scanSessionId: state.scanSessionId,
        latestScanSession: state.latestScanSession,
        latestScanResult: state.latestScanResult,
        latestScanRecipes: state.latestScanRecipes,
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
  return {
    ...scanSession,
    latestScanRecipes: Array.isArray(scanSession.latestScanRecipes) ? scanSession.latestScanRecipes : [],
    updatedAt: new Date().toISOString(),
  };
}

function getLatestScanSessionState(latestScanSession: LatestScanSession) {
  return {
    scanSessionId: latestScanSession.scanSessionId,
    latestScanSession,
    latestScanResult: latestScanSession.latestScanResult,
    latestScanRecipes: latestScanSession.latestScanRecipes,
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
    latestScanRecipes: [],
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
  | 'latestScanRecipes'
  | 'latestScanStatus'
  | 'latestScanRecipe'
  | 'selectedScanImage'
>) {
  return Boolean(
    state.scanSessionId ||
    state.latestScanSession ||
    state.latestScanResult ||
    state.latestScanRecipes.length > 0 ||
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
    recipesLength: scanSession.latestScanRecipes.length,
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
