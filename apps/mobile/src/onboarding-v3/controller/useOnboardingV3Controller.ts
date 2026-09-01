import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { PurchasesPackage } from 'react-native-purchases';

import { analyticsEvents, track } from '../../analytics/track';
import {
  ApiClientError,
} from '../../api/client';
import type {
  AnalyzeScanRequest,
  CreateScanRequest,
  CreateScanResult,
  GenerateRecipeFromAnalysisRequest,
  ScanImageMetadata,
  ScanRejectionType,
  ScanSource,
} from '../../api/types';
import type { Recipe } from '../../mocks';
import { onboardingPersistence } from '../../state/onboardingPersistence';
import { getCanonicalScanRecipeId, isUsableCanonicalRecipe } from '../../state/canonicalRecipes';
import { foodPreferencesPersistence, toApiFoodPreferences, type FoodPreferences } from '../../state/foodPreferences';
import { useOkyoStore } from '../../state/useOkyoStore';
import { purchasePackage, restorePurchases } from '../../services/revenueCat';
import { buildGuidedCookingSteps } from '../../utils/guidedCookingSteps';
import { copyToDocuments } from '../../utils/scanImageStorage';
import type { AttributionSource } from '../state/attribution';
import { buildGoalContext } from '../state/goalContext';
import { onboardingV3Persistence } from '../state/onboardingV3Persistence';
import type { PersonalizedAnswer, PersonalizedOnboardingProfile, PrimaryGoal, SecondaryGoal } from '../state/personalizedOnboarding';
import { onboardingV3Log } from '../utils/onboardingV3Log';
import { runOnboardingAnalysis, runOnboardingRecipeGeneration } from './onboardingV3Requests';
import {
  initialOnboardingV3State,
  getPersistedPersonalizedStep,
  isRealInputUnlocked,
  onboardingV3Reducer,
  type OnboardingV3Error,
  type OnboardingV3Event,
  type OnboardingV3State,
} from './onboardingV3Machine';

type OnboardingRecipeResult = Omit<CreateScanResult, 'source'> & { source?: ScanSource };
type AnalysisRejectionError = { kind: 'ingredients_only' | 'not_food' | 'unclear'; message: string };

export function useOnboardingV3Controller() {
  const [state, rawDispatch] = useReducer(onboardingV3Reducer, initialOnboardingV3State);
  const [isPurchaseBusy, setIsPurchaseBusy] = useState(false);
  const [showcaseInitialPage, setShowcaseInitialPage] = useState(0);
  const stateRef = useRef(state);
  const hydratedRef = useRef(false);
  const pendingSplashRef = useRef<{ elapsedMs: number; fontsLoaded: boolean } | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const selectedImageRef = useRef<ScanImageMetadata | null>(null);
  const mealDescriptionRef = useRef<string | null>(null);
  const sourceRef = useRef<ScanSource>('photos');
  const recipeRequestIdRef = useRef<string | null>(null);
  const didCompleteRef = useRef(false);
  const branchPreviewCompletionBusyRef = useRef(false);
  const purchaseBusyRef = useRef(false);
  const completionPathRef = useRef<'purchase' | 'restore' | 'dev_bypass' | 'branch_preview' | null>(null);

  stateRef.current = state;

  const dispatch = useCallback((event: OnboardingV3Event) => {
    const current = stateRef.current;
    const next = onboardingV3Reducer(current, event);
    if (next === current) {
      onboardingV3Log('unhandled_event', { eventType: event.type, step: current.step });
    } else {
      onboardingV3Log('transition', { event: event.type, from: current.step, to: next.step });
      stateRef.current = next;
    }
    rawDispatch(event);
  }, []);

  useEffect(() => {
    // Fast Refresh can replay effects while preserving refs. Once hydration has
    // completed, do not dispatch HYDRATE into a later machine step.
    if (hydratedRef.current) return undefined;
    let mounted = true;
    Promise.all([
      onboardingV3Persistence.readPersonalizedProfile(),
      onboardingV3Persistence.readPersonalizedProgress(),
      onboardingV3Persistence.readMascotName(),
      onboardingV3Persistence.readAttribution(),
      foodPreferencesPersistence.read(),
    ])
      .then(([profile, resumeStep, mascotName, attribution, dietaryPreferences]) => {
        if (!mounted) return;
        dispatch({ type: 'HYDRATE', profile: { ...profile, dietaryPreferences }, resumeStep, mascotName, attribution });
      })
      .catch((error: unknown) => {
        onboardingV3Log('hydration_failed', { error: String(error) });
      })
      .finally(() => {
        if (!mounted) return;
        hydratedRef.current = true;
        const pending = pendingSplashRef.current;
        if (pending) {
          pendingSplashRef.current = null;
          dispatch({ type: 'SPLASH_FINISHED', ...pending });
        }
      });
    return () => { mounted = false; };
  }, [dispatch]);

  const commitCanonicalOnboardingCompletion = useCallback(async (onPersisted?: () => void) => {
    await onboardingPersistence.writeCompleted();
    onPersisted?.();
    useOkyoStore.getState().completeOnboarding();
    onboardingV3Log('completed', { path: completionPathRef.current ?? 'purchase' });
    track(analyticsEvents.ONBOARDING_COMPLETE, { screen: 'OnboardingV3' });
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || state.step === 'splash' || state.step === 'complete') return;
    void Promise.all([
      onboardingV3Persistence.writePersonalizedProfile(state.profile),
      onboardingV3Persistence.writePersonalizedProgress(getPersistedPersonalizedStep(state.step)),
    ]).catch((error: unknown) => onboardingV3Log('personalized_persist_failed', { error: String(error) }));
  }, [state.profile, state.step]);

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  useEffect(() => {
    if (state.step !== 'complete' || didCompleteRef.current) return;
    didCompleteRef.current = true;
    void commitCanonicalOnboardingCompletion().catch((error: unknown) => {
      didCompleteRef.current = false;
      onboardingV3Log('completion_persist_failed', { error: String(error) });
    });
  }, [commitCanonicalOnboardingCompletion, state.step]);

  const finishSplash = useCallback((elapsedMs: number, fontsLoaded: boolean) => {
    if (!hydratedRef.current) {
      pendingSplashRef.current = { elapsedMs, fontsLoaded };
      return;
    }
    dispatch({ type: 'SPLASH_FINISHED', elapsedMs, fontsLoaded });
  }, [dispatch]);

  const finishShowcase = useCallback(() => {
    dispatch({ type: 'SHOWCASE_FINISHED' });
  }, [dispatch]);

  const selectAttribution = useCallback((source: AttributionSource) => {
    dispatch({ type: 'ATTRIBUTION_SELECTED', source });
    void onboardingV3Persistence.writeAttribution(source).catch((error: unknown) => {
      onboardingV3Log('attribution_persist_failed', { error: String(error) });
    });
  }, [dispatch]);

  const skipAttribution = useCallback(() => {
    dispatch({ type: 'ATTRIBUTION_SKIPPED' });
    void onboardingV3Persistence.writeAttribution(null).catch((error: unknown) => {
      onboardingV3Log('attribution_persist_failed', { error: String(error) });
    });
  }, [dispatch]);

  const submitMascotName = useCallback((raw: string) => {
    dispatch({ type: 'MASCOT_NAME_SUBMITTED', raw });
    void onboardingV3Persistence.writeMascotName(raw).catch((error: unknown) => {
      onboardingV3Log('mascot_name_persist_failed', { error: String(error) });
    });
  }, [dispatch]);

  const submitName = useCallback((raw: string) => {
    dispatch({ type: 'NAME_SUBMITTED', raw });
    onboardingV3Log('user_named', { length: raw.trim().length });
  }, [dispatch]);

  const selectPrimaryGoal = useCallback((goal: PrimaryGoal) => dispatch({ type: 'PRIMARY_GOAL_SELECTED', goal }), [dispatch]);
  const setPersonalizedAnswer = useCallback((key: string, value: PersonalizedAnswer) => dispatch({ type: 'ANSWER_SET', key, value }), [dispatch]);
  const continuePersonalized = useCallback(() => dispatch({ type: 'CONTINUE' }), [dispatch]);
  const completeHoldReveal = useCallback(() => dispatch({ type: 'HOLD_COMPLETED' }), [dispatch]);
  const submitSecondaryGoals = useCallback((goals: SecondaryGoal[]) => dispatch({ type: 'SECONDARY_GOALS_SET', goals }), [dispatch]);
  const submitDietaryPreferences = useCallback((preferences: FoodPreferences) => {
    dispatch({ type: 'DIETARY_SET', preferences });
    void foodPreferencesPersistence.write(preferences).catch((error: unknown) => {
      onboardingV3Log('dietary_persist_failed', { error: String(error) });
    });
  }, [dispatch]);

  const selectPhoto = useCallback(async (image: ScanImageMetadata) => {
    if (!isRealInputUnlocked(stateRef.current.step)) return;
    // Keep the picker/camera URI temporary until a real recipe succeeds. A
    // selected or rejected food photo must not be copied into Documents.
    selectedImageRef.current = image;
    mealDescriptionRef.current = null;
    sourceRef.current = image.source === 'camera' ? 'camera' : 'photos';
    recipeRequestIdRef.current = null;
    dispatch({ type: 'PHOTO_SELECTED', uri: image.uri ?? '' });
  }, [dispatch]);

  const beginSession = useCallback((source: ScanSource, image: ScanImageMetadata | null, mealDescription: string | null) => {
    const scanSessionId = createScanSessionId(source);
    const store = useOkyoStore.getState();
    const previewImage = getPreviewImageMetadata(image);
    store.clearLatestScan({
      preserveImageUri: previewImage?.uri,
      reason: 'OnboardingV3.beginSession',
      source: 'OnboardingV3',
    });
    store.setSelectedMode('Normal');
    store.beginLatestScanSession({
      scanSessionId,
      latestScanStatus: 'pending',
      latestScanFailure: null,
      latestScanResult: null,
      latestScanRecipe: null,
      selectedScanImage: previewImage,
      latestAiDebugMetadata: null,
      mealDescription,
      source,
      reason: 'OnboardingV3.analysis_started',
    });
    track(analyticsEvents.SCAN_STARTED, { screen: 'OnboardingV3', source });
    if (image) track(analyticsEvents.PHOTO_UPLOADED, { screen: 'OnboardingV3', source });
    return scanSessionId;
  }, []);

  const performAnalysis = useCallback(async (
    request: AnalyzeScanRequest,
    scanSessionId: string,
  ) => {
    const startedAt = Date.now();
    onboardingV3Log('analyze_request', {
      hasDescription: Boolean(request.mealDescription),
      hasImage: Boolean(request.image),
      source: request.source,
    });
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    try {
      const result = await runOnboardingAnalysis(request, controller.signal);
      if (controller.signal.aborted || requestControllerRef.current !== controller) return;
      dispatch({ type: 'ANALYSIS_SUCCEEDED', analysisId: result.analysisId, dishName: result.dishName });
      onboardingV3Log('analyze_result', {
        analysisId: result.analysisId,
        confidence: result.confidence,
        inputKind: result.inputKind,
        ms: Date.now() - startedAt,
        scanState: result.scanState,
      });
      track(analyticsEvents.DISH_DETECTED, { dishName: result.dishName, screen: 'OnboardingV3' });
    } catch (error) {
      if (controller.signal.aborted || requestControllerRef.current !== controller) return;
      const rejection = getAnalysisRejection(error);
      if (rejection) {
        writeFailedSession(scanSessionId, sourceRef.current, selectedImageRef.current, mealDescriptionRef.current, rejection.error, rejection.rejectionType);
        dispatch({ type: 'ANALYSIS_REJECTED', kind: rejection.error.kind, message: rejection.error.message });
        onboardingV3Log('analyze_rejected', { ms: Date.now() - startedAt, rejectionType: rejection.rejectionType });
      } else {
        const message = getAnalysisFailureMessage(error);
        writeFailedSession(scanSessionId, sourceRef.current, selectedImageRef.current, mealDescriptionRef.current, { kind: 'network', message }, 'ai_failed');
        dispatch({ type: 'ANALYSIS_FAILED', message });
      }
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    }
  }, [dispatch]);

  const submitDescription = useCallback((description: string) => {
    if (!isRealInputUnlocked(stateRef.current.step)) return;
    const mealDescription = description.trim();
    if (!mealDescription) return;
    selectedImageRef.current = null;
    mealDescriptionRef.current = mealDescription;
    sourceRef.current = 'description';
    recipeRequestIdRef.current = null;
    const scanSessionId = beginSession('description', null, mealDescription);
    dispatch({ type: 'DESCRIPTION_SUBMITTED', text: mealDescription, scanSessionId });
    void performAnalysis({ source: 'description', mode: 'Normal', mealDescription }, scanSessionId);
  }, [beginSession, dispatch, performAnalysis]);

  const confirmPhoto = useCallback(() => {
    if (!isRealInputUnlocked(stateRef.current.step)) return;
    const image = selectedImageRef.current;
    if (!image) return;
    const scanSessionId = beginSession(sourceRef.current, image, null);
    dispatch({ type: 'PHOTO_CONFIRMED', scanSessionId });
    void performAnalysis({ source: sourceRef.current, mode: 'Normal', image }, scanSessionId);
  }, [beginSession, dispatch, performAnalysis]);

  const cancelAnalysis = useCallback(() => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    const uri = selectedImageRef.current?.uri;
    useOkyoStore.getState().clearLatestScan({
      preserveImageUri: uri,
      reason: 'OnboardingV3.analysis_cancelled',
      source: 'OnboardingV3',
    });
    dispatch({ type: 'BACK' });
  }, [dispatch]);

  const generateRecipe = useCallback(async (selection: FoodPreferences, existingRecipeId: string | null) => {
    const current = stateRef.current;
    if (!current.analysisId || !current.scanSessionId) return;
    const requestId = recipeRequestIdRef.current ?? createRecipeRequestId();
    recipeRequestIdRef.current = requestId;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const startedAt = Date.now();
    onboardingV3Log('recipe_request', {
      analysisId: current.analysisId,
      hasPreferences: selection.allergies.length > 0 || selection.restrictions.length > 0 || selection.avoidances.length > 0 || selection.dislikes.length > 0,
    });
    try {
      const dietary = toApiFoodPreferences(selection);
      const request: GenerateRecipeFromAnalysisRequest = {
        mode: 'Normal',
        ...dietary,
        recipeRequestId: requestId,
        goalContext: buildGoalContext(current.profile),
      };
      const fallbackRequest: CreateScanRequest = {
        source: sourceRef.current,
        mode: 'Normal',
        ...(selectedImageRef.current ? { image: selectedImageRef.current } : {}),
        ...(mealDescriptionRef.current ? { mealDescription: mealDescriptionRef.current } : {}),
        ...dietary,
        goalContext: buildGoalContext(current.profile),
      };
      const result = await runOnboardingRecipeGeneration({
        analysisId: current.analysisId,
        request,
        fallbackRequest,
      }, controller.signal);
      if (controller.signal.aborted || requestControllerRef.current !== controller) return;
      const persistedImage = selectedImageRef.current
        ? await copyToDocuments(selectedImageRef.current)
        : null;
      if (controller.signal.aborted || requestControllerRef.current !== controller) return;
      selectedImageRef.current = persistedImage;
      const recipeId = commitRecipeResult(result, {
        existingRecipeId,
        image: persistedImage,
        mealDescription: mealDescriptionRef.current,
        scanSessionId: current.scanSessionId,
        source: sourceRef.current,
      });
      dispatch({ type: 'RECIPE_READY', recipeId });
      onboardingV3Log('recipe_committed', {
        ms: Date.now() - startedAt,
        recipeId,
        usedFallbackPath: Boolean(result.source),
      });
      track(analyticsEvents.RECIPE_GENERATED, { dishName: result.scan?.dishName, screen: 'OnboardingV3' });
    } catch (error) {
      if (controller.signal.aborted || requestControllerRef.current !== controller) return;
      onboardingV3Log('recipe_failed', { ms: Date.now() - startedAt, reason: getSafeErrorReason(error) });
      dispatch({ type: 'RECIPE_FAILED', message: "Okyo couldn't finish this recipe. Try again." });
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    }
  }, [dispatch]);

  useEffect(() => {
    if (state.step !== 'recipe' || !state.analysisId || state.recipeId || recipeRequestIdRef.current) return;
    const dietary = state.profile.dietaryPreferences;
    void generateRecipe(dietary, null);
  }, [generateRecipe, state.analysisId, state.profile.dietaryPreferences, state.recipeId, state.step]);

  const retryRecipe = useCallback(() => {
    dispatch({ type: 'RECIPE_RETRY' });
    void generateRecipe(stateRef.current.profile.dietaryPreferences, stateRef.current.recipeId);
  }, [dispatch, generateRecipe]);

  const startOver = useCallback(() => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    selectedImageRef.current = null;
    mealDescriptionRef.current = null;
    recipeRequestIdRef.current = null;
    useOkyoStore.getState().clearLatestScan({ reason: 'OnboardingV3.start_over', source: 'OnboardingV3' });
    dispatch({ type: 'START_OVER' });
  }, [dispatch]);

  const continueToPaywall = useCallback(() => dispatch({ type: 'CONTINUE' }), [dispatch]);

  const startCooking = useCallback(() => {
    const recipeId = stateRef.current.recipeId;
    const recipe = recipeId ? useOkyoStore.getState().recipesById[recipeId] : null;
    if (!recipeId || !recipe) return;
    const steps = buildGuidedCookingSteps(recipe);
    useOkyoStore.getState().startCookingRecipe(recipeId, steps.length);
    onboardingV3Log('cooking', { action: 'started' });
    dispatch({ type: 'COOK' });
  }, [dispatch]);

  const updateCookingStep = useCallback((index: number, total: number) => {
    const recipeId = stateRef.current.recipeId;
    if (recipeId) useOkyoStore.getState().updateCookingStep(recipeId, index, total);
  }, []);

  const exitCooking = useCallback(() => {
    const recipeId = stateRef.current.recipeId;
    if (recipeId) useOkyoStore.getState().endCookingRecipe(recipeId);
    onboardingV3Log('cooking', { action: 'exited' });
    dispatch({ type: 'COOKING_EXITED' });
  }, [dispatch]);

  const completeCooking = useCallback(() => {
    const recipeId = stateRef.current.recipeId;
    if (recipeId) useOkyoStore.getState().completeRecipe(recipeId);
    onboardingV3Log('cooking', { action: 'completed' });
    dispatch({ type: 'COOKING_COMPLETED' });
  }, [dispatch]);

  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    if (purchaseBusyRef.current) return;
    purchaseBusyRef.current = true;
    setIsPurchaseBusy(true);
    try {
      const result = await purchasePackage(pkg);
      if (result.status === 'purchased') {
        useOkyoStore.getState().setPremium(true);
        completionPathRef.current = 'purchase';
        onboardingV3Log('purchase_state', { isEntitled: true, packageIdentifier: pkg.identifier, status: 'purchased' });
        dispatch({ type: 'PURCHASE_SUCCEEDED', entitled: true });
      } else if (result.status === 'not_entitled') {
        onboardingV3Log('purchase_state', { isEntitled: false, packageIdentifier: pkg.identifier, status: 'not_entitled' });
        dispatch({ type: 'PURCHASE_SUCCEEDED', entitled: false });
      } else if (result.status === 'cancelled') {
        onboardingV3Log('purchase_state', { isEntitled: false, packageIdentifier: pkg.identifier, status: 'cancelled' });
        dispatch({ type: 'PURCHASE_CANCELLED' });
      } else {
        onboardingV3Log('purchase_state', { isEntitled: false, packageIdentifier: pkg.identifier, status: 'failed' });
        dispatch({ type: 'PURCHASE_FAILED', message: 'We could not finish that purchase. Try again.' });
      }
    } catch {
      dispatch({ type: 'PURCHASE_FAILED', message: 'We could not finish that purchase. Try again.' });
    } finally {
      purchaseBusyRef.current = false;
      setIsPurchaseBusy(false);
    }
  }, [dispatch]);

  const restore = useCallback(async () => {
    if (purchaseBusyRef.current) return;
    purchaseBusyRef.current = true;
    setIsPurchaseBusy(true);
    try {
      const result = await restorePurchases();
      if (result.status === 'restored') {
        if (result.isEntitled) useOkyoStore.getState().setPremium(true);
        if (result.isEntitled) completionPathRef.current = 'restore';
        onboardingV3Log('purchase_state', { isEntitled: result.isEntitled, packageIdentifier: null, status: 'restored' });
        dispatch({ type: 'RESTORE_SUCCEEDED', entitled: result.isEntitled });
      } else {
        dispatch({ type: 'PURCHASE_FAILED', message: 'We could not restore purchases. Try again.' });
      }
    } catch {
      dispatch({ type: 'PURCHASE_FAILED', message: 'We could not restore purchases. Try again.' });
    } finally {
      purchaseBusyRef.current = false;
      setIsPurchaseBusy(false);
    }
  }, [dispatch]);

  const acceptExistingEntitlement = useCallback(() => {
    useOkyoStore.getState().setPremium(true);
    completionPathRef.current = 'restore';
    dispatch({ type: 'PURCHASE_SUCCEEDED', entitled: true });
  }, [dispatch]);

  // TEMPORARY DEVELOPMENT PAYWALL BYPASS — see src/config/devFlags.ts.
  // Finishes onboarding straight into MainTabs instead of routing through the
  // real-purchase 'postPurchase' handoff screen. Never reached unless
  // DEV_BYPASS_PAYWALL is true, which is always false in release builds.
  const devCompleteOnboarding = useCallback(() => {
    useOkyoStore.getState().setPremium(true);
    completionPathRef.current = 'dev_bypass';
    dispatch({ type: 'DEV_BYPASS_COMPLETED' });
  }, [dispatch]);

  // Stage-two branch previews have already collected their answers. Their final
  // Done action uses the same controller completion lifecycle as the rest of V3
  // without granting a subscription or re-entering the paywall flow.
  const completeBranchPreview = useCallback(async () => {
    if (branchPreviewCompletionBusyRef.current) return;
    branchPreviewCompletionBusyRef.current = true;
    completionPathRef.current = 'branch_preview';
    try {
      await commitCanonicalOnboardingCompletion(() => {
        // Move the controller through its canonical terminal state only after
        // durable persistence succeeds. The app shell then switches to MainTabs.
        didCompleteRef.current = true;
        dispatch({ type: 'BRANCH_PREVIEW_COMPLETED' });
      });
    } catch (error) {
      didCompleteRef.current = false;
      completionPathRef.current = null;
      onboardingV3Log('completion_persist_failed', { error: String(error) });
      throw error;
    } finally {
      branchPreviewCompletionBusyRef.current = false;
    }
  }, [commitCanonicalOnboardingCompletion, dispatch]);

  const back = useCallback(() => {
    if (stateRef.current.step === 'nameFox') setShowcaseInitialPage(6);
    if (stateRef.current.step === 'recipe') requestControllerRef.current?.abort();
    dispatch({ type: 'BACK' });
  }, [dispatch]);

  return {
    state,
    isPurchaseBusy,
    showcaseInitialPage,
    finishSplash,
    finishShowcase,
    selectAttribution,
    skipAttribution,
    submitMascotName,
    submitName,
    selectPrimaryGoal,
    setPersonalizedAnswer,
    continuePersonalized,
    completeHoldReveal,
    submitSecondaryGoals,
    submitDietaryPreferences,
    selectPhoto,
    submitDescription,
    confirmPhoto,
    cancelAnalysis,
    retryRecipe,
    startOver,
    continueToPaywall,
    startCooking,
    updateCookingStep,
    exitCooking,
    completeCooking,
    purchase,
    restore,
    acceptExistingEntitlement,
    devCompleteOnboarding,
    completeBranchPreview,
    dismissPurchaseError: () => dispatch({ type: 'PURCHASE_CANCELLED' }),
    back,
    permissionDenied: (message?: string) => dispatch({ type: 'PERMISSION_DENIED', message }),
    editRecipeTitle: (recipeId: string, title: string) => useOkyoStore.getState().updateRecipe(recipeId, { title: title.trim() }),
  };
}

function getAnalysisRejection(error: unknown): {
  error: AnalysisRejectionError;
  rejectionType: ScanRejectionType;
} | null {
  if (!(error instanceof ApiClientError)) return null;
  if (error.code === 'ingredients_only') {
    return {
      error: { kind: 'ingredients_only', message: "Scan a prepared dish you'd like to recreate." },
      rejectionType: 'ingredients_only',
    };
  }
  if (error.code === 'no_food_detected') {
    return {
      error: { kind: 'not_food', message: "This doesn't look like a meal yet. Try another photo." },
      rejectionType: 'not_food',
    };
  }
  if (error.code === 'unclear_food') {
    return {
      error: { kind: 'unclear', message: 'Try a clearer photo with the whole dish visible.' },
      rejectionType: 'unclear_image',
    };
  }
  return null;
}

function getAnalysisFailureMessage(error: unknown) {
  if (error instanceof ApiClientError && error.status === 413) return 'This photo was too large to scan. Try a smaller image.';
  if (error instanceof ApiClientError && error.status === 429) return 'Okyo has reached its daily scan limit. Try again later.';
  return 'Okyo had trouble reading this photo. Try again in a second.';
}

function commitRecipeResult(
  result: OnboardingRecipeResult,
  context: {
    existingRecipeId: string | null;
    image: ScanImageMetadata | null;
    mealDescription: string | null;
    scanSessionId: string;
    source: ScanSource;
  },
) {
  const recipe = getResultRecipe(result);
  if (result.status && result.status !== 'success') throw new Error('Recipe response was not successful.');
  if (!result.scan || !isUsableCanonicalRecipe(recipe)) throw new Error('Recipe response was incomplete.');
  const store = useOkyoStore.getState();
  if (context.existingRecipeId) {
    if (!store.correctRecipe(context.existingRecipeId, recipe, result.scan)) {
      throw new Error('Existing onboarding recipe could not be updated.');
    }
    return context.existingRecipeId;
  }
  const committed = store.commitSuccessfulScanSession({
    scanSessionId: context.scanSessionId,
    latestScanStatus: 'success',
    latestScanFailure: null,
    latestScanResult: result.scan,
    latestScanRecipe: recipe,
    selectedScanImage: getPreviewImageMetadata(context.image),
    latestAiDebugMetadata: result.aiSource ? {
      aiSource: result.aiSource,
      aiProvider: result.aiProvider,
      visionModel: result.visionModel,
      recipeModel: result.recipeModel,
      fallbackReason: result.fallbackReason,
      confidence: result.confidence,
    } : null,
    mealDescription: context.mealDescription,
    source: context.source,
    reason: 'OnboardingV3.recipe_ready',
  });
  if (!committed) throw new Error('Canonical onboarding recipe could not be stored.');
  return getCanonicalScanRecipeId(context.scanSessionId);
}

function getResultRecipe(result: OnboardingRecipeResult): Recipe | null {
  const recipes = Array.isArray(result.recipes) ? result.recipes : [];
  return recipes.find((recipe) => recipe.mode === 'Normal') ?? result.recipe ?? recipes[0] ?? null;
}

function getPreviewImageMetadata(image: ScanImageMetadata | null) {
  if (!image) return null;
  const { dataUrl: _dataUrl, ...preview } = image;
  return preview;
}

function writeFailedSession(
  scanSessionId: string,
  source: ScanSource,
  image: ScanImageMetadata | null,
  mealDescription: string | null,
  error: OnboardingV3Error,
  rejectionType: ScanRejectionType,
) {
  useOkyoStore.getState().writeLatestScanSession({
    scanSessionId,
    latestScanStatus: error.kind === 'network' ? 'failed' : 'rejected',
    latestScanFailure: {
      status: error.kind === 'network' ? 'failed' : 'rejected',
      rejectionType,
      rejectionReason: error.message,
    },
    latestScanResult: null,
    latestScanRecipe: null,
    selectedScanImage: getPreviewImageMetadata(image),
    latestAiDebugMetadata: null,
    mealDescription,
    source,
    reason: 'OnboardingV3.analysis_failed',
  });
}

function createScanSessionId(source: ScanSource) {
  return `onboarding-v3-${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createRecipeRequestId() {
  return `onboarding-v3-recipe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSafeErrorReason(error: unknown) {
  if (error instanceof ApiClientError) return error.code || `http_${error.status}`;
  return error instanceof Error ? error.name : 'unknown';
}
