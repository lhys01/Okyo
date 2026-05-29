import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
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
  type Recipe,
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
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const latestAiDebugMetadata = useOkyoStore((state) => state.latestAiDebugMetadata);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const setLatestScanResult = useOkyoStore((state) => state.setLatestScanResult);
  const setLatestScanStatus = useOkyoStore((state) => state.setLatestScanStatus);
  const setLatestScanFailure = useOkyoStore((state) => state.setLatestScanFailure);
  const setLatestScanRecipe = useOkyoStore((state) => state.setLatestScanRecipe);
  const incrementWeeklyScanCount = useOkyoStore((state) => state.incrementWeeklyScanCount);
  const saveRecipe = useOkyoStore((state) => state.saveRecipe);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const awardedXpEvents = useOkyoStore((state) => state.awardedXpEvents);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const scanResult = latestScanResult ?? defaultScanResult;
  const isDemoScan = isExplicitDemoScan(selectedScanImage);
  const selectedRecipe = getDisplayRecipe(selectedMode, latestScanRecipe, isDemoScan);
  const confidencePercent = Math.round(scanResult.confidence * 100);
  const didTrackResultView = useRef(false);
  const [showStarterRecipe, setShowStarterRecipe] = useState(false);
  const firstScanEventId = `first-scan-${scanResult.id}`;
  const isScanFailure = latestScanStatus === 'rejected' || latestScanStatus === 'failed';
  const isPartialScan = latestScanStatus === 'partial' && Boolean(latestScanResult);
  const failureCopy = getScanFailureCopy(latestScanFailure);
  const debugReason = getDebugReason(latestAiDebugMetadata, latestScanFailure);
  const aiDebugLabel = getAiDebugLabel(latestAiDebugMetadata, latestScanStatus);
  const partialStarterRecipe = isPartialScan ? getStarterRecipe(scanResult.dishName) : null;

  useEffect(() => {
    if (didTrackResultView.current) {
      return;
    }

    uiLog('ResultSummaryScreen', 'enter', { mode: selectedMode });

    if (latestScanStatus === 'pending') {
      return;
    }

    didTrackResultView.current = true;
    if (isScanFailure || isPartialScan) {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: isPartialScan
          ? 'Scan recognized dish but recipe generation was incomplete.'
          : latestScanFailure?.rejectionReason ?? 'Scan was rejected or failed.',
        screen: 'ResultSummaryScreen',
      });
      return;
    }
    if (!latestScanResult && isDemoScan) {
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
      savings: selectedRecipe?.estimatedSavings ?? 0,
      screen: 'ResultSummaryScreen',
    });
  }, [awardXPOnce, awardedXpEvents, firstScanEventId, incrementWeeklyScanCount, isDemoScan, isPartialScan, isScanFailure, latestScanFailure?.rejectionReason, latestScanResult, latestScanStatus, scanResult.dishName, selectedRecipe?.estimatedSavings, selectedMode, selectedModeRaw, setLatestScanResult]);

  const chooseMode = (mode: RecipeMode) => {
    setSelectedMode(mode);
    setShowStarterRecipe(false);
    uiLog('ResultSummaryScreen', 'choose_mode', { mode });
    track(analyticsEvents.MODE_SELECTED, {
      dishName: scanResult.dishName,
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
    saveRecipe(selectedRecipe);
    if (!alreadySaved) {
      awardXPOnce(`save-recipe-${selectedRecipe.id}`, 5);
    }
    unlockBadge('first-dupe');
    track(analyticsEvents.RECIPE_SAVED, {
      dishName: selectedRecipe.title,
      mode: selectedRecipe.mode,
      savings: selectedRecipe?.estimatedSavings ?? 0,
      screen: 'ResultSummaryScreen',
    });
    navigation.navigate('MainTabs');
  };

  const goToScan = () => {
    setShowStarterRecipe(false);
    setLatestScanFailure(null);
    setLatestScanResult(null);
    setLatestScanStatus(null);
    setLatestScanRecipe(null);
    navigation.navigate('ScanScreen');
  };

  const goBackToScanTab = () => {
    setShowStarterRecipe(false);
    setLatestScanFailure(null);
    setLatestScanResult(null);
    setLatestScanStatus(null);
    setLatestScanRecipe(null);
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
        {__DEV__ && debugReason ? (
          <Text style={styles.aiDebugReason}>{debugReason}</Text>
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

  if (isPartialScan) {
    return (
      <ScreenContainer>
        <Text style={styles.kicker}>Almost there</Text>
        <Text style={styles.title}>{scanResult.dishName}</Text>
        <Text style={styles.subtitle}>
          We recognized this as {scanResult.dishName}. Recipe generation had a hiccup.
        </Text>
        {__DEV__ && aiDebugLabel ? (
          <View style={styles.aiDebugPill}>
            <Text style={styles.aiDebugText}>{aiDebugLabel}</Text>
          </View>
        ) : null}
        {__DEV__ && debugReason ? (
          <Text style={styles.aiDebugReason}>{debugReason}</Text>
        ) : null}

        {selectedScanImage?.uri ? (
          <Image source={{ uri: selectedScanImage.uri }} style={styles.scanPreview} />
        ) : null}

        <View style={styles.partialCard}>
          <Text style={styles.failureTitle}>Useful scan, incomplete recipe.</Text>
          <Text style={styles.failureBody}>
            Confidence: {confidencePercent}%. Try again, or use a quick starter inspired-by recipe while Okyo keeps the result honest.
          </Text>
        </View>

        {showStarterRecipe && partialStarterRecipe ? (
          <View style={styles.starterCard}>
            <Text style={styles.starterLabel}>Starter inspired-by recipe</Text>
            <Text style={styles.starterTitle}>{partialStarterRecipe.title}</Text>
            <Text style={styles.starterBody}>{partialStarterRecipe.body}</Text>
            {partialStarterRecipe.steps.map((step, index) => (
              <Text key={`${partialStarterRecipe.title}-${step}`} style={styles.starterStep}>
                {index + 1}. {step}
              </Text>
            ))}
            <Text style={styles.starterNote}>
              This is a safe starter, not a fully generated AI recipe. Costs and savings are not shown for this partial result.
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {partialStarterRecipe ? (
            <PrimaryButton onPress={() => setShowStarterRecipe(true)}>Use Starter Recipe</PrimaryButton>
          ) : null}
          <SecondaryButton onPress={goToScan}>Try Again</SecondaryButton>
          <SecondaryButton onPress={goBackToScanTab}>Back to Scan</SecondaryButton>
        </View>
      </ScreenContainer>
    );
  }

  if (latestScanStatus === 'pending' && !latestScanResult) {
    return (
      <ScreenContainer>
        <Text style={styles.kicker}>Scanning</Text>
        <Text style={styles.title}>Okyo is still looking.</Text>
        <Text style={styles.subtitle}>
          This can take a few seconds for real food photos. We will only show a result when it is safe to trust.
        </Text>
        <View style={styles.loadingMiniCard}>
          <Text style={styles.loadingMiniText}>Building your homemade dupe...</Text>
        </View>
        <View style={styles.actions}>
          <SecondaryButton onPress={goBackToScanTab}>Back to Scan</SecondaryButton>
        </View>
      </ScreenContainer>
    );
  }

  if (!selectedRecipe) {
    return (
      <ScreenContainer>
        <Text style={styles.kicker}>Recipe issue</Text>
        <Text style={styles.title}>The scan worked, but the recipe needs another try.</Text>
        <Text style={styles.subtitle}>
          {latestScanResult
            ? `Okyo recognized ${scanResult.dishName}, but no safe ${selectedMode} recipe came back for this real scan.`
            : 'Okyo needs a completed scan before it can show a real recipe.'}
        </Text>
        {selectedScanImage?.uri ? (
          <Image source={{ uri: selectedScanImage.uri }} style={styles.scanPreview} />
        ) : null}
        <View style={styles.failureCard}>
          <Text style={styles.failureTitle}>No mock recipe shown.</Text>
          <Text style={styles.failureBody}>
            Try again so Okyo can generate a recipe for this photo instead of falling back to demo pasta.
          </Text>
        </View>
        <View style={styles.actions}>
          <PrimaryButton onPress={goToScan}>Try Another Photo</PrimaryButton>
          <SecondaryButton onPress={goBackToScanTab}>Back to Scan</SecondaryButton>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.kicker}>{isDemoScan ? 'Demo result' : 'Scan result'}</Text>
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
  partialCard: {
    backgroundColor: '#fff7d8',
    borderColor: '#eadc91',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 18,
    padding: 18,
  },
  starterCard: {
    backgroundColor: '#ffffff',
    borderColor: '#eadc91',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 14,
    padding: 18,
  },
  starterLabel: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  starterTitle: {
    color: colors.charcoal,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 6,
  },
  starterBody: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  starterStep: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 8,
  },
  starterNote: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 12,
  },
  loadingMiniCard: {
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 20,
    padding: 18,
  },
  loadingMiniText: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
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
  aiDebugReason: {
    color: '#315399',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 8,
  },
});

function getDisplayRecipe(mode: RecipeMode, recipe: Recipe | null, isDemoScan: boolean) {
  if (recipe?.mode === mode) {
    return recipe;
  }

  return isDemoScan ? getSafeRecipeForMode(mode) : null;
}

function isExplicitDemoScan(image: { placeholder?: boolean; source?: string } | null) {
  return image?.placeholder === true && image.source === 'mock';
}

function getAiDebugLabel(metadata: AiDebugMetadata | null, status?: string | null) {
  if (status === 'partial') {
    return 'AI: Partial';
  }

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

function getDebugReason(
  metadata: AiDebugMetadata | null,
  failure: { rejectionReason?: string } | null,
) {
  const reason = failure?.rejectionReason ?? metadata?.fallbackReason;
  return reason ? `Dev reason: ${reason}` : null;
}

function getStarterRecipe(dishName: string) {
  const normalized = dishName.toLowerCase();
  if (!dishName.trim()) {
    return null;
  }

  if (normalized.includes('pizza')) {
    return {
      title: `${dishName} starter`,
      body: 'A simple inspired-by pizza path using store-bought dough or flatbread.',
      steps: [
        'Spread tomato sauce over dough or flatbread.',
        'Add mozzarella and a small drizzle of olive oil.',
        'Bake until the crust is crisp and the cheese is bubbling.',
        'Finish with basil, oregano, or chili flakes if you have them.',
      ],
    };
  }

  if (normalized.includes('spaghetti') || normalized.includes('noodle') || normalized.includes('pasta')) {
    return {
      title: `${dishName} starter`,
      body: 'A simple inspired-by pasta path using pantry sauce and a short noodle.',
      steps: [
        'Boil pasta until just tender and reserve a little pasta water.',
        'Warm tomato, cream, or broth-based sauce in a pan.',
        'Toss pasta with sauce and loosen with pasta water as needed.',
        'Finish with cheese, herbs, or chili flakes if they fit the dish.',
      ],
    };
  }

  return {
    title: `${dishName} starter`,
    body: 'A simple inspired-by cooking path based on the recognized dish name.',
    steps: [
      'Identify the main protein, grain, or vegetable base.',
      'Cook the main ingredient simply with salt, pepper, and oil.',
      'Add a sauce or seasoning that matches the dish style.',
      'Taste and adjust before serving.',
    ],
  };
}
