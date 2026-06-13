import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { colors, sharedStyles } from '../components/OkyoUI';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { type OnboardingGoal, useOkyoStore } from '../state/useOkyoStore';

const goals: OnboardingGoal[] = [
  'Save money',
  'Eat healthier',
  'Recreate restaurant meals',
  'Learn to cook',
  'Make food content',
];

export function GoalScreen() {
  const navigation = useNavigation();
  const setGoal = useOkyoStore((state) => state.setGoal);

  const selectGoal = (goal: OnboardingGoal) => {
    setGoal(goal);
    track(analyticsEvents.ONBOARDING_GOAL_SELECTED, { screen: 'GoalScreen', goal });
    navigation.navigate('ScanScreen' as never);
  };

  return (
    <ScreenScaffold
      title="Pick a goal"
      body="Choose what you want Okyo to optimize for first."
    >
      <View style={styles.goalList}>
        {goals.map((goal) => (
          <Pressable
            key={goal}
            style={({ pressed }) => [styles.goalButton, pressed ? styles.goalButtonPressed : null]}
            onPress={() => selectGoal(goal)}
          >
            <Text style={styles.goalText}>{goal}</Text>
          </Pressable>
        ))}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  goalList: {
    gap: 10,
    marginTop: 24,
  },
  goalButton: {
    ...sharedStyles.card,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  goalButtonPressed: {
    opacity: 0.78,
  },
  goalText: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '700',
  },
});
