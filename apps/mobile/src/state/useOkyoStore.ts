import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { analyticsEvents, track } from '../analytics/track';
import type { AiDebugMetadata, ScanImageMetadata, ScanRejectionType, ScanStatus } from '../api/types';
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

type OkyoState = {
  hasCompletedOnboarding: boolean;
  onboardingGoal: OnboardingGoal | null;
  latestScanResult: ScanResult | null;
  latestScanStatus: ScanStatus | 'pending' | null;
  latestScanFailure: LatestScanFailure | null;
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
  setLatestScanResult: (scanResult: ScanResult | null) => void;
  setLatestScanStatus: (status: ScanStatus | 'pending' | null) => void;
  setLatestScanFailure: (failure: LatestScanFailure | null) => void;
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
      latestScanResult: null,
      latestScanStatus: null,
      latestScanFailure: null,
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
      setLatestScanResult: (scanResult) => set({ latestScanResult: scanResult }),
      setLatestScanStatus: (status) => set({ latestScanStatus: status }),
      setLatestScanFailure: (failure) => set({ latestScanFailure: failure }),
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
        set({
          savedRecipes: [],
          completedChallenges: [],
          totalMoneySaved: 0,
          xp: 0,
          unlockedBadges: [],
          recentBadgeUnlock: null,
          awardedXpEvents: [],
          latestScanFailure: null,
          latestScanResult: null,
          latestScanStatus: null,
          selectedScanImage: null,
          latestAiDebugMetadata: null,
        }),
    }),
    {
      name: 'okyo-local-state',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        onboardingGoal: state.onboardingGoal,
        latestScanResult: state.latestScanResult,
        latestScanStatus: state.latestScanStatus,
        latestScanFailure: state.latestScanFailure,
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
