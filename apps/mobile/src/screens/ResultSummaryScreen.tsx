import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import type { AiDebugMetadata } from '../api/types';
import { uiLog } from '../utils/uiDebug';
import {
  PrimaryButton,
  colors,
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
const recipeModes: RecipeMode[] = ['Restaurant Copy', 'Budget', 'Healthy'];
type ResultSummaryNavigation = NativeStackNavigationProp<RootStackParamList, 'ResultSummaryScreen'>;

export function ResultSummaryScreen() {
  const navigation = useNavigation<ResultSummaryNavigation>();
  const selectedModeRaw = useOkyoStore((state) => state.selectedMode);
  const selectedMode = getSafeRecipeMode(selectedModeRaw);
  const latestScanResult = useOkyoStore((state) => state.latestScanResult);
  const latestScanRecipes = useOkyoStore((state) => state.latestScanRecipes);
  const latestScanStatus = useOkyoStore((state) => state.latestScanStatus);
  const latestScanFailure = useOkyoStore((state) => state.latestScanFailure);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const latestAiDebugMetadata = useOkyoStore((state) => state.latestAiDebugMetadata);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const setLatestScanResult = useOkyoStore((state) => state.setLatestScanResult);
  const setLatestScanRecipes = useOkyoStore((state) => state.setLatestScanRecipes);
  const setLatestScanStatus = useOkyoStore((state) => state.setLatestScanStatus);
  const setLatestScanFailure = useOkyoStore((state) => state.setLatestScanFailure);
  const setLatestScanRecipe = useOkyoStore((state) => state.setLatestScanRecipe);
  const incrementWeeklyScanCount = useOkyoStore((state) => state.incrementWeeklyScanCount);
  const saveRecipe = useOkyoStore((state) => state.saveRecipe);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const awardedXpEvents = useOkyoStore((state) => state.awardedXpEvents);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const isDemoScan = isExplicitDemoScan(selectedScanImage);
  const scanResult = latestScanResult ?? (isDemoScan ? defaultScanResult : null);
  const storedRecipe = getStoredRecipeForMode(latestScanRecipes, selectedMode, latestScanRecipe);
  const selectedRecipe = storedRecipe ?? (isDemoScan ? getSafeRecipeForMode(selectedMode) : null);
  const confidencePercent = Math.round((scanResult?.confidence ?? latestAiDebugMetadata?.confidence ?? 0) * 100);
  const shouldShowRecipeFallbackNote = Boolean(
    latestScanResult &&
    latestAiDebugMetadata?.aiSource === 'openrouter_ai' &&
    !storedRecipe,
  );
  const didTrackResultView = useRef(false);
  const [showStarterRecipe, setShowStarterRecipe] = useState(false);
  const firstScanEventId = `first-scan-${scanResult?.id ?? 'missing-scan'}`;
  const isScanFailure = latestScanStatus === 'rejected' || latestScanStatus === 'failed';
  const isPartialScan = latestScanStatus === 'partial' && Boolean(latestScanResult);
  const failureCopy = getScanFailureCopy(latestScanFailure);
  const debugReason = getDebugReason(latestAiDebugMetadata, latestScanFailure);
  const aiDebugLabel = getAiDebugLabel(latestAiDebugMetadata, latestScanStatus);
  const partialStarterRecipe = isPartialScan && scanResult ? getStarterRecipe(scanResult.dishName) : null;
  const selectedModeUi = getModeUi(selectedMode);
  const totalTimeMinutes = selectedRecipe
    ? selectedRecipe.totalTimeMinutes ?? selectedRecipe.prepTimeMinutes + selectedRecipe.cookTimeMinutes
    : null;
  const displayDishName = cleanDisplayText(scanResult?.dishName ?? '');
  const displaySubtitle = getDisplaySubtitle(scanResult?.restaurantStyle, selectedRecipe?.description);

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
      savings: selectedRecipe?.estimatedSavings ?? 0,
      screen: 'ResultSummaryScreen',
    });
  }, [awardXPOnce, awardedXpEvents, firstScanEventId, incrementWeeklyScanCount, isDemoScan, isPartialScan, isScanFailure, latestScanFailure?.rejectionReason, latestScanResult, latestScanStatus, scanResult, selectedRecipe?.estimatedSavings, selectedMode, selectedModeRaw, setLatestScanResult]);

  const chooseMode = (mode: RecipeMode) => {
    setSelectedMode(mode);
    setShowStarterRecipe(false);
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
    setShowStarterRecipe(false);
    setLatestScanFailure(null);
    setLatestScanResult(null);
    setLatestScanRecipes([]);
    setLatestScanStatus(null);
    setLatestScanRecipe(null);
    navigation.navigate('MainTabs', { screen: 'ScanScreen' });
  };

  const goBackToScanTab = () => {
    setShowStarterRecipe(false);
    setLatestScanFailure(null);
    setLatestScanResult(null);
    setLatestScanRecipes([]);
    setLatestScanStatus(null);
    setLatestScanRecipe(null);
    navigation.navigate('MainTabs', { screen: 'ScanScreen' });
  };

  const openSettings = () => {
    navigation.navigate('MainTabs', { screen: 'SettingsScreen' });
  };

  if (isScanFailure) {
    return (
      <ResultFrame onScanAgain={goToScan} onSettings={openSettings}>
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
          <Image source={{ uri: selectedScanImage.uri }} resizeMode="contain" style={styles.standaloneScanPreview} />
        ) : null}

        <View style={styles.failureCard}>
          <Text style={styles.failureTitle}>Try uploading a clearer food photo.</Text>
          <Text style={styles.failureBody}>
            Use a well-lit restaurant meal photo where the main dish is centered and visible.
          </Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton onPress={goToScan}>Try Another Photo</PrimaryButton>
          <ActionButton label="Back to Scan" onPress={goBackToScanTab} />
        </View>
      </ResultFrame>
    );
  }

  if (isPartialScan && scanResult) {
    return (
      <ResultFrame onScanAgain={goToScan} onSettings={openSettings}>
        <Text style={styles.kicker}>Almost there</Text>
        <Text style={styles.title}>{cleanDisplayText(scanResult.dishName)}</Text>
        <Text style={styles.subtitle}>
          We recognized this as {cleanDisplayText(scanResult.dishName)}. Recipe generation had a hiccup.
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
          <Image source={{ uri: selectedScanImage.uri }} resizeMode="contain" style={styles.standaloneScanPreview} />
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
          <ActionButton label="Try Again" onPress={goToScan} />
          <ActionButton label="Back to Scan" onPress={goBackToScanTab} />
        </View>
      </ResultFrame>
    );
  }

  if (latestScanStatus === 'pending' && !latestScanResult) {
    return (
      <ResultFrame onScanAgain={goToScan} onSettings={openSettings}>
        <Text style={styles.kicker}>Scanning</Text>
        <Text style={styles.title}>Okyo is still looking.</Text>
        <Text style={styles.subtitle}>
          This can take a few seconds for real food photos. We will only show a result when it is safe to trust.
        </Text>
        <View style={styles.loadingMiniCard}>
          <Text style={styles.loadingMiniText}>Building your homemade dupe...</Text>
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
        <Text style={styles.title}>The scan worked, but the recipe needs another try.</Text>
        <Text style={styles.subtitle}>
          {latestScanResult
            ? `Okyo recognized ${cleanDisplayText(scanResult?.dishName ?? 'this dish')}, but no safe ${selectedModeUi.label} recipe came back for this real scan.`
            : 'Okyo needs a completed scan before it can show a real recipe.'}
        </Text>
        {selectedScanImage?.uri ? (
          <Image source={{ uri: selectedScanImage.uri }} resizeMode="contain" style={styles.standaloneScanPreview} />
        ) : null}
        <View style={styles.failureCard}>
          <Text style={styles.failureTitle}>No mock recipe shown.</Text>
          <Text style={styles.failureBody}>
            Try again so Okyo can generate a recipe for this photo instead of falling back to demo pasta.
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
    <ResultFrame onScanAgain={goToScan} onSettings={openSettings}>
      <View style={styles.headerSection}>
        <Text style={styles.kicker}>Scan result</Text>
        <Text style={styles.title}>{displayDishName}</Text>
        <Text style={styles.subtitle}>{displaySubtitle}</Text>
        <View style={styles.aiMatchPill}>
          <Text style={styles.aiMatchIcon}>+</Text>
          <Text style={styles.aiMatchText}>
            {confidencePercent > 0 ? `${confidencePercent}% AI recipe match` : 'AI recipe match'}
          </Text>
        </View>
      </View>
      {__DEV__ && aiDebugLabel ? (
        <View style={styles.aiDebugPill}>
          <Text style={styles.aiDebugText}>{aiDebugLabel}</Text>
        </View>
      ) : null}

      <FoodImageCard
        dishName={displayDishName}
        imageUri={selectedScanImage?.uri}
        isDemoScan={isDemoScan}
      />

      <View style={styles.savingsHero}>
        <View style={styles.savingsBadge}>
          <Text style={styles.savingsBadgeText}>$</Text>
        </View>
        <View style={styles.savingsAmountGroup}>
          <Text style={styles.savingsHeroLabel}>You save</Text>
          <Text style={styles.savingsHeroValue}>
            {formatOptionalCurrency(selectedRecipe.estimatedSavings)}
          </Text>
        </View>
        <View style={styles.savingsDivider} />
        <View style={styles.priceCompare}>
          <View>
            <Text style={styles.priceLabel}>Restaurant</Text>
            <Text style={styles.priceValue}>{formatOptionalCurrency(scanResult.restaurantPrice)}</Text>
          </View>
          <View style={styles.priceArrowWrap}>
            <Text style={styles.priceArrow}>→</Text>
          </View>
          <View>
            <Text style={styles.priceLabel}>Home</Text>
            <Text style={styles.priceValue}>{formatOptionalCurrency(selectedRecipe.estimatedHomemadeCost)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.statTile}>
          <View style={[styles.statIcon, styles.statIconBlue]}>
            <Text style={styles.statIconText}>✓</Text>
          </View>
          <Text style={styles.metricLabel}>Confidence</Text>
          <Text style={styles.metricValue}>{confidencePercent > 0 ? `${confidencePercent}%` : '—'}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statTile}>
          <View style={[styles.statIcon, styles.statIconGold]}>
            <Text style={styles.statIconText}>^</Text>
          </View>
          <Text style={styles.metricLabel}>Difficulty</Text>
          <Text style={styles.metricValue}>{selectedRecipe.difficulty ?? '—'}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statTile}>
          <View style={[styles.statIcon, styles.statIconPurple]}>
            <Text style={styles.statIconText}>○</Text>
          </View>
          <Text style={styles.metricLabel}>Time</Text>
          <Text style={styles.metricValue}>{totalTimeMinutes ? `${totalTimeMinutes} min` : '—'}</Text>
        </View>
      </View>

      <ResultModeTabs selectedMode={selectedMode} onSelectMode={chooseMode} />

      <View style={styles.matchCard}>
        <View style={styles.modeBadge}>
          <Text style={styles.modeBadgeIcon}>{selectedModeUi.icon}</Text>
          <Text style={styles.modeBadgeText}>{selectedModeUi.label}</Text>
        </View>
        <View style={styles.matchHeader}>
          <Text style={styles.matchLabel}>Match score</Text>
        </View>
        <Text style={styles.matchValue}>
          {formatScore(scanResult.matchScore)}
          <Text style={styles.matchValueDenominator}>/10</Text>
        </Text>
        <Text style={styles.matchNote}>
          {cleanDisplayText(selectedRecipe.description)}
        </Text>
        <View style={styles.chipRow}>
          {getModeChips(selectedRecipe).map((chip) => (
            <View key={chip.label} style={styles.infoChip}>
              <Text style={styles.infoChipValue}>{chip.value}</Text>
              <Text style={styles.infoChipLabel}>{chip.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {shouldShowRecipeFallbackNote ? (
        <View style={styles.recipeFallbackNote}>
          <Text style={styles.recipeFallbackNoteText}>
            Okyo did not receive a generated {selectedModeUi.label} recipe for this scan, so this mode is using a local starter fallback.
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton onPress={() => navigation.navigate('RecipeDetailScreen', { mode: selectedMode })}>
          View recipe
        </PrimaryButton>
        <View style={styles.secondaryRow}>
          <ActionButton label="Share" onPress={openShareDupe} />
          <ActionButton label="Save recipe" onPress={saveSelectedRecipe} />
          <ActionButton
            label="Groceries"
            onPress={() => navigation.navigate('GroceryListScreen', { mode: selectedMode })}
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
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Scan again"
            accessibilityRole="button"
            onPress={onScanAgain}
            style={({ pressed }) => [styles.scanAgainButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.scanAgainArrow}>‹</Text>
            <Text style={styles.scanAgainText}>Scan again</Text>
          </Pressable>
          <Text style={styles.topTitle}>Result</Text>
          <Pressable
            accessibilityLabel="Open settings"
            accessibilityRole="button"
            onPress={onSettings}
            style={({ pressed }) => [styles.settingsButton, pressed ? styles.pressed : null]}
          >
            <SettingsGlyph />
          </Pressable>
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsGlyph() {
  return (
    <View style={styles.settingsGlyph}>
      <View style={styles.settingsToothTop} />
      <View style={styles.settingsToothSide} />
      <View style={styles.settingsGearOuter}>
        <View style={styles.settingsGearInner} />
      </View>
    </View>
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
        <Image source={{ uri: imageUri }} resizeMode="contain" style={styles.foodImage} />
      </View>
    );
  }

  if (isDemoScan) {
    return (
      <View style={styles.foodImageCard}>
        <Text style={styles.foodFallbackLabel}>{dishName}</Text>
        <View style={styles.demoPlate}>
          <View style={styles.demoBunTop} />
          <View style={styles.demoSauce} />
          <View style={styles.demoPatty} />
          <View style={styles.demoBunBottom} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.foodImageCard}>
      <Text style={styles.photoUnavailableTitle}>Food photo unavailable</Text>
      <Text style={styles.photoUnavailableBody}>Okyo can still show the scan result from the recipe data.</Text>
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
              <Text style={[styles.modeTabIcon, isSelected ? styles.modeTabIconSelected : null]}>
                {modeUi.icon}
              </Text>
              <Text style={[styles.modeTabText, isSelected ? styles.modeTabTextSelected : null]}>
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
  label: string;
  onPress: () => void;
};

function ActionButton({ label, onPress }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, pressed ? styles.pressed : null]}
    >
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

const modeUiByMode: Record<RecipeMode, { label: string; icon: string }> = {
  'Restaurant Copy': { label: 'Restaurant Style', icon: 'R' },
  Budget: { label: 'Budget', icon: '$' },
  Healthy: { label: 'Lighter', icon: 'L' },
};

function getModeUi(mode: RecipeMode) {
  return modeUiByMode[mode];
}

function getModeChips(recipe: Recipe) {
  return [
    { label: 'Est. cost', value: formatOptionalCurrency(recipe.estimatedHomemadeCost) },
    { label: 'Savings', value: formatOptionalCurrency(recipe.estimatedSavings) },
    { label: 'Serves', value: String(recipe.servings || '—') },
  ].filter((chip) => chip.value !== '—');
}

function getDisplaySubtitle(restaurantStyle?: string, recipeDescription?: string) {
  const style = cleanDisplayText(restaurantStyle ?? '');
  if (style) {
    return `${style} inspired-by homemade swap`;
  }

  const description = cleanDisplayText(recipeDescription ?? '');
  return description || 'Inspired-by homemade swap estimate';
}

function cleanDisplayText(value: string) {
  const commonTypo = `Amer${'cian'}`;
  const lowercaseTypo = `amer${'cian'}`;

  return value
    .replace(new RegExp(`\\b${commonTypo}\\b`, 'g'), 'American')
    .replace(new RegExp(`\\b${lowercaseTypo}\\b`, 'g'), 'american')
    .trim();
}

function formatOptionalCurrency(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? formatCurrency(value) : '—';
}

function formatScore(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '—';
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    backgroundColor: colors.background,
    flexGrow: 1,
    paddingBottom: 34,
    paddingHorizontal: 18,
  },
  topBar: {
    alignItems: 'center',
    height: 54,
    justifyContent: 'center',
    marginBottom: 18,
    position: 'relative',
  },
  scanAgainButton: {
    alignItems: 'center',
    backgroundColor: '#fffaf3',
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    left: 0,
    minHeight: 42,
    paddingHorizontal: 14,
    position: 'absolute',
    top: 6,
  },
  scanAgainArrow: {
    color: colors.charcoal,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 32,
  },
  scanAgainText: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '900',
  },
  topTitle: {
    color: colors.charcoal,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  settingsButton: {
    alignItems: 'center',
    backgroundColor: '#fffaf3',
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 6,
    width: 42,
  },
  settingsGlyph: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  settingsGearOuter: {
    alignItems: 'center',
    backgroundColor: colors.charcoal,
    borderRadius: 999,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  settingsGearInner: {
    backgroundColor: '#fffaf3',
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  settingsToothTop: {
    backgroundColor: colors.charcoal,
    borderRadius: 2,
    height: 22,
    position: 'absolute',
    width: 5,
  },
  settingsToothSide: {
    backgroundColor: colors.charcoal,
    borderRadius: 2,
    height: 5,
    position: 'absolute',
    width: 22,
  },
  headerSection: {
    marginBottom: 14,
  },
  kicker: {
    color: colors.coral,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.charcoal,
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 42,
  },
  subtitle: {
    color: colors.body,
    fontSize: 18,
    lineHeight: 24,
    marginTop: 8,
  },
  aiMatchPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#eef4ff',
    borderColor: '#bad0ff',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  aiMatchIcon: {
    color: '#3967c3',
    fontSize: 16,
    fontWeight: '900',
  },
  aiMatchText: {
    color: '#315aaa',
    fontSize: 15,
    fontWeight: '900',
  },
  foodImageCard: {
    alignItems: 'center',
    aspectRatio: 1.35,
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    justifyContent: 'center',
    maxHeight: 280,
    minHeight: 210,
    overflow: 'hidden',
    width: '100%',
  },
  foodImage: {
    height: '100%',
    width: '100%',
  },
  foodFallbackLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    left: 18,
    position: 'absolute',
    textTransform: 'uppercase',
    top: 16,
  },
  demoPlate: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    width: '82%',
  },
  demoBunTop: {
    backgroundColor: '#d89037',
    borderRadius: 80,
    height: 62,
    width: '84%',
  },
  demoSauce: {
    backgroundColor: '#f6b936',
    height: 24,
    marginTop: -6,
    transform: [{ rotate: '-2deg' }],
    width: '78%',
  },
  demoPatty: {
    backgroundColor: '#6f321b',
    borderRadius: 24,
    height: 46,
    marginTop: -5,
    width: '82%',
  },
  demoBunBottom: {
    backgroundColor: '#bf7633',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    height: 32,
    marginTop: -2,
    width: '76%',
  },
  photoUnavailableTitle: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  photoUnavailableBody: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 260,
    textAlign: 'center',
  },
  savingsHero: {
    alignItems: 'center',
    backgroundColor: '#edf8ef',
    borderColor: '#bfe4ca',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginTop: 16,
    padding: 16,
  },
  savingsBadge: {
    alignItems: 'center',
    backgroundColor: '#f8fff9',
    borderRadius: 999,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  savingsBadgeText: {
    color: colors.green,
    fontSize: 28,
    fontWeight: '900',
  },
  savingsAmountGroup: {
    minWidth: 100,
  },
  savingsHeroLabel: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  savingsHeroValue: {
    color: colors.green,
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 40,
    marginTop: 2,
  },
  savingsDivider: {
    backgroundColor: '#c7e5d0',
    height: 72,
    width: 1,
  },
  priceCompare: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceLabel: {
    color: colors.body,
    fontSize: 13,
    fontWeight: '700',
  },
  priceValue: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 5,
  },
  priceArrowWrap: {
    alignItems: 'center',
    backgroundColor: '#d8f0df',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    marginHorizontal: 4,
    width: 34,
  },
  priceArrow: {
    color: colors.green,
    fontSize: 22,
    fontWeight: '900',
  },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 16,
    paddingHorizontal: 8,
    paddingVertical: 18,
  },
  statTile: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 94,
  },
  statDivider: {
    backgroundColor: colors.border,
    height: 76,
    width: 1,
  },
  statIcon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    marginBottom: 10,
    width: 42,
  },
  statIconBlue: {
    backgroundColor: '#e8efff',
  },
  statIconGold: {
    backgroundColor: '#fff1ce',
  },
  statIconPurple: {
    backgroundColor: '#f1e1ff',
  },
  statIconText: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '900',
  },
  metricLabel: {
    color: colors.body,
    fontSize: 13,
    fontWeight: '700',
  },
  metricValue: {
    color: colors.charcoal,
    fontSize: 21,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'center',
  },
  modeTabs: {
    alignItems: 'center',
    backgroundColor: '#fff8ed',
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 18,
    padding: 5,
  },
  modeTabSlot: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  modeDivider: {
    backgroundColor: colors.border,
    height: 34,
    width: 1,
  },
  modeTab: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 6,
  },
  modeTabSelected: {
    backgroundColor: colors.charcoal,
  },
  modeTabIcon: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '900',
  },
  modeTabIconSelected: {
    color: '#bfeecb',
  },
  modeTabText: {
    color: colors.charcoal,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  modeTabTextSelected: {
    color: '#fffdf8',
  },
  matchCard: {
    backgroundColor: '#fffaf3',
    borderColor: colors.border,
    borderRadius: 26,
    borderWidth: 1,
    marginTop: 18,
    padding: 22,
  },
  modeBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#dff2e5',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modeBadgeIcon: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '900',
  },
  modeBadgeText: {
    color: colors.green,
    fontSize: 16,
    fontWeight: '900',
  },
  matchHeader: {
    marginTop: 26,
  },
  matchLabel: {
    color: colors.body,
    fontSize: 20,
    fontWeight: '900',
  },
  matchValue: {
    color: colors.charcoal,
    fontSize: 62,
    fontWeight: '900',
    lineHeight: 72,
    marginTop: 2,
  },
  matchValueDenominator: {
    color: colors.green,
    fontSize: 42,
    fontWeight: '900',
  },
  matchNote: {
    color: colors.body,
    fontSize: 18,
    lineHeight: 26,
    marginTop: 12,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  infoChip: {
    backgroundColor: '#fffdf8',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minHeight: 72,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  infoChipValue: {
    color: colors.charcoal,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  infoChipLabel: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
  },
  recipeFallbackNote: {
    backgroundColor: '#fff7d8',
    borderColor: '#eadc91',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  recipeFallbackNoteText: {
    color: colors.body,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  standaloneScanPreview: {
    backgroundColor: '#fffaf3',
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    height: 210,
    marginTop: 18,
    width: '100%',
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
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 8,
  },
  actionButtonText: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
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
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});

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
      body: failure.rejectionReason ?? 'Okyo needs a clear food photo to build a useful inspired-by recipe.',
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

function getStoredRecipeForMode(recipes: Recipe[], mode: RecipeMode, fallbackRecipe: Recipe | null) {
  return recipes.find((recipe) => recipe.mode === mode) ??
    (fallbackRecipe?.mode === mode ? fallbackRecipe : null);
}
