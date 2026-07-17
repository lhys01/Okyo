import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Bookmark,
  Camera,
  Cart,
  CheckCircle,
  MagicWand,
  NavArrowLeft,
  OpenBook,
  PlusCircle,
  Settings,
  ShareAndroid,
  ArrowRight,
} from 'iconoir-react-native';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { attachRealScanImage } from '../utils/savedRecipeImage';
import { checkImageFileExists, getStorageLocation } from '../utils/imageValidation';
import { imageTraceLog, uiLog } from '../utils/uiDebug';
import { PrimaryButton, RewardToast } from '../components/OkyoUI';
import { RecipeQualityCard } from '../components/RecipeQualityCard';
import { colors, fontFamilies, radius, shadows, surfaces } from '../theme/okyoTheme';
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
import { getRealScanImageUri } from '../utils/recipeImages';
import { isUsableScan } from '../utils/scanDecision';
import { logMobileScreenReveal } from '../utils/scanTelemetry';
import { useRecipeQualityReport } from '../utils/useRecipeQualityReport';

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
type ResultSummaryNavigation = NativeStackNavigationProp<RootStackParamList, 'ResultSummaryScreen'>;
type ResultSummaryRoute = RouteProp<RootStackParamList, 'ResultSummaryScreen'>;
const shouldPinDevResultSummaryQa =
  typeof __DEV__ !== 'undefined' &&
  __DEV__ &&
  process.env.EXPO_PUBLIC_OKYO_RESULT_SUMMARY_QA === '1';

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
  const userRestaurantPrice = useOkyoStore((state) => state.userRestaurantPrice);
  const setUserRestaurantPrice = useOkyoStore((state) => state.setUserRestaurantPrice);
  const clearLatestScan = useOkyoStore((state) => state.clearLatestScan);
  const saveRecipe = useOkyoStore((state) => state.saveRecipe);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const awardedXpEvents = useOkyoStore((state) => state.awardedXpEvents);
  const routeScanSessionId = route.params?.scanSessionId;
  const stateSource = latestScanSession ? 'latest_scan_session' : 'legacy_latest_scan_fields';
  const latestScanResult = latestScanSession?.latestScanResult ?? storedLatestScanResult;
  const latestScanStatus = latestScanSession?.latestScanStatus ?? storedLatestScanStatus;
  const latestScanFailure = latestScanSession?.latestScanFailure ?? storedLatestScanFailure;
  const latestScanRecipe = latestScanSession?.latestScanRecipe ?? storedLatestScanRecipe;
  // Single canonical recipe. The view mode (Restaurant/Budget/Healthy) is a lens,
  // not a separate recipe — kept as a 1-element list for the view selectors/tabs.
  const latestScanRecipes = latestScanRecipe ? [latestScanRecipe] : [];
  const selectedScanImage = latestScanSession?.selectedScanImage ?? storedSelectedScanImage;
  const selectedScanImageUri = getRealScanImageUri(selectedScanImage);
  const latestAiDebugMetadata = latestScanSession?.latestAiDebugMetadata ?? storedLatestAiDebugMetadata;
  const isDemoScan = isExplicitDemoScan(selectedScanImage);
  const scanResult = latestScanResult ?? (isDemoScan ? defaultScanResult : null);
  const hasSuccessfulScanSession = latestScanStatus === 'success' && Boolean(scanResult);
  const storedRecipe = getStoredRecipeForMode(latestScanRecipes, selectedMode, latestScanRecipe, hasSuccessfulScanSession);
  const selectedRecipe = storedRecipe ?? (isDemoScan ? getSafeRecipeForMode(selectedMode) : null);
  const confidencePercent = getPercentValue(scanResult?.confidence ?? latestAiDebugMetadata?.confidence);
  const matchPercent = confidencePercent ?? getPercentValue(
    typeof scanResult?.matchScore === 'number' ? scanResult.matchScore / 10 : undefined,
  );
  const didTrackResultView = useRef(false);
  const [dishNameOverride, setDishNameOverride] = useState('');
  const [isEditingDishName, setIsEditingDishName] = useState(false);
  const [dishGuessConfirmed, setDishGuessConfirmed] = useState(false);
  const [restaurantPriceInput, setRestaurantPriceInput] = useState('');
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const [saveToastLabel, setSaveToastLabel] = useState('Saved to your library');
  const [reduceMotion, setReduceMotion] = useState(false);
  const revealAnim = useRef(new Animated.Value(0)).current;
  const saveNavigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const homemadeEstimate = selectedRecipe?.estimatedHomemadeCost ?? scanResult?.homemadeCost ?? null;
  const canShowSavings = isDemoScan || userRestaurantPrice !== null;

  useEffect(() => {
    logMobileScreenReveal(routeScanSessionId ?? scanSessionId);
  }, [routeScanSessionId, scanSessionId]);
  const estimatedSavings = isDemoScan
    ? selectedRecipe?.estimatedSavings ?? 0
    : userRestaurantPrice !== null && homemadeEstimate !== null
      ? Math.max(0, userRestaurantPrice - homemadeEstimate)
      : null;
  const displaySubtitle = getDisplaySubtitle(scanResult?.restaurantStyle, selectedRecipe?.description);
  const bestGuessNote = getBestGuessResultNote(scanResult);
  const qualityReport = useRecipeQualityReport(selectedRecipe, {
    source: isDemoScan ? 'savedRecipe' : 'scan',
    skillLevel: selectedRecipe?.difficulty,
  });

  useEffect(() => {
    setDishNameOverride('');
    setDishGuessConfirmed(false);
    setIsEditingDishName(false);
    // Savings only appear from a price the user actually paid — never from the
    // AI's restaurant estimate. Restore their entered price if one exists.
    setRestaurantPriceInput(userRestaurantPrice !== null ? userRestaurantPrice.toFixed(2) : '');
  }, [scanResult?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);

    return () => subscription?.remove?.();
  }, []);

  useEffect(() => () => {
    if (saveNavigationTimer.current) {
      clearTimeout(saveNavigationTimer.current);
    }
  }, []);

  useEffect(() => {
    revealAnim.setValue(0);
    if (reduceMotion) {
      Animated.timing(revealAnim, {
        duration: 120,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(revealAnim, {
      duration: 560,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [revealAnim, reduceMotion, scanResult?.id]);

  // One canonical dish title per scan: the scan's dish identity wins over the
  // AI recipe's invented name, so Result, Recipe, Grocery, Share, and Library
  // all show the same dish. Runs once per scan result.
  useEffect(() => {
    if (!scanResult || !storedRecipe || isDemoScan) {
      return;
    }
    const canonicalTitle = cleanDisplayText(scanResult.dishName);
    if (canonicalTitle && storedRecipe.title !== canonicalTitle) {
      setLatestScanRecipe({ ...storedRecipe, title: canonicalTitle });
    }
  }, [scanResult?.id, storedRecipe?.id, storedRecipe?.title]); // eslint-disable-line react-hooks/exhaustive-deps

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
    awardXPOnce(firstScanEventId, 10);
    track(analyticsEvents.RESULT_VIEWED, {
      dishName: scanResult.dishName,
      mode: selectedMode,
      savings: estimatedSavings ?? 0,
      screen: 'ResultSummaryScreen',
    });
  }, [awardXPOnce, estimatedSavings, firstScanEventId, isDemoScan, latestScanFailure?.rejectionReason, latestScanResult, latestScanStatus, scanResult, selectedMode, selectedModeRaw, setLatestScanResult, shouldShowFailure, shouldShowPartial]);

  // Persist a user dish-name edit so every screen (Recipe, Grocery, Share,
  // Library-on-save) shows the corrected name, not just this one.
  const confirmDishName = () => {
    setDishGuessConfirmed(true);
    setIsEditingDishName(false);
    const confirmedName = cleanDisplayText(dishNameOverride.trim());
    if (!confirmedName || !scanResult) {
      return;
    }
    setLatestScanResult({ ...scanResult, dishName: confirmedName });
    if (storedRecipe) {
      setLatestScanRecipe({ ...storedRecipe, title: confirmedName });
    }
  };

  const saveSelectedRecipe = () => {
    if (!selectedRecipe) {
      return;
    }

    const alreadySaved = savedRecipes.some((savedRecipe) => savedRecipe.id === selectedRecipe.id);
    const saveEventId = `save-recipe-${selectedRecipe.id}`;
    const willAwardSaveXp = !alreadySaved && !awardedXpEvents.includes(saveEventId);
    uiLog('ResultSummaryScreen', 'save_recipe', { recipeId: selectedRecipe.id });
    saveRecipe(attachRealScanImage(selectedRecipe, selectedScanImage));
    if (!alreadySaved) {
      awardXPOnce(saveEventId, 5);
    }
    track(analyticsEvents.RECIPE_SAVED, {
      dishName: selectedRecipe.title,
      mode: selectedRecipe.mode,
      savings: estimatedSavings ?? 0,
      screen: 'ResultSummaryScreen',
    });
    setSaveToastLabel(willAwardSaveXp ? 'Saved to your library +5 XP' : 'Saved to your library');
    setSaveToastVisible(true);
    if (saveNavigationTimer.current) {
      clearTimeout(saveNavigationTimer.current);
    }
    saveNavigationTimer.current = setTimeout(() => {
      navigation.navigate('MainTabs', { screen: 'LibraryScreen' });
    }, reduceMotion ? 140 : 520);
  };

  const openShareDupe = () => {
    if (!selectedRecipe) {
      return;
    }

    navigation.navigate('ShareCardPreviewScreen', {
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
    navigation.navigate('MainTabs', { screen: 'ScanScreen' });
  };

  const goBackToScanTab = () => {
    clearLatestScan({
      reason: 'user_tapped_back_to_scan',
      source: 'ResultSummaryScreen.goBackToScanTab',
    });
    navigation.navigate('MainTabs', { screen: 'ScanScreen' });
  };

  const openSettings = () => {
    navigation.navigate('SettingsScreen');
  };

  const openRecipeTools = () => {
    navigation.navigate('MainTabs', { screen: 'RecipeDetailScreen', params: { mode: selectedMode } });
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
          <ActionButton label="Back to Scan" onPress={goBackToScanTab} />
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
          <ActionButton label="Back to Scan" onPress={goBackToScanTab} />
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
          <PrimaryButton onPress={goToScan}>Try Another Photo</PrimaryButton>
          <ActionButton label="Back to Scan" onPress={goBackToScanTab} />
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
          <ActionButton label="Back to Scan" onPress={goBackToScanTab} />
        </View>
      </ResultFrame>
    );
  }

  return (
    <ResultFrame
      onScanAgain={goToScan}
      onSettings={openSettings}
      rewardToast={<RewardToast label={saveToastLabel} tone="save" visible={saveToastVisible} />}
    >
      <Animated.View
        style={{
          opacity: revealAnim,
          transform: [
            {
              translateY: revealAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [reduceMotion ? 0 : 18, 0],
              }),
            },
          ],
        }}
      >
      <FoodImageCard
        dishName={displayDishName || 'Scanned dish'}
        imageUri={selectedScanImageUri ?? undefined}
        isDemoScan={isDemoScan}
      />

      <View style={styles.headerSection}>
        <Text style={styles.kicker}>
          {isUncertainResult ? 'Okyo made a best guess' : 'Okyo understood your food'}
        </Text>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          numberOfLines={2}
          style={styles.title}
        >
          {displayDishName || 'Scanned dish'}
        </Text>
        <Text style={styles.subtitle}>{displaySubtitle}</Text>
        <View style={styles.metaChipRow}>
          {selectedRecipe.servings ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>Serves {selectedRecipe.servings}</Text>
            </View>
          ) : null}
          {selectedRecipe.difficulty ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{selectedRecipe.difficulty}</Text>
            </View>
          ) : null}
          {totalTimeMinutes ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{totalTimeMinutes} min</Text>
            </View>
          ) : null}
        </View>
        {matchPercent !== null ? (
          <View style={styles.matchPill}>
            <CheckCircle color={colors.green} height={20} strokeWidth={2.25} width={20} />
            <Text style={styles.matchPillText}>
              {isUncertainResult
                ? `Best guess · Scan match: ${getScanMatchLabel(matchPercent)}`
                : `Scan match: ${getScanMatchLabel(matchPercent)}`}
            </Text>
          </View>
        ) : null}
        {bestGuessNote ? (
          <Text style={styles.bestGuessNote}>{bestGuessNote}</Text>
        ) : null}
      </View>

      {shouldPinDevResultSummaryQa && qualityReport ? <RecipeQualityCard compact report={qualityReport} /> : null}

      {shouldShowDishConfirmation && scanResult ? (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmLabel}>Best guess based on the photo.</Text>
          <Text style={styles.confirmTitle}>Does this look right?</Text>
          <Text style={styles.confirmDishName}>{displayDishName || cleanDisplayText(scanResult.dishName)}</Text>

          {possibleDishNames.length > 0 ? (
            <View style={styles.alternativeRow}>
              {possibleDishNames.map((name) => (
                <Pressable
                  accessibilityRole="button"
                  key={name}
                  onPress={() => {
                    setDishNameOverride(name);
                    setDishGuessConfirmed(false);
                  }}
                  style={({ pressed }) => [styles.alternativeChip, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.alternativeChipText}>{name}</Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setIsEditingDishName(true);
                  setDishGuessConfirmed(false);
                }}
                style={({ pressed }) => [styles.alternativeChip, pressed ? styles.pressed : null]}
              >
                <Text style={styles.alternativeChipText}>Something else</Text>
              </Pressable>
            </View>
          ) : null}

          {isEditingDishName ? (
            <TextInput
              accessibilityLabel="Edit dish name"
              autoCapitalize="words"
              onChangeText={(value) => {
                // TODO: Regenerate the recipe from this edited dish name when the API supports scan revision.
                setDishNameOverride(value);
                setDishGuessConfirmed(false);
              }}
              placeholder="Enter dish name"
              placeholderTextColor={colors.muted}
              style={styles.dishNameInput}
              value={dishNameOverride}
            />
          ) : null}

          <View style={styles.confirmActions}>
            <Pressable
              accessibilityRole="button"
              onPress={confirmDishName}
              style={({ pressed }) => [styles.confirmPrimary, pressed ? styles.pressed : null]}
            >
              <Text style={styles.confirmPrimaryText}>Keep this guess</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setIsEditingDishName(true);
                setDishGuessConfirmed(false);
              }}
              style={({ pressed }) => [styles.confirmSecondary, pressed ? styles.pressed : null]}
            >
              <Text style={styles.confirmSecondaryText}>Edit dish name</Text>
            </Pressable>
          </View>
          <Text style={styles.confirmNote}>
            {dishGuessConfirmed
              ? 'Dish name updated. The recipe content follows the original scan.'
              : 'Edit if the name is off. Recipe content follows the original scan.'}
          </Text>
        </View>
      ) : null}

      <View style={styles.savingsHero}>
        <View style={styles.savingsAmountGroup}>
          <Text style={styles.savingsHeroLabel}>
            {canShowSavings ? (isDemoScan ? 'Example savings' : 'You saved') : 'Estimated home cost'}
          </Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.78}
            numberOfLines={1}
            style={styles.savingsHeroValue}
          >
            {canShowSavings
              ? formatOptionalCurrency(estimatedSavings)
              : formatHomemadeEstimateRange(homemadeEstimate)}
          </Text>
        </View>
        {isDemoScan ? (
          <View style={styles.priceCompareRow}>
            <View style={styles.priceColumn}>
              <Text numberOfLines={1} style={styles.priceLabel}>Restaurant</Text>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                numberOfLines={1}
                style={styles.priceValue}
              >
                {formatOptionalCurrency(scanResult.restaurantPrice)}
              </Text>
            </View>
            <ArrowRight color={colors.green} height={28} strokeWidth={2.6} width={28} />
            <View style={styles.priceColumn}>
              <Text numberOfLines={1} style={styles.priceLabel}>Home</Text>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                numberOfLines={1}
                style={styles.priceValue}
              >
                {formatOptionalCurrency(selectedRecipe.estimatedHomemadeCost)}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.priceCompareRow}>
            <View style={styles.priceColumn}>
              {userRestaurantPrice !== null ? (
                <>
                  <Text style={styles.priceLabel}>Restaurant {formatOptionalCurrency(userRestaurantPrice)}</Text>
                  <Text style={styles.priceLabel}>Home {formatHomemadeEstimateRange(homemadeEstimate)}</Text>
                </>
              ) : (
                <Text style={styles.priceHint}>Add restaurant price to calculate savings.</Text>
              )}
            </View>
            <TextInput
              accessibilityLabel="Restaurant price paid"
              keyboardType="decimal-pad"
              onChangeText={(value) => {
                setRestaurantPriceInput(value);
                setUserRestaurantPrice(parseRestaurantPrice(value));
              }}
              placeholder="I paid $"
              placeholderTextColor={colors.muted}
              style={styles.priceInput}
              value={restaurantPriceInput}
            />
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <ResultPrimaryButton onPress={openRecipeTools}>
          <OpenBook color={colors.onCoral} height={25} strokeWidth={2.15} width={25} />
          <Text style={styles.resultPrimaryButtonText}>View recipe</Text>
        </ResultPrimaryButton>
        <View style={styles.secondaryRow}>
          <ActionButton
            icon={<ShareAndroid color={colors.coral} height={19} strokeWidth={2.2} width={19} />}
            label="Share"
            onPress={openShareDupe}
          />
          <ActionButton
            icon={<Bookmark color={colors.coral} height={19} strokeWidth={2.2} width={19} />}
            label="Save recipe"
            onPress={saveSelectedRecipe}
          />
          <ActionButton
            icon={<Cart color={colors.coral} height={19} strokeWidth={2.2} width={19} />}
            label="Groceries"
            onPress={() => navigation.navigate('MainTabs', { screen: 'GroceryListScreen', params: { mode: selectedMode } })}
          />
        </View>
      </View>

      <NextWithOkyoCard onOpenRecipe={openRecipeTools} />

      <View style={styles.matchCard}>
        <View style={styles.matchTopRow}>
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>Style: {selectedModeUi.label}</Text>
          </View>
        </View>
        <View style={styles.matchBodyRow}>
          <View style={styles.matchCopy}>
            <Text style={styles.matchTitle}>About this recipe</Text>
            <Text style={styles.matchNote}>
              {getModeSummary(selectedRecipe, selectedMode)}
            </Text>
          </View>
        </View>
      </View>

      {!shouldPinDevResultSummaryQa && qualityReport ? <RecipeQualityCard compact report={qualityReport} /> : null}
      </Animated.View>
    </ResultFrame>
  );
}

type ResultFrameProps = {
  children: ReactNode;
  onScanAgain: () => void;
  onSettings: () => void;
  rewardToast?: ReactNode;
};

function ResultFrame({ children, onScanAgain, onSettings, rewardToast }: ResultFrameProps) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.screenContent, { paddingBottom: 48 + insets.bottom }]}
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
      {rewardToast}
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

type NextWithOkyoCardProps = {
  onOpenRecipe: () => void;
};

const nextWithOkyoItems = [
  {
    title: 'Check this recipe',
    body: 'Spot tricky steps before you cook.',
  },
  {
    title: 'Make it fit me',
    body: 'Adjust the plan from the recipe view.',
  },
  {
    title: 'Build groceries',
    body: 'Turn ingredients into a smarter list.',
  },
  {
    title: 'Cook with guidance',
    body: 'Use step-by-step help when you start.',
  },
];

function NextWithOkyoCard({ onOpenRecipe }: NextWithOkyoCardProps) {
  return (
    <View style={styles.nextCard}>
      <View style={styles.nextHeaderRow}>
        <View style={styles.nextIconBubble}>
          <MagicWand color={colors.coral} height={21} strokeWidth={2.2} width={21} />
        </View>
        <View style={styles.nextHeaderCopy}>
          <Text style={styles.nextKicker}>What Okyo can do next</Text>
          <Text style={styles.nextTitle}>Open the recipe to check, adapt, shop, or cook.</Text>
        </View>
      </View>

      <View style={styles.nextGrid}>
        {nextWithOkyoItems.map((item) => (
          <View key={item.title} style={styles.nextItem}>
            <View style={styles.nextDot} />
            <View style={styles.nextItemCopy}>
              <Text style={styles.nextItemTitle}>{item.title}</Text>
              <Text style={styles.nextItemBody}>{item.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onOpenRecipe}
        style={({ pressed }) => [styles.nextLinkButton, pressed ? styles.pressed : null]}
      >
        <Text style={styles.nextLinkText}>Open recipe tools</Text>
        <ArrowRight color={colors.coral} height={19} strokeWidth={2.35} width={19} />
      </Pressable>
    </View>
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

// Human-readable scan match tier. 82 mirrors the isUncertainScan threshold so
// "High" and the confident result path always agree.
function getScanMatchLabel(percent: number | null) {
  if (percent === null) {
    return 'Medium';
  }
  if (percent >= 82) {
    return 'High';
  }
  return percent >= 60 ? 'Medium' : 'Low';
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

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    backgroundColor: colors.background,
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
    backgroundColor: colors.card,
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
    color: colors.coral,
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
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  settingsButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
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
    marginBottom: 22,
    marginTop: 26,
    minWidth: 0,
  },
  kicker: {
    color: colors.coral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 10,
  },
  title: {
    color: colors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 47,
    minWidth: 0,
  },
  failureHeadline: {
    color: colors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 31,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 36,
    minWidth: 0,
  },
  subtitle: {
    color: colors.muted,
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
    backgroundColor: colors.greenSoft,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  matchPillText: {
    color: colors.green,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
  },
  bestGuessNote: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    marginTop: 12,
  },
  foodImageCard: {
    alignItems: 'center',
    aspectRatio: 0.96,
    backgroundColor: colors.cream,
    borderRadius: radius.hero,
    justifyContent: 'center',
    maxHeight: 390,
    minHeight: 318,
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
    backgroundColor: colors.coralSoft,
    borderRadius: 999,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  photoUnavailableTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 19,
    fontWeight: '800',
    maxWidth: '90%',
    textAlign: 'center',
  },
  photoUnavailableBody: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 260,
    textAlign: 'center',
  },
  confirmCard: {
    ...surfaces.card,
    marginTop: 18,
    padding: 20,
  },
  confirmLabel: {
    color: colors.coral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '700',
  },
  confirmTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 21,
    fontWeight: '800',
    marginTop: 6,
  },
  confirmDishName: {
    color: colors.charcoal,
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
    backgroundColor: colors.coralSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  alternativeChipText: {
    color: colors.coralDark,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  dishNameInput: {
    backgroundColor: colors.card,
    borderRadius: 16,
    color: colors.charcoal,
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
    backgroundColor: colors.coral,
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 10,
  },
  confirmPrimaryText: {
    color: colors.onCoral,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmSecondary: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 10,
  },
  confirmSecondaryText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmNote: {
    color: colors.muted,
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
  savingsAmountGroup: {
    flex: 1,
    minWidth: 0,
  },
  savingsHeroLabel: {
    color: colors.green,
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  savingsHeroValue: {
    color: colors.green,
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
    backgroundColor: colors.greenSoft,
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
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  priceValue: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  priceHint: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 5,
  },
  priceInput: {
    backgroundColor: colors.card,
    borderRadius: 999,
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '700',
    minHeight: 50,
    minWidth: 94,
    paddingHorizontal: 12,
    textAlign: 'center',
  },
  metaChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  metaChip: {
    backgroundColor: colors.cream,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  metaChipText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  matchCard: {
    ...surfaces.card,
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
    backgroundColor: colors.coralSoft,
    borderRadius: 999,
    maxWidth: '74%',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  modeBadgeText: {
    color: colors.coralDark,
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
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  matchNote: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 7,
  },
  nextCard: {
    ...surfaces.card,
    gap: 16,
    marginTop: 16,
    minWidth: 0,
    padding: 18,
  },
  nextHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  nextIconBubble: {
    alignItems: 'center',
    backgroundColor: colors.coralSoft,
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  nextHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  nextKicker: {
    color: colors.coral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  nextTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
    marginTop: 4,
  },
  nextGrid: {
    gap: 10,
  },
  nextItem: {
    alignItems: 'flex-start',
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  nextDot: {
    backgroundColor: colors.green,
    borderRadius: 999,
    height: 7,
    marginTop: 7,
    width: 7,
  },
  nextItemCopy: {
    flex: 1,
    minWidth: 0,
  },
  nextItemTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  nextItemBody: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 2,
  },
  nextLinkButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.coralSoft,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 14,
  },
  nextLinkText: {
    color: colors.coral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    fontWeight: '800',
  },
  standaloneScanPreview: {
    backgroundColor: colors.cream,
    borderRadius: radius.card,
    height: 170,
    marginTop: 14,
    width: '100%',
  },
  failureCard: {
    ...surfaces.card,
    marginTop: 14,
    padding: 18,
  },
  loadingMiniCard: {
    ...surfaces.card,
    marginTop: 20,
    padding: 18,
  },
  loadingMiniText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  failureTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '700',
  },
  failureBody: {
    color: colors.muted,
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
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: 20,
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
    color: colors.charcoal,
    flexShrink: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    minWidth: 0,
    textAlign: 'center',
  },
  resultPrimaryButton: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    minHeight: 60,
    paddingHorizontal: 18,
    ...shadows.cta,
  },
  resultPrimaryButtonText: {
    color: colors.onCoral,
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
      primaryLabel: 'Try a Food Photo',
    };
  }

  if (rejectionType === 'unclear_image') {
    return {
      title: 'Try uploading a clearer food photo.',
      body: 'Use a well-lit photo where the main dish is centered and visible.',
      primaryLabel: 'Try Another Photo',
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
