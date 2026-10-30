import { lazy, Suspense, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isClerkAvailable } from '../../auth/clerkRuntime';
import { analyticsEvents, track } from '../../analytics/track';
import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import type { CommitmentBranch } from '../state/branchCommitmentPersistence';
import { onboardingQuestionExperiment } from '../state/onboardingQuestionExperiment';

const SignInScreen = lazy(async () => ({ default: (await import('../../auth/SignInScreen')).SignInScreen }));
const body: Record<CommitmentBranch, string> = {
  eat_healthier: 'Save your Health Made plan so Okyo can personalize your meals.',
  save_money: 'Save your Savings Made plan so Okyo can help you cook and save.',
  hit_macros: 'Save your Macros Made plan so Okyo can keep meals aligned with your goals.',
};

export function BranchAccountScreen({ branch, onBack, onDone }: { branch: CommitmentBranch; onBack: () => void; onDone: () => void }) {
  const clerkAvailable = isClerkAvailable();
  const didTrackAccountCreationStart = useRef(false);
  useEffect(() => {
    if (!clerkAvailable) onDone();
  }, [clerkAvailable, onDone]);
  useEffect(() => {
    if (!clerkAvailable || didTrackAccountCreationStart.current) return;
    didTrackAccountCreationStart.current = true;
    void onboardingQuestionExperiment.getAssignment().then((variant) => {
      track(analyticsEvents.ACCOUNT_CREATION_STARTED, {
        experiment_name: 'branch_questions_v1',
        experiment_variant: variant,
      });
    });
  }, [clerkAvailable]);

  if (!clerkAvailable) return <Loading />;
  return <Suspense fallback={<Loading />}><SignInScreen allowSkip={false} onBack={onBack} onDone={onDone} onSkip={onDone} subtitle={body[branch]} title="Create your account." /></Suspense>;
}

function Loading() { return <View style={styles.loading}><Text style={styles.loadingText}>Loading sign-in…</Text></View>; }

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center' },
  loadingText: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 15 },
});
