import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { uiLog } from '../utils/uiDebug';
import { EmptyState, PrimaryButton, ScreenContainer, SecondaryButton, StatCard } from '../components/OkyoUI';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { colors } from '../theme/okyoTheme';

type ChallengeCompleteNavigation = NativeStackNavigationProp<RootStackParamList, 'ChallengeCompleteScreen'>;
type ChallengeCompleteRoute = RouteProp<RootStackParamList, 'ChallengeCompleteScreen'>;
const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

export function ChallengeCompleteScreen() {
  const navigation = useNavigation<ChallengeCompleteNavigation>();
  const route = useRoute<ChallengeCompleteRoute>();
  const completedChallenges = useOkyoStore((state) => state.completedChallenges);
  const didTrackMissingChallenge = useRef(false);
  const safeCompletedChallenges = Array.isArray(completedChallenges) ? completedChallenges : [];
  const challenge =
    safeCompletedChallenges.find((completedChallenge) => completedChallenge.id === route.params?.challengeId) ??
    safeCompletedChallenges[safeCompletedChallenges.length - 1];

  useEffect(() => {
    if (didTrackMissingChallenge.current || challenge) {
      return;
    }

    uiLog('ChallengeCompleteScreen', 'enter', { challengeId: route.params?.challengeId });

    didTrackMissingChallenge.current = true;
    track(analyticsEvents.RESULT_ERROR, {
      errorMessage: 'Challenge complete opened without a completed challenge.',
      screen: 'ChallengeCompleteScreen',
    });
  }, [challenge]);

  if (!challenge) {
    return (
      <EmptyState
        eyebrow="Challenge complete"
        title="No challenge result yet"
        body="Complete a Dupe Challenge to see your score and savings."
        actionLabel="Start a Scan"
        onAction={() => navigation.navigate('ScanScreen')}
      />
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.kicker}>Challenge complete</Text>
      <Text style={styles.title}>{challenge.recipeTitle}</Text>
      <Text style={styles.description}>
        You rated this {challenge.rating.toLowerCase()} and logged your estimated savings.
      </Text>

      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>Match score</Text>
        <Text style={styles.scoreValue}>{challenge.matchScore.toFixed(1)}/10</Text>
      </View>

      <View style={styles.grid}>
        <StatCard label="Mode" value={challenge.mode} />
        <StatCard label="Savings earned" value={formatCurrency(challenge.moneySaved)} tone="savings" />
        <StatCard label="XP earned" value={`+${challenge.xpEarned}`} />
        <StatCard label="Badge" value={challenge.badgeUnlocked ?? 'None'} />
      </View>

      <View style={styles.actions}>
        <PrimaryButton onPress={() => { uiLog('ChallengeCompleteScreen', 'share_result', { challengeId: challenge.id }); navigation.navigate('ShareCardPreviewScreen', { cardType: 'challenge_result', mode: challenge.mode }); }}>
          Share Result
        </PrimaryButton>
        <SecondaryButton onPress={() => navigation.navigate('MainTabs')}>Back to Tabs</SecondaryButton>
      </View>
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
  scoreCard: {
    backgroundColor: colors.greenSoft,
    borderRadius: 20,
    marginTop: 22,
    padding: 18,
  },
  scoreLabel: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '800',
  },
  scoreValue: {
    color: colors.green,
    fontSize: 38,
    fontWeight: '700',
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  actions: {
    gap: 10,
    marginTop: 20,
  },
});
