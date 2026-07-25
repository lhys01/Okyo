import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Bookmark,
  Camera,
  Cart,
  CheckCircle,
  Clock,
  Cutlery,
  NavArrowLeft,
  OpenBook,
  PlusCircle,
  Settings,
  ShareAndroid,
  ShieldCheck,
  Sparks,
  ArrowRight,
} from 'iconoir-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { correctScanRecipe } from '../api/client';
import { attachRealScanImage } from '../utils/savedRecipeImage';
import { checkImageFileExists, getStorageLocation } from '../utils/imageValidation';
import { canUseScanStateForRoute } from '../utils/onboardingScanGuards';
import {
  buildCorrectionRequest,
  canSubmitCorrection,
  isCurrentCorrectionRequest,
  validateCorrectionNote,
} from '../utils/recipeCorrection';
import { imageTraceLog, uiLog } from '../utils/uiDebug';
import { KikoMascot } from '../components/KikoMascot';
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
import { recipeColors, recipeShadows } from '../theme/recipeTheme';
import { getRealScanImageUri } from '../utils/recipeImages';
import { isUsableScan } from '../utils/scanDecision';
import { isValidNutritionEstimate } from '../utils/nutrition';

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
const recipeModes: RecipeMode[] = ['Restaurant Copy', 'Budget', 'Healthy'];
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
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const setLatestScanResult = useOkyoStore((state) => state.setLatestScanResult);
  const setLatestScanRecipe = useOkyoStore((state) => state.setLatestScanRecipe);
  const clearLatestScan = useOkyoStore((state) => state.clearLatestScan);
  const incrementWeeklyScanCount = useOkyoStore((state) => state.incrementWeeklyScanCount);
  const saveRecipe = useOkyoStore((state) => state.saveRecipe);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const awardedXpEvents = useOkyoStore((state) => state.awardedXpEvents);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const routeScanSessionId = route.params?.scanSessionId;
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
  const latestScanResult = canUseStoredScanState ? latestScanSession?.latestScanResult ?? storedLatestScanResult : null;
  const latestScanStatus = canUseStoredScanState ? latestScanSession?.latestScanStatus ?? storedLatestScanStatus : null;
  const latestScanFailure = canUseStoredScanState ? latestScanSession?.latestScanFailure ?? storedLatestScanFailure : null;
  const latestScanRecipe = canUseStoredScanState ? latestScanSession?.latestScanRecipe ?? storedLatestScanRecipe : null;
  const isDescriptionScan = canUseStoredScanState && latestScanSession?.source === 'description';
  // Single canonical recipe. The view mode (Restaurant/Budget/Healthy) is a lens,
  // not a separate recipe — kept as a 1-element list for the view selectors/tabs.
  const latestScanRecipes = latestScanRecipe ? [latestScanRecipe] : [];
  const selectedScanImage = canUseStoredScanState ? latestScanSession?.selectedScanImage ?? storedSelectedScanImage : null;
  const selectedScanImageUri = getRealScanImageUri(selectedScanImage);
  const latestAiDebugMetadata = canUseStoredScanState
    ? latestScanSession?.latestAiDebugMetadata ?? storedLatestAiDebugMetadata
    : null;
  const isDemoScan = isExplicitDemoScan(selectedScanImage);
  const scanResult = latestScanResult ?? (isDemoScan ? defaultScanResult : null);
  const hasSuccessfulScanSession = latestScanStatus === 'success' && Boolean(scanResult);
  const storedRecipe = getStoredRecipeForMode(latestScanRecipes, selectedMode, latestScanRecipe, hasSuccessfulScanSession);
  const selectedRecipe = storedRecipe ?? (isDemoScan ? getSafeRecipeForMode(selectedMode) : null);
  const confidencePercent = isDescriptionScan ? null : getPercentValue(scanResult?.confidence ?? latestAiDebugMetadata?.confidence);
  const matchPercent = isDescriptionScan ? null : confidencePercent ?? getPercentValue(
    typeof scanResult?.matchScore === 'number' ? scanResult.matchScore / 10 : undefined,
  );
  const didTrackResultView = useRef(false);
  const [dishNameOverride, setDishNameOverride] = useState('');
  // "isEditingDishName" doubles as the correction-input reveal state ("Fix
  // it" tapped) and "dishGuessConfirmed" as "the user has responded to the
  // confirmation step" (either "Yes, looks good" or a successful correction).
  const [isEditingDishName, setIsEditingDishName] = useState(false);
  const [dishGuessConfirmed, setDishGuessConfirmed] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  // Race guard: only the response for the most recently fired correction
  // request is allowed to apply. An older in-flight response arriving late
  // (after a retry or a second correction) becomes a silent no-op.
  const latestCorrectionRequestIdRef = useRef<string | null>(null);
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
  const totalTimeMinutes = selectedRecipe
    ? selectedRecipe.totalTimeMinutes ?? selectedRecipe.prepTimeMinutes + selectedRecipe.cookTimeMinutes
    : null;
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
    if (!latestScanResult && isDemoScan) {
      setLatestScanResult(defaultScanResult);
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
  }, [awardXPOnce, awardedXpEvents, estimatedSavings, firstScanEventId, incrementWeeklyScanCount, isDemoScan, latestScanFailure?.rejectionReason, latestScanResult, latestScanStatus, scanResult, selectedMode, selectedModeRaw, setLatestScanResult, shouldShowFailure, shouldShowPartial]);

  // ── Dish confirmation / correction ──────────────────────────────────────

  const confirmDishLooksRight = () => {
    setDishGuessConfirmed(true);
    setIsEditingDishName(false);
    track(analyticsEvents.MODE_SELECTED, {
      dishName: scanResult?.dishName ?? 'Missing scan',
      mode: selectedMode,
      screen: 'ResultSummaryScreen',
    });
  };

  const revealCorrectionInput = () => {
    setIsEditingDishName(true);
    setCorrectionError(null);
  };

  const cancelCorrection = () => {
    setIsEditingDishName(false);
    setCorrectionText('');
    setCorrectionError(null);
  };

  const submitCorrection = async () => {
    const validationError = validateCorrectionNote(correctionText);
    if (validationError || !selectedRecipe) {
      setCorrectionError(validationError ?? 'Okyo needs a recipe to correct.');
      return;
    }

    const requestId = `correction-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    latestCorrectionRequestIdRef.current = requestId;
    setIsCorrecting(true);
    setCorrectionError(null);

    try {
      const payload = buildCorrectionRequest({ correctionNote: correctionText, mode: selectedMode });
      const result = await correctScanRecipe(selectedRecipe.id, payload);

      if (!isCurrentCorrectionRequest(requestId, latestCorrectionRequestIdRef.current)) {
        // A newer correction (or a "Yes, looks good") superseded this one.
        return;
      }

      const correctedRecipe = result.recipe ?? result.recipes?.[0] ?? null;
      if (!correctedRecipe || !result.scan) {
        setCorrectionError('Okyo could not update the recipe. Try a shorter correction.');
        return;
      }

      correctedScanIdRef.current = result.scan.id;
      setLatestScanResult(result.scan);
      setLatestScanRecipe(correctedRecipe);
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
    } catch (error) {
      if (!isCurrentCorrectionRequest(requestId, latestCorrectionRequestIdRef.current)) {
        return;
      }
      setCorrectionError(error instanceof Error ? error.message : 'Okyo could not update the recipe. Try again.');
    } finally {
      if (isCurrentCorrectionRequest(requestId, latestCorrectionRequestIdRef.current)) {
        setIsCorrecting(false);
      }
    }
  };

  const chooseMode = (mode: RecipeMode) => {
    setSelectedMode(mode);
    uiLog('ResultSummaryScreen', 'choose_mode', { mode });
    track(analyticsEvents.MODE_SELECTED, {
      dishName: scanResult?.dishName ?? 'Missing scan',
      mode,
      screen: 'ResultSummaryScreen',
    });
  };

  const saveSelectedRecipe = () => {
    if (!selectedRecipe) {
      return;
    }

    const alreadySaved = savedRecipes.some((savedRecipe) => savedRecipe.id === selectedRecipe.id);
    uiLog('ResultSummaryScreen', 'save_recipe', { recipeId: selectedRecipe.id });
    saveRecipe(attachRealScanImage(selectedRecipe, selectedScanImage));
    if (!alreadySaved) {
      awardXPOnce(`save-recipe-${selectedRecipe.id}`, 5);
    }
    unlockBadge('first-dupe');
    track(analyticsEvents.RECIPE_SAVED, {
      dishName: selectedRecipe.title,
      mode: selectedRecipe.mode,
      savings: estimatedSavings ?? 0,
      screen: 'ResultSummaryScreen',
    });
    navigation.navigate('MainTabs', { screen: 'LibraryScreen' });
  };

  const openShareDupe = () => {
    if (!selectedRecipe) {
      return;
    }

    navigation.navigate('ShareCardPreviewScreen', {
      cardType: 'scan_result',
      mode: selectedMode,
      scanContext: {
        image: selectedScanImage,
        recipe: selectedRecipe,
        scanResult,
      },
    });
  };

  const goToScan = () => {
    clearLatestScan({
      reason: 'user_tapped_scan_again',
      source: 'ResultSummaryScreen.goToScan',
    });
    if (isDescriptionScan) navigation.navigate('DescribeMealScreen');
    else navigation.navigate('MainTabs', { screen: 'HomeScreen' });
  };

  const goBackToScanTab = () => {
    clearLatestScan({
      reason: 'user_tapped_back_to_scan',
      source: 'ResultSummaryScreen.goBackToScanTab',
    });
    if (isDescriptionScan) navigation.navigate('DescribeMealScreen');
    else navigation.navigate('MainTabs', { screen: 'HomeScreen' });
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
      <FoodImageCard
        dishName={displayDishName || 'Scanned dish'}
        imageUri={selectedScanImageUri ?? undefined}
        isDemoScan={isDemoScan}
        isDescriptionScan={isDescriptionScan}
      />

      <View style={styles.headerSection}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          numberOfLines={2}
          style={styles.title}
        >
          {selectedRecipe.title || displayDishName || 'Scanned dish'}
        </Text>
        <View style={styles.recipeMetaRow}>
          <StatBlock
            icon={<Clock color={colors.coral} height={19} strokeWidth={2.2} width={19} />}
            label="Time"
            value={totalTimeMinutes ? `${totalTimeMinutes} min` : '—'}
          />
          <View style={styles.statDivider} />
          <StatBlock
            icon={<Cutlery color={colors.coral} height={19} strokeWidth={2.2} width={19} />}
            label="Difficulty"
            value={selectedRecipe.difficulty ?? '—'}
          />
        </View>
      </View>

      {!dishGuessConfirmed ? (
        <DishConfirmationCard
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
      ) : null}

      <NutritionEstimateSection nutrition={selectedRecipe.nutritionEstimate} />
      <RecipeContent recipe={selectedRecipe} />

      <View style={styles.actions}>
        <ResultPrimaryButton onPress={() => navigation.navigate('MainTabs', { screen: 'RecipeStepsScreen', params: { mode: selectedMode } })}>
          <OpenBook color="#fffdf8" height={25} strokeWidth={2.15} width={25} />
          <Text style={styles.resultPrimaryButtonText}>Start cooking</Text>
        </ResultPrimaryButton>
        <View style={styles.secondaryRow}>
          <ActionButton
            icon={<Bookmark color={colors.coral} height={19} strokeWidth={2.2} width={19} />}
            label="Save"
            onPress={saveSelectedRecipe}
          />
          <ActionButton
            icon={<Cart color={colors.coral} height={19} strokeWidth={2.2} width={19} />}
            label="Add to grocery list"
            onPress={() => navigation.navigate('MainTabs', { screen: 'GroceryListScreen', params: { mode: selectedMode } })}
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
          <View pointerEvents="none" style={styles.topTitleWrap}>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              numberOfLines={1}
              style={styles.topTitle}
            >
              Result
            </Text>
          </View>
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
  isDescriptionScan: boolean;
};

function FoodImageCard({ dishName, imageUri, isDemoScan, isDescriptionScan }: FoodImageCardProps) {
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

  if (isDescriptionScan) {
    return (
      <View style={styles.foodImageCard}>
        <View style={styles.photoEmptyContent}>
          <View style={styles.photoEmptyIcon}>
            <Sparks color={colors.coral} height={25} strokeWidth={2.2} width={25} />
          </View>
          <Text style={styles.photoUnavailableTitle}>Recipe idea</Text>
          <Text style={styles.photoUnavailableBody}>Built from your meal description.</Text>
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
        {recipe.ingredients.map((ingredient) => (
          <View key={`${ingredient.quantity}-${ingredient.name}`} style={styles.recipeListRow}>
            <View style={styles.recipeBullet} />
            <Text style={styles.recipeListText}>{ingredient.quantity} {ingredient.name}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.recipeSectionTitle}>Steps</Text>
      <View style={styles.recipeList}>
        {recipe.steps.map((step, index) => (
          <View key={`${index}-${step}`} style={styles.recipeListRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.recipeListText}>{step}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

type DishConfirmationCardProps = {
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
            placeholder="These are lamb chops, not chicken."
            placeholderTextColor={recipeColors.muted}
            style={styles.correctionInput}
            value={correctionText}
          />
          {correctionError ? <Text style={styles.correctionErrorText}>{correctionError}</Text> : null}
          <View style={styles.confirmActions}>
            <Pressable
              accessibilityRole="button"
              disabled={isCorrecting}
              onPress={onSubmitCorrection}
              style={[styles.confirmPrimary, isCorrecting ? styles.confirmDisabled : null]}
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

function NutritionEstimateSection({ nutrition }: { nutrition: Recipe['nutritionEstimate'] }) {
  if (!isValidNutritionEstimate(nutrition)) return null;
  const values = [
    ['Calories', `${nutrition.calories} kcal`],
    ['Protein', `${nutrition.proteinGrams} g`],
    ['Carbohydrates', `${nutrition.carbohydratesGrams} g`],
    ['Fat', `${nutrition.fatGrams} g`],
  ];
  return (
    <View accessibilityLabel="Nutrition estimate" style={styles.nutritionSection}>
      <View style={styles.nutritionHeader}>
        <Text style={styles.nutritionTitle}>Nutrition estimate</Text>
        <Text style={styles.nutritionNote}>Estimated per serving</Text>
      </View>
      <View style={styles.nutritionGrid}>
        {values.map(([label, value]) => (
          <View key={label} style={styles.nutritionValue}>
            <Text style={styles.nutritionLabel}>{label}</Text>
            <Text style={styles.nutritionAmount}>{value}</Text>
          </View>
        ))}
      </View>
      {typeof nutrition.fiberGrams === 'number' ? <Text style={styles.nutritionFiber}>Fiber · {nutrition.fiberGrams} g</Text> : null}
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

type ResultModeTabsProps = {
  selectedMode: RecipeMode;
  onSelectMode: (mode: RecipeMode) => void;
};

function ResultModeTabs({ selectedMode, onSelectMode }: ResultModeTabsProps) {
  return (
    <View style={styles.modeTabs}>
      {recipeModes.map((mode, index) => {
        const isSelected = selectedMode === mode;
        const modeUi = getModeUi(mode);

        return (
          <View key={mode} style={styles.modeTabSlot}>
            {index > 0 ? <View style={styles.modeDivider} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelectMode(mode)}
              style={({ pressed }) => [
                styles.modeTab,
                isSelected ? styles.modeTabSelected : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                numberOfLines={1}
                style={[styles.modeTabText, isSelected ? styles.modeTabTextSelected : null]}
              >
                {modeUi.label}
              </Text>
            </Pressable>
          </View>
        );
      })}
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
  'Restaurant Copy': { label: 'Restaurant Style' },
  Budget: { label: 'Budget' },
  Healthy: { label: 'Lighter' },
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
    return 'Budget-friendly homemade recipe from the photo';
  }

  if (style) {
    return 'Homemade recipe based on what’s visible';
  }

  return 'Homemade recipe from the photo';
}

function getModeCardTitle(mode: RecipeMode) {
  switch (mode) {
    case 'Budget':
      return 'Budget pick for your scan';
    case 'Healthy':
      return 'Lighter pick for your scan';
    case 'Restaurant Copy':
    default:
      return 'Best match for your scan';
  }
}

function getModeSummary(recipe: Recipe, mode: RecipeMode) {
  const description = cleanDisplayText(recipe.description);
  if (description) {
    return description;
  }

  switch (mode) {
    case 'Budget':
      return 'Keeps the dish feeling familiar while nudging the grocery cost down.';
    case 'Healthy':
      return 'A lighter version with the same cozy scan-inspired idea.';
    case 'Restaurant Copy':
    default:
      return 'A homemade restaurant-style version built from your scan.';
  }
}

function cleanDisplayText(value: string) {
  const commonTypo = `Amer${'cian'}`;
  const lowercaseTypo = `amer${'cian'}`;
  const joinedCopyWord = ['copy', 'cat'].join('');
  const spacedCopyWord = ['copy', 'cat'].join('\\s+');

  return value
    .replace(new RegExp(`\\b${commonTypo}\\b`, 'g'), 'American')
    .replace(new RegExp(`\\b${lowercaseTypo}\\b`, 'g'), 'american')
    .replace(new RegExp(`\\b${joinedCopyWord}(?:[-\\s]?style)?\\b`, 'gi'), 'inspired-by')
    .replace(new RegExp(`\\b${spacedCopyWord}(?:[-\\s]?style)?\\b`, 'gi'), 'inspired-by')
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
  topTitleWrap: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 118,
    position: 'absolute',
    right: 118,
    top: 0,
  },
  topTitle: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
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
    borderRadius: 26,
    borderWidth: 1,
    marginTop: 18,
    padding: 20,
  },
  correctionInput: {
    backgroundColor: recipeColors.cream,
    borderRadius: 16,
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 10,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  correctionErrorText: {
    color: recipeColors.orange,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  confirmDisabled: {
    opacity: 0.6,
  },
  confirmLabel: {
    color: recipeColors.orange,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  confirmTitle: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 21,
    fontWeight: '800',
    marginTop: 6,
  },
  confirmDishName: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 29,
    marginTop: 8,
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
    gap: 10,
    marginTop: 12,
  },
  confirmPrimary: {
    alignItems: 'center',
    backgroundColor: recipeColors.orange,
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
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
    minHeight: 48,
    paddingHorizontal: 10,
  },
  confirmSecondaryText: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmNote: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    marginTop: 10,
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
      body: friendlyReason ?? 'Okyo needs a clear food photo to build a useful inspired-by recipe.',
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
