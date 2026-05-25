import { StyleSheet, Text, View } from 'react-native';

import { EmptyState, ScreenContainer, StatCard, colors } from '../components/OkyoUI';
import { useOkyoStore } from '../state/useOkyoStore';

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

export function SavingsDashboardScreen() {
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const completedChallenges = useOkyoStore((state) => state.completedChallenges);
  const storedMoneySaved = useOkyoStore((state) => state.totalMoneySaved);

  const savedRecipeSavings = savedRecipes.reduce(
    (total, recipe) => total + recipe.estimatedSavings,
    0,
  );
  const challengeSavings = completedChallenges.reduce(
    (total, challenge) => total + challenge.moneySaved,
    0,
  );
  const totalEstimatedSaved = savedRecipeSavings + storedMoneySaved;
  const savingsThisWeek = savedRecipeSavings + challengeSavings;
  const savingsThisMonth = totalEstimatedSaved;
  const biggestSavingsWin = Math.max(
    0,
    ...savedRecipes.map((recipe) => recipe.estimatedSavings),
    ...completedChallenges.map((challenge) => challenge.moneySaved),
  );
  const completedDupeCount = savedRecipes.length + completedChallenges.length;
  const averageSavings =
    completedDupeCount > 0 ? totalEstimatedSaved / completedDupeCount : 0;
  const hasSavingsData = completedDupeCount > 0 || totalEstimatedSaved > 0;

  if (!hasSavingsData) {
    return (
      <EmptyState
        eyebrow="Savings"
        title="No savings yet"
        body="Save dupes or complete challenges to see your estimated Okyo savings here."
      />
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.kicker}>Savings</Text>
      <Text style={styles.title}>{formatCurrency(totalEstimatedSaved)}</Text>
      <Text style={styles.description}>Total estimated money saved with Okyo.</Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Biggest savings win</Text>
        <Text style={styles.heroValue}>{formatCurrency(biggestSavingsWin)}</Text>
      </View>

      <View style={styles.grid}>
        <StatCard label="This week" value={formatCurrency(savingsThisWeek)} />
        <StatCard label="This month" value={formatCurrency(savingsThisMonth)} />
        <StatCard label="Saved dupes" value={savedRecipes.length} />
        <StatCard label="Challenges" value={completedChallenges.length} />
      </View>

      <View style={styles.averageCard}>
        <Text style={styles.averageLabel}>Average savings per dupe</Text>
        <Text style={styles.averageValue}>{formatCurrency(averageSavings)}</Text>
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
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 41,
  },
  description: {
    color: colors.body,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
  },
  heroCard: {
    backgroundColor: colors.greenSoft,
    borderRadius: 20,
    marginTop: 22,
    padding: 18,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  averageCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 16,
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
});
