import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Camera,
  Cart,
  Clock,
  Cutlery,
  NavArrowLeft,
  Play,
  PlusCircle,
  Settings,
} from 'iconoir-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { resolveCanonicalRecipe } from '../state/canonicalRecipes';
import { recipeColors, recipeShadows } from '../theme/recipeTheme';
import { getRealScanImageUri } from '../utils/recipeImages';
import { formatRecipeDuration, getRecipeTiming } from '../utils/recipeIntegrity';
import { buildGuidedCookingSteps } from '../utils/guidedCookingSteps';
import { isUsableScan } from '../utils/scanDecision';
import { getFreshDescribeMealResetState, getHomeResetState } from '../utils/scanControllerUtils';

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
type ResultSummaryNavigation = NativeStackNavigationProp<RootStackParamList, 'ResultSummaryScreen'>;
type ResultSummaryRoute = RouteProp<RootStackParamList, 'ResultSummaryScreen'>;

export function ResultSummaryScreen() {
  const navigation = useNavigation<ResultSummaryNavigation>();
  const route = useRoute<ResultSummaryRoute>();
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
  const confirmRecipeIdentification = useOkyoStore((state) => state.confirmRecipeIdentification);
  const clearLatestScan = useOkyoStore((state) => state.clearLatestScan);
  const incrementWeeklyScanCount = useOkyoStore((state) => state.incrementWeeklyScanCount);
  const toggleRecipeLiked = useOkyoStore((state) => state.toggleRecipeLiked);
  const startCookingRecipe = useOkyoStore((state) => state.startCookingRecipe);
  const activeCookingSession = useOkyoStore((state) => state.activeCookingSession);
  const endCookingRecipe = useOkyoStore((state) => state.endCookingRecipe);
  const addRecipeToGrocery = useOkyoStore((state) => state.addRecipeToGrocery);
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
  const isPhotoScan = latestScanRecipe?.origin === 'scan' ||
    (canUseStoredScanState &&
      (latestScanSession?.source === 'camera' || latestScanSession?.source === 'photos'));
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
  const confidencePercent = isDescriptionScan ? null : getPercentValue(scanResult?.confidence ?? latestAiDebugMetadata?.confidence);
  const matchPercent = isDescriptionScan ? null : confidencePercent ?? getPercentValue(
    typeof scanResult?.matchScore === 'number' ? scanResult.matchScore / 10 : undefined,
  );
  const didTrackResultView = useRef(false);
  const [dishNameOverride, setDishNameOverride] = useState('');
  // The large identification Quick Check is one-time. Its editor transitions
  // into the same small, permanent correction entry used by reopened recipes.
  const [isEditingDishName, setIsEditingDishName] = useState(false);
  const [dishGuessConfirmed, setDishGuessConfirmed] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  // Race guard: only the response for the most recently fired correction
  // request is allowed to apply. An older in-flight response arriving late
  // (after a retry or a second correction) becomes a silent no-op.
  const latestCorrectionRequestIdRef = useRef<string | null>(null);
  const correctionInFlightRef = useRef(false);
  const correctedScanIdRef = useRef<string | null>(null);
  const [restaurantPriceInput, setRestaurantPriceInput] = useState('');
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
  const isRealScan = !isDemoScan;
  const failureCopy = getScanFailureCopy(latestScanFailure);
  const failureGuidance = getFailureGuidance(latestScanFailure?.rejectionType);
  const selectedModeUi = getModeUi(selectedMode);
  const recipeTiming = selectedRecipe ? getRecipeTiming(selectedRecipe) : null;
  const isUncertainResult = isUncertainScan(scanResult, latestScanStatus, confidencePercent);
  const displayDishName = cleanDisplayText(dishNameOverride.trim() || scanResult?.dishName || '');
  const possibleDishNames = getPossibleDishNames(scanResult, displayDishName);
  const shouldShowDishConfirmation = Boolean(isRealScan && scanResult && isUncertainResult);
  const userRestaurantPrice = parseRestaurantPrice(restaurantPriceInput);
  const homemadeEstimate = selectedRecipe?.estimatedHomemadeCost ?? scanResult?.homemadeCost ?? null;
  const canShowSavings = isDemoScan || userRestaurantPrice !== null;
  const estimatedSavings = isDemoScan
    ? selectedRecipe?.estimatedSavings ?? 0
    : userRestaurantPrice !== null && homemadeEstimate !== null
      ? Math.max(0, userRestaurantPrice - homemadeEstimate)
      : null;
  const displaySubtitle = getDisplaySubtitle(scanResult?.restaurantStyle, selectedRecipe?.description);
  const bestGuessNote = getBestGuessResultNote(scanResult);
  const isLiked = selectedRecipe ? savedRecipeIds.includes(selectedRecipe.id) : false;
  const hasConfirmedIdentification = Boolean(
    dishGuessConfirmed || latestScanRecipe?.identificationConfirmedAt,
  );

  useEffect(() => {
    // A successful correction writes a new scanResult (new id) on purpose —
    // that id change must NOT re-trigger the "does this look right?" card or
    // wipe the price the user already typed in.
    if (correctedScanIdRef.current && correctedScanIdRef.current === scanResult?.id) {
      correctedScanIdRef.current = null;
      return;
    }
    setDishNameOverride('');
    setDishGuessConfirmed(false);
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

  const confirmDishLooksRight = () => {
    if (selectedRecipe) {
      confirmRecipeIdentification(selectedRecipe.id);
    }
    setDishGuessConfirmed(true);
    setIsEditingDishName(false);
    setCorrectionText('');
    setCorrectionError(null);
    track(analyticsEvents.MODE_SELECTED, {
      dishName: scanResult?.dishName ?? 'Missing scan',
      mode: selectedMode,
      screen: 'ResultSummaryScreen',
    });
  };

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

  const submitCorrection = async () => {
    if (correctionInFlightRef.current) {
      return;
    }

    const validationError = validateCorrectionNote(correctionText);
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
      const sourceRecipeId = getRecipeCorrectionSourceId(selectedRecipe);
      const payload = buildCorrectionRequest({
        correctionRequestId: requestId,
        correctionNote: correctionText,
        expectedSourceRecipeId: sourceRecipeId,
        canonicalRecipeId: selectedRecipe.id,
        scanSessionId,
        mode: selectedMode,
      });
      const result = await correctScanRecipe(sourceRecipeId, payload);

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

      correctedScanIdRef.current = result.scan.id;
      setDishNameOverride(result.scan.dishName ?? '');
      setDishGuessConfirmed(true);
      setIsEditingDishName(false);
      setCorrectionText('');
      track(analyticsEvents.RECIPE_GENERATED, {
        dishName: result.scan.dishName,
        mode: correctedRecipe.mode,
        savings: correctedRecipe.estimatedSavings,
        screen: 'ResultSummaryScreen',
      });
    } catch {
      if (!isCurrentCorrectionRequest(requestId, latestCorrectionRequestIdRef.current)) {
        return;
      }
      setCorrectionError(CORRECTION_FAILURE_MESSAGE);
    } finally {
      if (isCurrentCorrectionRequest(requestId, latestCorrectionRequestIdRef.current)) {
        correctionInFlightRef.current = false;
        setIsCorrecting(false);
      }
    }
  };

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
    if (isDescriptionScan) navigation.reset(getFreshDescribeMealResetState());
    else navigation.reset(getHomeResetState());
  };

  const goBackToScanTab = () => {
    clearLatestScan({
      reason: 'user_tapped_back_to_scan',
      source: 'ResultSummaryScreen.goBackToScanTab',
    });
    if (isDescriptionScan) navigation.reset(getFreshDescribeMealResetState());
    else navigation.reset(getHomeResetState());
  };

  const openSettings = () => {
    navigation.navigate('SettingsScreen');
  };

  if (shouldShowFailure) {
    return (
      <ResultFrame onScanAgain={goToScan} onSettings={openSettings}>
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
      <ResultFrame onScanAgain={goToScan} onSettings={openSettings}>
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
      <ResultFrame onScanAgain={goToScan} onSettings={openSettings}>
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
      <ResultFrame onScanAgain={goToScan} onSettings={openSettings}>
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
    <ResultFrame onScanAgain={goToScan} onSettings={openSettings}>
      {!isDescriptionScan ? (
        <FoodImageCard
          dishName={displayDishName || 'Scanned dish'}
          imageUri={selectedScanImageUri ?? undefined}
          isDemoScan={isDemoScan}
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
        <View style={styles.recipeMetaRow}>
          <StatBlock
            icon={<Clock color={colors.coral} height={19} strokeWidth={2.2} width={19} />}
            label="Total"
            value={recipeTiming ? formatRecipeDuration(recipeTiming.totalMinutes) : '—'}
          />
          <View style={styles.statDivider} />
          <StatBlock
            icon={<Clock color={colors.coral} height={19} strokeWidth={2.2} width={19} />}
            label="Hands-on"
            value={recipeTiming ? formatRecipeDuration(recipeTiming.handsOnMinutes) : '—'}
          />
          <View style={styles.statDivider} />
          <StatBlock
            icon={<Clock color={colors.coral} height={19} strokeWidth={2.2} width={19} />}
            label="Waiting"
            value={recipeTiming ? formatRecipeDuration(recipeTiming.waitingMinutes) : '—'}
          />
          <View style={styles.statDivider} />
          <StatBlock
            icon={<Cutlery color={colors.coral} height={19} strokeWidth={2.2} width={19} />}
            label="Servings"
            value={`${selectedRecipe.servings}`}
          />
        </View>
      </View>

      {isPhotoScan && !hasConfirmedIdentification ? (
        <DishConfirmationCard
          canSubmit={canSubmitCorrection(correctionText)}
          correctionError={correctionError}
          correctionText={correctionText}
          dishName={displayDishName || selectedRecipe.title || 'this dish'}
          isCorrecting={isCorrecting}
          isEditing={isEditingDishName}
          onCancel={cancelCorrection}
          onChangeCorrectionText={setCorrectionText}
          onConfirm={confirmDishLooksRight}
          onFixIt={revealCorrectionInput}
          onSubmitCorrection={() => void submitCorrection()}
        />
      ) : isEditingDishName ? (
        <RecipeEditCard
          canSubmit={canSubmitCorrection(correctionText)}
          correctionError={correctionError}
          correctionText={correctionText}
          isCorrecting={isCorrecting}
          onCancel={cancelCorrection}
          onChangeCorrectionText={setCorrectionText}
          onSubmitCorrection={() => void submitCorrection()}
        />
      ) : (
        <EditRecipeAction onPress={revealCorrectionInput} />
      )}

      <RecipeNutritionCards nutrition={selectedRecipe.nutritionEstimate} />
      <RecipeContent recipe={selectedRecipe} />
      <View style={styles.homemadeEstimateCard}>
        <Text style={styles.homemadeEstimateLabel}>Homemade Estimate</Text>
        <Text style={styles.homemadeEstimateValue}>{formatOptionalCurrency(homemadeEstimate)}</Text>
        <Text style={styles.homemadeEstimateNote}>Estimated total cost to make at home</Text>
      </View>

      <View style={styles.actions}>
        <ResultPrimaryButton onPress={startCooking}>
          <Play color="#fffdf8" height={25} strokeWidth={2.2} width={25} />
          <Text style={styles.resultPrimaryButtonText}>Start Cooking</Text>
        </ResultPrimaryButton>
        <View style={styles.secondaryRow}>
          <RecipeLikeButton isLiked={isLiked} onToggle={toggleSelectedRecipeLike} />
          <ActionButton
            icon={<Cart color={colors.coral} height={19} strokeWidth={2.2} width={19} />}
            label="Add to grocery list"
            onPress={addSelectedRecipeToGrocery}
          />
        </View>
      </View>
    </ResultFrame>
  );
}

type ResultFrameProps = {
  children: ReactNode;
  onScanAgain: () => void;
  onSettings: () => void;
};

function ResultFrame({ children, onScanAgain, onSettings }: ResultFrameProps) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.screenContent, { paddingBottom: 220 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
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
          <Pressable
            accessibilityLabel="Open settings"
            accessibilityRole="button"
            onPress={onSettings}
            style={({ pressed }) => [styles.settingsButton, pressed ? styles.pressed : null]}
          >
            <Settings color={colors.charcoal} height={22} strokeWidth={2.2} width={22} />
          </Pressable>
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

type FoodImageCardProps = {
  dishName: string;
  imageUri?: string;
  isDemoScan: boolean;
};

function FoodImageCard({ dishName, imageUri, isDemoScan }: FoodImageCardProps) {
  if (imageUri) {
    return (
      <View style={styles.foodImageCard}>
        <Image source={{ uri: imageUri }} resizeMode="cover" style={styles.foodImage} />
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

type DishConfirmationCardProps = {
  canSubmit: boolean;
  correctionError: string | null;
  correctionText: string;
  dishName: string;
  isCorrecting: boolean;
  isEditing: boolean;
  onCancel: () => void;
  onChangeCorrectionText: (value: string) => void;
  onConfirm: () => void;
  onFixIt: () => void;
  onSubmitCorrection: () => void;
};

// Compact confirmation/correction step shown right after identification and
// before the user works through the rest of the recipe. "Fix it" reveals a
// short free-text field instead of sending the user back to the camera —
// submitting regenerates the recipe from the same photo/session via
// correctScanRecipe (see recipeCorrection.ts + api/client.ts).
function DishConfirmationCard({
  canSubmit,
  correctionError,
  correctionText,
  dishName,
  isCorrecting,
  isEditing,
  onCancel,
  onChangeCorrectionText,
  onConfirm,
  onFixIt,
  onSubmitCorrection,
}: DishConfirmationCardProps) {
  return (
    <View style={styles.confirmCard}>
      <Text style={styles.confirmLabel}>Quick check</Text>
      <Text style={styles.confirmTitle}>Does this look right?</Text>
      <Text style={styles.confirmDishName}>{dishName}</Text>

      {isEditing ? (
        <>
          <Text style={styles.confirmNote}>What should Kiko know?</Text>
          <TextInput
            editable={!isCorrecting}
            multiline
            onChangeText={onChangeCorrectionText}
            placeholder="Fix anything that looks wrong"
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
              <Text style={styles.confirmPrimaryText}>{isCorrecting ? 'Updating…' : 'Submit correction'}</Text>
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
        </>
      ) : (
        <View style={styles.confirmActions}>
          <Pressable accessibilityRole="button" onPress={onConfirm} style={styles.confirmPrimary}>
            <Text style={styles.confirmPrimaryText}>Yes, looks good</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onFixIt} style={styles.confirmSecondary}>
            <Text style={styles.confirmSecondaryText}>Fix it</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
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

function EditRecipeAction({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Edit recipe"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.editRecipeAction, pressed ? styles.pressed : null]}
    >
      <Text style={styles.editRecipeActionText}>Edit recipe</Text>
    </Pressable>
  );
}

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
      <Text style={styles.recipeEditTitle}>Edit recipe</Text>
      <TextInput
        editable={!isCorrecting}
        multiline
        onChangeText={onChangeCorrectionText}
        placeholder="Fix anything that looks wrong"
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
          <Text style={styles.confirmPrimaryText}>{isCorrecting ? 'Updating…' : 'Submit correction'}</Text>
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
    backgroundColor: recipeColors.background,
    flex: 1,
  },
  screenContent: {
    backgroundColor: recipeColors.background,
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
    backgroundColor: recipeColors.card,
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
    color: recipeColors.orange,
    flexShrink: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
  },
  settingsButton: {
    alignItems: 'center',
    backgroundColor: recipeColors.card,
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    top: 8,
    width: 44,
    zIndex: 2,
  },
  headerSection: {
    marginBottom: 8,
    marginTop: 18,
    minWidth: 0,
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
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 27,
    marginTop: 10,
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
    aspectRatio: 1.38,
    backgroundColor: recipeColors.cream,
    borderRadius: 32,
    justifyContent: 'center',
    maxHeight: 270,
    minHeight: 220,
    overflow: 'hidden',
    width: '100%',
  },
  foodImage: {
    height: '100%',
    width: '100%',
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
    backgroundColor: recipeColors.card,
    borderColor: recipeColors.border,
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  editRecipeAction: {
    alignSelf: 'flex-start',
    backgroundColor: recipeColors.orangeSoft,
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  editRecipeActionText: {
    color: recipeColors.orangeDeep,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
  },
  recipeEditCard: {
    backgroundColor: recipeColors.card,
    borderColor: recipeColors.border,
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
  correctionInput: {
    backgroundColor: recipeColors.cream,
    borderRadius: 16,
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 7,
    minHeight: 64,
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
  confirmLabel: {
    color: recipeColors.orange,
    fontFamily: fontFamilies.extraBold,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  confirmTitle: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
    marginTop: 3,
  },
  confirmDishName: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 25,
    marginTop: 4,
  },
  alternativeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  alternativeChip: {
    backgroundColor: recipeColors.orangeSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  alternativeChipText: {
    color: recipeColors.orangeDeep,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
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
    backgroundColor: recipeColors.orange,
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
    backgroundColor: recipeColors.cream,
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  confirmSecondaryText: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
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
    backgroundColor: recipeColors.greenSoft,
    borderRadius: 22,
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
    gap: 14,
    marginTop: 22,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: recipeColors.cream,
    borderColor: 'rgba(232, 220, 203, 0.8)',
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    justifyContent: 'center',
    minHeight: 64,
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
