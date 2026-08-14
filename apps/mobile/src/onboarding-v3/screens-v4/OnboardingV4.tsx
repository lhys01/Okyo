import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { colors } from '../../theme/okyoTheme';
import { onboardingV4DraftPersistence, type OnboardingV4ScanInputMethod } from '../state/onboardingV4Draft';
import { commitOnboardingV4PlanToCanonicalProfile } from '../state/onboardingV4CanonicalCommit';
import type { ScanImageMetadata } from '../../api/types';
import { initialOnboardingV4State, isBranchQ1Answered, isBranchQ2Answered, isMacroDetailsAnswered, onboardingV4Reducer, type OnboardingV4State } from '../state/onboardingV4Reducer';
import { getOnboardingV4StageLabel } from '../state/onboardingV4Route';
import { trackOnboardingV4 } from '../../analytics/onboardingV4Events';
import {
  onboardingV4AnswerSubmittedEvent,
  onboardingV4DietarySavedEvent,
  onboardingV4GoalSelectedEvent,
  onboardingV4FirstRecipeRevealedEvent,
  onboardingV4InsightViewedEvent,
  onboardingV4PlanViewedEvent,
  onboardingV4PaywallViewedEvent,
  onboardingV4PurchaseEvent,
  onboardingV4MeaningfulActionSelectedEvent,
  onboardingV4ScanInputSelectedEvent,
  onboardingV4ScreenViewedEvent,
  onboardingV4StartedEvent,
} from './onboardingV4Instrumentation';
import { BRANCH_Q1_TITLE, BRANCH_Q2_TITLE, HEALTH_Q1_OPTIONS, HEALTH_Q2_OPTIONS, MACRO_Q1_OPTIONS, MACRO_Q2_OPTIONS, NOT_SURE_Q1_OPTIONS, NOT_SURE_Q2_OPTIONS, SAVINGS_Q1_OPTIONS } from './onboardingV4BranchCopy';
import { buildHealthPlanContent, buildMacrosPlanContent, buildNotSurePlanContent, buildSavingsPlanContent } from './onboardingV4PlanCopy';
import { BranchQuestionScreen } from './BranchQuestionScreen';
import { DietarySafetyScreen } from './DietarySafetyScreen';
import { saveOnboardingV4DietarySafety } from '../state/onboardingV4DietarySave';
import { FirstScanEntryScreen } from './FirstScanEntryScreen';
import { MacroTargetSetupScreen } from './MacroTargetSetupScreen';
import { PersonalInsightScreen } from './PersonalInsightScreen';
import { PersonalPlanScreen } from './PersonalPlanScreen';
import { PrimaryGoalScreen } from './PrimaryGoalScreen';
import { PromiseScreen } from './PromiseScreen';
import { SavingsSpendQuestionScreen } from './SavingsSpendQuestionScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { PhotoConfirmScreen } from '../screens/PhotoConfirmScreen';
import { FirstScanAnalyzingScreen } from './FirstScanAnalyzingScreen';
import { ResumeFirstAttemptScreen } from './ResumeFirstAttemptScreen';
import { onboardingV4ScanPersistence, type OnboardingV4InFlightScan } from '../state/onboardingV4ScanPersistence';
import { createOnboardingV4ScanSession, getOnboardingV4ScanFailure, runOnboardingV4FirstScan, type FirstScanPhase } from '../controller/onboardingV4FirstScan';
import { applyOnboardingV4Customization, isOnboardingV4CustomizationApplied, requestOnboardingV4Customization } from '../controller/onboardingV4Customization';
import { FirstScanTransactionError } from '../controller/onboardingV4FirstScanTransaction';
import { FreeRecipeResultScreen, type V4PremiumAction } from './FreeRecipeResultScreen';
import { resolveV4ResultRecipe } from '../state/onboardingV4Result';
import { EMPTY_FOOD_PREFERENCES, useFoodPreferences } from '../../state/foodPreferences';
import { useOkyoStore } from '../../state/useOkyoStore';
import { getEntitlementSnapshot, purchasePackage, restorePurchases, useEntitlement } from '../../services/revenueCat';
import { buildGuidedCookingSteps } from '../../utils/guidedCookingSteps';
import { OnboardingCookingScreen } from '../screens/OnboardingCookingScreen';
import { V4CustomizationScreen } from './V4CustomizationScreen';
import { V4PaywallScreen } from './V4PaywallScreen';
import { decideOnboardingV4PremiumAccess, getCompletedCookRecovery, isCompletedCustomizationDestinationReady, onboardingV4PremiumActionPersistence, resumeOnboardingV4PremiumAction, type OnboardingV4PendingPremiumAction } from '../state/onboardingV4PremiumAction';
import type {
  HealthBarrier,
  HealthierDefinition,
  MacroFocus,
  MacroTargetPath,
  PreferredTransformation,
  TakeoutFrequencyBucket,
  UniversalNeed,
} from '../state/branchContracts';

type Props = {
  appStartedAt: number;
  fontsLoaded: boolean;
  onRestore: () => void;
  isRestoring?: boolean;
};
/**
 * Top-level V4 flow wrapper (Okyo_Onboarding_V4_Implementation_Plan.md Step
 * 03/04/05): `splash → promise → primaryGoal → branchQ1 → branchQ2 →
 * [macroDetails] → personalInsight`. Mounted by `OnboardingV3.tsx` only when
 * `shouldUseOnboardingV4()` resolves true — never unconditionally.
 * Persistence is centralized in one effect (below) that writes the current
 * draft to storage on every change, so every submitted answer is persisted
 * immediately without duplicating the reducer's update logic here.
 */
export function OnboardingV4({ appStartedAt, fontsLoaded, onRestore, isRestoring = false }: Props) {
  const [state, dispatch] = useReducer(onboardingV4Reducer, initialOnboardingV4State);
  const hasEmittedStartedRef = useRef(false);
  const lastViewedStepRef = useRef<string | null>(null);
  const hasHydratedRef = useRef(false);
  const [isSavingDietary, setIsSavingDietary] = useState(false);
  const [dietarySaveError, setDietarySaveError] = useState<string | null>(null);
  const [isCommittingPlan, setIsCommittingPlan] = useState(false);
  const [planCommitError, setPlanCommitError] = useState<string | null>(null);
  const [scanImage, setScanImage] = useState<ScanImageMetadata | null>(null);
  const [scanPhase, setScanPhase] = useState<FirstScanPhase>('analysis');
  const scanAbortRef = useRef<AbortController | null>(null);
  const hasEmittedPlanViewedRef = useRef(false);
  const hasEmittedScanInputSelectedRef = useRef(false);
  const hasEmittedRecipeRevealedRef = useRef(false);
  const lastPaywallViewedActionRef = useRef<string | null>(null);
  const premiumRequestBusyRef = useRef(false);
  const [isPremiumRequestBusy, setIsPremiumRequestBusy] = useState(false);
  const [premiumDestinationError, setPremiumDestinationError] = useState<string | null>(null);
  const entitlement = useEntitlement();
  const { preferences: foodPreferences } = useFoodPreferences();
  const storeHasHydrated = useOkyoStore((store) => store.hasHydrated);
  const recipesById = useOkyoStore((store) => store.recipesById);
  const latestScanSessionId = useOkyoStore((store) => store.scanSessionId);
  const saveRecipe = useOkyoStore((store) => store.saveRecipe);
  const addRecipeToGrocery = useOkyoStore((store) => store.addRecipeToGrocery);
  const resultRecipe = resolveV4ResultRecipe(recipesById, state.recipeId, latestScanSessionId);

  const resumePremiumAction = useCallback(async (action: OnboardingV4PendingPremiumAction) => {
    dispatch({ type: 'PREMIUM_ACTION_EXECUTING', action: { ...action, status: 'executing', errorMessage: undefined } });
    setPremiumDestinationError(null);
    try {
      const completed = await resumeOnboardingV4PremiumAction(action, {
        persistence: onboardingV4PremiumActionPersistence,
        getRecipe: (recipeId) => useOkyoStore.getState().recipesById[recipeId] ?? null,
        startCook: (recipe) => useOkyoStore.getState().startCookingRecipe(recipe.recipeId, buildGuidedCookingSteps(recipe).length),
        requestCorrection: requestOnboardingV4Customization,
        isCorrectionApplied: isOnboardingV4CustomizationApplied,
        applyCorrection: applyOnboardingV4Customization,
      });
      dispatch({ type: 'PREMIUM_ACTION_RESUMED', action: completed });
    } catch (error) {
      const latest = await onboardingV4PremiumActionPersistence.read();
      const message = error instanceof Error ? error.message : 'Okyo couldn’t finish that action. Try again.';
      const failed = latest?.actionId === action.actionId ? latest : { ...action, status: 'failed' as const, errorMessage: message };
      dispatch({ type: 'PREMIUM_ACTION_FAILED', action: failed, message });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([onboardingV4DraftPersistence.readDraft(), onboardingV4ScanPersistence.readInFlightScan(), onboardingV4ScanPersistence.readFreeRecipeConsumed(), onboardingV4PremiumActionPersistence.read()]).then(([draft, inFlightScan, freeRecipeConsumed, pendingPremiumAction]) => {
      if (cancelled) return;
      hasHydratedRef.current = true;
      const store = useOkyoStore.getState();
      const restoredRecipe = freeRecipeConsumed ? resolveV4ResultRecipe(store.recipesById, null, store.scanSessionId) : null;
      dispatch({ type: 'HYDRATE', draft, inFlightScan, freeRecipeConsumed, recipeId: restoredRecipe?.recipeId ?? null, pendingPremiumAction });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!storeHasHydrated || !state.freeRecipeConsumed || state.recipeId || !resultRecipe) return;
    dispatch({ type: 'RESULT_RESTORED', recipeId: resultRecipe.recipeId });
  }, [resultRecipe, state.freeRecipeConsumed, state.recipeId, storeHasHydrated]);

  useEffect(() => {
    if (state.step !== 'recipe' || !resultRecipe || !state.draft.resolvedPrimaryGoal || hasEmittedRecipeRevealedRef.current) return;
    hasEmittedRecipeRevealedRef.current = true;
    const event = onboardingV4FirstRecipeRevealedEvent(state.draft.resolvedPrimaryGoal);
    void trackOnboardingV4(event.name, event.properties);
  }, [resultRecipe, state.draft.resolvedPrimaryGoal, state.step]);

  useEffect(() => {
    const action = state.pendingPremiumAction;
    if ((state.step !== 'recipe' && state.step !== 'paywall' && state.step !== 'postPurchase') || !storeHasHydrated || !resultRecipe || !action || action.status === 'dismissed' || action.status === 'completed' || action.status === 'failed') return;
    const decision = decideOnboardingV4PremiumAccess(entitlement);
    if (decision === 'wait') return;
    if (decision === 'fail_closed') {
      if (!state.paywallError) dispatch({ type: 'PAYWALL_ERROR', message: 'Okyo couldn’t verify your subscription right now. Your free recipe is still available.' });
      return;
    }
    if (decision === 'resume') {
      void resumePremiumAction(action).catch(() => dispatch({ type: 'PAYWALL_ERROR', message: 'Okyo couldn’t resume that action. Your free recipe is still available.' }));
      return;
    }
    if (action.status === 'paywall') return;
    void onboardingV4PremiumActionPersistence.write({ ...action, status: 'paywall' }).then((persisted) => dispatch({ type: 'PAYWALL_REQUIRED', action: persisted }));
  }, [entitlement, resultRecipe, resumePremiumAction, state.paywallError, state.pendingPremiumAction, state.step, storeHasHydrated]);

  useEffect(() => {
    const action = state.pendingPremiumAction;
    if (!action || action.status !== 'completed' || !storeHasHydrated || !resultRecipe) return;
    if (action.type === 'customize') {
      if (isCompletedCustomizationDestinationReady(action, resultRecipe)) return;
      const message = 'Okyo couldn’t verify the saved customization. Your original recipe is still available.';
      const failed = { ...action, status: 'failed' as const, errorMessage: message };
      void onboardingV4PremiumActionPersistence.write(failed).then((persisted) => dispatch({ type: 'PREMIUM_ACTION_FAILED', action: persisted, message }));
      return;
    }
    const store = useOkyoStore.getState();
    const recovery = getCompletedCookRecovery({
      storeHydrated: store.hasHydrated,
      recipeExists: Boolean(store.recipesById[action.recipeId]),
      recipeCompleted: store.recipesById[action.recipeId]?.completionState === 'completed',
      activeRecipeId: store.activeCookingSession?.recipeId ?? null,
      expectedRecipeId: action.recipeId,
    });
    if (recovery === 'ready' || recovery === 'wait') return;
    if (recovery === 'meal_completed') {
      const dismissed = { ...action, status: 'dismissed' as const };
      void onboardingV4PremiumActionPersistence.write(dismissed).then(
        (persisted) => dispatch({ type: 'RETURN_TO_RECIPE', action: persisted }),
        () => dispatch({ type: 'RETURN_TO_RECIPE', action: dismissed }),
      );
      return;
    }
    if (recovery === 'start') {
      if (store.startCookingRecipe(action.recipeId, buildGuidedCookingSteps(resultRecipe).length)) return;
    }
    setPremiumDestinationError(recovery === 'mismatch'
      ? 'Another Cook Mode session is active. Finish or exit it before reopening this recipe.'
      : 'Okyo couldn’t restore Cook Mode for this recipe. Your recipe is still available.');
  }, [resultRecipe, state.pendingPremiumAction, storeHasHydrated]);

  useEffect(() => {
    const action = state.pendingPremiumAction;
    if (state.step !== 'paywall' || !action || !state.draft.resolvedPrimaryGoal || lastPaywallViewedActionRef.current === action.actionId) return;
    lastPaywallViewedActionRef.current = action.actionId;
    const event = onboardingV4PaywallViewedEvent(action.type, state.draft.resolvedPrimaryGoal);
    void trackOnboardingV4(event.name, event.properties);
  }, [state.draft.resolvedPrimaryGoal, state.pendingPremiumAction, state.step]);

  useEffect(() => {
    if (!state.scanError) return;
    Alert.alert('Your free recipe is still available', state.scanError);
  }, [state.scanError]);

  useEffect(() => {
    if (state.step !== 'recipe' || !state.paywallError) return;
    Alert.alert('Your free recipe is still available', state.paywallError);
  }, [state.paywallError, state.step]);

  const executeScan = (inFlightScan: OnboardingV4InFlightScan, persistedEvent?: 'PHOTO_CONFIRMED' | 'DESCRIPTION_SUBMITTED' | 'RESUME_SCAN') => {
    scanAbortRef.current?.abort();
    const controller = new AbortController();
    scanAbortRef.current = controller;
    setScanPhase('analysis');
    const runtimeImage = scanImage?.uri === inFlightScan.imageUri ? scanImage : null;
    void runOnboardingV4FirstScan(inFlightScan, controller.signal, {
      ...(runtimeImage ? { loadImage: async () => runtimeImage } : {}),
      onPersisted: () => dispatch(persistedEvent === 'PHOTO_CONFIRMED' || persistedEvent === 'DESCRIPTION_SUBMITTED' ? { type: persistedEvent, inFlightScan } : { type: 'RESUME_SCAN' }),
      onPhase: (phase) => { setScanPhase(phase); if (phase === 'recipe') dispatch({ type: 'ANALYSIS_SUCCEEDED', analysisId: 'completed' }); },
    }).then(async (recipeId) => {
      if (controller.signal.aborted || scanAbortRef.current !== controller) return;
      dispatch({ type: 'RECIPE_READY', recipeId });
    }).catch(async (error: unknown) => {
      if (controller.signal.aborted || scanAbortRef.current !== controller) return;
      const failure = getOnboardingV4ScanFailure(error);
      const recoverable = error instanceof FirstScanTransactionError && error.preserveInFlight;
      dispatch(recoverable ? { type: 'TRANSACTION_RECOVERABLE_FAILURE', message: failure.message } : { type: failure.kind === 'rejected' ? 'ANALYSIS_REJECTED' : 'ANALYSIS_FAILED', message: failure.message });
    }).finally(() => { if (scanAbortRef.current === controller) scanAbortRef.current = null; });
  };

  const beginScan = (inFlightScan: OnboardingV4InFlightScan, event: 'PHOTO_CONFIRMED' | 'DESCRIPTION_SUBMITTED') => executeScan(inFlightScan, event);

  useEffect(() => {
    if (!hasHydratedRef.current) return; // avoid persisting the initial empty draft before hydration has even read the real one
    void onboardingV4DraftPersistence.writeDraft(state.draft);
  }, [state.draft]);

  useEffect(() => {
    if (hasEmittedStartedRef.current) return;
    hasEmittedStartedRef.current = true;
    const event = onboardingV4StartedEvent();
    void trackOnboardingV4(event.name, event.properties);
  }, []);

  useEffect(() => {
    const event = onboardingV4ScreenViewedEvent(state.step, lastViewedStepRef.current);
    if (!event) return;
    lastViewedStepRef.current = state.step;
    void trackOnboardingV4(event.name, event.properties);
  }, [state.step]);

  useEffect(() => {
    if (state.step !== 'plan' || hasEmittedPlanViewedRef.current || !state.draft.resolvedPrimaryGoal) return;
    hasEmittedPlanViewedRef.current = true;
    const event = onboardingV4PlanViewedEvent(state.draft.resolvedPrimaryGoal);
    void trackOnboardingV4(event.name, event.properties);
  }, [state.step, state.draft.resolvedPrimaryGoal]);

  const trackAnswer = (fieldId: string) => {
    const event = onboardingV4AnswerSubmittedEvent(state.step, fieldId);
    void trackOnboardingV4(event.name, event.properties);
  };

  const stageLabel = getOnboardingV4StageLabel(state.step);

  if (state.step === 'splash') {
    return (
      <SplashScreen
        appStartedAt={appStartedAt}
        fontsLoaded={fontsLoaded}
        onFinished={() => dispatch({ type: 'SPLASH_FINISHED' })}
      />
    );
  }

  if (state.step === 'promise') {
    return <PromiseScreen isRestoring={isRestoring} onContinue={() => dispatch({ type: 'CONTINUE' })} onRestore={onRestore} />;
  }

  if (state.step === 'primaryGoal') {
    return (
      <PrimaryGoalScreen
        onBack={() => dispatch({ type: 'BACK' })}
        onSelect={(goal) => {
          dispatch({ type: 'GOAL_SELECTED', goal });
          const event = onboardingV4GoalSelectedEvent(goal);
          void trackOnboardingV4(event.name, event.properties);
        }}
        selected={state.draft.initialGoal}
      />
    );
  }

  if (state.step === 'branchQ1') {
    const goal = state.draft.initialGoal;
    if (goal === 'save_money') {
      return (
        <BranchQuestionScreen
          canContinue={isBranchQ1Answered(state.draft)}
          onBack={() => dispatch({ type: 'BACK' })}
          onContinue={() => dispatch({ type: 'CONTINUE' })}
          onSelect={(value) => { dispatch({ type: 'SAVINGS_TAKEOUT_FREQUENCY_ANSWERED', value: value as TakeoutFrequencyBucket }); trackAnswer('takeoutFrequency'); }}
          options={SAVINGS_Q1_OPTIONS}
          selected={state.draft.savingsAnswers.takeoutFrequency}
          stageLabel={stageLabel}
          title={BRANCH_Q1_TITLE.save_money}
        />
      );
    }
    if (goal === 'eat_healthier') {
      return (
        <BranchQuestionScreen
          canContinue={isBranchQ1Answered(state.draft)}
          onBack={() => dispatch({ type: 'BACK' })}
          onContinue={() => dispatch({ type: 'CONTINUE' })}
          onSelect={(value) => { dispatch({ type: 'HEALTH_DEFINITION_ANSWERED', value: value as HealthierDefinition }); trackAnswer('healthierDefinition'); }}
          options={HEALTH_Q1_OPTIONS}
          selected={state.draft.healthAnswers.healthierDefinition}
          stageLabel={stageLabel}
          title={BRANCH_Q1_TITLE.eat_healthier}
        />
      );
    }
    if (goal === 'hit_macros') {
      return (
        <BranchQuestionScreen
          canContinue={isBranchQ1Answered(state.draft)}
          onBack={() => dispatch({ type: 'BACK' })}
          onContinue={() => dispatch({ type: 'CONTINUE' })}
          onSelect={(value) => { dispatch({ type: 'MACRO_FOCUS_ANSWERED', value: value as MacroFocus }); trackAnswer('macroFocus'); }}
          options={MACRO_Q1_OPTIONS}
          selected={state.draft.macroAnswers.macroFocus}
          stageLabel={stageLabel}
          title={BRANCH_Q1_TITLE.hit_macros}
        />
      );
    }
    if (goal === 'not_sure') {
      return (
        <BranchQuestionScreen
          canContinue={isBranchQ1Answered(state.draft)}
          onBack={() => dispatch({ type: 'BACK' })}
          onContinue={() => dispatch({ type: 'CONTINUE' })}
          onSelect={(value) => { dispatch({ type: 'NOT_SURE_UNIVERSAL_NEED_ANSWERED', value: value as UniversalNeed }); trackAnswer('universalNeed'); }}
          options={NOT_SURE_Q1_OPTIONS}
          selected={state.draft.notSureAnswers.universalNeed}
          stageLabel={stageLabel}
          title={BRANCH_Q1_TITLE.not_sure}
        />
      );
    }
    return <View style={styles.empty} />;
  }

  if (state.step === 'branchQ2') {
    const goal = state.draft.initialGoal;
    if (goal === 'save_money') {
      return (
        <SavingsSpendQuestionScreen
          canContinue={isBranchQ2Answered(state.draft)}
          onBack={() => dispatch({ type: 'BACK' })}
          onChange={(value) => { dispatch({ type: 'SAVINGS_SPEND_PER_MEAL_ANSWERED', value }); trackAnswer('spendPerMealDollars'); }}
          onContinue={() => dispatch({ type: 'CONTINUE' })}
          stageLabel={stageLabel}
          value={state.draft.savingsAnswers.spendPerMealDollars}
        />
      );
    }
    if (goal === 'eat_healthier') {
      return (
        <BranchQuestionScreen
          canContinue={isBranchQ2Answered(state.draft)}
          onBack={() => dispatch({ type: 'BACK' })}
          onContinue={() => dispatch({ type: 'CONTINUE' })}
          onSelect={(value) => { dispatch({ type: 'HEALTH_BARRIER_ANSWERED', value: value as HealthBarrier }); trackAnswer('healthBarrier'); }}
          options={HEALTH_Q2_OPTIONS}
          selected={state.draft.healthAnswers.healthBarrier}
          stageLabel={stageLabel}
          title={BRANCH_Q2_TITLE.eat_healthier}
        />
      );
    }
    if (goal === 'hit_macros') {
      return (
        <BranchQuestionScreen
          canContinue={isBranchQ2Answered(state.draft)}
          onBack={() => dispatch({ type: 'BACK' })}
          onContinue={() => dispatch({ type: 'CONTINUE' })}
          onSelect={(value) => { dispatch({ type: 'MACRO_TARGET_PATH_ANSWERED', value: value as MacroTargetPath }); trackAnswer('targetPath'); }}
          options={MACRO_Q2_OPTIONS}
          selected={state.draft.macroAnswers.targetPath}
          stageLabel={stageLabel}
          title={BRANCH_Q2_TITLE.hit_macros}
        />
      );
    }
    if (goal === 'not_sure') {
      return (
        <BranchQuestionScreen
          canContinue={isBranchQ2Answered(state.draft)}
          onBack={() => dispatch({ type: 'BACK' })}
          onContinue={() => dispatch({ type: 'CONTINUE' })}
          onSelect={(value) => { dispatch({ type: 'NOT_SURE_TRANSFORMATION_ANSWERED', value: value as PreferredTransformation }); trackAnswer('preferredTransformation'); }}
          options={NOT_SURE_Q2_OPTIONS}
          selected={state.draft.notSureAnswers.preferredTransformation}
          stageLabel={stageLabel}
          title={BRANCH_Q2_TITLE.not_sure}
        />
      );
    }
    return <View style={styles.empty} />;
  }

  if (state.step === 'macroDetails' && (state.draft.macroAnswers.targetPath === 'known' || state.draft.macroAnswers.targetPath === 'estimate')) {
    return (
      <MacroTargetSetupScreen
        calculatorInputs={state.draft.macroAnswers.calculatorInputs}
        canContinue={isMacroDetailsAnswered(state.draft)}
        knownTargets={state.draft.macroAnswers.knownTargets}
        onBack={() => dispatch({ type: 'BACK' })}
        onCalculatorInputsChange={(value) => { dispatch({ type: 'MACRO_CALCULATOR_INPUTS_ANSWERED', value }); trackAnswer('calculatorInputs'); }}
        onContinue={() => dispatch({ type: 'CONTINUE' })}
        onKnownTargetsChange={(value) => { dispatch({ type: 'MACRO_KNOWN_TARGETS_ANSWERED', value }); trackAnswer('knownTargets'); }}
        stageLabel={stageLabel}
        targetPath={state.draft.macroAnswers.targetPath}
      />
    );
  }

  if (state.step === 'personalInsight') {
    return (
      <PersonalInsightScreen
        draft={state.draft}
        onBack={() => dispatch({ type: 'BACK' })}
        onContinue={() => dispatch({ type: 'CONTINUE' })}
        onRevealed={() => {
          if (!state.draft.resolvedPrimaryGoal) return;
          const event = onboardingV4InsightViewedEvent(state.draft.resolvedPrimaryGoal);
          void trackOnboardingV4(event.name, event.properties);
        }}
        stageLabel={stageLabel}
      />
    );
  }

  if (state.step === 'dietarySafety') {
    const handleSave = () => {
      if (isSavingDietary) return; // guards duplicate writes/analytics from a double-tap
      setIsSavingDietary(true);
      setDietarySaveError(null);
      void saveOnboardingV4DietarySafety(state.draft.dietaryAnswers).then((result) => {
        setIsSavingDietary(false);
        if (result.status === 'error') {
          setDietarySaveError(result.message);
          return; // stays on dietarySafety — no dispatch, no analytics
        }
        dispatch({ type: 'DIETARY_SAVED' });
        const event = onboardingV4DietarySavedEvent(state.draft.dietaryAnswers);
        void trackOnboardingV4(event.name, event.properties);
      });
    };
    return (
      <DietarySafetyScreen
        answers={state.draft.dietaryAnswers}
        errorMessage={dietarySaveError}
        isSaving={isSavingDietary}
        onBack={() => dispatch({ type: 'BACK' })}
        onDislikesChange={(value) => { dispatch({ type: 'DIETARY_DISLIKES_CHANGED', value }); trackAnswer('dislikes'); }}
        onSave={handleSave}
        onToggleAllergy={(value) => { dispatch({ type: 'DIETARY_ALLERGY_TOGGLED', value }); trackAnswer('allergy'); }}
        onToggleNoneOfThese={() => { dispatch({ type: 'DIETARY_NONE_OF_THESE_TOGGLED' }); trackAnswer('noneOfThese'); }}
        onToggleRestriction={(value) => { dispatch({ type: 'DIETARY_RESTRICTION_TOGGLED', value }); trackAnswer('restriction'); }}
        stageLabel={stageLabel}
      />
    );
  }

  if (state.step === 'plan') {
    const handleCommit = () => {
      if (isCommittingPlan) return; // guards duplicate writes from a double-tap
      setIsCommittingPlan(true);
      setPlanCommitError(null);
      void commitOnboardingV4PlanToCanonicalProfile(state.draft).then(
        () => {
          setIsCommittingPlan(false);
          dispatch({ type: 'PLAN_COMMITTED' });
        },
        () => {
          setIsCommittingPlan(false);
          setPlanCommitError("Okyo couldn't save your plan. Try again.");
        },
      );
    };
    return (
      <PersonalPlanScreen
        commitError={planCommitError}
        draft={state.draft}
        isCommitting={isCommittingPlan}
        onBack={() => dispatch({ type: 'BACK' })}
        onContinue={handleCommit}
        stageLabel={stageLabel}
      />
    );
  }

  if (state.step === 'scanEntry') {
    if (state.inFlightScan) {
      return <ResumeFirstAttemptScreen onResume={() => executeScan(state.inFlightScan!, 'RESUME_SCAN')} onStartOver={() => { void onboardingV4ScanPersistence.clearInFlightScan(); dispatch({ type: 'IN_FLIGHT_CLEARED' }); }} />;
    }
    const priorityEcho = resolveScanEntryPriorityEcho(state.draft);
    const handleMethodSelected = (method: OnboardingV4ScanInputMethod) => {
      dispatch({ type: 'SCAN_INPUT_METHOD_SELECTED', method });
      if (!hasEmittedScanInputSelectedRef.current) {
        hasEmittedScanInputSelectedRef.current = true;
        const event = onboardingV4ScanInputSelectedEvent(method);
        void trackOnboardingV4(event.name, event.properties);
      }
    };
    return (
      <FirstScanEntryScreen
        description={state.draft.scanInput.description}
        onBack={() => dispatch({ type: 'BACK' })}
        onCameraPermissionPrompted={() => void trackOnboardingV4('camera_permission_prompted', { screen: 'scanEntry' })}
        onCameraPermissionResult={(granted) => void trackOnboardingV4('camera_permission_result', { screen: 'scanEntry', permissionResult: granted ? 'granted' : 'denied' })}
        onDescriptionChange={(value) => dispatch({ type: 'SCAN_DESCRIPTION_CHANGED', value })}
        onDescriptionSubmitted={(value) => { dispatch({ type: 'SCAN_DESCRIPTION_CHANGED', value }); const scan = createOnboardingV4ScanSession('description', value); beginScan(scan, 'DESCRIPTION_SUBMITTED'); }}
        onImageSelected={(_method, image) => { setScanImage(image); dispatch({ type: 'SCAN_IMAGE_SELECTED' }); }}
        onMethodSelected={handleMethodSelected}
        priorityEcho={priorityEcho}
      />
    );
  }

  if (state.step === 'photoConfirm' && scanImage?.uri) {
    return <PhotoConfirmScreen photoUri={scanImage.uri} onBack={() => { setScanImage(null); dispatch({ type: 'BACK' }); }} onConfirm={() => { const source = scanImage.source === 'camera' ? 'camera' : 'photos'; const scan = createOnboardingV4ScanSession(source, scanImage.uri!); beginScan(scan, 'PHOTO_CONFIRMED'); }} />;
  }

  if (state.step === 'analyzing') {
    return <FirstScanAnalyzingScreen phase={scanPhase} onCancel={() => { scanAbortRef.current?.abort(); scanAbortRef.current = null; void onboardingV4ScanPersistence.clearInFlightScan(); dispatch({ type: 'ANALYSIS_CANCELLED' }); }} />;
  }

  if (state.step === 'paywall' && state.pendingPremiumAction && state.draft.resolvedPrimaryGoal) {
    const dismissPaywall = async () => {
      try {
        const dismissed = await onboardingV4PremiumActionPersistence.write({ ...state.pendingPremiumAction!, status: 'dismissed' });
        dispatch({ type: 'PAYWALL_DISMISSED', action: dismissed });
      } catch {
        dispatch({ type: 'PAYWALL_DISMISSED', action: { ...state.pendingPremiumAction!, status: 'dismissed' } });
        Alert.alert('Your free recipe is still available', 'Okyo couldn’t save the dismissal, but you can keep using your free recipe.');
      }
    };
    const fail = (message: string, errorKind: string) => {
      dispatch({ type: 'PAYWALL_ERROR', message });
      const event = onboardingV4PurchaseEvent('purchase_failed', state.pendingPremiumAction!.type, state.draft.resolvedPrimaryGoal!, errorKind);
      void trackOnboardingV4(event.name, event.properties);
    };
    const handlePurchase = async (pkg: PurchasesPackage) => {
      if (premiumRequestBusyRef.current) return;
      premiumRequestBusyRef.current = true;
      setIsPremiumRequestBusy(true);
      const started = onboardingV4PurchaseEvent('purchase_started', state.pendingPremiumAction!.type, state.draft.resolvedPrimaryGoal!);
      void trackOnboardingV4(started.name, started.properties);
      try {
        const result = await purchasePackage(pkg);
        const verified = getEntitlementSnapshot();
        if (result.status === 'purchased' && verified.status === 'ready' && verified.isEntitled) {
          const success = onboardingV4PurchaseEvent('purchase_succeeded', state.pendingPremiumAction!.type, state.draft.resolvedPrimaryGoal!);
          void trackOnboardingV4(success.name, success.properties);
          await resumePremiumAction(state.pendingPremiumAction!);
        } else if (result.status === 'cancelled') {
          await dismissPaywall();
        } else {
          fail('We couldn’t verify that purchase. Your free recipe is still here—try again.', result.status);
        }
      } catch {
        fail('We couldn’t finish that purchase. Your free recipe is still here—try again.', 'request_failed');
      } finally {
        premiumRequestBusyRef.current = false;
        setIsPremiumRequestBusy(false);
      }
    };
    const handleRestore = async () => {
      if (premiumRequestBusyRef.current) return;
      premiumRequestBusyRef.current = true;
      setIsPremiumRequestBusy(true);
      try {
        const result = await restorePurchases();
        const verified = getEntitlementSnapshot();
        if (result.status === 'restored' && result.isEntitled && verified.status === 'ready' && verified.isEntitled) {
          const restored = onboardingV4PurchaseEvent('purchase_restored', state.pendingPremiumAction!.type, state.draft.resolvedPrimaryGoal!);
          void trackOnboardingV4(restored.name, restored.properties);
          await resumePremiumAction(state.pendingPremiumAction!);
        } else {
          fail('We couldn’t verify a restored subscription. Your free recipe is still here—try again.', result.status);
        }
      } catch {
        fail('We couldn’t restore purchases. Your free recipe is still here—try again.', 'restore_failed');
      } finally {
        premiumRequestBusyRef.current = false;
        setIsPremiumRequestBusy(false);
      }
    };
    return <V4PaywallScreen action={state.pendingPremiumAction.type} entitlement={entitlement} error={state.paywallError} goal={state.draft.resolvedPrimaryGoal} isBusy={isPremiumRequestBusy} onDismiss={() => void dismissPaywall()} onPurchase={(pkg) => void handlePurchase(pkg)} onRestore={() => void handleRestore()} />;
  }

  if (state.step === 'postPurchase' && state.pendingPremiumAction) {
    const action = state.pendingPremiumAction;
    const returnToRecipe = () => {
      const dismissed = { ...action, status: 'dismissed' as const, errorMessage: undefined };
      void onboardingV4PremiumActionPersistence.write(dismissed).then(
        (persisted) => dispatch({ type: 'RETURN_TO_RECIPE', action: persisted }),
        () => dispatch({ type: 'RETURN_TO_RECIPE', action: dismissed }),
      );
    };
    if (resultRecipe && action.type === 'cook' && action.status === 'completed' && useOkyoStore.getState().activeCookingSession?.recipeId === resultRecipe.recipeId && !premiumDestinationError) {
      const active = useOkyoStore.getState().activeCookingSession;
      return <OnboardingCookingScreen initialIndex={active?.currentStepIndex ?? 0} onBack={returnToRecipe} onComplete={() => { useOkyoStore.getState().completeRecipe(resultRecipe.recipeId); returnToRecipe(); }} onExit={() => { useOkyoStore.getState().endCookingRecipe(resultRecipe.recipeId); returnToRecipe(); }} onProgress={(index, total) => useOkyoStore.getState().updateCookingStep(resultRecipe.recipeId, index, total)} recipe={resultRecipe} />;
    }
    return <V4CustomizationScreen
      action={action.type}
      error={premiumDestinationError ?? action.errorMessage ?? state.paywallError}
      instruction={action.customizationText ?? ''}
      isApplying={!premiumDestinationError && action.status !== 'failed'}
      onBack={returnToRecipe}
      onRetry={() => void resumePremiumAction(action)}
      recipeTitle={resultRecipe?.title ?? 'your recipe'}
    />;
  }

  if (state.step === 'recipe') {
    if (!resultRecipe || !state.draft.resolvedPrimaryGoal) {
      return <View style={styles.recovery}><Text style={styles.recoveryTitle}>Your recipe is still being restored</Text><Text style={styles.recoveryBody}>Close and reopen Okyo in a moment. Your free result has not been regenerated.</Text></View>;
    }
    const handlePremiumAction = (action: V4PremiumAction, customizationText?: string) => {
      if (premiumRequestBusyRef.current) return;
      premiumRequestBusyRef.current = true;
      const event = onboardingV4MeaningfulActionSelectedEvent(action, state.draft.resolvedPrimaryGoal!);
      void trackOnboardingV4(event.name, event.properties);
      const existing = state.pendingPremiumAction;
      const operation = (existing?.status === 'paywall' || existing?.status === 'dismissed') && existing.type === action
        ? onboardingV4PremiumActionPersistence.write({ ...existing, status: 'pending_entitlement', ...(action === 'customize' && customizationText ? { customizationText } : {}) })
        : onboardingV4PremiumActionPersistence.create(action, resultRecipe.recipeId, customizationText);
      void operation.then((pending) => {
        dispatch({ type: 'PREMIUM_ACTION_PERSISTED', action: pending });
      }, () => {
        Alert.alert('Your free recipe is still available', 'Okyo couldn’t save that action yet. Try again.');
      }).finally(() => { premiumRequestBusyRef.current = false; });
    };
    return <FreeRecipeResultScreen
      dietaryPreferences={foodPreferences ?? EMPTY_FOOD_PREFERENCES}
      initialGoalWasNotSure={state.draft.initialGoal === 'not_sure'}
      onAddGroceries={() => addRecipeToGrocery(resultRecipe.recipeId)}
      onPremiumAction={handlePremiumAction}
      onSave={() => saveRecipe(resultRecipe.recipeId)}
      onShare={() => { void Share.share({ message: `${resultRecipe.title}\nA personalized recipe from Okyo.` }); }}
      preferredTransformation={state.draft.notSureAnswers.preferredTransformation}
      priorityNote={state.draft.resolvedPrimaryGoal === 'eat_healthier' ? state.draft.healthAnswers.healthierDefinition : state.draft.resolvedPrimaryGoal === 'hit_macros' ? state.draft.macroAnswers.macroFocus : null}
      recipe={resultRecipe}
      selectedGoal={state.draft.resolvedPrimaryGoal}
    />;
  }

  return <View style={styles.empty} />;
}

function resolveScanEntryPriorityEcho(draft: OnboardingV4State['draft']): string {
  if (draft.initialGoal === 'not_sure') return buildNotSurePlanContent(draft.notSureAnswers, draft.resolvedPrimaryGoal).firstScanPriorityEcho;
  if (draft.initialGoal === 'save_money') return buildSavingsPlanContent(draft.savingsAnswers).firstScanPriorityEcho;
  if (draft.initialGoal === 'eat_healthier') return buildHealthPlanContent(draft.healthAnswers).firstScanPriorityEcho;
  return buildMacrosPlanContent(draft.macroAnswers, draft.macroAnswers.calculatorInputs.ageYears).firstScanPriorityEcho;
}

const styles = StyleSheet.create({
  empty: { backgroundColor: colors.background, flex: 1 },
  recovery: { backgroundColor: colors.background, flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  recoveryTitle: { color: colors.charcoal, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  recoveryBody: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10, textAlign: 'center' },
});
