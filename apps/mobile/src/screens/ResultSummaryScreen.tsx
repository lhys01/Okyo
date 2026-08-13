import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Camera,
  Clock,
  NavArrowLeft,
  PlusCircle,
  ShareAndroid,
} from 'iconoir-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { CORRECTION_FAILURE_MESSAGE, correctScanRecipe } from '../api/client';
import { checkImageFileExists, getStorageLocation } from '../utils/imageValidation';
import { canUseScanStateForRoute } from '../utils/onboardingScanGuards';
import {
  buildCorrectionRequest,
  canSubmitCorrection,
  getRecipeCorrectionSourceId,
  isCurrentCorrectionRequest,
  validateCorrectionNote,
} from '../utils/recipeCorrection';
import { imageTraceLog, uiLog } from '../utils/uiDebug';
import { KikoMascot } from '../components/KikoMascot';
import { RecipeLikeButton } from '../components/RecipeLikeButton';
import { RecipeNutritionCards } from '../components/RecipeNutritionCards';
import { RecipeCostSummary, RecipeQuickFacts } from '../components/RecipeAssistantOverview';
import { RecipeIngredientsAssistant } from '../components/RecipeIngredientsAssistant';
import { RecipePrimaryActions } from '../components/RecipePrimaryActions';
import { FoodSafetyNotice } from '../components/FoodSafetyNotice';
import {
  PrimaryButton,
  colors,
  fontFamilies,
} from '../components/OkyoUI';
import {
  defaultScanResult,
  getSafeRecipeForMode,
  getSafeRecipeMode,
  isRecipeMode,
  type Recipe,
  type RecipeMode,
  type ScanResult,
} from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { findFoodPreferenceConflicts, foodPreferencesPersistence, toApiFoodPreferences, useFoodPreferences } from '../state/foodPreferences';
import { useMascotName } from '../state/useMascotName';
import { onboardingV3Persistence } from '../onboarding-v3/state/onboardingV3Persistence';
import { buildGoalContext } from '../onboarding-v3/state/goalContext';
import { RECIPE_PRESENTATION_MODES, resolveCanonicalRecipe, type RecipePresentationMode } from '../state/canonicalRecipes';
import { recipeColors, recipeShadows } from '../theme/recipeTheme';
import { getRealScanImageUri } from '../utils/recipeImages';
import { formatRecipeDuration, getRecipeTiming } from '../utils/recipeIntegrity';
import { buildGuidedCookingSteps } from '../utils/guidedCookingSteps';
import { isUsableScan } from '../utils/scanDecision';
import { getFreshDescribeMealResetState, getHomeResetState } from '../utils/scanControllerUtils';
import { getCompactRecipeDescription, getCookingCtaLabel } from '../utils/recipePresentation';

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
type ResultSummaryNavigation = NativeStackNavigationProp<RootStackParamList, 'ResultSummaryScreen'>;
type ResultSummaryRoute = RouteProp<RootStackParamList, 'ResultSummaryScreen'>;

export function ResultSummaryScreen() {
  const navigation = useNavigation<ResultSummaryNavigation>();
  const route = useRoute<ResultSummaryRoute>();
  const mascotName = useMascotName();
  const selectedModeRaw = useOkyoStore((state) => state.selectedMode);
  const selectedMode = getSafeRecipeMode(selectedModeRaw);
  const scanSessionId = useOkyoStore((state) => state.scanSessionId);
  const latestScanSession = useOkyoStore((state) => state.latestScanSession);
  const storedLatestScanResult = useOkyoStore((state) => state.latestScanResult);
  const storedLatestScanStatus = useOkyoStore((state) => state.latestScanStatus);
  const storedLatestScanFailure = useOkyoStore((state) => state.latestScanFailure);
  const storedLatestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const storedSelectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const storedLatestAiDebugMetadata = useOkyoStore((state) => state.latestAiDebugMetadata);
  const recipesById = useOkyoStore((state) => state.recipesById);
  const savedRecipeIds = useOkyoStore((state) => state.savedRecipeIds);
  const correctRecipe = useOkyoStore((state) => state.correctRecipe);
  const getRecipePresentationVariant = useOkyoStore((state) => state.getRecipePresentationVariant);
  const cacheRecipePresentationVariant = useOkyoStore((state) => state.cacheRecipePresentationVariant);
  const setRecipePresentationMode = useOkyoStore((state) => state.setRecipePresentationMode);
  const clearLatestScan = useOkyoStore((state) => state.clearLatestScan);
  const incrementWeeklyScanCount = useOkyoStore((state) => state.incrementWeeklyScanCount);
  const toggleRecipeLiked = useOkyoStore((state) => state.toggleRecipeLiked);
  const startCookingRecipe = useOkyoStore((state) => state.startCookingRecipe);
  const activeCookingSession = useOkyoStore((state) => state.activeCookingSession);
  const endCookingRecipe = useOkyoStore((state) => state.endCookingRecipe);
  const addRecipeToGrocery = useOkyoStore((state) => state.addRecipeToGrocery);
  const toggleIngredientInGrocery = useOkyoStore((state) => state.toggleIngredientInGrocery);
  const groceryRecipeIds = useOkyoStore((state) => state.groceryRecipeIds);
  const groceryIngredientSelections = useOkyoStore((state) => state.groceryIngredientSelections ?? {});
  const recipeServingOverrides = useOkyoStore((state) => state.recipeServingOverrides ?? {});
  const setRecipeServingOverride = useOkyoStore((state) => state.setRecipeServingOverride);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const awardedXpEvents = useOkyoStore((state) => state.awardedXpEvents);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const routeScanSessionId = route.params?.scanSessionId;
  const routeRecipeId = route.params?.recipeId;
  const canUseStoredScanState = canUseScanStateForRoute(
    routeScanSessionId,
    scanSessionId,
    latestScanSession?.scanSessionId,
  );
  const stateSource = !canUseStoredScanState
    ? 'route_session_mismatch'
    : latestScanSession
      ? 'latest_scan_session'
      : 'legacy_latest_scan_fields';
  const sessionRecipeId = latestScanSession?.latestScanRecipe?.id;
  const requestedRecipeId = routeRecipeId ??
    (canUseStoredScanState && storedLatestScanRecipe?.id === sessionRecipeId ? sessionRecipeId : undefined);
  const canonicalRecipe = routeRecipeId
    ? resolveCanonicalRecipe(recipesById, routeRecipeId)
    : canUseStoredScanState
      ? resolveCanonicalRecipe(recipesById, requestedRecipeId)
      : null;
  const latestScanResult = canonicalRecipe?.scanResult ??
    (canUseStoredScanState ? latestScanSession?.latestScanResult ?? storedLatestScanResult : null);
  const latestScanStatus = routeRecipeId && canonicalRecipe
    ? 'success'
    : canUseStoredScanState
      ? latestScanSession?.latestScanStatus ?? storedLatestScanStatus
      : null;
  const latestScanFailure = canUseStoredScanState ? latestScanSession?.latestScanFailure ?? storedLatestScanFailure : null;
  const latestScanRecipe = canonicalRecipe &&
    canonicalRecipe.id === requestedRecipeId &&
    (Boolean(routeRecipeId) || !sessionRecipeId || sessionRecipeId === requestedRecipeId)
    ? canonicalRecipe
    : null;
  const isDescriptionScan = latestScanRecipe?.origin === 'description' ||
    (canUseStoredScanState && latestScanSession?.source === 'description');
  // Single canonical recipe. The selected view is a lens,
  // not a separate recipe — kept as a 1-element list for the view selectors/tabs.
  const latestScanRecipes = latestScanRecipe ? [latestScanRecipe] : [];
  const selectedScanImage = latestScanRecipe?.originalImage ??
    (canUseStoredScanState ? latestScanSession?.selectedScanImage ?? storedSelectedScanImage : null);
  const selectedScanImageUri = getRealScanImageUri(selectedScanImage);
  const latestAiDebugMetadata = canUseStoredScanState
    ? latestScanSession?.latestAiDebugMetadata ?? storedLatestAiDebugMetadata
    : null;
  const isDemoScan = isExplicitDemoScan(selectedScanImage);
  const scanResult = latestScanResult ?? (isDemoScan ? defaultScanResult : null);
  const hasSuccessfulScanSession = latestScanStatus === 'success' && Boolean(scanResult);
  const selectedRecipe = latestScanRecipe ?? (isDemoScan ? getSafeRecipeForMode(selectedMode) : null);
  const { preferences: foodPreferences } = useFoodPreferences();
  const foodConflicts = selectedRecipe && foodPreferences
    ? findFoodPreferenceConflicts(selectedRecipe.ingredients.map((ingredient) => ingredient.name), foodPreferences)
    : [];
  const didTrackResultView = useRef(false);
  const [dishNameOverride, setDishNameOverride] = useState('');
  // The compact identification confirmation is one-time. Its editor transitions
  // into the same small, permanent correction entry used by reopened recipes.
  const [isEditingDishName, setIsEditingDishName] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [pendingPresentationMode, setPendingPresentationMode] = useState<RecipePresentationMode | null>(null);
  // Race guard: only the response for the most recently fired correction
  // request is allowed to apply. An older in-flight response arriving late
  // (after a retry or a second correction) becomes a silent no-op.
  const latestCorrectionRequestIdRef = useRef<string | null>(null);
  const correctionInFlightRef = useRef(false);
  const correctedScanIdRef = useRef<string | null>(null);
  const baseRecipeRef = useRef<Recipe | null>(null);
  const baseScanRef = useRef<ScanResult | null>(null);
  const [restaurantPriceInput, setRestaurantPriceInput] = useState('');
  const displayServings = selectedRecipe ? (recipeServingOverrides[selectedRecipe.id] ?? selectedRecipe.servings) : 2;
  const firstScanEventId = `first-scan-${scanResult?.id ?? 'missing-scan'}`;
  const isScanFailure = latestScanStatus === 'rejected' || latestScanStatus === 'failed';
  const isPartialScan = latestScanStatus === 'partial' && Boolean(latestScanResult);
  const hasUsableScan = isUsableScan({
    latestScanRecipe,
    recipes: latestScanRecipes,
    scan: scanResult,
    status: latestScanStatus === 'pending' ? null : latestScanStatus,
  });
  const shouldShowFailure = isScanFailure && !hasUsableScan;
  const shouldShowPartial = isPartialScan && !hasUsableScan;
  const failureCopy = getScanFailureCopy(latestScanFailure);
  const failureGuidance = getFailureGuidance(latestScanFailure?.rejectionType);
  const selectedModeUi = getModeUi(selectedMode);
  const selectedPresentationMode = latestScanRecipe?.selectedPresentationMode ?? 'Normal';
  const recipeTiming = selectedRecipe ? getRecipeTiming(selectedRecipe) : null;
  const displayDishName = cleanDisplayText(dishNameOverride.trim() || scanResult?.dishName || '');
  const possibleDishNames = getPossibleDishNames(scanResult, displayDishName);
  const userRestaurantPrice = parseRestaurantPrice(restaurantPriceInput);
  const restaurantEstimate =
    userRestaurantPrice ??
    (selectedRecipe?.restaurantPriceEstimate && selectedRecipe.restaurantPriceEstimate > 0
      ? selectedRecipe.restaurantPriceEstimate
      : scanResult?.restaurantPrice && scanResult.restaurantPrice > 0
        ? scanResult.restaurantPrice
        : null);
  const homemadeEstimate = selectedRecipe?.estimatedHomemadeCost ?? scanResult?.homemadeCost ?? null;
  const canShowSavings = isDemoScan || restaurantEstimate !== null;
  const estimatedSavings = isDemoScan
    ? selectedRecipe?.estimatedSavings ?? 0
    : restaurantEstimate !== null && homemadeEstimate !== null
      ? Math.max(0, restaurantEstimate - homemadeEstimate)
      : null;
  const displaySubtitle = getDisplaySubtitle(scanResult?.restaurantStyle, selectedRecipe?.description);
  const bestGuessNote = getBestGuessResultNote(scanResult);
  const isLiked = selectedRecipe ? savedRecipeIds.includes(selectedRecipe.id) : false;

  useEffect(() => {
    // Legacy recipes created before base snapshots were persisted still get a
    // reliable in-session Normal restore. New scan recipes use the canonical
    // snapshots below, which also survive an app restart.
    if (!selectedRecipe || !scanResult || selectedPresentationMode !== 'Normal') {
      return;
    }
    baseRecipeRef.current = latestScanRecipe?.baseRecipe ?? selectedRecipe;
    baseScanRef.current = latestScanRecipe?.baseScanResult ?? scanResult;
  }, [latestScanRecipe, scanResult, selectedPresentationMode, selectedRecipe]);

  useEffect(() => {
    // A successful correction writes a new scanResult (new id) on purpose —
    // that id change must not reset the active correction editor or
    // wipe the price the user already typed in.
    if (correctedScanIdRef.current && correctedScanIdRef.current === scanResult?.id) {
      correctedScanIdRef.current = null;
      return;
    }
    setDishNameOverride('');
    setIsEditingDishName(false);
    setCorrectionText('');
    setCorrectionError(null);
    // Pre-fill with the AI's restaurant price estimate for real scans so the
    // savings section shows immediately without requiring user input.
    const priceHint =
      !isDemoScan && scanResult?.restaurantPrice && scanResult.restaurantPrice > 0
        ? scanResult.restaurantPrice.toFixed(2)
        : '';
    setRestaurantPriceInput(priceHint);
  }, [scanResult?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    logResultStateSource({
      activeScanSessionId: scanSessionId,
      legacyRecipesLength: storedLatestScanRecipe ? 1 : 0,
      legacyStatus: storedLatestScanStatus,
      routeScanSessionId,
      sessionExists: Boolean(latestScanSession),
      sessionRecipesLength: latestScanSession?.latestScanRecipe ? 1 : 0,
      sessionStatus: latestScanSession?.latestScanStatus,
      stateSource,
    });
    if (
      latestScanSession?.latestScanStatus === 'success' &&
      (!storedLatestScanStatus || !storedLatestScanRecipe)
    ) {
      logPreserveSuccessState({
        legacyRecipesLength: storedLatestScanRecipe ? 1 : 0,
        legacyStatus: storedLatestScanStatus,
        scanSessionId: latestScanSession.scanSessionId,
        sessionRecipesLength: latestScanSession.latestScanRecipe ? 1 : 0,
      });
    }
    logResultDecision({
      hasSuccessfulScanSession,
      isDemoScan,
      isPartialScan: shouldShowPartial,
      isScanFailure: shouldShowFailure,
      latestScanRecipesLength: latestScanRecipes.length,
      latestScanStatus,
      route: getResultDecisionRoute({
        hasSuccessfulScanSession,
        isPartialScan: shouldShowPartial,
        isScanFailure: shouldShowFailure,
        latestScanStatus,
        scanResultExists: Boolean(scanResult),
        selectedRecipeExists: Boolean(selectedRecipe),
      }),
      scanState: scanResult?.scanState,
      selectedRecipeExists: Boolean(selectedRecipe),
      stateSource,
    });
  }, [
    hasSuccessfulScanSession,
    isDemoScan,
    latestScanRecipes.length,
    latestScanSession,
    latestScanStatus,
    routeScanSessionId,
    scanResult,
    scanSessionId,
    selectedRecipe,
    shouldShowFailure,
    shouldShowPartial,
    stateSource,
    storedLatestScanRecipe,
    storedLatestScanStatus,
  ]);

  useEffect(() => {
    if (didTrackResultView.current) {
      return;
    }

    uiLog('ResultSummaryScreen', 'enter', { mode: selectedMode });
    const _traceUri = selectedScanImageUri ?? null;
    const _tracePlaceholder = selectedScanImage?.placeholder ?? null;
    const _traceSource = latestScanSession?.selectedScanImage ? 'latestScanSession' : 'storedSelectedScanImage';
    checkImageFileExists(_traceUri).then((fileExists) => {
      imageTraceLog('ResultSummaryScreen', {
        screen: 'ResultSummaryScreen',
        recipeId: selectedRecipe?.id ?? null,
        imageSource: _traceSource,
        imageUri: _traceUri,
        fileExists: _traceUri ? fileExists : 'n/a',
        usingFallback: !_traceUri,
        fallbackReason: !_traceUri
          ? (_tracePlaceholder ? 'placeholder_image' : 'no_scan_image')
          : null,
        storageLocation: getStorageLocation(_traceUri),
        selectedScanImageSource: selectedScanImage?.source,
        selectedScanImagePlaceholder: _tracePlaceholder,
      });
    });

    if (latestScanStatus === 'pending') {
      return;
    }

    didTrackResultView.current = true;
    if (shouldShowFailure || shouldShowPartial) {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: shouldShowPartial
          ? 'Scan recognized dish but recipe generation was incomplete.'
          : latestScanFailure?.rejectionReason ?? 'Scan was rejected or failed.',
        screen: 'ResultSummaryScreen',
      });
      return;
    }
    if (!scanResult) {
      return;
    }
    if (!isRecipeMode(selectedModeRaw)) {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: 'Selected mode was missing or invalid on result view.',
        screen: 'ResultSummaryScreen',
      });
    }
    if (!awardedXpEvents.includes(firstScanEventId)) {
      incrementWeeklyScanCount();
    }
    awardXPOnce(firstScanEventId, 10);
    track(analyticsEvents.RESULT_VIEWED, {
      dishName: scanResult.dishName,
      mode: selectedMode,
      savings: estimatedSavings ?? 0,
      screen: 'ResultSummaryScreen',
    });
  }, [awardXPOnce, awardedXpEvents, estimatedSavings, firstScanEventId, incrementWeeklyScanCount, isDemoScan, latestScanFailure?.rejectionReason, latestScanResult, latestScanStatus, scanResult, selectedMode, selectedModeRaw, shouldShowFailure, shouldShowPartial]);

  // ── Dish confirmation / correction ──────────────────────────────────────

  const revealCorrectionInput = () => {
    setIsEditingDishName(true);
    setCorrectionText('');
    setCorrectionError(null);
  };

  const cancelCorrection = () => {
    setIsEditingDishName(false);
    setCorrectionText('');
    setCorrectionError(null);
  };

  const submitCorrection = async (override?: {
    correctionNote?: string;
    mode?: RecipeMode;
    presentationMode?: RecipePresentationMode;
    sourceRecipe?: Recipe;
  }) => {
    if (correctionInFlightRef.current) {
      return;
    }

    const correctionNote = override?.correctionNote ?? correctionText;
    const validationError = validateCorrectionNote(correctionNote, mascotName);
    if (validationError || !selectedRecipe) {
      setCorrectionError(validationError ?? CORRECTION_FAILURE_MESSAGE);
      return;
    }

    correctionInFlightRef.current = true;
    const requestId = `correction-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    latestCorrectionRequestIdRef.current = requestId;
    setIsCorrecting(true);
    setCorrectionError(null);

    try {
      const sourceRecipeId = getRecipeCorrectionSourceId(override?.sourceRecipe ?? selectedRecipe);
      const sourceRecipe = override?.sourceRecipe ?? selectedRecipe;
      const profile = await onboardingV3Persistence.readPersonalizedProfile();
      const payload = buildCorrectionRequest({
        correctionRequestId: requestId,
        correctionNote,
        expectedSourceRecipeId: sourceRecipeId,
        canonicalRecipeId: selectedRecipe.id,
        currentRecipe: sourceRecipe,
        goalContext: buildGoalContext(profile),
        scanSessionId,
        mode: override?.mode ?? selectedMode,
      });
      const preferences = await foodPreferencesPersistence.read();
      const result = await correctScanRecipe(sourceRecipeId, { ...payload, ...toApiFoodPreferences(preferences) });

      if (!isCurrentCorrectionRequest(requestId, latestCorrectionRequestIdRef.current)) {
        // A newer correction (or a "Yes, looks good") superseded this one.
        return;
      }

      const correctedRecipe = result.recipe ?? result.recipes?.[0] ?? null;
      if (!correctedRecipe || !result.scan) {
        setCorrectionError(CORRECTION_FAILURE_MESSAGE);
        return;
      }

      const didUpdateRecipe = correctRecipe(selectedRecipe.id, correctedRecipe, result.scan);
      if (!didUpdateRecipe) {
        setCorrectionError(CORRECTION_FAILURE_MESSAGE);
        return;
      }

      if (override?.presentationMode) {
        if (override.presentationMode !== 'Normal') {
          cacheRecipePresentationVariant(
            selectedRecipe.id,
            override.presentationMode,
            correctedRecipe,
            result.scan,
          );
        }
        setRecipePresentationMode(selectedRecipe.id, override.presentationMode);
      }

      correctedScanIdRef.current = result.scan.id;
      setDishNameOverride(result.scan.dishName ?? '');
      setIsEditingDishName(false);
      setCorrectionText('');
      track(analyticsEvents.RECIPE_GENERATED, {
        dishName: result.scan.dishName,
        mode: correctedRecipe.mode,
        savings: correctedRecipe.estimatedSavings,
        screen: 'ResultSummaryScreen',
      });
    } catch (error) {
      if (!isCurrentCorrectionRequest(requestId, latestCorrectionRequestIdRef.current)) {
        return;
      }
      uiLog('ResultSummaryScreen', 'customize_failed', {
        code: error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown',
        status: error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0,
      });
      setCorrectionError(CORRECTION_FAILURE_MESSAGE);
    } finally {
      if (isCurrentCorrectionRequest(requestId, latestCorrectionRequestIdRef.current)) {
        correctionInFlightRef.current = false;
        setIsCorrecting(false);
      }
    }
  };

  const choosePresentationMode = async (mode: RecipePresentationMode) => {
    if (!selectedRecipe || mode === selectedPresentationMode || isCorrecting || correctionInFlightRef.current) {
      return;
    }

    setPendingPresentationMode(mode);
    setCorrectionError(null);
    try {
      const baseRecipe = latestScanRecipe?.baseRecipe ?? baseRecipeRef.current;
      const baseScan = latestScanRecipe?.baseScanResult ?? baseScanRef.current;

      if (mode === 'Normal') {
        if (!baseRecipe || !baseScan || !correctRecipe(selectedRecipe.id, baseRecipe, baseScan)) {
          setCorrectionError(CORRECTION_FAILURE_MESSAGE);
          return;
        }
        setRecipePresentationMode(selectedRecipe.id, 'Normal');
        return;
      }

      const cachedVariant = getRecipePresentationVariant(selectedRecipe.id, mode);
      if (cachedVariant) {
        if (!correctRecipe(selectedRecipe.id, cachedVariant.recipe, cachedVariant.scanResult)) {
          setCorrectionError(CORRECTION_FAILURE_MESSAGE);
          return;
        }
        setRecipePresentationMode(selectedRecipe.id, mode);
        return;
      }

      await submitCorrection({
        correctionNote: getPresentationModeInstruction(mode),
        presentationMode: mode,
        // Every style starts from the base scan recipe, so Lighter → More
        // Protein is deterministic rather than compounding transformations.
        sourceRecipe: baseRecipe ?? selectedRecipe,
      });
    } finally {
      setPendingPresentationMode(null);
    }
  };

  useEffect(() => {
    const instruction = route.params?.customizeInstruction?.trim();
    if (!instruction || !selectedRecipe) return;

    const transformationMode = route.params?.transformationMode;
    const shouldAutoSubmit = route.params?.autoSubmitCustomizeInstruction === true;
    setCorrectionText(instruction);
    setIsEditingDishName(true);
    navigation.setParams({
      autoSubmitCustomizeInstruction: undefined,
      customizeInstruction: undefined,
      transformationMode: undefined,
    });

    if (shouldAutoSubmit) {
      void submitCorrection({
        correctionNote: instruction,
        mode: transformationMode,
        presentationMode: transformationMode,
      });
    }
  }, [navigation, route.params?.autoSubmitCustomizeInstruction, route.params?.customizeInstruction, route.params?.transformationMode, selectedRecipe]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSelectedRecipeLike = () => {
    if (!selectedRecipe || !resolveCanonicalRecipe(recipesById, selectedRecipe.id)) {
      return;
    }

    uiLog('ResultSummaryScreen', isLiked ? 'unlike_recipe' : 'like_recipe', {
      recipeId: selectedRecipe.id,
    });
    toggleRecipeLiked(selectedRecipe.id);
    if (!isLiked) {
      awardXPOnce(`save-recipe-${selectedRecipe.id}`, 5);
      unlockBadge('first-dupe');
      track(analyticsEvents.RECIPE_SAVED, {
        dishName: selectedRecipe.title,
        mode: selectedRecipe.mode,
        savings: estimatedSavings ?? 0,
        screen: 'ResultSummaryScreen',
      });
    }
  };

  const startCooking = () => {
    if (!selectedRecipe || !resolveCanonicalRecipe(recipesById, selectedRecipe.id)) {
      return;
    }

    const seriousConflict = foodConflicts.find((item) => item.category === 'allergy' || item.category === 'restriction');
    if (seriousConflict) {
      Alert.alert(
        'Before you cook',
        `This recipe still includes ${seriousConflict.ingredient}. You marked ${seriousConflict.preference} as ${seriousConflict.category === 'allergy' ? 'an allergy' : 'a dietary restriction'}.`,
        [
          { text: 'Go back', style: 'cancel' },
          { text: 'Review recipe' },
          { text: 'Make this work for me', onPress: () => { setCorrectionText(`Replace every ingredient that conflicts with my ${seriousConflict.preference} ${seriousConflict.category}. Preserve the dish while updating ingredients, steps, nutrition, timing, and cost.`); setIsEditingDishName(true); } },
        ],
      );
      return;
    }

    const navigateToCooking = () => navigation.navigate('MainTabs', {
      screen: 'RecipeStepsScreen',
      params: { completion: false, mode: selectedMode, recipeId: selectedRecipe.id },
    });
    const guidedStepCount = buildGuidedCookingSteps(selectedRecipe).length;
    if (activeCookingSession && activeCookingSession.recipeId !== selectedRecipe.id) {
      Alert.alert(
        'Another recipe is in progress',
        'Choose whether to keep cooking it or end that session before starting this recipe.',
        [
          { text: 'Continue Current', style: 'cancel', onPress: () => navigation.navigate('MainTabs', {
            screen: 'RecipeStepsScreen',
            params: { completion: false, mode: recipesById[activeCookingSession.recipeId]?.selectedMode ?? selectedMode, recipeId: activeCookingSession.recipeId },
          }) },
          { text: 'End & Start This', style: 'destructive', onPress: () => {
            endCookingRecipe(activeCookingSession.recipeId);
            startCookingRecipe(selectedRecipe.id);
            useOkyoStore.getState().updateCookingStep(selectedRecipe.id, 0, guidedStepCount);
            navigateToCooking();
          } },
        ],
      );
      return;
    }
    startCookingRecipe(selectedRecipe.id);
    useOkyoStore.getState().updateCookingStep(selectedRecipe.id, 0, guidedStepCount);
    navigateToCooking();
  };

  const addSelectedRecipeToGrocery = () => {
    if (!selectedRecipe || !resolveCanonicalRecipe(recipesById, selectedRecipe.id)) {
      return;
    }

    addRecipeToGrocery(selectedRecipe.id);
    navigation.navigate('MainTabs', {
      screen: 'GroceryListScreen',
      params: { mode: selectedMode, recipeId: selectedRecipe.id },
    });
  };

  const openShareDupe = () => {
    if (!selectedRecipe) {
      return;
    }

    navigation.navigate('ShareCardPreviewScreen', {
      cardType: 'scan_result',
      mode: selectedMode,
      recipeId: isDemoScan ? undefined : selectedRecipe.id,
      scanContext: isDemoScan
        ? {
            image: selectedScanImage,
            recipe: selectedRecipe,
            scanResult,
          }
        : undefined,
    });
  };

  const goToScan = () => {
    clearLatestScan({
      reason: 'user_tapped_scan_again',
      source: 'ResultSummaryScreen.goToScan',
    });
    const rootNavigation = navigation.getParent() ?? navigation;
    if (isDescriptionScan) rootNavigation.reset(getFreshDescribeMealResetState());
    else rootNavigation.reset(getHomeResetState());
  };

  const goBackToScanTab = () => {
    clearLatestScan({
      reason: 'user_tapped_back_to_scan',
      source: 'ResultSummaryScreen.goBackToScanTab',
    });
    const rootNavigation = navigation.getParent() ?? navigation;
    if (isDescriptionScan) rootNavigation.reset(getFreshDescribeMealResetState());
    else rootNavigation.reset(getHomeResetState());
  };

  if (shouldShowFailure) {
    return (
      <ResultFrame onScanAgain={goToScan}>
        <Text style={styles.kicker}>Scan issue</Text>
        <Text style={styles.failureHeadline}>{failureCopy.title}</Text>
        <Text style={styles.subtitle}>{failureCopy.body}</Text>

        {selectedScanImageUri ? (
          <Image source={{ uri: selectedScanImageUri }} resizeMode="contain" style={styles.standaloneScanPreview} />
        ) : null}

        <View style={styles.failureCard}>
          <Text style={styles.failureTitle}>{failureGuidance.title}</Text>
          <Text style={styles.failureBody}>{failureGuidance.body}</Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton onPress={goToScan}>{failureGuidance.primaryLabel}</PrimaryButton>
          <ActionButton label="Back to Home" onPress={goBackToScanTab} />
        </View>
      </ResultFrame>
    );
  }

  if (latestScanStatus === 'pending' && !latestScanResult) {
    return (
      <ResultFrame onScanAgain={goToScan}>
        <Text style={styles.kicker}>Scanning</Text>
        <Text style={styles.failureHeadline}>Okyo is still looking.</Text>
        <Text style={styles.subtitle}>
          This can take a few seconds for real food photos. We will only show a result when it is safe to trust.
        </Text>
        <View style={styles.loadingMiniCard}>
          <Text style={styles.loadingMiniText}>Building your homemade swap...</Text>
        </View>
        <View style={styles.actions}>
          <ActionButton label="Back to Home" onPress={goBackToScanTab} />
        </View>
      </ResultFrame>
    );
  }

  if (!selectedRecipe) {
    return (
      <ResultFrame onScanAgain={goToScan}>
        <Text style={styles.kicker}>Recipe issue</Text>
        <Text style={styles.failureHeadline}>The scan worked, but the recipe needs another try.</Text>
        <Text style={styles.subtitle}>
          {latestScanResult
            ? `Okyo recognized ${cleanDisplayText(scanResult?.dishName ?? 'this dish')}, but no safe ${selectedModeUi.label} recipe came back for this real scan.`
            : 'Okyo needs a completed scan before it can show a real recipe.'}
        </Text>
        {selectedScanImageUri ? (
          <Image source={{ uri: selectedScanImageUri }} resizeMode="contain" style={styles.standaloneScanPreview} />
        ) : null}
        <View style={styles.failureCard}>
          <Text style={styles.failureTitle}>No unrelated recipe shown.</Text>
          <Text style={styles.failureBody}>
            Try again so Okyo can generate a recipe for this photo instead of showing a different dish.
          </Text>
        </View>
        <View style={styles.actions}>
          <PrimaryButton onPress={goToScan}>Scan Again</PrimaryButton>
          <ActionButton label="Back to Home" onPress={goBackToScanTab} />
        </View>
      </ResultFrame>
    );
  }

  if (!scanResult) {
    return (
      <ResultFrame onScanAgain={goToScan}>
        <Text style={styles.kicker}>Scan result</Text>
        <Text style={styles.title}>Scan something first.</Text>
        <Text style={styles.subtitle}>
          Okyo needs a completed scan before it can show savings or build a recipe.
        </Text>
        <View style={styles.actions}>
          <PrimaryButton onPress={goToScan}>Start a Scan</PrimaryButton>
          <ActionButton label="Back to Home" onPress={goBackToScanTab} />
        </View>
      </ResultFrame>
    );
  }

  return (
    <ResultFrame hideTopBar={!isDescriptionScan} onScanAgain={goToScan}>
      {!isDescriptionScan ? (
        <FoodImageCard
          dishName={displayDishName || 'Scanned dish'}
          imageUri={selectedScanImageUri ?? undefined}
          isDemoScan={isDemoScan}
          onScanAgain={goToScan}
        />
      ) : null}

      <View style={styles.headerSection}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          numberOfLines={2}
          style={[styles.title, isDescriptionScan ? styles.descriptionTitle : null]}
        >
          {selectedRecipe.title || displayDishName || 'Scanned dish'}
        </Text>
        <Text numberOfLines={2} style={styles.subtitle}>
          {getCompactRecipeDescription(selectedRecipe.description)}
        </Text>
        <RecipeQuickFacts recipe={selectedRecipe} />
      </View>

      <FoodSafetyNotice
        conflicts={foodConflicts}
        onAdapt={() => { setCorrectionText('Replace every ingredient that conflicts with my saved allergies and dietary restrictions while preserving the dish. Update ingredients, steps, nutrition, timing, and cost.'); setIsEditingDishName(true); }}
      />

      <RecipePrimaryActions
        onCook={startCooking}
        onCustomize={revealCorrectionInput}
        onGroceries={addSelectedRecipeToGrocery}
      />

      <RecipeStyleSelector
        isUpdating={pendingPresentationMode !== null && isCorrecting}
        pendingMode={pendingPresentationMode}
        selectedMode={selectedPresentationMode}
        onSelect={(mode) => void choosePresentationMode(mode)}
      />

      {isEditingDishName ? (
        <RecipeEditCard
          canSubmit={canSubmitCorrection(correctionText)}
          correctionError={correctionError}
          correctionText={correctionText}
          isCorrecting={isCorrecting}
          onCancel={cancelCorrection}
          onChangeCorrectionText={setCorrectionText}
          onSubmitCorrection={() => void submitCorrection()}
        />
      ) : null}

      <RecipeNutritionCards nutrition={selectedRecipe.nutritionEstimate} />
      <RecipeCostSummary
        homemadePrice={homemadeEstimate ?? undefined}
        recipe={selectedRecipe}
        restaurantPrice={restaurantEstimate ?? undefined}
        servings={displayServings}
      />
      <RecipeIngredientsAssistant
        recipe={selectedRecipe}
        servings={displayServings}
        selectedIngredientIds={getSelectedIngredientIds(selectedRecipe, groceryRecipeIds, groceryIngredientSelections)}
        onServingsChange={(servings) => setRecipeServingOverride(selectedRecipe.id, servings)}
        onAddIngredient={(ingredient) => {
          toggleIngredientInGrocery(selectedRecipe.id, ingredient.name);
        }}
      />
      <View style={styles.actions}>
        <View style={styles.secondaryRow}>
          <RecipeLikeButton isLiked={isLiked} onToggle={toggleSelectedRecipeLike} />
          <ActionButton
            icon={<ShareAndroid color={colors.coral} height={19} strokeWidth={2.2} width={19} />}
            label="Share recipe"
            onPress={openShareDupe}
          />
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={startCooking}
        style={({ pressed }) => [styles.bottomCookButton, pressed ? styles.pressed : null]}
      >
        <Text style={styles.bottomCookButtonText}>
          {getCookingCtaLabel(selectedRecipe, activeCookingSession?.recipeId)}
        </Text>
      </Pressable>
    </ResultFrame>
  );
}

type RecipeStyleSelectorProps = {
  isUpdating: boolean;
  pendingMode: RecipePresentationMode | null;
  selectedMode: RecipePresentationMode;
  onSelect: (mode: RecipePresentationMode) => void;
};

function RecipeStyleSelector({ isUpdating, pendingMode, selectedMode, onSelect }: RecipeStyleSelectorProps) {
  return (
    <View style={styles.styleSection}>
      <Text style={styles.styleHeading}>Choose your style</Text>
      <View style={styles.styleSegmentedControl}>
        {RECIPE_PRESENTATION_MODES.map((mode) => {
          const isSelected = mode === selectedMode;
          const isPending = isUpdating && pendingMode === mode;
          return (
            <Pressable
              key={mode}
              accessibilityLabel={isPending ? `${mode}, updating recipe` : `${mode} recipe style`}
              accessibilityRole="button"
              accessibilityState={{ busy: isPending, selected: isSelected }}
              disabled={isUpdating}
              onPress={() => onSelect(mode)}
              style={({ pressed }) => [
                styles.styleOption,
                isSelected ? styles.styleOptionSelected : null,
                pressed && !isUpdating ? styles.pressed : null,
              ]}
            >
              {isPending ? <ActivityIndicator color={colors.coralDark} size="small" /> : null}
              <Text adjustsFontSizeToFit minimumFontScale={0.76} numberOfLines={1} style={[
                styles.styleOptionText,
                isSelected ? styles.styleOptionTextSelected : null,
              ]}>
                {mode}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type ResultFrameProps = {
  children: ReactNode;
  hideTopBar?: boolean;
  onScanAgain: () => void;
};

function ResultFrame({ children, hideTopBar = false, onScanAgain }: ResultFrameProps) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.screenContent, { paddingBottom: 52 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {!hideTopBar ? <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Scan again"
            accessibilityRole="button"
            onPress={onScanAgain}
            style={({ pressed }) => [styles.scanAgainButton, pressed ? styles.pressed : null]}
          >
            <NavArrowLeft color={colors.coral} height={21} strokeWidth={2.35} width={21} />
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              numberOfLines={1}
              style={styles.scanAgainText}
            >
              Scan again
            </Text>
          </Pressable>
        </View> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

type FoodImageCardProps = {
  dishName: string;
  imageUri?: string;
  isDemoScan: boolean;
  onScanAgain: () => void;
};

function FoodImageCard({ dishName, imageUri, isDemoScan, onScanAgain }: FoodImageCardProps) {
  const scanAgainControl = (
    <Pressable
      accessibilityLabel="Scan again"
      accessibilityRole="button"
      hitSlop={8}
      onPress={onScanAgain}
      style={({ pressed }) => [styles.heroScanAgainButton, pressed ? styles.pressed : null]}
    >
      <NavArrowLeft color={colors.charcoal} height={19} strokeWidth={2.35} width={19} />
      <Text style={styles.heroScanAgainText}>Scan again</Text>
    </Pressable>
  );

  if (imageUri) {
    return (
      <View style={styles.foodImageCard}>
        <Image source={{ uri: imageUri }} resizeMode="cover" style={styles.foodImage} />
        {scanAgainControl}
      </View>
    );
  }

  if (isDemoScan) {
    return (
      <View style={styles.foodImageCard}>
        <View style={styles.photoEmptyContent}>
          <View style={styles.photoEmptyIcon}>
            <Camera color={colors.coral} height={25} strokeWidth={2.2} width={25} />
          </View>
          <Text style={styles.photoUnavailableTitle}>{dishName}</Text>
          <Text style={styles.photoUnavailableBody}>Example result shown without a saved food photo.</Text>
        </View>
        {scanAgainControl}
      </View>
    );
  }

  return (
    <View style={styles.foodImageCard}>
      <View style={styles.photoEmptyContent}>
        <View style={styles.photoEmptyIcon}>
          <PlusCircle color={colors.coral} height={25} strokeWidth={2.2} width={25} />
        </View>
        <Text style={styles.photoUnavailableTitle}>Food photo unavailable</Text>
        <Text style={styles.photoUnavailableBody}>Okyo can still show the scan result from the recipe data.</Text>
      </View>
      {scanAgainControl}
    </View>
  );
}

function RecipeContent({ recipe }: { recipe: Recipe }) {
  return (
    <View style={styles.recipeContent}>
      <Text style={styles.recipeSectionTitle}>Ingredients</Text>
      <View style={styles.recipeList}>
        {recipe.ingredients.map((ingredient, index) => (
          <View key={getIngredientRowKey(ingredient, index)} style={styles.recipeListRow}>
            <View style={styles.recipeBullet} />
            <Text style={styles.recipeListText}>{ingredient.quantity} {ingredient.name}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.recipeSectionTitle}>Equipment</Text>
      <View style={styles.recipeList}>
        {(recipe.equipment ?? []).length > 0 ? (recipe.equipment ?? []).map((item) => (
          <View key={item} style={styles.recipeListRow}>
            <View style={styles.recipeBullet} />
            <Text style={styles.recipeListText}>{item}</Text>
          </View>
        )) : (
          <View style={styles.recipeListRow}>
            <View style={styles.recipeBullet} />
            <Text style={styles.recipeListText}>No special equipment listed</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function getIngredientRowKey(ingredient: Recipe['ingredients'][number], index: number): string {
  const ingredientId = (ingredient as Recipe['ingredients'][number] & { id?: unknown }).id;
  const stablePart = typeof ingredientId === 'string' && ingredientId.trim()
    ? ingredientId.trim()
    : `${ingredient.quantity} ${ingredient.name}`;
  const normalized = stablePart
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'ingredient';
  return `ingredient-${normalized}-${index}`;
}

type RecipeEditCardProps = {
  canSubmit: boolean;
  correctionError: string | null;
  correctionText: string;
  isCorrecting: boolean;
  onCancel: () => void;
  onChangeCorrectionText: (value: string) => void;
  onSubmitCorrection: () => void;
};

function RecipeEditCard({
  canSubmit,
  correctionError,
  correctionText,
  isCorrecting,
  onCancel,
  onChangeCorrectionText,
  onSubmitCorrection,
}: RecipeEditCardProps) {
  return (
    <View style={styles.recipeEditCard}>
      <Text style={styles.recipeEditTitle}>Customize recipe</Text>
      <Text style={styles.recipeEditLabel}>Describe the change you want</Text>
      <TextInput
        editable={!isCorrecting}
        multiline
        onChangeText={onChangeCorrectionText}
        placeholder="Describe the change you want…"
        placeholderTextColor={recipeColors.muted}
        style={styles.correctionInput}
        value={correctionText}
      />
      {correctionError ? <Text style={styles.correctionErrorText}>{correctionError}</Text> : null}
      <View style={styles.confirmActions}>
        <Pressable
          accessibilityRole="button"
          disabled={isCorrecting || !canSubmit}
          onPress={onSubmitCorrection}
          style={[styles.confirmPrimary, isCorrecting || !canSubmit ? styles.confirmDisabled : null]}
        >
          <Text style={styles.confirmPrimaryText}>{isCorrecting ? 'Updating…' : 'Update Recipe'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isCorrecting}
          onPress={onCancel}
          style={[styles.confirmSecondary, isCorrecting ? styles.confirmDisabled : null]}
        >
          <Text style={styles.confirmSecondaryText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

type StatBlockProps = {
  icon: ReactNode;
  label: string;
  value: string;
};

function StatBlock({ icon, label, value }: StatBlockProps) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statIcon}>
        {icon}
      </View>
      <View style={styles.statTextGroup}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          numberOfLines={1}
          style={styles.metricLabel}
        >
          {label}
        </Text>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          numberOfLines={1}
          style={styles.metricValue}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

type ActionButtonProps = {
  icon?: ReactNode;
  label: string;
  onPress: () => void;
};

function ActionButton({ icon, label, onPress }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, pressed ? styles.pressed : null]}
    >
      {icon ? <View style={styles.actionButtonIcon}>{icon}</View> : null}
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        numberOfLines={1}
        style={styles.actionButtonText}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type ResultPrimaryButtonProps = {
  children: ReactNode;
  onPress: () => void;
};

function ResultPrimaryButton({ children, onPress }: ResultPrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.resultPrimaryButton, pressed ? styles.pressed : null]}
    >
      {children}
    </Pressable>
  );
}

function getResultDecisionRoute(input: {
  hasSuccessfulScanSession: boolean;
  isPartialScan: boolean;
  isScanFailure: boolean;
  latestScanStatus: string | null;
  scanResultExists: boolean;
  selectedRecipeExists: boolean;
}) {
  if (input.isScanFailure) {
    return 'result_failure_path';
  }
  if (input.isPartialScan) {
    return 'result_partial_path';
  }
  if (input.latestScanStatus === 'pending' && !input.scanResultExists) {
    return 'result_pending_path';
  }
  if (!input.scanResultExists) {
    return 'result_missing_scan_path';
  }
  if (!input.selectedRecipeExists) {
    return input.hasSuccessfulScanSession ? 'result_success_path' : 'result_missing_recipe_path';
  }

  return 'result_success_path';
}

function logResultStateSource(details: Record<string, unknown>) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  console.log('okyo_result_state_source', {
    screen: 'ResultSummaryScreen',
    ...details,
  });
}

function logPreserveSuccessState(details: Record<string, unknown>) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  console.log('okyo_result_preserve_success_state', {
    screen: 'ResultSummaryScreen',
    ...details,
  });
}

function logResultDecision(details: Record<string, unknown>) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  console.log('okyo_scan_route_decision', {
    screen: 'ResultSummaryScreen',
    ...details,
  });
  console.log('okyo_scan_failure_reason', {
    screen: 'ResultSummaryScreen',
    route: details.route,
  });
}

const modeUiByMode: Record<RecipeMode, { label: string }> = {
  Normal: { label: 'Normal' },
  Lighter: { label: 'Lighter' },
  Healthier: { label: 'Healthier' },
  'More Protein': { label: 'More Protein' },
};

function getModeUi(mode: RecipeMode) {
  return modeUiByMode[mode];
}

function getPresentationModeInstruction(mode: RecipePresentationMode): string {
  switch (mode) {
    case 'Lighter':
      return 'Create a lighter version of this recipe while preserving the core dish. Reduce calories where practical and update ingredients, quantities, instructions, nutrition, cost, and relevant metadata.';
    case 'Healthier':
      return 'Create a healthier version of this recipe while preserving the core dish. Improve nutrition balance with practical ingredient changes and update ingredients, quantities, instructions, nutrition, cost, and relevant metadata.';
    case 'More Protein':
      return 'Create a higher-protein version of this recipe while preserving the core dish. Increase protein meaningfully and update ingredients, quantities, instructions, nutrition, cost, and relevant metadata.';
    case 'Normal':
      return 'Return this recipe to its original homemade version.';
  }
}

function getModeChips(
  recipe: Recipe,
  options: {
    estimatedSavings: number | null;
    showSavings: boolean;
  },
) {
  return [
    { label: `${formatOptionalCurrency(recipe.estimatedHomemadeCost)} homemade est.` },
    options.showSavings ? { label: `${formatOptionalCurrency(options.estimatedSavings)} savings` } : null,
    { label: recipe.servings ? `Serves ${recipe.servings}` : 'Serves —' },
  ].filter((chip): chip is { label: string } => Boolean(chip))
    .filter((chip) => !chip.label.includes('—'));
}

function getDisplaySubtitle(restaurantStyle?: string, recipeDescription?: string) {
  const style = cleanDisplayText(restaurantStyle ?? '');
  const description = cleanDisplayText(recipeDescription ?? '');
  if (description.toLowerCase().includes('lighter')) {
    return 'Lighter homemade recipe from what Okyo can see';
  }

  if (description.toLowerCase().includes('budget') || description.toLowerCase().includes('lower-cost')) {
    return 'Lighter homemade recipe from the photo';
  }

  if (style) {
    return 'Homemade recipe based on what’s visible';
  }

  return 'Homemade recipe from the photo';
}

function getSelectedIngredientIds(recipe: Recipe, groceryRecipeIds: string[], selections: Record<string, string[]>): string[] {
  const selected = selections[recipe.id] ?? [];
  if (selected.length > 0) return selected;
  return groceryRecipeIds.includes(recipe.id)
    ? recipe.ingredients.map((ingredient) => ingredient.name.trim().toLowerCase()).filter(Boolean)
    : [];
}

function getModeCardTitle(_mode: RecipeMode) {
  return 'Recipe view';
}

function getModeSummary(recipe: Recipe, _mode: RecipeMode) {
  const description = cleanDisplayText(recipe.description);
  if (description) {
    return description;
  }
  return 'A homemade version built from your scan.';
}

function cleanDisplayText(value: string) {
  const commonTypo = `Amer${'cian'}`;
  const lowercaseTypo = `amer${'cian'}`;
  const joinedCopyWord = ['copy', 'cat'].join('');
  const spacedCopyWord = ['copy', 'cat'].join('\\s+');

  return value
    .replace(new RegExp(`\\b${commonTypo}\\b`, 'g'), 'American')
    .replace(new RegExp(`\\b${lowercaseTypo}\\b`, 'g'), 'american')
    .replace(new RegExp(`\\b${joinedCopyWord}(?:[-\\s]?style)?\\b`, 'gi'), 'homemade')
    .replace(new RegExp(`\\b${spacedCopyWord}(?:[-\\s]?style)?\\b`, 'gi'), 'homemade')
    .trim();
}

function formatOptionalCurrency(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? formatCurrency(value) : '—';
}

function parseRestaurantPrice(value: string) {
  const parsed = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatHomemadeEstimateRange(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 'Add recipe items';
  }

  const low = Math.max(1, value * 0.85);
  const high = Math.max(low, value * 1.15);
  return `about ${formatCurrency(low)}–${formatCurrency(high)}`;
}

function isUncertainScan(
  scanResult: ScanResult | null,
  status: string | null,
  confidencePercent: number | null,
) {
  return Boolean(
    status === 'partial' ||
    scanResult?.scanState === 'food_present_uncertain_dish' ||
    scanResult?.scanState === 'partial_food' ||
    scanResult?.scanState === 'too_unclear' ||
    (typeof confidencePercent === 'number' && confidencePercent < 82),
  );
}

function getPossibleDishNames(scanResult: ScanResult | null, displayDishName: string) {
  if (!scanResult) {
    return [];
  }

  const fallbackNames = getFallbackDishAlternatives(scanResult);
  const names = [
    ...(scanResult.possibleDishNames ?? []),
    ...fallbackNames,
  ];
  const seen = new Set<string>([displayDishName.toLowerCase()]);

  return names
    .map(cleanDisplayText)
    .filter((name) => {
      const key = name.toLowerCase();
      if (!name || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

function getFallbackDishAlternatives(scanResult: ScanResult) {
  const text = `${scanResult.dishName} ${scanResult.restaurantStyle}`.toLowerCase();
  if (text.includes('smoothie') || text.includes('shake') || text.includes('juice') || text.includes('latte') || text.includes('matcha')) {
    return ['Berry Smoothie', 'Fruit Smoothie', 'Iced Latte'];
  }
  if (text.includes('grill') || text.includes('meat') || text.includes('char')) {
    return ['Grilled Meat Plate', 'Grilled Chicken Plate', 'Charred Grill Plate'];
  }
  if (text.includes('rice') || text.includes('bowl')) {
    return ['Saucy Rice Bowl', 'Grilled Chicken Rice Bowl', 'Stir-Fry Plate'];
  }
  if (text.includes('noodle') || text.includes('pasta')) {
    return ['Noodle Bowl', 'Pasta Bowl', 'Saucy Noodles'];
  }
  if (text.includes('burger') || text.includes('sandwich')) {
    return ['Loaded Sandwich', 'Loaded Burger', 'Cheeseburger'];
  }
  if (text.includes('salad')) {
    return ['Loaded Salad', 'Chopped Salad', 'Mediterranean-Style Salad'];
  }

  return ['Saucy Rice Bowl', 'Loaded Sandwich', 'Noodle Bowl'];
}

function getPercentValue(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

function formatPercent(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value}%` : '—';
}

function formatScore(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '—';
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFCF9',
    flex: 1,
  },
  screenContent: {
    backgroundColor: '#FFFCF9',
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topBar: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 8,
    minHeight: 60,
    position: 'relative',
  },
  scanAgainButton: {
    alignItems: 'center',
    backgroundColor: '#FFF7F7',
    borderColor: '#F0E3DC',
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    left: 0,
    maxWidth: 118,
    minHeight: 44,
    paddingHorizontal: 11,
    position: 'absolute',
    top: 8,
    zIndex: 2,
  },
  scanAgainText: {
    color: colors.coralDark,
    flexShrink: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
  },
  headerSection: {
    marginBottom: 6,
    marginTop: 12,
    minWidth: 0,
  },
  styleSection: {
    marginTop: 16,
  },
  styleHeading: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  styleSegmentedControl: {
    backgroundColor: '#FCF5F0',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 3,
    minWidth: 0,
    padding: 4,
  },
  styleOption: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  styleOptionSelected: {
    backgroundColor: colors.coralSoft,
    shadowColor: '#C05A72',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  styleOptionText: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 11.5,
    fontWeight: '700',
    minWidth: 0,
    textAlign: 'center',
  },
  styleOptionTextSelected: {
    color: colors.coralDark,
  },
  kicker: {
    color: recipeColors.orange,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  title: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 40,
    minWidth: 0,
  },
  descriptionTitle: {
    fontSize: 29,
    lineHeight: 35,
  },
  failureHeadline: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 31,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 36,
    minWidth: 0,
  },
  subtitle: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    marginTop: 5,
    minWidth: 0,
  },
  matchPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: recipeColors.greenSoft,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  matchPillText: {
    color: recipeColors.green,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
  },
  bestGuessNote: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    marginTop: 12,
  },
  foodImageCard: {
    alignItems: 'center',
    aspectRatio: 1.02,
    backgroundColor: '#FFF6F3',
    borderRadius: 32,
    justifyContent: 'center',
    maxHeight: 390,
    minHeight: 310,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  foodImage: {
    height: '100%',
    width: '100%',
  },
  heroScanAgainButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E9DDD5',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    left: 14,
    minHeight: 42,
    overflow: 'hidden',
    paddingHorizontal: 12,
    position: 'absolute',
    shadowColor: '#5a3924',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 3,
    top: 14,
  },
  heroScanAgainText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  photoEmptyContent: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  photoEmptyIcon: {
    alignItems: 'center',
    backgroundColor: recipeColors.orangeSoft,
    borderRadius: 999,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  photoUnavailableTitle: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 19,
    fontWeight: '800',
    maxWidth: '90%',
    textAlign: 'center',
  },
  photoUnavailableBody: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 260,
    textAlign: 'center',
  },
  confirmCard: {
    backgroundColor: '#FFF7F7',
    borderColor: '#F1DFE2',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recipeEditCard: {
    backgroundColor: '#FFFDFB',
    borderColor: '#E9DDD5',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  recipeEditTitle: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
  },
  recipeEditLabel: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  correctionInput: {
    backgroundColor: '#FFF7F3',
    borderColor: '#E9DDD5',
    borderWidth: 1,
    borderRadius: 16,
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 7,
    minHeight: 112,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  correctionErrorText: {
    color: recipeColors.orange,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },
  confirmDisabled: {
    opacity: 0.6,
  },
  confirmTitle: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
    marginTop: 0,
  },
  alternativeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  alternativeChip: {
    backgroundColor: '#FFF0F4',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  alternativeChipText: {
    color: colors.coralDark,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
  },
  dishNameInput: {
    backgroundColor: recipeColors.card,
    borderRadius: 16,
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 12,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 9,
  },
  confirmPrimary: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  confirmPrimaryText: {
    color: '#fffdf8',
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmSecondary: {
    alignItems: 'center',
    backgroundColor: '#FFFFFFB8',
    borderColor: '#E9DDD5',
    borderWidth: 1,
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  confirmSecondaryText: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmNote: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 6,
  },
  savingsHero: {
    alignItems: 'stretch',
    gap: 14,
    marginTop: 18,
    minWidth: 0,
    padding: 20,
  },
  savingsTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  savingsBadge: {
    alignItems: 'center',
    backgroundColor: recipeColors.greenSoft,
    borderRadius: 999,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  savingsAmountGroup: {
    flex: 1,
    minWidth: 0,
  },
  savingsHeroLabel: {
    color: recipeColors.green,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  savingsHeroValue: {
    color: recipeColors.green,
    fontFamily: fontFamilies.display,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: 0,
    includeFontPadding: false,
    lineHeight: 36,
    marginTop: 2,
  },
  priceCompareRow: {
    alignItems: 'center',
    backgroundColor: recipeColors.greenSoft,
    borderRadius: 22,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  priceColumn: {
    flex: 1,
    minWidth: 88,
  },
  priceLabel: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  priceValue: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  priceHint: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 5,
  },
  priceInput: {
    backgroundColor: recipeColors.card,
    borderRadius: 999,
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '700',
    minHeight: 50,
    minWidth: 94,
    paddingHorizontal: 12,
    textAlign: 'center',
  },
  summaryCard: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 18,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 16,
  },
  recipeMetaRow: {
    alignItems: 'center',
    backgroundColor: recipeColors.cream,
    borderRadius: 18,
    flexDirection: 'row',
    marginTop: 14,
    minHeight: 58,
    paddingHorizontal: 8,
  },
  recipeContent: {
    marginTop: 6,
  },
  homemadeEstimateCard: {
    backgroundColor: '#EEF8F2',
    borderColor: '#D8EEDF',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 22,
    padding: 18,
  },
  homemadeEstimateLabel: {
    color: recipeColors.green,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '800',
  },
  homemadeEstimateValue: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 5,
  },
  homemadeEstimateNote: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    marginTop: 4,
  },
  nutritionSection: {
    borderTopColor: recipeColors.border,
    borderTopWidth: 1,
    marginTop: 22,
    paddingTop: 16,
  },
  nutritionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nutritionTitle: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 17,
    fontWeight: '700',
  },
  nutritionNote: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 11,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  nutritionValue: {
    backgroundColor: recipeColors.cream,
    borderRadius: 12,
    minWidth: '22%',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  nutritionLabel: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 11,
  },
  nutritionAmount: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    marginTop: 2,
  },
  nutritionFiber: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 12,
    marginTop: 8,
  },
  recipeDescription: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    lineHeight: 23,
  },
  recipeSectionTitle: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 21,
    fontWeight: '800',
    marginTop: 24,
  },
  recipeList: {
    gap: 11,
    marginTop: 12,
  },
  recipeListRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  recipeBullet: {
    backgroundColor: recipeColors.orange,
    borderRadius: 999,
    height: 7,
    marginTop: 8,
    width: 7,
  },
  recipeListText: {
    color: recipeColors.charcoal,
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    lineHeight: 23,
  },
  stepNumber: {
    alignItems: 'center',
    backgroundColor: recipeColors.orangeSoft,
    borderRadius: 999,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  stepNumberText: {
    color: recipeColors.orangeDeep,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '800',
  },
  statTile: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 62,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  statDivider: {
    backgroundColor: recipeColors.border,
    height: 56,
    width: 1,
  },
  statIcon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  statTextGroup: {
    flexShrink: 1,
    minWidth: 0,
  },
  metricLabel: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  metricValue: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
    marginTop: 1,
    textAlign: 'center',
  },
  modeTabs: {
    alignItems: 'center',
    backgroundColor: recipeColors.cream,
    borderRadius: 999,
    flexDirection: 'row',
    marginTop: 16,
    minWidth: 0,
    padding: 5,
  },
  modeTabSlot: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  modeDivider: {
    backgroundColor: recipeColors.border,
    height: 32,
    width: 1,
  },
  modeTab: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 0,
    paddingHorizontal: 6,
  },
  modeTabSelected: {
    backgroundColor: recipeColors.card,
  },
  modeTabText: {
    color: recipeColors.muted,
    flexShrink: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 0,
    textAlign: 'center',
  },
  modeTabTextSelected: {
    color: recipeColors.orange,
  },
  matchCard: {
    marginTop: 16,
    minWidth: 0,
    padding: 20,
  },
  matchTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 32,
    minWidth: 0,
  },
  modeBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: recipeColors.orangeSoft,
    borderRadius: 999,
    maxWidth: '74%',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  modeBadgeText: {
    color: recipeColors.orangeDeep,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  matchBodyRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    minWidth: 0,
  },
  matchCopy: {
    flex: 1,
    minWidth: 0,
  },
  matchTitle: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  matchScoreLine: {
    color: recipeColors.orange,
    fontFamily: fontFamilies.display,
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
    marginTop: 6,
  },
  matchScoreSuffix: {
    fontSize: 15,
  },
  matchNote: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 7,
  },
  matchAward: {
    alignItems: 'center',
    backgroundColor: recipeColors.orangeSoft,
    borderRadius: 999,
    height: 60,
    justifyContent: 'center',
    marginTop: 10,
    width: 60,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    minWidth: 0,
  },
  infoChip: {
    backgroundColor: recipeColors.cream,
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  infoChipText: {
    color: recipeColors.green,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    includeFontPadding: false,
    lineHeight: 18,
    textAlign: 'center',
  },
  standaloneScanPreview: {
    backgroundColor: recipeColors.cream,
    borderRadius: 24,
    height: 170,
    marginTop: 14,
    width: '100%',
  },
  failureCard: {
    marginTop: 14,
    padding: 18,
  },
  partialCard: {
    backgroundColor: recipeColors.yellowSoft,
    borderRadius: 24,
    marginTop: 14,
    padding: 18,
  },
  loadingMiniCard: {
    marginTop: 20,
    padding: 18,
  },
  loadingMiniText: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  failureTitle: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '700',
  },
  failureBody: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  actions: {
    gap: 10,
    marginTop: 24,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFFB8',
    borderColor: '#E9DDD5',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    justifyContent: 'center',
    minHeight: 58,
    minWidth: 0,
    paddingHorizontal: 6,
  },
  actionButtonIcon: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  actionButtonText: {
    color: recipeColors.charcoal,
    flexShrink: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    minWidth: 0,
    textAlign: 'center',
  },
  resultPrimaryButton: {
    alignItems: 'center',
    backgroundColor: recipeColors.orange,
    borderRadius: 24,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    minHeight: 60,
    paddingHorizontal: 18,
    shadowColor: recipeColors.orangeDeep,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 3,
  },
  resultPrimaryButtonText: {
    color: '#fffdf8',
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '800',
  },
  bottomCookButton: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 22,
    justifyContent: 'center',
    marginHorizontal: 0,
    marginTop: 16,
    minHeight: 58,
    paddingHorizontal: 18,
  },
  bottomCookButtonText: {
    color: '#fffdf8',
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});

function isExplicitDemoScan(image: { source?: string; [key: string]: unknown } | null) {
  const demoFlagKey = ['place', 'holder'].join('');
  return image?.[demoFlagKey] === true && image.source === 'mock';
}

function getBestGuessResultNote(scanResult: ScanResult | null) {
  if (!scanResult) {
    return null;
  }

  if (scanResult.scanState === 'food_present_uncertain_dish') {
    return getPublicBestGuessNote(scanResult.bestGuessNote) ?? 'Best guess based on the photo. You can edit or retry if this is off.';
  }

  if (scanResult.scanState === 'partial_food') {
    return getPublicBestGuessNote(scanResult.bestGuessNote) ?? 'Best guess from what is visible in the photo.';
  }

  return null;
}

function getPublicBestGuessNote(note: string | null | undefined) {
  const cleanedNote = getPublicFailureReason(note);
  if (!cleanedNote) {
    return null;
  }

  return cleanedNote.replace(/\bAI\b/g, 'Okyo');
}

function getScanFailureCopy(failure: { rejectionType?: string; rejectionReason?: string } | null) {
  const friendlyReason = getPublicFailureReason(failure?.rejectionReason);
  const reasonText = friendlyReason?.toLowerCase() ?? '';

  if (reasonText.includes('too large')) {
    return {
      title: 'This photo was too large to scan.',
      body: 'Try a smaller image.',
    };
  }

  if (reasonText.includes('trouble scanning') || reasonText.includes('reach the scanner') || reasonText.includes('try again in a second')) {
    return {
      title: 'Okyo had trouble scanning this photo.',
      body: 'Try again in a second.',
    };
  }

  if (failure?.rejectionType === 'not_food') {
    return {
      title: 'Try a food photo.',
      body: friendlyReason ?? 'Okyo needs a clear food photo to build a useful homemade recipe.',
    };
  }

  if (failure?.rejectionType === 'unclear_image') {
    return {
      title: 'This photo is too unclear.',
      body: friendlyReason ?? 'Try a brighter or closer food photo.',
    };
  }

  // ai_failed: the scanner hiccuped (rate limit, timeout, provider error). This
  // is not about the photo, so the copy must not ask for a clearer one.
  return {
    title: 'That scan didn’t go through.',
    body: friendlyReason ?? 'It’s not your photo — Okyo’s scanner hit a snag. Try the same photo again.',
  };
}

// The guidance card under the headline. Only the genuinely photo-related
// rejections should suggest a clearer photo; provider hiccups should not.
function getFailureGuidance(rejectionType: string | undefined) {
  if (rejectionType === 'not_food') {
    return {
      title: 'Point Okyo at a dish.',
      body: 'Okyo works best on a clear photo of food or a drink.',
      primaryLabel: 'Scan Again',
    };
  }

  if (rejectionType === 'unclear_image') {
    return {
      title: 'Try uploading a clearer food photo.',
      body: 'Use a well-lit photo where the main dish is centered and visible.',
      primaryLabel: 'Scan Again',
    };
  }

  return {
    title: 'Mind trying that again?',
    body: 'The scanner had a momentary hiccup. The same photo will usually work on a second try.',
    primaryLabel: 'Try Again',
  };
}

function getPublicFailureReason(reason: string | null | undefined) {
  const cleanedReason = cleanDisplayText(reason ?? '');
  if (!cleanedReason) {
    return null;
  }

  const lowerReason = cleanedReason.toLowerCase();
  const internalWords = ['provider', 'model', 'fallback', 'debug', 'openrouter', 'locally'];
  const hasInternalWord = /\bai\b/.test(lowerReason) ||
    internalWords.some((word) => lowerReason.includes(word));
  if (hasInternalWord) {
    return null;
  }

  return cleanedReason;
}

function getStoredRecipeForMode(
  recipes: Recipe[],
  mode: RecipeMode,
  fallbackRecipe: Recipe | null,
  shouldPreserveSuccessfulScan = false,
) {
  return recipes.find((recipe) => recipe.mode === mode) ??
    (fallbackRecipe?.mode === mode ? fallbackRecipe : null) ??
    (shouldPreserveSuccessfulScan ? fallbackRecipe ?? recipes[0] ?? null : null);
}
