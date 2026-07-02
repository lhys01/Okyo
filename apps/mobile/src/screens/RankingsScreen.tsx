import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { uiLog } from '../utils/uiDebug';
import { BadgePill, PrimaryButton, ScreenContainer, colors, sharedStyles } from '../components/OkyoUI';
import { mockBadges, type Badge, type LeaderboardEntry } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';

type RankingsNavigation = NativeStackNavigationProp<RootStackParamList>;

const leaderboardSections = [
  'Biggest Saver This Week',
  'Best Match Score',
  'Most Dupes Completed',
  'Best Budget Dupe',
  'Best Healthy Swap',
  'Rising Cook',
];
const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

function getLevel(xp: number) {
  return Math.floor(xp / 100) + 1;
}

function getRankTitle(xp: number) {
  if (xp >= 500) {
    return 'Dupe Master';
  }
  if (xp >= 250) {
    return 'Sauce Scholar';
  }
  if (xp >= 100) {
    return 'Kitchen Closer';
  }

  return 'Rising Cook';
}

function getBadgeHint(badge: Badge, context: {
  savedRecipeCount: number;
  completedChallengeCount: number;
  totalMoneySaved: number;
  bestMatchScore: number;
  hasBudgetSave: boolean;
  hasHealthyChallenge: boolean;
  hasPastaRecipe: boolean;
}) {
  switch (badge.id) {
    case 'first-dupe':
      return context.savedRecipeCount + context.completedChallengeCount > 0
        ? 'Ready to unlock'
        : 'Save or complete 1 dupe';
    case 'nailed-it':
      return context.bestMatchScore >= 9 ? 'Ready to unlock' : 'Earn a 9+/10 match';
    case 'budget-beast':
      return context.hasBudgetSave ? 'Ready to unlock' : 'Save $25+ on one dupe';
    case 'pasta-hacker':
      return context.hasPastaRecipe ? 'Ready to unlock' : 'Save or cook a pasta dupe';
    case 'healthy-swap-pro':
      return context.hasHealthyChallenge ? 'Ready to unlock' : 'Complete a Healthy challenge';
    case 'grocery-exporter':
      return 'Copy or share a grocery list';
    case '100-saved-club':
      return `${formatCurrency(context.totalMoneySaved)} / $100 saved`;
    default:
      return badge.description;
  }
}

function getFallbackEntries(section: string): LeaderboardEntry[] {
  const entriesBySection: Record<string, LeaderboardEntry[]> = {
    'Biggest Saver This Week': [
      { id: 'mock-saver-1', rank: 1, displayName: 'Maya', category: section, value: '$92 saved', xp: 420 },
      { id: 'mock-saver-2', rank: 2, displayName: 'Jordan', category: section, value: '$81 saved', xp: 390 },
    ],
    'Best Match Score': [
      { id: 'mock-match-1', rank: 1, displayName: 'Avery', category: section, value: '9.4/10 match', xp: 360 },
      { id: 'mock-match-2', rank: 2, displayName: 'Sam', category: section, value: '9.1/10 match', xp: 330 },
    ],
    'Most Dupes Completed': [
      { id: 'mock-dupes-1', rank: 1, displayName: 'Riley', category: section, value: '7 dupes', xp: 410 },
      { id: 'mock-dupes-2', rank: 2, displayName: 'Noah', category: section, value: '5 dupes', xp: 305 },
    ],
    'Best Budget Dupe': [
      { id: 'mock-budget-1', rank: 1, displayName: 'Priya', category: section, value: '$34 saved', xp: 300 },
      { id: 'mock-budget-2', rank: 2, displayName: 'Kai', category: section, value: '$28 saved', xp: 260 },
    ],
    'Best Healthy Swap': [
      { id: 'mock-healthy-1', rank: 1, displayName: 'Lena', category: section, value: '8.8/10 healthy', xp: 285 },
      { id: 'mock-healthy-2', rank: 2, displayName: 'Theo', category: section, value: '8.4/10 healthy', xp: 245 },
    ],
    'Rising Cook': [
      { id: 'mock-rising-1', rank: 1, displayName: 'Morgan', category: section, value: '+140 XP', xp: 270 },
      { id: 'mock-rising-2', rank: 2, displayName: 'Jess', category: section, value: '+120 XP', xp: 240 },
    ],
  };

  return entriesBySection[section] ?? [];
}

export function RankingsScreen() {
  const navigation = useNavigation<RankingsNavigation>();
  const xp = useOkyoStore((state) => state.xp);
  const unlockedBadges = useOkyoStore((state) => state.unlockedBadges);
  const recentBadgeUnlock = useOkyoStore((state) => state.recentBadgeUnlock);
  const clearRecentBadgeUnlock = useOkyoStore((state) => state.clearRecentBadgeUnlock);
  const leaderboardEntries = useOkyoStore((state) => state.leaderboardEntries);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const completedChallenges = useOkyoStore((state) => state.completedChallenges);
  const totalMoneySaved = useOkyoStore((state) => state.totalMoneySaved);
  const didTrackView = useRef(false);
  const safeXp = typeof xp === 'number' && Number.isFinite(xp) ? xp : 0;
  const safeUnlockedBadges = Array.isArray(unlockedBadges) ? unlockedBadges : [];
  const safeLeaderboardEntries = Array.isArray(leaderboardEntries) ? leaderboardEntries : [];
  const safeSavedRecipes = Array.isArray(savedRecipes) ? savedRecipes : [];
  const safeCompletedChallenges = Array.isArray(completedChallenges) ? completedChallenges : [];
  const safeTotalMoneySaved = typeof totalMoneySaved === 'number' && Number.isFinite(totalMoneySaved)
    ? totalMoneySaved
    : 0;
  const safeBadges = Array.isArray(mockBadges) && mockBadges.length > 0 ? mockBadges : [];
  const level = getLevel(safeXp);
  const nextLevelXp = level * 100;
  const xpIntoLevel = safeXp % 100;
  const bestMatchScore = Math.max(
    0,
    ...safeCompletedChallenges.map((challenge) => typeof challenge?.matchScore === 'number' ? challenge.matchScore : 0),
  );
  const bestSavings = Math.max(
    0,
    ...safeSavedRecipes.map((recipe) => typeof recipe?.estimatedSavings === 'number' ? recipe.estimatedSavings : 0),
    ...safeCompletedChallenges.map((challenge) => typeof challenge?.moneySaved === 'number' ? challenge.moneySaved : 0),
  );
  const savedRecipeCount = safeSavedRecipes.length;
  const completedChallengeCount = safeCompletedChallenges.length;
  const hasBudgetSave = safeSavedRecipes.some((recipe) => recipe?.mode === 'Budget' && recipe?.estimatedSavings >= 25);
  const hasHealthyChallenge = safeCompletedChallenges.some((challenge) => challenge?.mode === 'Healthy');
  const hasPastaRecipe = [
    ...safeSavedRecipes.map((recipe) => recipe?.title ?? ''),
    ...safeCompletedChallenges.map((challenge) => challenge?.recipeTitle ?? ''),
  ].some((title) => title.toLowerCase().includes('pasta') || title.toLowerCase().includes('rigatoni'));
  const recentBadge = safeBadges.find((badge) => badge.id === recentBadgeUnlock);
  const hasUserActivity = safeXp > 0 || savedRecipeCount > 0 || completedChallengeCount > 0;
  const badgeContext = {
    savedRecipeCount,
    completedChallengeCount,
    totalMoneySaved: safeTotalMoneySaved,
    bestMatchScore,
    hasBudgetSave,
    hasHealthyChallenge,
    hasPastaRecipe,
  };

  useEffect(() => {
    if (didTrackView.current) {
      return;
    }

    uiLog('RankingsScreen', 'enter', { xp: safeXp });

    didTrackView.current = true;
    track(analyticsEvents.LEADERBOARD_VIEWED, {
      screen: 'RankingsScreen',
      xpAmount: safeXp,
    });
  }, [safeXp]);

  const getUserValueForSection = (section: string) => {
    switch (section) {
      case 'Biggest Saver This Week':
        return `${formatCurrency(safeTotalMoneySaved + safeSavedRecipes.reduce((total, recipe) => total + (typeof recipe?.estimatedSavings === 'number' ? recipe.estimatedSavings : 0), 0))} saved`;
      case 'Best Match Score':
        return bestMatchScore > 0 ? `${bestMatchScore.toFixed(1)}/10 match` : 'No score yet';
      case 'Most Dupes Completed':
        return `${savedRecipeCount + completedChallengeCount} dupes`;
      case 'Best Budget Dupe':
        return hasBudgetSave ? `${formatCurrency(bestSavings)} saved` : 'Try Budget mode';
      case 'Best Healthy Swap':
        return hasHealthyChallenge ? `${bestMatchScore.toFixed(1)}/10 healthy` : 'Try Healthy mode';
      case 'Rising Cook':
      default:
        return `+${safeXp} XP`;
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.kicker}>Rankings</Text>
      <Text style={styles.title}>{getRankTitle(safeXp)}</Text>
      <Text style={styles.description}>Level {level} · {safeXp} XP</Text>

      {!hasUserActivity ? (
        <View style={styles.lowActivityCard}>
          <Text style={styles.lowActivityTitle}>Your ranking is warming up</Text>
          <Text style={styles.lowActivityText}>
            Scan, save, export a grocery list, or finish a Dupe Challenge to start earning XP. Mock leaderboards are still shown below.
          </Text>
        </View>
      ) : null}

      <View style={styles.xpCard}>
        <View style={styles.xpHeader}>
          <Text style={styles.xpLabel}>Progress to Level {level + 1}</Text>
          <Text style={styles.xpValue}>{xpIntoLevel}/100 XP</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${xpIntoLevel}%` }]} />
        </View>
        <Text style={styles.progressHint}>{nextLevelXp - xp} XP to next level</Text>
      </View>

      {recentBadge ? (
        <View style={styles.unlockBanner}>
          <View>
            <Text style={styles.unlockLabel}>New badge unlocked</Text>
            <Text style={styles.unlockTitle}>{recentBadge.name}</Text>
          </View>
          <Pressable style={styles.dismissButton} onPress={clearRecentBadgeUnlock}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Badges</Text>
        <View style={styles.badgeGrid}>
          {safeBadges.map((badge) => {
            const unlocked = safeUnlockedBadges.includes(badge.id);
            return (
              <View key={badge.id} style={[styles.badgeCard, unlocked ? styles.badgeUnlocked : null]}>
                <View style={styles.badgeHeader}>
                  <Text style={styles.badgeName}>{badge.name}</Text>
                  {unlocked ? <BadgePill tone="green">Unlocked</BadgePill> : null}
                </View>
                <Text style={styles.badgeStatus}>{unlocked ? 'Unlocked' : getBadgeHint(badge, badgeContext)}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.shareAction}>
        <PrimaryButton onPress={() => { uiLog('RankingsScreen', 'share_ranking'); navigation.navigate('ShareCardPreviewScreen', { cardType: 'ranking' }); }}>
          Share Ranking
        </PrimaryButton>
      </View>

      {leaderboardSections.map((section) => {
        const seededEntries = safeLeaderboardEntries.filter((entry) => entry?.category === section);
        const entries = seededEntries.length > 0 ? seededEntries : getFallbackEntries(section);
        const userEntry: LeaderboardEntry = {
          id: `you-${section}`,
          rank: 3,
          displayName: 'You',
          category: section,
          value: getUserValueForSection(section),
          xp: safeXp,
        };

        return (
          <View key={section} style={styles.leaderboardSection}>
            <Text style={styles.sectionTitle}>{section}</Text>
            {[...entries.slice(0, 2), userEntry].map((entry) => (
              <View key={entry.id} style={[styles.leaderRow, entry.displayName === 'You' ? styles.userRow : null]}>
                <Text style={styles.rank}>#{entry.rank}</Text>
                <View style={styles.leaderInfo}>
                  <Text style={styles.leaderName}>{entry.displayName}</Text>
                  <Text style={styles.leaderValue}>{entry.value}</Text>
                </View>
                <Text style={styles.leaderXp}>{entry.xp} XP</Text>
              </View>
            ))}
          </View>
        );
      })}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: colors.coral,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.charcoal,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 37,
  },
  description: {
    color: colors.body,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
  },
  xpCard: {
    ...sharedStyles.card,
    marginTop: 22,
    padding: 18,
  },
  lowActivityCard: {
    backgroundColor: colors.cream,
    borderRadius: 18,
    marginTop: 18,
    padding: 16,
  },
  lowActivityTitle: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '700',
  },
  lowActivityText: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xpLabel: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '700',
  },
  xpValue: {
    color: colors.green,
    fontSize: 15,
    fontWeight: '700',
  },
  progressTrack: {
    backgroundColor: colors.border,
    borderRadius: 999,
    height: 12,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.coral,
    height: '100%',
  },
  progressHint: {
    color: colors.body,
    fontSize: 13,
    marginTop: 10,
  },
  unlockBanner: {
    alignItems: 'center',
    backgroundColor: colors.greenSoft,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    padding: 16,
  },
  unlockLabel: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  unlockTitle: {
    color: colors.green,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  dismissButton: {
    borderColor: '#9fcfb3',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dismissText: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    ...sharedStyles.card,
    marginTop: 14,
    padding: 18,
  },
  sectionTitle: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  badgeGrid: {
    gap: 10,
  },
  badgeCard: {
    backgroundColor: colors.cream,
    borderRadius: 16,
    padding: 14,
  },
  badgeUnlocked: {
    backgroundColor: colors.greenSoft,
  },
  badgeHeader: {
    alignItems: 'flex-start',
    gap: 8,
  },
  badgeName: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '700',
  },
  badgeStatus: {
    color: colors.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  shareAction: {
    marginTop: 14,
  },
  leaderboardSection: {
    ...sharedStyles.card,
    marginTop: 14,
    padding: 18,
  },
  leaderRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
  },
  userRow: {
    backgroundColor: colors.cream,
  },
  rank: {
    color: colors.coral,
    fontSize: 14,
    fontWeight: '700',
    width: 36,
  },
  leaderInfo: {
    flex: 1,
  },
  leaderName: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '700',
  },
  leaderValue: {
    color: colors.body,
    fontSize: 13,
    marginTop: 2,
  },
  leaderXp: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '700',
  },
});
