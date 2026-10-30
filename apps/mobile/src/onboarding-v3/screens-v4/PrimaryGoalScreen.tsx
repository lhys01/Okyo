import * as Haptics from 'expo-haptics';
import { Check } from 'iconoir-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { ONBOARDING_BACK_ROW_HEIGHT, ONBOARDING_BACK_ROW_TOP_GAP, ONBOARDING_HORIZONTAL_PADDING } from '../components/onboardingLayout';
import { FUTURE_PRIMARY_GOALS, primaryGoalLabels, type FuturePrimaryGoal } from '../state/personalizedOnboarding';

type Props = {
  selected: FuturePrimaryGoal | null;
  onBack: () => void;
  onSelect: (goal: FuturePrimaryGoal) => void;
};

/**
 * The one place in the whole codebase that iterates `FUTURE_PRIMARY_GOALS`
 * (not `PRIMARY_GOALS`) — makes `not_sure` genuinely selectable for the first
 * time (Okyo_Onboarding_V4_Implementation_Plan.md Step 03). `personalizedOnboarding.ts`
 * is read-only here per Step 03's scope: `primaryGoalLabels` is reused as-is
 * for the three real goals, and `not_sure`'s label is defined locally since
 * that map doesn't (and per Step 04, shouldn't) cover it.
 */
export function PrimaryGoalScreen({ selected, onBack, onSelect }: Props) {
  const [choice, setChoice] = useState(selected);
  const choose = (goal: FuturePrimaryGoal) => {
    if (choice === goal) return;
    setChoice(goal);
    void Haptics.selectionAsync().catch(() => undefined);
  };
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <OnboardingBackButton onPress={onBack} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.headline}>What matters most to you?</Text>
        <Text style={styles.description}>Same dish. A little more you.</Text>
        <View accessibilityRole="radiogroup" style={styles.goalList}>
          {FUTURE_PRIMARY_GOALS.map((goal) => (
            <GoalRow key={goal} goal={goal} selected={choice === goal} onPress={() => choose(goal)} />
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable accessibilityLabel={choice === 'not_sure' ? 'Try my first recipe' : 'Continue with selected goal'} accessibilityRole="button" accessibilityState={{ disabled: !choice }} disabled={!choice} onPress={() => { if (choice) onSelect(choice); }} style={({ pressed }) => [styles.primary, !choice && styles.disabled, pressed && styles.pressed]} testID="primary-goal-continue">
          <Text style={styles.primaryLabel}>{choice === 'not_sure' ? 'Try my first recipe' : 'Continue'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const FUTURE_GOAL_LABELS: Record<FuturePrimaryGoal, string> = {
  ...primaryGoalLabels,
  not_sure: 'Just show me',
};

const GOAL_DETAILS: Record<FuturePrimaryGoal, { description: string; color: string }> = {
  save_money: { description: 'Keep the craving. Understand the cost.', color: colors.mint },
  eat_healthier: { description: 'More balance in food I actually want.', color: colors.healthSoft },
  hit_macros: { description: 'See the numbers that matter to me.', color: colors.lavender },
  not_sure: { description: 'Skip personalization. Try my first recipe.', color: colors.creamDeep },
};

function GoalRow({ goal, selected, onPress }: { goal: FuturePrimaryGoal; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={FUTURE_GOAL_LABELS[goal]}
      accessibilityHint={GOAL_DETAILS[goal].description}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.goalRow, selected && { backgroundColor: GOAL_DETAILS[goal].color }, pressed && styles.pressed]}
      testID={`primary-goal-card-${goal}`}
    >
      <View style={styles.rowCopy}>
        <Text style={styles.goalText}>{FUTURE_GOAL_LABELS[goal]}</Text>
        <Text style={styles.goalDetail}>{GOAL_DETAILS[goal].description}</Text>
      </View>
      <View style={[styles.indicator, selected && styles.indicatorChecked]}>
        {selected ? <Check color={colors.surfaceMuted} height={16} width={16} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.surfaceMuted, flex: 1 },
  header: { alignItems: 'flex-start', minHeight: ONBOARDING_BACK_ROW_HEIGHT, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: ONBOARDING_BACK_ROW_TOP_GAP },
  content: { flexGrow: 1, paddingBottom: 16, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: 16 },
  headline: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 28, letterSpacing: -0.7, lineHeight: 34 },
  description: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 22, marginTop: 8 },
  goalList: { gap: 4, marginTop: 20 },
  goalRow: { alignItems: 'center', borderBottomColor: colors.border, borderRadius: 16, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 70, paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  rowCopy: { flex: 1 },
  goalText: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 17, lineHeight: 23 },
  goalDetail: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 18, marginTop: 2 },
  indicator: { height: 24, width: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.body, alignItems: 'center', justifyContent: 'center' },
  indicatorChecked: { backgroundColor: colors.ink, borderColor: colors.ink },
  footer: { paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingVertical: 12 },
  primary: { minHeight: 58, paddingHorizontal: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.coral, borderRadius: 24 },
  primaryLabel: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 17, lineHeight: 24, textAlign: 'center' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
});
