import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { uiLog } from '../utils/uiDebug';
import { BadgePill, PrimaryButton, ProgressFill, RewardToast, ScreenContainer, sharedStyles } from '../components/OkyoUI';
import { mockBadges, type Badge } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { colors, radius, shadows } from '../theme/okyoTheme';

type RankingsNavigation = NativeStackNavigationProp<RootStackParamList>;

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

export function RankingsScreen() {
  const navigation = useNavigation<RankingsNavigation>();
  const xp = useOkyoStore((state) => state.xp);
  const unlockedBadges = useOkyoStore((state) => state.unlockedBadges);
  const recentBadgeUnlock = useOkyoStore((state) => state.recentBadgeUnlock);
  const clearRecentBadgeUnlock = useOkyoStore((state) => state.clearRecentBadgeUnlock);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const completedChallenges = useOkyoStore((state) => state.completedChallenges);
  const totalMoneySaved = useOkyoStore((state) => state.totalMoneySaved);
  const didTrackView = useRef(false);
  const safeXp = typeof xp === 'number' && Number.isFinite(xp) ? xp : 0;
  const safeUnlockedBadges = Array.isArray(unlockedBadges) ? unlockedBadges : [];
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

  return (
    <ScreenContainer>
      <Text style={styles.kicker}>Rankings</Text>
      <Text style={styles.title}>{getRankTitle(safeXp)}</Text>
      <Text style={styles.description}>Level {level} · {safeXp} XP</Text>

      {!hasUserActivity ? (
        <View style={styles.lowActivityCard}>
          <Text style={styles.lowActivityTitle}>Your ranking is warming up</Text>
          <Text style={styles.lowActivityText}>
            Scan, save, export a grocery list, or finish a Dupe Challenge to start earning XP.
          </Text>
        </View>
      ) : null}

      <View style={styles.xpCard}>
        <View style={styles.xpHeader}>
          <Text style={styles.xpLabel}>Progress to Level {level + 1}</Text>
          <Text style={styles.xpValue}>{xpIntoLevel}/100 XP</Text>
        </View>
        <ProgressFill progress={xpIntoLevel / 100} style={styles.progressFillMeter} />
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
                  <Text style={styles.badgeName} numberOfLines={1}>{badge.name}</Text>
                  {unlocked ? <BadgePill tone="green">Unlocked</BadgePill> : null}
                </View>
                <Text style={styles.badgeStatus} numberOfLines={2}>{unlocked ? 'Unlocked' : getBadgeHint(badge, badgeContext)}</Text>
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

      <View style={styles.leaderboardSection}>
        <Text style={styles.sectionTitle}>Rankings</Text>
        <Text style={styles.emptyRankingsTitle}>Rankings are not available yet.</Text>
        <Text style={styles.emptyRankingsBody}>
          Keep cooking with Okyo — this area will become useful when real progress data is ready.
        </Text>
      </View>
      <RewardToast
        label={recentBadge ? `${recentBadge.name} unlocked` : ''}
        tone="badge"
        visible={Boolean(recentBadge)}
      />
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
  progressFillMeter: {
    marginTop: 14,
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
    borderRadius: radius.panel,
    padding: 14,
    ...shadows.soft,
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
  emptyRankingsTitle: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyRankingsBody: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
});
