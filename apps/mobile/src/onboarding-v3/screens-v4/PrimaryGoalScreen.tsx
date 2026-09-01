import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.headline}>What would you like Okyo to make easier?</Text>
        <View style={styles.goalList}>
          {FUTURE_PRIMARY_GOALS.map((goal) => (
            <GoalCard key={goal} goal={goal} selected={selected === goal} onPress={() => onSelect(goal)} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const FUTURE_GOAL_LABELS: Record<FuturePrimaryGoal, string> = {
  ...primaryGoalLabels,
  not_sure: "I'm not sure yet",
};

function goalIcon(goal: FuturePrimaryGoal) {
  if (goal === 'save_money') return require('../../../assets/onboarding-v3/stickers/fox-holding-carrot.png');
  if (goal === 'eat_healthier') return require('../../../assets/onboarding-v3/stickers/fox-drinking-water.png');
  if (goal === 'hit_macros') return require('../../../assets/onboarding-v3/stickers/fox-questioning.png');
  return require('../../../assets/onboarding-v3/stickers/fox-waving.png');
}

function GoalCard({ goal, selected, onPress }: { goal: FuturePrimaryGoal; selected: boolean; onPress: () => void }) {
  const artwork = goalIcon(goal);
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
        <Image accessibilityIgnoresInvertColors source={artwork} resizeMode="contain" style={styles.goalArtwork} />
      </View>
      <Text style={[styles.goalText, selected && styles.goalTextSelected]}>{FUTURE_GOAL_LABELS[goal]}</Text>
      <Text style={[styles.goalArrow, selected && styles.goalTextSelected]}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'flex-start', minHeight: ONBOARDING_BACK_ROW_HEIGHT, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: ONBOARDING_BACK_ROW_TOP_GAP },
  content: { flexGrow: 1, justifyContent: 'center', paddingBottom: 36, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: 18 },
  headline: { color: colors.charcoal, fontFamily: fontFamilies.personalizedDisplay, fontSize: 36, letterSpacing: -0.6, lineHeight: 42 },
  goalList: { gap: 14, marginTop: 34 },
  goalCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 26, borderWidth: 1, flexDirection: 'row', minHeight: 176, paddingHorizontal: 22, paddingVertical: 20 },
  goalCardSelected: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  goalIcon: { alignItems: 'center', height: 82, justifyContent: 'center', width: 82 },
  goalArtwork: { height: 82, width: 82 },
  goalText: { color: colors.charcoal, flex: 1, fontFamily: fontFamilies.bold, fontSize: 22, marginLeft: 16 },
  goalTextSelected: { color: '#FFFFFF' },
  goalArrow: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 25 },
});
