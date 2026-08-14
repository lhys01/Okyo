import { Compass, PiggyBank, Spark, StatsUpSquare } from 'iconoir-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <OnboardingBackButton onPress={onBack} />
      </View>
      <View style={styles.content}>
        <Text style={styles.headline}>What would you like Okyo to make easier?</Text>
        <View style={styles.goalList}>
          {FUTURE_PRIMARY_GOALS.map((goal) => (
            <GoalCard key={goal} goal={goal} selected={selected === goal} onPress={() => onSelect(goal)} />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const FUTURE_GOAL_LABELS: Record<FuturePrimaryGoal, string> = {
  ...primaryGoalLabels,
  not_sure: "I'm not sure yet",
};

function goalIcon(goal: FuturePrimaryGoal) {
  if (goal === 'save_money') return PiggyBank;
  if (goal === 'eat_healthier') return Spark;
  if (goal === 'hit_macros') return StatsUpSquare;
  return Compass;
}

function GoalCard({ goal, selected, onPress }: { goal: FuturePrimaryGoal; selected: boolean; onPress: () => void }) {
  const Icon = goalIcon(goal);
  return (
    <Pressable
      accessibilityLabel={FUTURE_GOAL_LABELS[goal]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.goalCard, selected && styles.goalCardSelected]}
      testID={`primary-goal-card-${goal}`}
    >
      <View style={styles.goalIcon}>
        <Icon color={selected ? '#FFFFFF' : colors.charcoal} height={30} width={30} />
      </View>
      <Text style={[styles.goalText, selected && styles.goalTextSelected]}>{FUTURE_GOAL_LABELS[goal]}</Text>
      <Text style={[styles.goalArrow, selected && styles.goalTextSelected]}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'flex-start', minHeight: ONBOARDING_BACK_ROW_HEIGHT, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: ONBOARDING_BACK_ROW_TOP_GAP },
  content: { flex: 1, justifyContent: 'center', paddingBottom: 22, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING },
  headline: { color: colors.charcoal, fontFamily: fontFamilies.personalizedDisplay, fontSize: 36, letterSpacing: -0.6, lineHeight: 42 },
  goalList: { gap: 14, marginTop: 34 },
  goalCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 26, borderWidth: 1, flexDirection: 'row', minHeight: 92, padding: 18 },
  goalCardSelected: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  goalIcon: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  goalText: { color: colors.charcoal, flex: 1, fontFamily: fontFamilies.bold, fontSize: 18, marginLeft: 10 },
  goalTextSelected: { color: '#FFFFFF' },
  goalArrow: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 25 },
});
