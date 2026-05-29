import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState, ScreenContainer, StatCard, colors } from '../components/OkyoUI';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
type SavingsNavigation = NativeStackNavigationProp<RootStackParamList>;

export function SavingsDashboardScreen() {
  const navigation = useNavigation<SavingsNavigation>();
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const completedChallenges = useOkyoStore((state) => state.completedChallenges);
  const storedMoneySaved = useOkyoStore((state) => state.totalMoneySaved);
  const safeSavedRecipes = Array.isArray(savedRecipes) ? savedRecipes : [];
  const safeCompletedChallenges = Array.isArray(completedChallenges) ? completedChallenges : [];
  const safeStoredMoneySaved = typeof storedMoneySaved === 'number' && Number.isFinite(storedMoneySaved)
    ? storedMoneySaved
    : 0;

  const savedRecipeSavings = safeSavedRecipes.reduce(
    (total, recipe) => total + (typeof recipe?.estimatedSavings === 'number' ? recipe.estimatedSavings : 0),
    0,
  );
  const challengeSavings = safeCompletedChallenges.reduce(
    (total, challenge) => total + (typeof challenge?.moneySaved === 'number' ? challenge.moneySaved : 0),
    0,
  );
  const totalEstimatedSaved = savedRecipeSavings + safeStoredMoneySaved;
  const savingsThisWeek = savedRecipeSavings + challengeSavings;
  const savingsThisMonth = totalEstimatedSaved;
  const biggestSavingsWin = Math.max(
    0,
    ...safeSavedRecipes.map((recipe) => typeof recipe?.estimatedSavings === 'number' ? recipe.estimatedSavings : 0),
    ...safeCompletedChallenges.map((challenge) => typeof challenge?.moneySaved === 'number' ? challenge.moneySaved : 0),
  );
  const completedDupeCount = safeSavedRecipes.length + safeCompletedChallenges.length;
  const averageSavings =
    completedDupeCount > 0 ? totalEstimatedSaved / completedDupeCount : 0;
  const hasSavingsData = completedDupeCount > 0 || totalEstimatedSaved > 0;

  if (!hasSavingsData) {
    return (
      <EmptyState
        eyebrow="Savings jar"
        title="Your dupe savings will stack up here."
        body="Scan a restaurant meal, save a recipe, or finish a Dupe Challenge to start filling your Okyo savings jar with friendly estimates."
        actionLabel="Start a Scan"
        onAction={() => navigation.navigate('ScanScreen')}
      />
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.kicker}>Savings jar</Text>
      <Text style={styles.title}>You’ve kept {formatCurrency(totalEstimatedSaved)} in your kitchen.</Text>
      <Text style={styles.description}>
        A friendly estimate of what your saved recipes and Dupe Challenges may have helped you skip spending.
      </Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroEmoji}>🥘</Text>
        <View style={styles.heroCopy}>
          <Text style={styles.heroLabel}>Biggest single win</Text>
          <Text style={styles.heroValue}>{formatCurrency(biggestSavingsWin)}</Text>
          <Text style={styles.heroHint}>Your tastiest restaurant-at-home moment so far.</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Savings snapshot</Text>
        <Text style={styles.sectionBody}>Quick totals from what you’ve saved and cooked.</Text>
      </View>
      <View style={styles.grid}>
        <StatCard label="This week" value={formatCurrency(savingsThisWeek)} />
        <StatCard label="This month" value={formatCurrency(savingsThisMonth)} />
        <StatCard label="Saved dupes" value={safeSavedRecipes.length} />
        <StatCard label="Challenges" value={safeCompletedChallenges.length} />
      </View>

      <View style={styles.averageCard}>
        <Text style={styles.averageLabel}>Average per dupe</Text>
        <Text style={styles.averageValue}>{formatCurrency(averageSavings)}</Text>
        <Text style={styles.averageHint}>Small wins count. Every homemade dupe nudges the jar up.</Text>
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
    color: colors.green,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 40,
  },
  description: {
    color: colors.body,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: colors.greenSoft,
    borderRadius: 22,
    flexDirection: 'row',
    gap: 14,
    marginTop: 24,
    padding: 18,
  },
  heroEmoji: {
    fontSize: 36,
  },
  heroCopy: {
    flex: 1,
  },
  heroLabel: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '800',
  },
  heroValue: {
    color: colors.green,
    fontSize: 32,
    fontWeight: '900',
    marginTop: 4,
  },
  heroHint: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  sectionHeader: {
    marginTop: 24,
  },
  sectionTitle: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '900',
  },
  sectionBody: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  averageCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 14,
    padding: 18,
  },
  averageLabel: {
    color: colors.body,
    fontSize: 14,
    fontWeight: '800',
  },
  averageValue: {
    color: colors.charcoal,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  averageHint: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
});
