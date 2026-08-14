import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { ONBOARDING_BACK_ROW_HEIGHT, ONBOARDING_BACK_ROW_TOP_GAP, ONBOARDING_HORIZONTAL_PADDING } from '../components/onboardingLayout';
import { OnboardingCTA } from '../components/OnboardingCTA';
import type { OnboardingV4Draft } from '../state/onboardingV4Draft';
import type { OnboardingV4StageLabel } from '../state/onboardingV4Route';
import { buildHealthPlanContent, buildMacrosPlanContent, buildNotSurePlanContent, buildSavingsPlanContent, withDietarySummary, type OnboardingV4PlanContent } from './onboardingV4PlanCopy';

type Props = {
  stageLabel: OnboardingV4StageLabel | null;
  draft: OnboardingV4Draft;
  isCommitting: boolean;
  commitError: string | null;
  onBack: () => void;
  onContinue: () => void;
};

/**
 * The Step 07 compact personal-plan screen — three concrete cards derived
 * entirely from the resolved goal's real draft/calculation data (via
 * onboardingV4PlanCopy.ts's pure builders). Rendered directly, with no
 * tap-to-reveal or fake-loading gate: unlike PersonalInsightScreen (Step 05),
 * the plan is not a "surprise reveal" moment — the plan's content must be
 * visible and reviewable before the user commits to it.
 */
export function PersonalPlanScreen({ stageLabel, draft, isCommitting, commitError, onBack, onContinue }: Props) {
  const content = resolvePlanContent(draft);
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <OnboardingBackButton onPress={onBack} />
        {stageLabel ? <Text accessibilityRole="text" style={styles.stageLabel}>{stageLabel}</Text> : null}
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.headline}>{content.headline}</Text>
        {content.cards.map((card) => (
          <View key={card.title} style={styles.card}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardBody}>{card.body}</Text>
          </View>
        ))}
        {commitError ? <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.errorText}>{commitError}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        <OnboardingCTA disabled={isCommitting} label={isCommitting ? 'Saving…' : 'Continue'} onPress={onContinue} testID="personal-plan-continue" />
      </View>
    </SafeAreaView>
  );
}

function resolvePlanContent(draft: OnboardingV4Draft): OnboardingV4PlanContent {
  const branchContent = draft.initialGoal === 'not_sure'
    ? buildNotSurePlanContent(draft.notSureAnswers, draft.resolvedPrimaryGoal)
    : draft.initialGoal === 'save_money'
      ? buildSavingsPlanContent(draft.savingsAnswers)
      : draft.initialGoal === 'eat_healthier'
        ? buildHealthPlanContent(draft.healthAnswers)
        : buildMacrosPlanContent(draft.macroAnswers, draft.macroAnswers.calculatorInputs.ageYears);
  return withDietarySummary(branchContent, draft.dietaryAnswers);
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', minHeight: ONBOARDING_BACK_ROW_HEIGHT, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: ONBOARDING_BACK_ROW_TOP_GAP },
  stageLabel: { color: colors.muted, flex: 1, fontFamily: fontFamilies.bold, fontSize: 13, letterSpacing: 0.4, marginLeft: 12, textTransform: 'uppercase' },
  content: { paddingBottom: 32, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: 8 },
  headline: { color: colors.charcoal, fontFamily: fontFamilies.personalizedDisplay, fontSize: 28, letterSpacing: -0.4, lineHeight: 34 },
  card: { backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 20, borderWidth: 1, marginTop: 16, padding: 18 },
  cardTitle: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' },
  cardBody: { color: colors.charcoal, fontFamily: fontFamilies.medium, fontSize: 15, lineHeight: 21, marginTop: 8 },
  errorText: { color: colors.danger, fontFamily: fontFamilies.medium, fontSize: 13, lineHeight: 19, marginTop: 18 },
  footer: { paddingBottom: 8, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: 10 },
});
