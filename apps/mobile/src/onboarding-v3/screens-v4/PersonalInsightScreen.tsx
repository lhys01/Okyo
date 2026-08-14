import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { useReduceMotion } from '../motion/useReduceMotion';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { ONBOARDING_BACK_ROW_HEIGHT, ONBOARDING_BACK_ROW_TOP_GAP, ONBOARDING_HORIZONTAL_PADDING } from '../components/onboardingLayout';
import { OnboardingCTA } from '../components/OnboardingCTA';
import type { OnboardingV4Draft } from '../state/onboardingV4Draft';
import type { OnboardingV4StageLabel } from '../state/onboardingV4Route';
import { buildHealthInsight, buildMacroInsight, buildNotSureInsight, buildSavingsInsight } from './onboardingV4BranchCopy';

type Props = {
  stageLabel: OnboardingV4StageLabel | null;
  draft: OnboardingV4Draft;
  onBack: () => void;
  onContinue: () => void;
  onRevealed?: () => void;
};

/**
 * The shared insight screen for all four branches (Okyo_Onboarding_V4_Implementation_Plan.md
 * Step 05). Tap-to-reveal is the accessible default — no hold gesture — and
 * Reduce Motion is respected by skipping the reveal fade entirely rather
 * than shortening it. Content is entirely answer-derived via
 * `onboardingV4BranchCopy.ts`'s pure builders; nothing here is a fabricated
 * default (no "150g protein"/"2,100 calories" placeholders).
 */
export function PersonalInsightScreen({ stageLabel, draft, onBack, onContinue, onRevealed }: Props) {
  const [revealed, setRevealed] = useState(false);
  const reduceMotion = useReduceMotion();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <OnboardingBackButton onPress={onBack} />
        {stageLabel ? <Text accessibilityRole="text" style={styles.stageLabel}>{stageLabel}</Text> : null}
      </View>
      <View style={styles.content}>
        {revealed ? (
          <InsightContent draft={draft} />
        ) : (
          <Pressable
            accessibilityHint="Shows your personalized starting insight"
            accessibilityLabel="Reveal your insight"
            accessibilityRole="button"
            onPress={() => { setRevealed(true); onRevealed?.(); }}
            style={[styles.revealButton, reduceMotion && styles.revealButtonNoElevation]}
            testID="personal-insight-reveal"
          >
            <Text style={styles.revealText}>Tap to see your plan</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.footer}>
        <OnboardingCTA disabled={!revealed} label="Continue" onPress={onContinue} testID="personal-insight-continue" />
      </View>
    </SafeAreaView>
  );
}

function InsightContent({ draft }: { draft: OnboardingV4Draft }) {
  if (draft.initialGoal === 'not_sure') {
    return (
      <>
        <Text style={styles.headline}>{buildNotSureInsight(draft.resolvedPrimaryGoal)}</Text>
        <Text style={styles.note}>You started out not sure — we'll keep learning what works for you.</Text>
      </>
    );
  }

  if (draft.initialGoal === 'save_money') {
    const insight = buildSavingsInsight(draft.savingsAnswers);
    if (insight.isZeroFrequency) {
      return (
        <>
          <Text style={styles.headline}>{insight.headline}</Text>
          <Text style={styles.note}>{insight.formulaNote}</Text>
        </>
      );
    }
    return (
      <>
        <Text style={styles.headline}>{insight.headline}</Text>
        <View style={styles.rangeRows}>
          <Text style={styles.rangeRow}>{insight.weeklyLine}</Text>
          <Text style={styles.rangeRow}>{insight.monthlyLine}</Text>
          <Text style={styles.rangeRow}>{insight.yearlyLine}</Text>
        </View>
        <Text style={styles.note}>{insight.formulaNote}</Text>
      </>
    );
  }

  if (draft.initialGoal === 'eat_healthier') {
    const insight = buildHealthInsight(draft.healthAnswers);
    return (
      <>
        <Text style={styles.headline}>{insight.headline}</Text>
        {insight.exampleLine ? <Text style={styles.example}>{insight.exampleLine}</Text> : null}
        {insight.barrierNote ? <Text style={styles.note}>{insight.barrierNote}</Text> : null}
      </>
    );
  }

  // hit_macros
  const insight = buildMacroInsight(draft.macroAnswers, draft.macroAnswers.calculatorInputs.ageYears);
  if (insight.minorMessage) {
    return (
      <>
        <Text style={styles.headline}>{insight.headline}</Text>
        <Text style={styles.note}>{insight.minorMessage}</Text>
      </>
    );
  }
  return (
    <>
      <Text style={styles.headline}>{insight.headline}</Text>
      {insight.rangeOrTargetLine ? <Text style={styles.rangeRow}>{insight.rangeOrTargetLine}</Text> : null}
      {insight.focusNote ? <Text style={styles.note}>{insight.focusNote}</Text> : null}
      {insight.disclaimer ? <Text style={styles.note}>{insight.disclaimer}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', minHeight: ONBOARDING_BACK_ROW_HEIGHT, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: ONBOARDING_BACK_ROW_TOP_GAP },
  stageLabel: { color: colors.muted, flex: 1, fontFamily: fontFamilies.bold, fontSize: 13, letterSpacing: 0.4, marginLeft: 12, textTransform: 'uppercase' },
  content: { flex: 1, justifyContent: 'center', paddingBottom: 22, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING },
  revealButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 24, borderWidth: 1, minHeight: 120, justifyContent: 'center', paddingHorizontal: 24 },
  revealButtonNoElevation: { elevation: 0, shadowOpacity: 0 },
  revealText: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 18, textAlign: 'center' },
  headline: { color: colors.charcoal, fontFamily: fontFamilies.personalizedDisplay, fontSize: 28, letterSpacing: -0.4, lineHeight: 34 },
  rangeRows: { gap: 6, marginTop: 18 },
  rangeRow: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 18, marginTop: 6 },
  example: { color: colors.body, fontFamily: fontFamilies.medium, fontSize: 15, marginTop: 14 },
  note: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 13, marginTop: 14 },
  footer: { paddingBottom: 8, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: 10 },
});
