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
import {
  addCanonicalRecipeToGrocery,
  cacheCanonicalRecipePresentationVariant,
  commitSuccessfulScan,
  confirmCanonicalRecipeIdentification,
  correctCanonicalRecipe,
  getCanonicalScanRecipeId,
  getCanonicalRecipePresentationVariant,
  getEmptyCanonicalRecipeCollections,
  isMockOrDemoRecipe,
  isUsableCanonicalRecipe,
  registerCanonicalRecipe,
  removeCanonicalSavedRecipe,
  resolveCanonicalRecipe,
  saveCanonicalRecipe,
  setCanonicalRecipeCompletion,
  setCanonicalRecipeMode,
  setCanonicalRecipePresentationMode,
  toggleCanonicalRecipeLiked,
  updateCanonicalRecipe,
  type CanonicalRecipe,
  type CanonicalRecipeCollections,
  type CanonicalRecipeOrigin,
  type RecipePresentationMode,
} from './canonicalRecipes';
import { onboardingPersistence } from './onboardingPersistence';
import { readPrimaryGoalFromProfile } from './primaryGoalBridge';
import type { PrimaryGoal } from '../onboarding-v3/state/personalizedOnboarding';
import { normalizeNutritionEstimate } from '../utils/nutrition';
import {
  isCurrentRecipeMode,
  migrateLegacyRecipeMode,
  normalizePersistedRecipeModeState,
} from '../utils/recipeModes';
import { normalizeRecipeTime } from '../utils/recipeIntegrity';
import {
  clearActiveCookingSession,
  createActiveCookingSession,
  isActiveCookingSession,
  updateActiveCookingSession,
  type ActiveCookingSession,
} from './activeCooking';
import { toggleGroceryIngredientSelection } from './groceryIngredientSelection';
import { createCompletedMeal, migrateLegacyCompletedMeals, sanitizeCompletedMeals, type CompletedMeal } from './completedMeals';

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
export type RecipeFeedback = {
  rating: 'loved' | 'okay' | 'disliked';
  reasons: string[];
  note?: string;
  createdAt: string;
  updatedAt?: string;
};

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
  mealDescription: string | null;
  source: ScanSource;
  updatedAt: string;
};

export type LatestScanSessionWrite = Omit<LatestScanSession, 'updatedAt'> & {
  reason: string;
};

type LatestScanClear = {
  preserveImageUri?: string;
  reason: string;
  source: string;
};

type OkyoState = {
  hasCompletedOnboarding: boolean;
  hasHydrated: boolean;
  hasSeenOnboarding: boolean;
  onboardingGoal: OnboardingGoal | null;
  primaryGoal: PrimaryGoal | null;
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
  mealDescription: string | null;
  selectedMode: RecipeMode;
  recipesById: Record<string, CanonicalRecipe>;
  recentRecipeIds: string[];
  savedRecipeIds: string[];
  groceryRecipeIds: string[];
  groceryIngredientSelections: Record<string, string[]>;
  recipeServingOverrides: Record<string, number>;
  activeCookingSession: ActiveCookingSession | null;
  completedMeals: CompletedMeal[];
  completedChallenges: CompletedChallenge[];
  recipeFeedbackById: Record<string, RecipeFeedback>;
  totalMoneySaved: number;
  weeklyScanCount: number;
  isPremium: boolean;
  xp: number;
  unlockedBadges: string[];
  recentBadgeUnlock: string | null;
  awardedXpEvents: string[];
  leaderboardEntries: LeaderboardEntry[];
  completeOnboarding: () => void;
  setOnboardingCompletionFromStorage: (completed: boolean) => void;
  setHasHydrated: (hydrated: boolean) => void;
  resetOnboarding: () => void;
  setGoal: (goal: OnboardingGoal) => void;
  refreshPrimaryGoal: () => Promise<void>;
  setWeeklyGoal: (goal: OnboardingWeeklyGoal) => void;
  setMealRoutinePreference: (preference: OnboardingMealRoutinePreference) => void;
  setNotificationChoice: (choice: OnboardingNotificationChoice) => void;
  markFirstOnboardingScanCompleted: () => void;
  markFirstOnboardingResultSeen: () => void;
  markPaywallShown: () => void;
  beginLatestScanSession: (scanSession: LatestScanSessionWrite) => void;
  writeLatestScanSession: (scanSession: LatestScanSessionWrite) => void;
  commitSuccessfulScanSession: (scanSession: LatestScanSessionWrite) => boolean;
  clearLatestScan: (clear: LatestScanClear) => void;
  setSelectedMode: (mode: RecipeMode) => void;
  registerRecipe: (
    recipe: Recipe,
    origin: Exclude<CanonicalRecipeOrigin, 'scan' | 'description'>,
  ) => void;
  updateRecipe: (recipeId: string, update: Partial<Recipe>) => void;
  correctRecipe: (recipeId: string, recipe: Recipe, scan: ScanResult) => boolean;
  getRecipePresentationVariant: (
    recipeId: string,
    mode: RecipePresentationMode,
  ) => { recipe: Recipe; scanResult: ScanResult } | null;
  cacheRecipePresentationVariant: (
    recipeId: string,
    mode: RecipePresentationMode,
    recipe: Recipe,
    scan: ScanResult,
  ) => void;
  confirmRecipeIdentification: (recipeId: string) => void;
  setRecipeMode: (recipeId: string, mode: RecipeMode) => void;
  setRecipePresentationMode: (recipeId: string, mode: RecipePresentationMode) => void;
  startCookingRecipe: (recipeId: string, totalStepCount?: number) => boolean;
  updateCookingStep: (recipeId: string, currentStepIndex: number, totalStepCount: number) => void;
  syncCookingStepCount: (recipeId: string, totalStepCount: number) => void;
  endCookingRecipe: (recipeId?: string) => void;
  completeRecipe: (recipeId: string) => void;
  saveRecipe: (
    recipe: Recipe | string,
    origin?: Exclude<CanonicalRecipeOrigin, 'scan' | 'description'>,
  ) => void;
  removeSavedRecipe: (recipeId: string) => void;
  toggleRecipeLiked: (recipeId: string) => void;
  addRecipeToGrocery: (recipeId: string) => void;
  addIngredientToGrocery: (recipeId: string, ingredientId: string) => void;
  toggleIngredientInGrocery: (recipeId: string, ingredientId: string) => void;
  setRecipeServingOverride: (recipeId: string, servings: number) => void;
  completeChallenge: (challenge: CompletedChallenge) => void;
  saveRecipeFeedback: (recipeId: string, feedback: Omit<RecipeFeedback, 'createdAt' | 'updatedAt'>) => void;
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
    (set, get) => ({
      hasCompletedOnboarding: false,
      hasHydrated: false,
      hasSeenOnboarding: false,
      onboardingGoal: null,
      primaryGoal: null,
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
      mealDescription: null,
      selectedMode: 'Normal',
      ...getEmptyCanonicalRecipeCollections(),
      groceryIngredientSelections: {},
      recipeServingOverrides: {},
      activeCookingSession: null,
      completedMeals: [],
      completedChallenges: [],
      recipeFeedbackById: {},
      totalMoneySaved: 0,
      weeklyScanCount: 0,
      isPremium: false,
      xp: 0,
      unlockedBadges: [],
      recentBadgeUnlock: null,
      awardedXpEvents: [],
      leaderboardEntries: mockLeaderboardEntries,
      completeOnboarding: () => {
        set({ hasCompletedOnboarding: true, hasSeenOnboarding: true });
        void readPrimaryGoalFromProfile(AsyncStorage).then((primaryGoal) => set({ primaryGoal }));
      },
      setOnboardingCompletionFromStorage: (completed) => set({ hasCompletedOnboarding: completed }),
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
      resetOnboarding: () => {
        set({
          hasCompletedOnboarding: false,
          hasSeenOnboarding: false,
          weeklyGoal: null,
          mealRoutinePreference: null,
          notificationChoice: null,
          firstOnboardingScanCompleted: false,
          firstOnboardingResultSeen: false,
          paywallShown: false,
          ...getClearedLatestScanState(),
        });
        onboardingPersistence.resetCompleted().catch((error: unknown) => {
          logDev('okyo_onboarding_completion_reset_failed', { error: String(error) });
        });
      },
      setGoal: (goal) => set({ onboardingGoal: goal }),
      refreshPrimaryGoal: async () => {
        const primaryGoal = await readPrimaryGoalFromProfile(AsyncStorage);
        set({ primaryGoal });
      },
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
          deleteUnusedScanImage(outgoingScanImageUri, useOkyoStore.getState().recipesById);
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
      commitSuccessfulScanSession: (scanSession) => {
        let committed = false;
        set((state) => {
          const collections = getCanonicalCollections(state);
          const nextCollections = commitSuccessfulScan(collections, {
            activeScanSessionId: state.scanSessionId,
            completedAt: new Date().toISOString(),
            image: scanSession.selectedScanImage,
            recipe: scanSession.latestScanRecipe,
            scan: scanSession.latestScanResult,
            scanSessionId: scanSession.scanSessionId,
            selectedMode: state.selectedMode,
            source: scanSession.source,
            status: scanSession.latestScanStatus,
          });
          const recipeId = getCanonicalScanRecipeId(scanSession.scanSessionId);
          const canonicalRecipe = resolveCanonicalRecipe(nextCollections.recipesById, recipeId);
          if (nextCollections === collections || !canonicalRecipe || !canonicalRecipe.scanResult) {
            return state;
          }

          const latestScanSession = createLatestScanSession({
            ...scanSession,
            latestScanResult: canonicalRecipe.scanResult,
            latestScanRecipe: canonicalRecipe,
            latestScanStatus: 'success',
          });
          committed = true;
          logScanStateWrite({
            ...getLatestScanSessionSummary(latestScanSession),
            reason: scanSession.reason,
            canonicalRecipeId: recipeId,
          });

          return {
            ...nextCollections,
            ...getLatestScanSessionState(latestScanSession),
          };
        });
        return committed;
      },
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
        if (outgoingScanImageUri && outgoingScanImageUri !== clear.preserveImageUri) {
          deleteUnusedScanImage(outgoingScanImageUri, useOkyoStore.getState().recipesById);
        }
      },
      setSelectedMode: (mode) => set({ selectedMode: getMigratedRecipeMode(mode) }),
      registerRecipe: (recipe, origin) =>
        set((state) => registerCanonicalRecipe(getCanonicalCollections(state), recipe, origin)),
      updateRecipe: (recipeId, update) =>
        set((state) => {
          const nextCollections = updateCanonicalRecipe(getCanonicalCollections(state), recipeId, update);
          return syncLatestScanRecipe(state, nextCollections, recipeId);
        }),
      correctRecipe: (recipeId, recipe, scan) => {
        let didCorrect = false;
        set((state) => {
          const collections = getCanonicalCollections(state);
          const nextCollections = correctCanonicalRecipe(
            collections,
            recipeId,
            recipe,
            scan,
          );
          didCorrect = nextCollections !== collections;
          if (!didCorrect) return state;
          const currentSelections = state.groceryIngredientSelections?.[recipeId] ?? [];
          const revisedNames = new Set(recipe.ingredients.map((item) => item.name.trim().toLowerCase()));
          const survivingSelections = currentSelections.filter((name) => revisedNames.has(name));
          const nextState = syncLatestScanRecipe(state, nextCollections, recipeId, true);
          if (currentSelections.length === 0 || survivingSelections.length > 0) {
            return {
              ...nextState,
              groceryIngredientSelections: currentSelections.length > 0
                ? { ...state.groceryIngredientSelections, [recipeId]: survivingSelections }
                : state.groceryIngredientSelections,
            };
          }
          const { [recipeId]: _staleSelection, ...remainingSelections } = state.groceryIngredientSelections;
          return { ...nextState, groceryIngredientSelections: remainingSelections };
        });
        return didCorrect;
      },
      getRecipePresentationVariant: (recipeId, mode) =>
        getCanonicalRecipePresentationVariant(getCanonicalCollections(get()), recipeId, mode),
      cacheRecipePresentationVariant: (recipeId, mode, recipe, scan) =>
        set((state) => syncLatestScanRecipe(
          state,
          cacheCanonicalRecipePresentationVariant(
            getCanonicalCollections(state),
            recipeId,
            mode,
            { recipe, scanResult: scan },
          ),
          recipeId,
        )),
      confirmRecipeIdentification: (recipeId) =>
        set((state) => {
          const nextCollections = confirmCanonicalRecipeIdentification(
            getCanonicalCollections(state),
            recipeId,
          );
          return syncLatestScanRecipe(state, nextCollections, recipeId);
        }),
      setRecipeMode: (recipeId, mode) =>
        set((state) => {
          const normalizedMode = getMigratedRecipeMode(mode);
          const nextCollections = setCanonicalRecipeMode(
            getCanonicalCollections(state),
            recipeId,
            normalizedMode,
          );
          return {
            ...syncLatestScanRecipe(state, nextCollections, recipeId),
            selectedMode: normalizedMode,
          };
        }),
      setRecipePresentationMode: (recipeId, mode) =>
        set((state) => {
          const nextCollections = setCanonicalRecipePresentationMode(
            getCanonicalCollections(state),
            recipeId,
            mode,
          );
          return syncLatestScanRecipe(state, nextCollections, recipeId);
        }),
      startCookingRecipe: (recipeId, totalStepCount = 0) => {
        let didStart = false;
        set((state) => {
          const recipe = resolveCanonicalRecipe(state.recipesById, recipeId);
          const activeSession = state.activeCookingSession;
          if (!recipe || (activeSession && activeSession.recipeId !== recipeId)) return state;
          didStart = true;
          const nextSession = activeSession?.recipeId === recipeId
            ? activeSession
            : createActiveCookingSession(recipeId, recipe.sourceRecipeId, totalStepCount);
          return {
            ...setCanonicalRecipeCompletion(getCanonicalCollections(state), recipeId, 'cooking'),
            activeCookingSession: nextSession,
          };
        });
        return didStart;
      },
      updateCookingStep: (recipeId, currentStepIndex, totalStepCount) =>
        set((state) => state.activeCookingSession?.recipeId === recipeId
          ? { activeCookingSession: updateActiveCookingSession(state.activeCookingSession, currentStepIndex, totalStepCount) }
          : state),
      syncCookingStepCount: (recipeId, totalStepCount) =>
        set((state) => state.activeCookingSession?.recipeId === recipeId &&
          state.activeCookingSession.totalStepCount !== totalStepCount
          ? {
            activeCookingSession: updateActiveCookingSession(
              state.activeCookingSession,
              state.activeCookingSession.currentStepIndex,
              totalStepCount,
            ),
          }
          : state),
      endCookingRecipe: (recipeId) =>
        set((state) => {
          if (!state.activeCookingSession || (recipeId && state.activeCookingSession.recipeId !== recipeId)) return state;
          return {
            ...setCanonicalRecipeCompletion(
              getCanonicalCollections(state),
              state.activeCookingSession.recipeId,
              'ready',
            ),
            activeCookingSession: clearActiveCookingSession(state.activeCookingSession, state.activeCookingSession.recipeId),
          };
        }),
      completeRecipe: (recipeId) =>
        set((state) => {
          const session = state.activeCookingSession;
          const recipe = resolveCanonicalRecipe(state.recipesById, recipeId);
          if (!session || session.recipeId !== recipeId || !recipe) return state;

          const completedAt = new Date().toISOString();
          const completedMeal = createCompletedMeal(recipe, session, completedAt);
          return {
            ...setCanonicalRecipeCompletion(getCanonicalCollections(state), recipeId, 'completed', completedAt),
            activeCookingSession: clearActiveCookingSession(session, recipeId),
            completedMeals: state.completedMeals.some((meal) => meal.id === completedMeal.id)
              ? state.completedMeals
              : [...state.completedMeals, completedMeal],
          };
        }),
      saveRecipe: (recipeOrId, origin = 'library') =>
        set((state) => {
          let collections = getCanonicalCollections(state);
          let recipeId: string;
          if (typeof recipeOrId === 'string') {
            recipeId = recipeOrId;
          } else {
            recipeId = recipeOrId.id;
            if (!resolveCanonicalRecipe(collections.recipesById, recipeId)) {
              collections = registerCanonicalRecipe(collections, recipeOrId, origin);
            }
          }

          return saveCanonicalRecipe(collections, recipeId);
        }),
      removeSavedRecipe: (recipeId) =>
        set((state) => removeCanonicalSavedRecipe(getCanonicalCollections(state), recipeId)),
      toggleRecipeLiked: (recipeId) =>
        set((state) => toggleCanonicalRecipeLiked(getCanonicalCollections(state), recipeId)),
      addRecipeToGrocery: (recipeId) =>
        set((state) => {
          const { [recipeId]: _removedSelection, ...remainingSelections } = state.groceryIngredientSelections ?? {};
          return {
            ...addCanonicalRecipeToGrocery(getCanonicalCollections(state), recipeId),
            groceryIngredientSelections: remainingSelections,
          };
        }),
      addIngredientToGrocery: (recipeId, ingredientId) => set((state) => ({
        ...addCanonicalRecipeToGrocery(getCanonicalCollections(state), recipeId),
        groceryIngredientSelections: {
          ...(state.groceryIngredientSelections ?? {}),
          [recipeId]: [...new Set([...(state.groceryIngredientSelections?.[recipeId] ?? []), ingredientId])],
        },
      })),
      toggleIngredientInGrocery: (recipeId, ingredientId) => set((state) => {
        const recipe = resolveCanonicalRecipe(state.recipesById, recipeId);
        if (!recipe) return state;
        return toggleGroceryIngredientSelection(state, recipeId, ingredientId, recipe.ingredients);
      }),
      setRecipeServingOverride: (recipeId, servings) => set((state) => ({
        recipeServingOverrides: {
          ...(state.recipeServingOverrides ?? {}),
          [recipeId]: Math.max(1, Math.min(12, Math.round(servings))),
        },
      })),
      completeChallenge: (challenge) =>
        set((state) => ({
          completedChallenges: state.completedChallenges.some(
            (completedChallenge) => completedChallenge.id === challenge.id,
          )
            ? state.completedChallenges
            : [...state.completedChallenges, challenge],
        })),
      saveRecipeFeedback: (recipeId, feedback) => set((state) => {
        const now = new Date().toISOString();
        const previous = state.recipeFeedbackById[recipeId];
        return {
          recipeFeedbackById: {
            ...state.recipeFeedbackById,
            [recipeId]: {
              ...feedback,
              createdAt: previous?.createdAt ?? now,
              updatedAt: now,
            },
          },
        };
      }),
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
            ...getEmptyCanonicalRecipeCollections(),
            activeCookingSession: null,
            completedMeals: [],
            completedChallenges: [],
            groceryIngredientSelections: {},
            recipeServingOverrides: {},
            recipeFeedbackById: {},
            totalMoneySaved: 0,
            weeklyScanCount: 0,
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
      migrate: migratePersistedOkyoState,
      onRehydrateStorage: () => (state) => {
        const normalizedState = state
          ? normalizePersistedRecipeModeState(state)
          : null;
        useOkyoStore.setState(normalizedState ?? {});
        void readPrimaryGoalFromProfile(AsyncStorage)
          .then((primaryGoal) => useOkyoStore.setState({ hasHydrated: true, primaryGoal }))
          .catch(() => useOkyoStore.setState({ hasHydrated: true, primaryGoal: null }));
      },
      partialize: (state) => ({
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
        mealDescription: state.mealDescription,
        selectedMode: state.selectedMode,
        recipesById: state.recipesById,
        recentRecipeIds: state.recentRecipeIds,
        savedRecipeIds: state.savedRecipeIds,
        groceryRecipeIds: state.groceryRecipeIds,
        groceryIngredientSelections: state.groceryIngredientSelections,
        recipeServingOverrides: state.recipeServingOverrides,
        activeCookingSession: state.activeCookingSession,
        completedMeals: state.completedMeals,
        completedChallenges: state.completedChallenges,
        recipeFeedbackById: state.recipeFeedbackById,
        totalMoneySaved: state.totalMoneySaved,
        weeklyScanCount: state.weeklyScanCount,
        isPremium: state.isPremium,
        xp: state.xp,
        unlockedBadges: state.unlockedBadges,
        awardedXpEvents: state.awardedXpEvents,
        leaderboardEntries: state.leaderboardEntries,
      }),
      version: 4,
    },
  ),
);

function migratePersistedOkyoState(persistedState: unknown, version: number) {
  if (!persistedState || typeof persistedState !== 'object' || Array.isArray(persistedState)) {
    return {};
  }

  const modeNormalizedState = normalizePersistedRecipeModeState(persistedState);
  const {
    hasCompletedOnboarding: _legacyOnboardingCompleted,
    savedRecipes: legacySavedRecipes,
    ...stateWithoutLegacyOnboardingCompletion
  } = modeNormalizedState as Record<string, unknown>;

  if (version >= 1) {
    return sanitizePersistedCanonicalState(stateWithoutLegacyOnboardingCompletion);
  }

  let collections = getEmptyCanonicalRecipeCollections();
  const latestScanStatus = stateWithoutLegacyOnboardingCompletion.latestScanStatus;
  const latestScanRecipe = stateWithoutLegacyOnboardingCompletion.latestScanRecipe;
  const latestScanResult = stateWithoutLegacyOnboardingCompletion.latestScanResult;
  const latestScanSession = stateWithoutLegacyOnboardingCompletion.latestScanSession;
  const scanSessionId = stateWithoutLegacyOnboardingCompletion.scanSessionId;
  const selectedMode = getMigratedRecipeMode(stateWithoutLegacyOnboardingCompletion.selectedMode);
  const selectedScanImage = stateWithoutLegacyOnboardingCompletion.selectedScanImage;
  if (
    latestScanStatus === 'success' &&
    typeof scanSessionId === 'string' &&
    isUsableCanonicalRecipe(latestScanRecipe as Recipe | null) &&
    latestScanResult &&
    typeof latestScanResult === 'object' &&
    isRecipeModeValue(selectedMode)
  ) {
    collections = commitSuccessfulScan(collections, {
      activeScanSessionId: scanSessionId,
      image: isScanImageMetadata(selectedScanImage) ? selectedScanImage : null,
      recipe: latestScanRecipe as Recipe,
      scan: latestScanResult as ScanResult,
      scanSessionId,
      selectedMode,
      source: getMigratedScanSource(latestScanSession, selectedScanImage),
      status: 'success',
    });
  }

  for (const legacyRecipe of Array.isArray(legacySavedRecipes) ? legacySavedRecipes : []) {
    if (
      !isUsableCanonicalRecipe(legacyRecipe as Recipe) ||
      isMockOrDemoRecipe(legacyRecipe as Recipe) ||
      (legacyRecipe as Recipe).id.startsWith('rec-')
    ) {
      continue;
    }

    const recipe = legacyRecipe as Recipe;
    const latestCanonicalId = typeof scanSessionId === 'string'
      ? getCanonicalScanRecipeId(scanSessionId)
      : null;
    const latestCanonical = resolveCanonicalRecipe(collections.recipesById, latestCanonicalId);
    if (latestCanonical?.sourceRecipeId === recipe.id) {
      collections = saveCanonicalRecipe(collections, latestCanonical.recipeId);
      continue;
    }

    collections = registerCanonicalRecipe(collections, recipe, getMigratedRecipeOrigin(recipe));
    collections = saveCanonicalRecipe(collections, recipe.id);
  }

  return sanitizePersistedCanonicalState({
    ...stateWithoutLegacyOnboardingCompletion,
    ...collections,
    latestScanRecipe: typeof scanSessionId === 'string'
      ? resolveCanonicalRecipe(collections.recipesById, getCanonicalScanRecipeId(scanSessionId))
      : null,
  });
}

function sanitizePersistedCanonicalState(state: Record<string, unknown>) {
  const recipesById: Record<string, CanonicalRecipe> = {};
  const persistedRecipes = isRecord(state.recipesById) ? state.recipesById : {};

  for (const [recipeId, value] of Object.entries(persistedRecipes)) {
    if (
      !isPersistedCanonicalRecipe(value) ||
      recipeId !== value.recipeId ||
      recipeId !== value.id ||
      isMockOrDemoRecipe(value)
    ) {
      continue;
    }

    const nutritionEstimate = normalizeNutritionEstimate(value.nutritionEstimate);
    recipesById[recipeId] = {
      ...value,
      ...normalizeRecipeTime(value),
      mode: getMigratedRecipeMode(value.mode),
      nutritionEstimate: nutritionEstimate ?? undefined,
      selectedMode: getMigratedRecipeMode(value.selectedMode),
      selectedPresentationMode: isRecipeModeValue(value.selectedMode) &&
        isRecipePresentationMode(value.selectedPresentationMode)
        ? value.selectedPresentationMode
        : getMigratedPresentationMode(value.selectedMode),
    };
  }

  const savedRecipeIds = sanitizeRecipeReferences(state.savedRecipeIds, recipesById)
    .filter((recipeId) => {
      const recipe = recipesById[recipeId];
      return recipe.isSaved === true && typeof recipe.savedAt === 'string';
    });
  const savedRecipeIdSet = new Set(savedRecipeIds);

  for (const [recipeId, recipe] of Object.entries(recipesById)) {
    const isSaved = savedRecipeIdSet.has(recipeId);
    recipesById[recipeId] = {
      ...recipe,
      isSaved,
      savedAt: isSaved ? recipe.savedAt : undefined,
    };
  }

  const recentRecipeIds = sanitizeRecipeReferences(state.recentRecipeIds, recipesById)
    .filter((recipeId) => {
      const recipe = recipesById[recipeId];
      return recipe.origin === 'scan' || recipe.origin === 'description';
    });
  const groceryRecipeIds = sanitizeRecipeReferences(state.groceryRecipeIds, recipesById);
  const latestRecipeId = isRecord(state.latestScanRecipe)
    ? getString(state.latestScanRecipe.recipeId) ?? getString(state.latestScanRecipe.id)
    : null;
  const latestScanRecipe = latestRecipeId
    ? resolveCanonicalRecipe(recipesById, latestRecipeId)
    : null;
  const activeCookingRecipe = isActiveCookingSession(state.activeCookingSession)
    ? resolveCanonicalRecipe(recipesById, state.activeCookingSession.recipeId)
    : null;
  const persistedCookingSession = activeCookingRecipe && isActiveCookingSession(state.activeCookingSession)
    ? {
      ...state.activeCookingSession,
      recipeRevisionId: activeCookingRecipe.sourceRecipeId,
      currentStepIndex: Math.max(0, Math.min(
        state.activeCookingSession.currentStepIndex,
        Math.max(0, state.activeCookingSession.totalStepCount - 1),
      )),
    }
    : null;

  const completedMeals = sanitizeCompletedMeals(state.completedMeals);

  return {
    ...state,
    recipesById,
    recentRecipeIds,
    savedRecipeIds,
    groceryRecipeIds,
    activeCookingSession: persistedCookingSession,
    // Old state only has a trustworthy completion timestamp on canonical
    // recipes. It cannot identify arbitrary scans as cooked, so it is safe to
    // migrate only those already marked completed.
    completedMeals: completedMeals.length > 0 ? completedMeals : migrateLegacyCompletedMeals(recipesById),
    latestScanRecipe,
    selectedMode: getMigratedRecipeMode(state.selectedMode),
  };
}

function sanitizeRecipeReferences(
  value: unknown,
  recipesById: Record<string, CanonicalRecipe>,
) {
  const recipeIds = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

  return [...new Set(recipeIds)].filter((recipeId) => Boolean(resolveCanonicalRecipe(
    recipesById,
    recipeId,
  )));
}

function isPersistedCanonicalRecipe(value: unknown): value is CanonicalRecipe {
  if (!isRecord(value) || !isUsableCanonicalRecipe(value as Recipe)) {
    return false;
  }

  return (
    typeof value.recipeId === 'string' &&
    typeof value.origin === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.scanCompletedAt === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isRecipePresentationMode(value: unknown): value is RecipePresentationMode {
  return value === 'Normal' ||
    value === 'Lighter' ||
    value === 'Healthier' ||
    value === 'More Protein';
}

function getMigratedPresentationMode(value: unknown): RecipePresentationMode {
  return getMigratedRecipeMode(value);
}

function getMigratedRecipeMode(value: unknown): RecipeMode {
  return migrateLegacyRecipeMode(value);
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function getCanonicalCollections(
  state: Pick<
    OkyoState,
    'recipesById' | 'recentRecipeIds' | 'savedRecipeIds' | 'groceryRecipeIds'
  >,
): CanonicalRecipeCollections {
  return {
    recipesById: state.recipesById,
    recentRecipeIds: state.recentRecipeIds,
    savedRecipeIds: state.savedRecipeIds,
    groceryRecipeIds: state.groceryRecipeIds,
  };
}

function syncLatestScanRecipe(
  state: OkyoState,
  collections: CanonicalRecipeCollections,
  recipeId: string,
  syncScanResult = false,
) {
  const canonicalRecipe = resolveCanonicalRecipe(collections.recipesById, recipeId);
  const isLatestRecipe = state.latestScanRecipe?.id === recipeId;
  if (!canonicalRecipe || !isLatestRecipe) {
    return collections;
  }

  const latestScanResult = syncScanResult && canonicalRecipe.scanResult
    ? canonicalRecipe.scanResult
    : state.latestScanResult;
  const latestScanSession = state.latestScanSession
    ? {
        ...state.latestScanSession,
        latestScanRecipe: canonicalRecipe,
        latestScanResult,
        updatedAt: new Date().toISOString(),
      }
    : null;

  return {
    ...collections,
    latestScanRecipe: canonicalRecipe,
    latestScanResult,
    latestScanSession,
  };
}

function isRecipeModeValue(value: unknown): value is RecipeMode {
  return isCurrentRecipeMode(value);
}

function isScanImageMetadata(value: unknown): value is ScanImageMetadata {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getMigratedScanSource(latestScanSession: unknown, selectedScanImage: unknown): ScanSource {
  const sessionSource = latestScanSession &&
    typeof latestScanSession === 'object' &&
    !Array.isArray(latestScanSession) &&
    'source' in latestScanSession
    ? (latestScanSession as { source?: unknown }).source
    : undefined;
  const imageSource = selectedScanImage &&
    typeof selectedScanImage === 'object' &&
    !Array.isArray(selectedScanImage) &&
    'source' in selectedScanImage
    ? (selectedScanImage as { source?: unknown }).source
    : undefined;
  const source = sessionSource ?? imageSource;
  return source === 'camera' || source === 'photos' || source === 'description'
    ? source
    : 'mock';
}

function getMigratedRecipeOrigin(
  recipe: Recipe,
): Exclude<CanonicalRecipeOrigin, 'scan' | 'description'> {
  if (recipe.id.startsWith('rec-')) {
    return 'recommendation';
  }
  if (recipe.id.startsWith('pack-')) {
    return 'restaurant-pack';
  }
  return 'library';
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
    mealDescription: latestScanSession.mealDescription,
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
    mealDescription: null,
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

// Deletes a scan image file from Documents if no canonical recipe references it.
// Successful scan photos remain durable whether or not the user saves the recipe.
function deleteUnusedScanImage(uri: string, recipesById: Record<string, CanonicalRecipe>) {
  const isReferenced = Object.values(recipesById).some(
    (recipe) => recipe.imageUri === uri || recipe.originalImage?.uri === uri,
  );
  if (isReferenced) {
    logDev('okyo_scan_image_cleanup_skipped', { uri, reason: 'referenced_by_canonical_recipe' });
    return;
  }
  FileSystem.deleteAsync(uri, { idempotent: true }).catch((error: unknown) => {
    logDev('okyo_scan_image_cleanup_failed', { uri, error: String(error) });
  });
}
