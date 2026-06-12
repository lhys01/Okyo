import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Calendar,
  Camera,
  Cutlery,
  DollarCircle,
  MoneySquare,
  NavArrowRight,
  StatsUpSquare,
} from 'iconoir-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KikoMascot } from '../components/KikoMascot';
import { colors } from '../components/OkyoUI';
import {
  getSafeRecipeMode,
  isRecipeMode,
  type Recipe,
  type RecipeMode,
} from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore, type CompletedChallenge } from '../state/useOkyoStore';
import { uiLog } from '../utils/uiDebug';

type SavingsNavigation = NativeStackNavigationProp<RootStackParamList>;
type SavingsPeriod = 'week' | 'month' | 'all';
type SavingsEntry = {
  id: string;
  title: string;
  mode: RecipeMode;
  savings: number;
  homeCost: number;
  restaurantCost: number;
  completedAt?: string | null;
  recipe?: Recipe;
  imageUri?: string | null;
};

const periodLabels: Record<SavingsPeriod, string> = {
  week: 'This week',
  month: 'This month',
  all: 'All time',
};

const formatCurrency = (value: number) => `$${Math.max(0, value).toFixed(2)}`;

export function SavingsDashboardScreen() {
  const navigation = useNavigation<SavingsNavigation>();
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const completedChallenges = useOkyoStore((state) => state.completedChallenges);
  const storedMoneySaved = useOkyoStore((state) => state.totalMoneySaved);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const writeSavedRecipeContext = useOkyoStore((state) => state.writeSavedRecipeContext);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const [selectedPeriod, setSelectedPeriod] = useState<SavingsPeriod>('month');

  const safeSavedRecipes = Array.isArray(savedRecipes) ? savedRecipes.filter((recipe) => recipe?.id) : [];
  const safeCompletedChallenges = Array.isArray(completedChallenges) ? completedChallenges : [];
  const safeStoredMoneySaved = getFiniteNumber(storedMoneySaved);
  const latestImageUri = selectedScanImage?.uri ?? null;

  const recipeEntries = useMemo(
    () => safeSavedRecipes.map((recipe) => toRecipeEntry(recipe, recipe.id === latestScanRecipe?.id ? latestImageUri : null)),
    [latestImageUri, latestScanRecipe?.id, safeSavedRecipes],
  );
  const challengeEntries = useMemo(
    () => safeCompletedChallenges.map(toChallengeEntry),
    [safeCompletedChallenges],
  );
  const allEntries = useMemo(
    () => [...recipeEntries, ...challengeEntries].filter((entry) => entry.savings > 0),
    [challengeEntries, recipeEntries],
  );
  const timestampedEntries = useMemo(
    () => allEntries.filter((entry) => Boolean(entry.completedAt)),
    [allEntries],
  );
  const selectedEntries = useMemo(
    () => filterEntriesForPeriod(allEntries, selectedPeriod),
    [allEntries, selectedPeriod],
  );

  const savedRecipeSavings = recipeEntries.reduce((total, entry) => total + entry.savings, 0);
  const totalEstimatedSaved = savedRecipeSavings + safeStoredMoneySaved;
  const selectedPeriodSavings = selectedPeriod === 'all'
    ? totalEstimatedSaved
    : selectedEntries.reduce((total, entry) => total + entry.savings, 0);
  const weekSavings = filterEntriesForPeriod(timestampedEntries, 'week').reduce((total, entry) => total + entry.savings, 0);
  const monthSavings = filterEntriesForPeriod(timestampedEntries, 'month').reduce((total, entry) => total + entry.savings, 0);
  const mealCount = safeSavedRecipes.length + safeCompletedChallenges.length;
  const averageSavings = mealCount > 0 ? totalEstimatedSaved / mealCount : 0;
  const biggestWin = (selectedEntries.length > 0 ? selectedEntries : allEntries)
    .reduce<SavingsEntry | null>((bestEntry, entry) => !bestEntry || entry.savings > bestEntry.savings ? entry : bestEntry, null);
  const recentWins = allEntries.slice().reverse().slice(0, 4);
  const nextGoal = getNextGoal(totalEstimatedSaved);
  const goalProgress = nextGoal > 0 ? Math.min(100, Math.round((totalEstimatedSaved / nextGoal) * 100)) : 100;
  const mealsAway = averageSavings > 0 && totalEstimatedSaved < nextGoal
    ? Math.max(1, Math.ceil((nextGoal - totalEstimatedSaved) / averageSavings))
    : null;
  const hasSavingsData = totalEstimatedSaved > 0 || allEntries.length > 0;
  const hasSelectedPeriodSavings = selectedPeriodSavings > 0;
  const zeroSavingsTitle = mealCount > 0
    ? 'Start remaking meals to track your savings.'
    : 'Your kitchen savings will stack up here.';
  const zeroSavingsBody = mealCount > 0
    ? 'Okyo will keep real savings estimates here as your saved meals and cooking wins add up.'
    : 'Save a restaurant-style recipe or finish a cooking challenge to start tracking what you kept at home.';

  const goToScan = () => {
    uiLog('SavingsDashboardScreen', 'scan_another_craving');
    navigation.navigate('MainTabs', { screen: 'ScanScreen' });
  };

  const openSavedRecipe = (recipe: Recipe) => {
    const mode = getSafeRecipeMode(recipe.mode);
    uiLog('SavingsDashboardScreen', 'open_recent_win', { recipeId: recipe.id });
    writeSavedRecipeContext({
      recipe,
      reason: 'open_saved_savings_recipe',
      source: 'SavingsDashboardScreen.openSavedRecipe',
    });
    if (isRecipeMode(recipe.mode)) {
      setSelectedMode(recipe.mode);
    }
    navigation.navigate('RecipeDetailScreen', { mode });
  };

  if (!hasSavingsData) {
    return (
      <SavingsFrame>
        <View style={styles.brandHeader}>
          <Text style={styles.logoText}>okyo</Text>
          <Text style={styles.screenTitle}>Savings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.emptyCard}>
          <KikoMascot pose="happy" size={118} style={styles.emptyMascot} />
          <Text style={styles.emptyTitle}>{zeroSavingsTitle}</Text>
          <Text style={styles.emptyBody}>{zeroSavingsBody}</Text>
          <PrimaryAction icon={<Camera color="#fffdf8" height={20} strokeWidth={2.2} width={20} />} label="Scan another craving" onPress={goToScan} />
        </View>
      </SavingsFrame>
    );
  }

  return (
    <SavingsFrame>
      <View style={styles.brandHeader}>
        <Text style={styles.logoText}>okyo</Text>
        <Text style={styles.screenTitle}>Savings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>
            {hasSelectedPeriodSavings
              ? `You kept ${formatCurrency(selectedPeriodSavings)} in your kitchen`
              : 'Start remaking meals to track your savings.'}
          </Text>
          <Text style={styles.heroBody}>
            {hasSelectedPeriodSavings
              ? 'Estimated from restaurant-style meals you saved or cooked at home.'
              : 'Save a restaurant-style recipe or switch to All time to review earlier wins.'}
          </Text>
        </View>
        <View style={styles.heroBadge}>
          <KikoMascot pose="success" size={72} />
        </View>
      </View>

      <View style={styles.periodTabs}>
        {(Object.keys(periodLabels) as SavingsPeriod[]).map((period) => (
          <Pressable
            key={period}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.periodTab,
              selectedPeriod === period ? styles.periodTabSelected : null,
              pressed ? styles.pressed : null,
            ]}
            onPress={() => {
              uiLog('SavingsDashboardScreen', 'select_period', { period });
              setSelectedPeriod(period);
            }}
          >
            <Text style={[styles.periodText, selectedPeriod === period ? styles.periodTextSelected : null]}>
              {periodLabels[period]}
            </Text>
          </Pressable>
        ))}
      </View>

      {biggestWin ? (
        <View style={styles.biggestCard}>
          <Text style={styles.sectionKicker}>Biggest win</Text>
          <View style={styles.biggestBody}>
            <SavingsThumb title={biggestWin.title} uri={biggestWin.imageUri} />
            <View style={styles.biggestCopy}>
              <Text style={styles.biggestTitle}>{cleanDisplayText(biggestWin.title)}</Text>
              <Text style={styles.biggestSavings}>Saved about {formatCurrency(biggestWin.savings)}</Text>
              <Text style={styles.biggestMeta}>
                Restaurant {formatCurrency(biggestWin.restaurantCost)}{' -> '}Home {formatCurrency(biggestWin.homeCost)}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.periodEmptyCard}>
          <Text style={styles.periodEmptyTitle}>No wins in {periodLabels[selectedPeriod].toLowerCase()} yet.</Text>
          <Text style={styles.periodEmptyBody}>All-time savings still count, and the next scan can start a fresh period.</Text>
        </View>
      )}

      <View style={styles.statsGrid}>
        <StatTile icon={<Calendar color={colors.green} height={24} strokeWidth={2} width={24} />} label="This week" value={formatCurrency(weekSavings)} />
        <StatTile icon={<Calendar color={colors.green} height={24} strokeWidth={2} width={24} />} label="This month" value={formatCurrency(monthSavings)} />
        <StatTile icon={<Cutlery color={colors.coral} height={24} strokeWidth={2} width={24} />} label="Meals remade" value={mealCount.toString()} />
        <StatTile icon={<StatsUpSquare color={colors.coral} height={24} strokeWidth={2} width={24} />} label="Average per meal" value={formatCurrency(averageSavings)} />
      </View>

      <View style={styles.goalCard}>
        <View style={styles.goalIcon}>
          <DollarCircle color={colors.coral} height={42} strokeWidth={1.8} width={42} />
        </View>
        <View style={styles.goalCopy}>
          <Text style={styles.goalTitle}>Next goal: {formatCurrency(nextGoal)} kept at home</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${goalProgress}%` }]} />
          </View>
          <View style={styles.goalFooter}>
            <Text style={styles.goalHint}>
              {mealsAway ? `You're about ${mealsAway} meal${mealsAway === 1 ? '' : 's'} away.` : 'You hit this goal. Keep the streak warm.'}
            </Text>
            <Text style={styles.goalPercent}>{goalProgress}%</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.goalButton, pressed ? styles.pressed : null]}
          onPress={goToScan}
        >
          <Text style={styles.goalButtonText}>Scan another craving</Text>
        </Pressable>
      </View>

      {recentWins.length > 0 ? (
        <View style={styles.recentCard}>
          <Text style={styles.recentTitle}>Recent wins</Text>
          <View style={styles.recentList}>
            {recentWins.map((entry) => (
              <RecentWinRow
                key={entry.id}
                entry={entry}
                onPress={entry.recipe ? () => openSavedRecipe(entry.recipe as Recipe) : undefined}
              />
            ))}
          </View>
        </View>
      ) : null}
    </SavingsFrame>
  );
}

function SavingsFrame({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function PrimaryAction({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.primaryAction, pressed ? styles.pressed : null]}
      onPress={onPress}
    >
      {icon}
      <Text style={styles.primaryActionText}>{label}</Text>
    </Pressable>
  );
}

function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statIcon}>{icon}</View>
      <View style={styles.statCopy}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={styles.statValue}>{value}</Text>
      </View>
    </View>
  );
}

function SavingsThumb({ title, uri }: { title: string; uri?: string | null }) {
  if (uri) {
    return <Image source={{ uri }} style={styles.thumbImage} />;
  }

  return (
    <View style={styles.thumbArt}>
      <Text style={styles.thumbInitials}>{getInitials(title)}</Text>
    </View>
  );
}

function RecentWinRow({ entry, onPress }: { entry: SavingsEntry; onPress?: () => void }) {
  const content = (
    <>
      <SavingsThumb title={entry.title} uri={entry.imageUri} />
      <View style={styles.recentCopy}>
        <Text numberOfLines={2} style={styles.recentDish}>{cleanDisplayText(entry.title)}</Text>
        <Text numberOfLines={1} style={styles.recentMode}>{getModeLabel(entry.mode)}</Text>
      </View>
      <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.recentAmount}>
        {formatCurrency(entry.savings)}
      </Text>
      {onPress ? <NavArrowRight color="#7b6b42" height={18} strokeWidth={2.25} width={18} /> : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.recentRow}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.recentRow, pressed ? styles.pressed : null]}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}

function toRecipeEntry(recipe: Recipe, imageUri?: string | null): SavingsEntry {
  const savings = getFiniteNumber(recipe.estimatedSavings);
  const homeCost = getFiniteNumber(recipe.estimatedHomemadeCost);

  return {
    id: `recipe-${recipe.id}`,
    title: recipe.title,
    mode: getSafeRecipeMode(recipe.mode),
    savings,
    homeCost,
    restaurantCost: homeCost + savings,
    completedAt: getOptionalDate(recipe),
    recipe,
    imageUri,
  };
}

function toChallengeEntry(challenge: CompletedChallenge): SavingsEntry {
  const savings = getFiniteNumber(challenge.moneySaved);

  return {
    id: `challenge-${challenge.id}`,
    title: challenge.recipeTitle,
    mode: getSafeRecipeMode(challenge.mode),
    savings,
    homeCost: 0,
    restaurantCost: savings,
    completedAt: challenge.completedAt,
  };
}

function filterEntriesForPeriod(entries: SavingsEntry[], period: SavingsPeriod) {
  if (period === 'all') {
    return entries;
  }

  const now = new Date();
  const start = period === 'week'
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    : new Date(now.getFullYear(), now.getMonth(), 1);

  return entries.filter((entry) => {
    if (!entry.completedAt) {
      return false;
    }

    const date = new Date(entry.completedAt);
    return Number.isFinite(date.getTime()) && date >= start && date <= now;
  });
}

function getNextGoal(total: number) {
  const goals = [25, 50, 100, 250, 500, 1000];
  return goals.find((goal) => total < goal) ?? Math.ceil((total + 1) / 500) * 500;
}

function getFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getOptionalDate(recipe: Recipe) {
  const maybeSavedAt = (recipe as Recipe & { savedAt?: unknown; createdAt?: unknown }).savedAt ??
    (recipe as Recipe & { savedAt?: unknown; createdAt?: unknown }).createdAt;

  return typeof maybeSavedAt === 'string' && maybeSavedAt.trim().length > 0 ? maybeSavedAt : null;
}

function getModeLabel(mode: RecipeMode) {
  switch (mode) {
    case 'Budget':
      return 'Budget';
    case 'Healthy':
      return 'Lighter';
    case 'Restaurant Copy':
    default:
      return 'Restaurant Style';
  }
}

function cleanDisplayText(value: string) {
  const copyWord = `copy${'cat'}`;
  const copyStyle = `${copyWord}-style`;

  return value
    .replace(new RegExp(`\\b${copyStyle}\\b`, 'gi'), 'restaurant-style')
    .replace(new RegExp(`\\b${copyWord}\\b`, 'gi'), 'restaurant-style')
    .replace(/\bdupes?\b/gi, 'swaps')
    .replace(/\bmock\b/gi, 'demo')
    .trim();
}

function getInitials(title: string) {
  const words = cleanDisplayText(title).split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase()).join('') || 'OK';
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    gap: 14,
    padding: 20,
    paddingBottom: 220,
  },
  brandHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  logoText: {
    color: colors.coral,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: 0,
  },
  screenTitle: {
    color: colors.charcoal,
    flex: 1,
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: 0,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 76,
  },
  heroCard: {
    backgroundColor: '#f1f7d8',
    borderColor: '#d8d88d',
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 124,
    overflow: 'hidden',
    padding: 16,
    shadowColor: '#3b2f20',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  heroCopy: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  heroTitle: {
    color: '#0e5528',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 27,
  },
  heroBody: {
    color: '#31543a',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 8,
  },
  heroBadge: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#fff8e8',
    borderColor: '#f4cf9c',
    borderRadius: 18,
    borderWidth: 1,
    height: 78,
    justifyContent: 'center',
    padding: 3,
    width: 78,
  },
  periodTabs: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 4,
  },
  periodTab: {
    alignItems: 'center',
    borderRadius: 19,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  periodTabSelected: {
    backgroundColor: '#1f5f29',
  },
  periodText: {
    color: colors.body,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  periodTextSelected: {
    color: '#fffdf8',
  },
  biggestCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#3b2f20',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
  },
  sectionKicker: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  biggestBody: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  biggestCopy: {
    flex: 1,
    minWidth: 0,
  },
  biggestTitle: {
    color: colors.charcoal,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 21,
  },
  biggestSavings: {
    color: colors.green,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 6,
  },
  biggestMeta: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 7,
  },
  thumbImage: {
    backgroundColor: colors.cream,
    borderRadius: 14,
    height: 64,
    width: 76,
  },
  thumbArt: {
    alignItems: 'center',
    backgroundColor: '#fff1df',
    borderColor: '#f2d9b5',
    borderRadius: 14,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    width: 76,
  },
  thumbInitials: {
    color: colors.coral,
    fontSize: 18,
    fontWeight: '700',
  },
  periodEmptyCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  periodEmptyTitle: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '700',
  },
  periodEmptyBody: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statTile: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: '48%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: 10,
    minHeight: 76,
    padding: 12,
  },
  statIcon: {
    alignItems: 'center',
    backgroundColor: '#edf5df',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  statCopy: {
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '700',
  },
  statValue: {
    color: '#174d1f',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 3,
  },
  goalCard: {
    backgroundColor: '#fff3e4',
    borderColor: '#f2c796',
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  goalIcon: {
    alignItems: 'center',
    backgroundColor: '#fffdf8',
    borderRadius: 999,
    height: 48,
    justifyContent: 'center',
    position: 'absolute',
    top: 14,
    left: 14,
    width: 48,
  },
  goalCopy: {
    marginLeft: 60,
    minHeight: 66,
  },
  goalTitle: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  progressTrack: {
    backgroundColor: '#ead8bd',
    borderRadius: 999,
    height: 10,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#6b9359',
    borderRadius: 999,
    height: '100%',
  },
  goalFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 10,
  },
  goalHint: {
    color: colors.body,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  goalPercent: {
    color: colors.coral,
    fontSize: 14,
    fontWeight: '700',
  },
  goalButton: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#fffdf8',
    borderColor: colors.green,
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  goalButtonText: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '700',
  },
  recentCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  recentTitle: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  recentList: {
    gap: 2,
  },
  recentRow: {
    alignItems: 'center',
    borderBottomColor: '#f0e4d6',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 76,
    paddingVertical: 8,
  },
  recentCopy: {
    flex: 1,
    minWidth: 0,
  },
  recentDish: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '700',
  },
  recentMode: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  recentAmount: {
    color: colors.green,
    fontSize: 16,
    fontWeight: '700',
    maxWidth: 82,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 26,
    borderWidth: 1,
    gap: 14,
    marginTop: 24,
    padding: 24,
  },
  emptyMascot: {
    marginBottom: 2,
  },
  emptyTitle: {
    color: colors.charcoal,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 31,
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.body,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  primaryAction: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.coral,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 16,
  },
  primaryActionText: {
    color: '#fffdf8',
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
});
