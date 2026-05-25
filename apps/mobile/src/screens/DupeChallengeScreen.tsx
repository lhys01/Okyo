import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { uiLog } from '../utils/uiDebug';
import { BadgePill, PrimaryButton, ScreenContainer, colors, sharedStyles } from '../components/OkyoUI';
import {
  defaultScanResult,
  getSafeRecipeForMode,
  getSafeRecipeMode,
  isRecipeMode,
  type RecipeMode,
} from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { type ChallengeRating, useOkyoStore } from '../state/useOkyoStore';

type DupeChallengeNavigation = NativeStackNavigationProp<RootStackParamList, 'DupeChallengeScreen'>;
type DupeChallengeRoute = RouteProp<RootStackParamList, 'DupeChallengeScreen'>;

const ratings: Array<{ label: ChallengeRating; matchScore: number }> = [
  { label: 'Nailed it', matchScore: 9.2 },
  { label: 'Pretty close', matchScore: 8.1 },
  { label: 'Needs work', matchScore: 6.4 },
  { label: 'Not close', matchScore: 4.2 },
];
const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

function getBadgeForChallenge(recipeTitle: string, mode: RecipeMode, rating: ChallengeRating, savings: number) {
  if (rating === 'Nailed it') {
    return 'nailed-it';
  }
  if (savings >= 25) {
    return 'budget-beast';
  }
  if (recipeTitle.toLowerCase().includes('rigatoni') || recipeTitle.toLowerCase().includes('pasta')) {
    return 'pasta-hacker';
  }
  if (mode === 'Healthy') {
    return 'healthy-swap-pro';
  }

  return 'first-dupe';
}

export function DupeChallengeScreen() {
  const navigation = useNavigation<DupeChallengeNavigation>();
  const route = useRoute<DupeChallengeRoute>();
  const storeSelectedMode = useOkyoStore((state) => state.selectedMode);
  const rawMode = route.params?.mode ?? storeSelectedMode;
  const selectedMode = getSafeRecipeMode(rawMode);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const completeChallenge = useOkyoStore((state) => state.completeChallenge);
  const incrementMoneySaved = useOkyoStore((state) => state.incrementMoneySaved);
  const addXP = useOkyoStore((state) => state.addXP);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const totalMoneySaved = useOkyoStore((state) => state.totalMoneySaved);
  const [isCooked, setIsCooked] = useState(false);
  const startedXpAdded = useRef(false);
  const completionLocked = useRef(false);
  const recipe = getSafeRecipeForMode(selectedMode);

  useEffect(() => {
    setSelectedMode(selectedMode);
    if (!startedXpAdded.current) {
      uiLog('DupeChallengeScreen', 'enter', { mode: selectedMode });
      track(analyticsEvents.CHALLENGE_STARTED, {
        dishName: recipe.title,
        mode: selectedMode,
        savings: recipe.estimatedSavings,
        screen: 'DupeChallengeScreen',
      });
      if (!isRecipeMode(rawMode)) {
        track(analyticsEvents.RESULT_ERROR, {
          errorMessage: 'Challenge mode was missing or invalid.',
          screen: 'DupeChallengeScreen',
        });
      }
      awardXPOnce(`start-dupe-challenge-${recipe.id}`, 15);
      startedXpAdded.current = true;
    }
  }, [awardXPOnce, rawMode, recipe.estimatedSavings, recipe.id, recipe.title, selectedMode, setSelectedMode]);

  const finishChallenge = (rating: ChallengeRating, matchScore: number) => {
    if (completionLocked.current) {
      return;
    }

    completionLocked.current = true;
    uiLog('DupeChallengeScreen', 'finish_challenge', { rating, matchScore, recipeId: recipe.id });
    const savings = recipe.estimatedSavings;
    const bonusXp = matchScore >= 8 ? 25 : 0;
    const savingsXp = savings >= 25 ? 25 : 0;
    const xpEarned = 40 + bonusXp + savingsXp;
    const badgeUnlocked = getBadgeForChallenge(recipe.title, selectedMode, rating, savings);
    const challengeId = `challenge-${recipe.id}-${Date.now()}`;

    track(analyticsEvents.ACCURACY_RATING_SUBMITTED, {
      dishName: recipe.title,
      mode: selectedMode,
      rating,
      screen: 'DupeChallengeScreen',
    });

    completeChallenge({
      id: challengeId,
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      mode: selectedMode,
      rating,
      completedAt: new Date().toISOString(),
      matchScore,
      moneySaved: savings,
      xpEarned,
      badgeUnlocked,
    });
    incrementMoneySaved(savings);
    addXP(xpEarned);
    unlockBadge('first-dupe');
    unlockBadge(badgeUnlocked);
    if (totalMoneySaved + savings >= 100) {
      unlockBadge('100-saved-club');
    }
    track(analyticsEvents.CHALLENGE_COMPLETED, {
      badgeName: badgeUnlocked,
      dishName: recipe.title,
      mode: selectedMode,
      rating,
      savings,
      screen: 'DupeChallengeScreen',
      xpAmount: xpEarned,
    });
    navigation.navigate('ChallengeCompleteScreen', { challengeId });
  };

  return (
    <ScreenContainer>
      <Text style={styles.kicker}>Dupe Challenge</Text>
      <Text style={styles.title}>{recipe.title}</Text>
      <Text style={styles.description}>
        Cook the mock recipe, compare it with the restaurant version, then rate how close you got.
      </Text>
      {!isRecipeMode(rawMode) ? (
        <View style={styles.fallbackNote}>
          <Text style={styles.fallbackNoteText}>
            We could not find that challenge mode, so Okyo is using Restaurant Copy.
          </Text>
        </View>
      ) : null}

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Mode</Text>
          <BadgePill tone="dark">{selectedMode}</BadgePill>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Dish</Text>
          <Text style={styles.summaryValue}>{defaultScanResult.dishName}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Estimated savings</Text>
          <Text style={styles.savingsValue}>{formatCurrency(recipe.estimatedSavings)}</Text>
        </View>
      </View>

      <View style={styles.instructionsCard}>
        <Text style={styles.sectionTitle}>Challenge steps</Text>
        <Text style={styles.instruction}>1. Cook the selected Okyo recipe.</Text>
        <Text style={styles.instruction}>2. Taste it next to your restaurant memory.</Text>
        <Text style={styles.instruction}>3. Rate taste, texture, and appearance as one match score.</Text>
      </View>

      {!isCooked ? (
        <View style={styles.primaryAction}>
          <PrimaryButton onPress={() => { uiLog('DupeChallengeScreen', 'mark_cooked', { recipeId: recipe.id }); setIsCooked(true); }}>Mark Cooked</PrimaryButton>
        </View>
      ) : (
        <View style={styles.ratingCard}>
          <Text style={styles.sectionTitle}>Rate the match</Text>
          <Text style={styles.ratingHelp}>Choose the closest overall result.</Text>
          {ratings.map((rating) => (
            <Pressable
              key={rating.label}
              style={styles.ratingButton}
              onPress={() => finishChallenge(rating.label, rating.matchScore)}
            >
              <Text style={styles.ratingLabel}>{rating.label}</Text>
              <Text style={styles.ratingScore}>{rating.matchScore.toFixed(1)}/10</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.returnAction}>
        <PrimaryButton onPress={() => navigation.navigate('RecipeDetailScreen', { mode: selectedMode })}>
          Back to Recipe
        </PrimaryButton>
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
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 37,
  },
  description: {
    color: colors.body,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
  },
  fallbackNote: {
    backgroundColor: colors.cream,
    borderRadius: 16,
    marginTop: 14,
    padding: 14,
  },
  fallbackNoteText: {
    color: colors.body,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  summaryCard: {
    ...sharedStyles.card,
    marginTop: 22,
    padding: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  summaryLabel: {
    color: colors.body,
    flex: 1,
    fontSize: 14,
  },
  summaryValue: {
    color: colors.charcoal,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
  },
  savingsValue: {
    color: colors.green,
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
  instructionsCard: {
    backgroundColor: colors.cream,
    borderRadius: 20,
    marginTop: 14,
    padding: 18,
  },
  sectionTitle: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  instruction: {
    color: colors.charcoal,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  primaryAction: {
    marginTop: 20,
  },
  ratingCard: {
    ...sharedStyles.card,
    marginTop: 18,
    padding: 18,
  },
  ratingHelp: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  ratingButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  ratingLabel: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '800',
  },
  ratingScore: {
    color: colors.green,
    fontSize: 15,
    fontWeight: '900',
  },
  returnAction: {
    marginTop: 12,
  },
});
