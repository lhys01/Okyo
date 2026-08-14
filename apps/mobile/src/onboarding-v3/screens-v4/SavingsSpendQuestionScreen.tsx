import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { ONBOARDING_BACK_ROW_HEIGHT, ONBOARDING_BACK_ROW_TOP_GAP, ONBOARDING_HORIZONTAL_PADDING } from '../components/onboardingLayout';
import { OnboardingCTA } from '../components/OnboardingCTA';
import { BRANCH_Q2_TITLE, SAVINGS_Q2_HELPER, SAVINGS_SPEND_DEFAULT, SAVINGS_SPEND_MAX, SAVINGS_SPEND_MIN, SAVINGS_SPEND_STEP } from './onboardingV4BranchCopy';
import type { OnboardingV4StageLabel } from '../state/onboardingV4Route';

type Props = {
  stageLabel: OnboardingV4StageLabel | null;
  value: number | null;
  onChange: (value: number) => void;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
};

/** The one branch question that isn't single-select (Save Money's Q2, a dollar-amount stepper) — kept as its own small screen rather than overloading BranchQuestionScreen with a second control type. */
export function SavingsSpendQuestionScreen({ stageLabel, value, onChange, onBack, onContinue, canContinue }: Props) {
  const current = value ?? SAVINGS_SPEND_DEFAULT;
  const display = current >= SAVINGS_SPEND_MAX ? `$${SAVINGS_SPEND_MAX}+` : `$${current}`;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <OnboardingBackButton onPress={onBack} />
        {stageLabel ? <Text accessibilityRole="text" style={styles.stageLabel}>{stageLabel}</Text> : null}
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{BRANCH_Q2_TITLE.save_money}</Text>
        <View style={styles.stage}>
          <Text style={styles.giantValue}>{display}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityLabel="Decrease"
              accessibilityRole="button"
              onPress={() => onChange(Math.max(SAVINGS_SPEND_MIN, current - SAVINGS_SPEND_STEP))}
              style={styles.roundButton}
            >
              <Text style={styles.roundButtonText}>−</Text>
            </Pressable>
            <View style={styles.track}>
              <View style={[styles.trackFill, { width: `${((current - SAVINGS_SPEND_MIN) / (SAVINGS_SPEND_MAX - SAVINGS_SPEND_MIN)) * 100}%` }]} />
            </View>
            <Pressable
              accessibilityLabel="Increase"
              accessibilityRole="button"
              onPress={() => onChange(Math.min(SAVINGS_SPEND_MAX, current + SAVINGS_SPEND_STEP))}
              style={styles.roundButton}
            >
              <Text style={styles.roundButtonText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.helper}>{SAVINGS_Q2_HELPER}</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <OnboardingCTA disabled={!canContinue} label="Continue" onPress={() => onContinue()} testID="savings-spend-continue" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', minHeight: ONBOARDING_BACK_ROW_HEIGHT, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: ONBOARDING_BACK_ROW_TOP_GAP },
  stageLabel: { color: colors.muted, flex: 1, fontFamily: fontFamilies.bold, fontSize: 13, letterSpacing: 0.4, marginLeft: 12, textTransform: 'uppercase' },
  content: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingBottom: 22, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING },
  title: { color: colors.charcoal, fontFamily: fontFamilies.personalizedDisplay, fontSize: 30, letterSpacing: -0.5, lineHeight: 36, textAlign: 'center' },
  stage: { alignItems: 'center', marginTop: 34 },
  giantValue: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 56 },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 16, marginTop: 24 },
  roundButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 24, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 },
  roundButtonText: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 24 },
  track: { backgroundColor: colors.border, borderRadius: 4, height: 6, overflow: 'hidden', width: 120 },
  trackFill: { backgroundColor: colors.charcoal, height: '100%' },
  helper: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 13, marginTop: 18 },
  footer: { paddingBottom: 8, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: 10 },
});
