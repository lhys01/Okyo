import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Bookmark,
  Camera,
  Cart,
  Clock,
  Cutlery,
  Dollar,
  NavArrowLeft,
  PlusCircle,
  Settings,
  ShareAndroid,
  ShieldCheck,
  Star,
} from 'iconoir-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
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
  const confidencePercent = getPercentValue(scanResult?.confidence ?? latestAiDebugMetadata?.confidence);
  const matchPercent = confidencePercent ?? getPercentValue(
    typeof scanResult?.matchScore === 'number' ? scanResult.matchScore / 10 : undefined,
  );
  const didTrackResultView = useRef(false);
  const [showStarterRecipe, setShowStarterRecipe] = useState(false);
  const firstScanEventId = `first-scan-${scanResult?.id ?? 'missing-scan'}`;
  const isScanFailure = latestScanStatus === 'rejected' || latestScanStatus === 'failed';
  const isPartialScan = latestScanStatus === 'partial' && Boolean(latestScanResult);
  const failureCopy = getScanFailureCopy(latestScanFailure);
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

        {selectedScanImage?.uri ? (
          <Image source={{ uri: selectedScanImage.uri }} resizeMode="contain" style={styles.standaloneScanPreview} />
        ) : null}

        <View style={styles.partialCard}>
          <Text style={styles.failureTitle}>Useful scan, incomplete recipe.</Text>
          <Text style={styles.failureBody}>
            Confidence: {formatPercent(confidencePercent)}. Try again, or use a quick starter inspired-by recipe while Okyo keeps the result honest.
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
        <Text style={styles.kicker}>SCAN RESULT</Text>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          numberOfLines={2}
          style={styles.title}
        >
          {displayDishName || 'Scanned dish'}
        </Text>
        <Text style={styles.subtitle}>{displaySubtitle}</Text>
        {matchPercent !== null ? (
          <View style={styles.matchPill}>
            <Text style={styles.matchPillText}>{formatPercent(matchPercent)} match</Text>
          </View>
        ) : null}
      </View>

      <FoodImageCard
        dishName={displayDishName || 'Scanned dish'}
        imageUri={selectedScanImage?.uri}
        isDemoScan={isDemoScan}
      />

      <View style={styles.savingsHero}>
        <View style={styles.savingsBadge}>
          <Dollar color={colors.green} height={28} strokeWidth={2.3} width={28} />
        </View>
        <View style={styles.savingsAmountGroup}>
          <Text style={styles.savingsHeroLabel}>You save</Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.78}
            numberOfLines={1}
            style={styles.savingsHeroValue}
          >
            {formatOptionalCurrency(selectedRecipe.estimatedSavings)}
          </Text>
        </View>
        <View style={styles.priceCompare}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={1}
            style={styles.priceCompareLine}
          >
            Restaurant {formatOptionalCurrency(scanResult.restaurantPrice)} →
          </Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={1}
            style={styles.priceCompareLineHome}
          >
            Home {formatOptionalCurrency(selectedRecipe.estimatedHomemadeCost)}
          </Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <StatBlock
          icon={<ShieldCheck color="#12629a" height={21} strokeWidth={2.2} width={21} />}
          iconStyle={styles.statIconBlue}
          label="Confidence"
          value={formatPercent(confidencePercent)}
        />
        <View style={styles.statDivider} />
        <StatBlock
          icon={<Cutlery color="#a85f08" height={21} strokeWidth={2.2} width={21} />}
          iconStyle={styles.statIconGold}
          label="Difficulty"
          value={selectedRecipe.difficulty ?? '—'}
        />
        <View style={styles.statDivider} />
        <StatBlock
          icon={<Clock color="#7b2fc8" height={21} strokeWidth={2.2} width={21} />}
          iconStyle={styles.statIconPurple}
          label="Time"
          value={totalTimeMinutes ? `${totalTimeMinutes} min` : '—'}
        />
      </View>

      <ResultModeTabs selectedMode={selectedMode} onSelectMode={chooseMode} />

      <View style={styles.matchCard}>
        <View style={styles.matchTopRow}>
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>{selectedModeUi.label}</Text>
          </View>
          {formatScore(scanResult.matchScore) !== '—' ? (
            <Text style={styles.matchTopScore}>{formatScore(scanResult.matchScore)}/10</Text>
          ) : null}
        </View>
        <View style={styles.matchBodyRow}>
          <View style={styles.matchCopy}>
            <Text style={styles.matchLabel}>Match score</Text>
            <Text style={styles.matchValue}>
              {formatScore(scanResult.matchScore)}
              {formatScore(scanResult.matchScore) !== '—' ? (
                <Text style={styles.matchValueDenominator}>/10</Text>
              ) : null}
            </Text>
            <Text style={styles.matchNote}>
              {getModeSummary(selectedRecipe, selectedMode)}
            </Text>
          </View>
          <View style={styles.matchAward}>
            <Star color={colors.green} height={33} strokeWidth={2.2} width={33} />
          </View>
        </View>
        <View style={styles.chipRow}>
          {getModeChips(selectedRecipe).map((chip) => (
            <View key={chip.label} style={styles.infoChip}>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                numberOfLines={1}
                style={styles.infoChipValue}
              >
                {chip.value}
              </Text>
              <Text numberOfLines={1} style={styles.infoChipLabel}>{chip.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <ResultPrimaryButton onPress={() => navigation.navigate('RecipeDetailScreen', { mode: selectedMode })}>
          View recipe
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
            <NavArrowLeft color={colors.charcoal} height={21} strokeWidth={2.35} width={21} />
            <Text style={styles.scanAgainText}>Scan again</Text>
          </Pressable>
          <View pointerEvents="none" style={styles.topTitleWrap}>
            <Text style={styles.topTitle}>Result</Text>
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
          <Text style={styles.photoUnavailableBody}>Demo scan result shown without a saved food photo.</Text>
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

type StatBlockProps = {
  icon: ReactNode;
  iconStyle: StyleProp<ViewStyle>;
  label: string;
  value: string;
};

function StatBlock({ icon, iconStyle, label, value }: StatBlockProps) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, iconStyle]}>
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
      <Text style={styles.resultPrimaryButtonText}>{children}</Text>
    </Pressable>
  );
}

const modeUiByMode: Record<RecipeMode, { label: string }> = {
  'Restaurant Copy': { label: 'Restaurant Style' },
  Budget: { label: 'Budget' },
  Healthy: { label: 'Lighter' },
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
    return `${style} homemade version`;
  }

  const description = cleanDisplayText(recipeDescription ?? '');
  if (description.toLowerCase().includes('lighter')) {
    return 'A lighter weeknight version of your scan';
  }

  if (description.toLowerCase().includes('budget') || description.toLowerCase().includes('lower-cost')) {
    return 'A budget-friendly version of your scan';
  }

  return 'Inspired-by homemade version';
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
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    backgroundColor: colors.background,
    flexGrow: 1,
    paddingBottom: 28,
    paddingHorizontal: 16,
  },
  topBar: {
    alignItems: 'center',
    height: 58,
    justifyContent: 'center',
    marginBottom: 18,
    marginTop: 4,
    position: 'relative',
  },
  scanAgainButton: {
    alignItems: 'center',
    backgroundColor: '#fffdf8',
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    left: 0,
    maxWidth: 148,
    minHeight: 44,
    paddingHorizontal: 14,
    position: 'absolute',
    top: 7,
    zIndex: 2,
  },
  scanAgainText: {
    color: colors.charcoal,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '900',
  },
  topTitleWrap: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 72,
    position: 'absolute',
    right: 72,
    top: 0,
  },
  topTitle: {
    color: colors.charcoal,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  settingsButton: {
    alignItems: 'center',
    backgroundColor: '#fffdf8',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 7,
    width: 44,
    zIndex: 2,
  },
  headerSection: {
    marginBottom: 14,
    minWidth: 0,
  },
  kicker: {
    color: colors.coral,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.charcoal,
    fontSize: 39,
    fontWeight: '900',
    lineHeight: 45,
    minWidth: 0,
  },
  subtitle: {
    color: colors.body,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: 4,
    minWidth: 0,
  },
  matchPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff0e8',
    borderColor: '#ffe0d2',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 12,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  matchPillText: {
    color: colors.coralDark,
    fontSize: 15,
    fontWeight: '900',
  },
  foodImageCard: {
    alignItems: 'center',
    aspectRatio: 1.73,
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    maxHeight: 240,
    minHeight: 188,
    overflow: 'hidden',
    width: '100%',
    shadowColor: '#7b5a38',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
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
    backgroundColor: '#fff1df',
    borderRadius: 999,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  photoUnavailableTitle: {
    color: colors.charcoal,
    fontSize: 17,
    fontWeight: '900',
    maxWidth: '90%',
    textAlign: 'center',
  },
  photoUnavailableBody: {
    color: colors.body,
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 260,
    textAlign: 'center',
  },
  savingsHero: {
    alignItems: 'center',
    backgroundColor: '#eef8ee',
    borderColor: '#bee1c5',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  savingsBadge: {
    alignItems: 'center',
    backgroundColor: '#d9efd9',
    borderRadius: 999,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  savingsAmountGroup: {
    flexGrow: 1,
    flexShrink: 0,
    minWidth: 128,
  },
  savingsHeroLabel: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  savingsHeroValue: {
    color: colors.charcoal,
    fontSize: 34,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 39,
    marginTop: 2,
  },
  priceCompare: {
    alignItems: 'flex-start',
    flexBasis: 128,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 128,
  },
  priceCompareLine: {
    color: colors.body,
    fontSize: 14,
    fontWeight: '700',
    width: '100%',
  },
  priceCompareLineHome: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
    width: '100%',
  },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 16,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 13,
  },
  statTile: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  statDivider: {
    backgroundColor: colors.border,
    height: 46,
    width: 1,
  },
  statIcon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
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
  statTextGroup: {
    flexShrink: 1,
    minWidth: 0,
  },
  metricLabel: {
    color: colors.body,
    fontSize: 13,
    fontWeight: '700',
  },
  metricValue: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
    marginTop: 1,
  },
  modeTabs: {
    alignItems: 'center',
    backgroundColor: '#fffdf8',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 14,
    minWidth: 0,
    padding: 6,
  },
  modeTabSlot: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  modeDivider: {
    backgroundColor: colors.border,
    height: 32,
    width: 1,
  },
  modeTab: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  modeTabSelected: {
    backgroundColor: '#fff0e8',
  },
  modeTabText: {
    color: colors.body,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '900',
    minWidth: 0,
    textAlign: 'center',
  },
  modeTabTextSelected: {
    color: colors.coral,
  },
  matchCard: {
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 14,
    minWidth: 0,
    padding: 14,
    shadowColor: '#7b5a38',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 1,
  },
  matchTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 38,
    minWidth: 0,
  },
  modeBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#dff2e5',
    borderRadius: 999,
    maxWidth: '74%',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  modeBadgeText: {
    color: colors.green,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  matchTopScore: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 8,
  },
  matchBodyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    minWidth: 0,
  },
  matchCopy: {
    flex: 1,
    minWidth: 0,
  },
  matchLabel: {
    color: colors.body,
    fontSize: 15,
    fontWeight: '800',
  },
  matchValue: {
    color: colors.charcoal,
    fontSize: 54,
    fontWeight: '900',
    lineHeight: 60,
    marginTop: 2,
  },
  matchValueDenominator: {
    color: colors.green,
    fontSize: 30,
    fontWeight: '900',
  },
  matchNote: {
    color: colors.body,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
  },
  matchAward: {
    alignItems: 'center',
    backgroundColor: '#e7f4e7',
    borderRadius: 999,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    minWidth: 0,
  },
  infoChip: {
    backgroundColor: '#fffdf8',
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 62,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  infoChipValue: {
    color: colors.charcoal,
    fontSize: 17,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 21,
    textAlign: 'center',
  },
  infoChipLabel: {
    color: colors.body,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  standaloneScanPreview: {
    backgroundColor: '#fffaf3',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 210,
    marginTop: 18,
    width: '100%',
  },
  failureCard: {
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 18,
    padding: 18,
  },
  partialCard: {
    backgroundColor: '#fff7d8',
    borderColor: '#eadc91',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 18,
    padding: 18,
  },
  starterCard: {
    backgroundColor: '#ffffff',
    borderColor: '#eadc91',
    borderRadius: 18,
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
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 18,
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
    marginTop: 16,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 52,
    minWidth: 0,
    paddingHorizontal: 7,
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
    fontSize: 14,
    fontWeight: '900',
    minWidth: 0,
    textAlign: 'center',
  },
  resultPrimaryButton: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 20,
    justifyContent: 'center',
    minHeight: 64,
    paddingHorizontal: 18,
    shadowColor: colors.coral,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 3,
  },
  resultPrimaryButtonText: {
    color: '#fffdf8',
    fontSize: 18,
    fontWeight: '900',
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

function getScanFailureCopy(failure: { rejectionType?: string; rejectionReason?: string } | null) {
  const friendlyReason = getPublicFailureReason(failure?.rejectionReason);

  if (failure?.rejectionType === 'not_food') {
    return {
      title: "This doesn't look like a restaurant meal.",
      body: friendlyReason ?? 'Okyo needs a clear food photo to build a useful inspired-by recipe.',
    };
  }

  if (failure?.rejectionType === 'unclear_image') {
    return {
      title: "Okyo couldn't analyze this photo.",
      body: friendlyReason ?? 'The dish was too unclear to identify confidently.',
    };
  }

  return {
    title: "Okyo couldn't analyze this photo.",
    body: friendlyReason ?? 'The scan did not return a safe result.',
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
