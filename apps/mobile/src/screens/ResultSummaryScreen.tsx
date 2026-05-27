import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import type { AiDebugMetadata } from '../api/types';
import { uiLog } from '../utils/uiDebug';
import {
  BadgePill,
  ModeTabs,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  colors,
  sharedStyles,
} from '../components/OkyoUI';
import {
  defaultScanResult,
  getSafeRecipeForMode,
  getSafeRecipeMode,
  isRecipeMode,
  type RecipeMode,
} from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
type ResultSummaryNavigation = NativeStackNavigationProp<RootStackParamList, 'ResultSummaryScreen'>;

export function ResultSummaryScreen() {
  const navigation = useNavigation<ResultSummaryNavigation>();
  const selectedModeRaw = useOkyoStore((state) => state.selectedMode);
  const selectedMode = getSafeRecipeMode(selectedModeRaw);
  const latestScanResult = useOkyoStore((state) => state.latestScanResult);
  const latestScanStatus = useOkyoStore((state) => state.latestScanStatus);
  const latestScanFailure = useOkyoStore((state) => state.latestScanFailure);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const latestAiDebugMetadata = useOkyoStore((state) => state.latestAiDebugMetadata);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const setLatestScanResult = useOkyoStore((state) => state.setLatestScanResult);
  const setLatestScanStatus = useOkyoStore((state) => state.setLatestScanStatus);
  const setLatestScanFailure = useOkyoStore((state) => state.setLatestScanFailure);
  const incrementWeeklyScanCount = useOkyoStore((state) => state.incrementWeeklyScanCount);
  const saveRecipe = useOkyoStore((state) => state.saveRecipe);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const awardedXpEvents = useOkyoStore((state) => state.awardedXpEvents);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const scanResult = latestScanResult ?? defaultScanResult;
  const selectedRecipe = getSafeRecipeForMode(selectedMode);
  const confidencePercent = Math.round(scanResult.confidence * 100);
  const didTrackResultView = useRef(false);
  const firstScanEventId = `first-scan-${scanResult.id}`;
  const aiDebugLabel = getAiDebugLabel(latestAiDebugMetadata);
  const isScanFailure = latestScanStatus === 'rejected' || latestScanStatus === 'failed';
  const failureCopy = getScanFailureCopy(latestScanFailure);

  useEffect(() => {
    if (didTrackResultView.current) {
      return;
    }

    uiLog('ResultSummaryScreen', 'enter', { mode: selectedMode });

    if (latestScanStatus === 'pending') {
      return;
    }

    didTrackResultView.current = true;
    if (isScanFailure) {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: latestScanFailure?.rejectionReason ?? 'Scan was rejected or failed.',
        screen: 'ResultSummaryScreen',
      });
      return;
    }
    if (!latestScanResult) {
      setLatestScanResult(defaultScanResult);
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
      savings: selectedRecipe.estimatedSavings,
      screen: 'ResultSummaryScreen',
    });
  }, [awardXPOnce, awardedXpEvents, firstScanEventId, incrementWeeklyScanCount, isScanFailure, latestScanFailure?.rejectionReason, latestScanResult, latestScanStatus, scanResult.dishName, selectedRecipe.estimatedSavings, selectedMode, selectedModeRaw, setLatestScanResult]);

  const chooseMode = (mode: RecipeMode) => {
    setSelectedMode(mode);
    uiLog('ResultSummaryScreen', 'choose_mode', { mode });
    track(analyticsEvents.MODE_SELECTED, {
      dishName: scanResult.dishName,
      mode,
      screen: 'ResultSummaryScreen',
    });
  };

  const saveSelectedRecipe = () => {
    const alreadySaved = savedRecipes.some((savedRecipe) => savedRecipe.id === selectedRecipe.id);
    uiLog('ResultSummaryScreen', 'save_recipe', { recipeId: selectedRecipe.id });
    saveRecipe(selectedRecipe);
    if (!alreadySaved) {
      awardXPOnce(`save-recipe-${selectedRecipe.id}`, 5);
    }
    unlockBadge('first-dupe');
    track(analyticsEvents.RECIPE_SAVED, {
      dishName: selectedRecipe.title,
      mode: selectedRecipe.mode,
      savings: selectedRecipe.estimatedSavings,
      screen: 'ResultSummaryScreen',
    });
    navigation.navigate('MainTabs');
  };

  const goToScan = () => {
    setLatestScanFailure(null);
    setLatestScanResult(null);
    setLatestScanStatus(null);
    navigation.navigate('ScanScreen');
  };

  const goBackToScanTab = () => {
    setLatestScanFailure(null);
    setLatestScanResult(null);
    setLatestScanStatus(null);
    navigation.navigate('MainTabs', { screen: 'ScanScreen' });
  };

  if (isScanFailure) {
    return (
      <ScreenContainer>
        <Text style={styles.kicker}>Scan issue</Text>
        <Text style={styles.title}>{failureCopy.title}</Text>
        <Text style={styles.subtitle}>{failureCopy.body}</Text>
        {__DEV__ && aiDebugLabel ? (
          <View style={styles.aiDebugPill}>
            <Text style={styles.aiDebugText}>{aiDebugLabel}</Text>
          </View>
        ) : null}

        {selectedScanImage?.uri ? (
          <Image source={{ uri: selectedScanImage.uri }} style={styles.scanPreview} />
        ) : null}

        <View style={styles.failureCard}>
          <Text style={styles.failureTitle}>Try uploading a clearer food photo.</Text>
          <Text style={styles.failureBody}>
            Use a well-lit restaurant meal photo where the main dish is centered and visible.
          </Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton onPress={goToScan}>Try Another Photo</PrimaryButton>
          <SecondaryButton onPress={goBackToScanTab}>Back to Scan</SecondaryButton>
        </View>
      </ScreenContainer>
    );
  }

  if (latestScanStatus === 'pending' && !latestScanResult) {
    return (
      <ScreenContainer>
        <Text style={styles.kicker}>Analyzing</Text>
        <Text style={styles.title}>Still checking this photo.</Text>
        <Text style={styles.subtitle}>
          Okyo is waiting for a safe scan result before showing recipes or savings.
        </Text>
        <View style={styles.actions}>
          <SecondaryButton onPress={goBackToScanTab}>Back to Scan</SecondaryButton>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.kicker}>Mock result</Text>
      <Text style={styles.title}>{scanResult.dishName}</Text>
      <Text style={styles.subtitle}>
        {scanResult.restaurantStyle} copycat estimate
      </Text>
      {__DEV__ && aiDebugLabel ? (
        <View style={styles.aiDebugPill}>
          <Text style={styles.aiDebugText}>{aiDebugLabel}</Text>
        </View>
      ) : null}

      {selectedScanImage?.uri ? (
        <Image source={{ uri: selectedScanImage.uri }} style={styles.scanPreview} />
      ) : null}

      <View style={styles.savingsHero}>
        <Text style={styles.savingsHeroLabel}>Estimated savings</Text>
        <Text style={styles.savingsHeroValue}>{formatCurrency(selectedRecipe.estimatedSavings)}</Text>
        <Text style={styles.savingsHeroBody}>
          {formatCurrency(scanResult.restaurantPrice)} restaurant estimate to {formatCurrency(selectedRecipe.estimatedHomemadeCost)} at home.
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Confidence</Text>
          <Text style={styles.metricValue}>{confidencePercent}%</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Restaurant price</Text>
          <Text style={styles.metricValue}>{formatCurrency(scanResult.restaurantPrice)}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Homemade cost</Text>
          <Text style={styles.metricValue}>{formatCurrency(selectedRecipe.estimatedHomemadeCost)}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Difficulty</Text>
          <Text style={styles.metricValue}>{selectedRecipe.difficulty}</Text>
        </View>
      </View>

      <ModeTabs modes={scanResult.modes} selectedMode={selectedMode} onSelectMode={chooseMode} />

      <View style={styles.matchCard}>
        <View style={styles.matchHeader}>
          <Text style={styles.matchLabel}>Match score</Text>
          <BadgePill tone="green">{selectedMode}</BadgePill>
        </View>
        <Text style={styles.matchValue}>{scanResult.matchScore.toFixed(1)}/10</Text>
        <Text style={styles.matchNote}>
          {selectedRecipe.title}: {selectedRecipe.description}
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton onPress={() => navigation.navigate('RecipeDetailScreen', { mode: selectedMode })}>
          View Recipe
        </PrimaryButton>
        <View style={styles.secondaryGrid}>
          <SecondaryButton onPress={() => navigation.navigate('ShareCardPreviewScreen', { cardType: 'scan_result', mode: selectedMode })}>
            Share Dupe
          </SecondaryButton>
          <SecondaryButton onPress={saveSelectedRecipe}>Save Recipe</SecondaryButton>
          <SecondaryButton onPress={() => navigation.navigate('GroceryListScreen', { mode: selectedMode })}>
            Grocery List
          </SecondaryButton>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: colors.coral,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.charcoal,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 39,
  },
  subtitle: {
    color: colors.body,
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
  },
  savingsHero: {
    backgroundColor: colors.greenSoft,
    borderColor: '#c7e8d1',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 22,
    padding: 20,
  },
  scanPreview: {
    backgroundColor: colors.cream,
    borderRadius: 18,
    height: 190,
    marginTop: 18,
    width: '100%',
  },
  savingsHeroLabel: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  savingsHeroValue: {
    color: colors.green,
    fontSize: 46,
    fontWeight: '900',
    lineHeight: 52,
    marginTop: 3,
  },
  savingsHeroBody: {
    color: '#356b4c',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 8,
  },
  summaryCard: {
    ...sharedStyles.card,
    marginTop: 14,
    padding: 18,
  },
  metricRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  metricLabel: {
    color: colors.body,
    fontSize: 15,
  },
  metricValue: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '900',
  },
  matchCard: {
    backgroundColor: colors.cream,
    borderRadius: 20,
    marginTop: 18,
    padding: 18,
  },
  matchHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  matchLabel: {
    color: colors.body,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  matchValue: {
    color: colors.charcoal,
    fontSize: 30,
    fontWeight: '900',
    marginTop: 2,
  },
  matchNote: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  failureCard: {
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 18,
    padding: 18,
  },
  failureTitle: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '900',
  },
  failureBody: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  actions: {
    gap: 12,
    marginTop: 22,
  },
  secondaryGrid: {
    gap: 10,
  },
  aiDebugPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#eef3ff',
    borderColor: '#c7d7ff',
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  aiDebugText: {
    color: '#315399',
    fontSize: 12,
    fontWeight: '900',
  },
});

function getAiDebugLabel(metadata: AiDebugMetadata | null) {
  switch (metadata?.aiSource) {
    case 'openrouter_ai':
      return 'AI: OpenRouter';
    case 'mock_ai':
      return 'AI: Mock';
    case 'fallback_ai':
      return 'AI: Fallback';
    default:
      return null;
  }
}

function getScanFailureCopy(failure: { rejectionType?: string; rejectionReason?: string } | null) {
  if (failure?.rejectionType === 'not_food') {
    return {
      title: "This doesn't look like a restaurant meal.",
      body: failure.rejectionReason ?? 'Okyo needs a clear food photo to build a useful copycat-style recipe.',
    };
  }

  if (failure?.rejectionType === 'unclear_image') {
    return {
      title: "Okyo couldn't analyze this photo.",
      body: failure.rejectionReason ?? 'The dish was too unclear to identify confidently.',
    };
  }

  return {
    title: "Okyo couldn't analyze this photo.",
    body: failure?.rejectionReason ?? 'The AI scan did not return a safe result.',
  };
}
