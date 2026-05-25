import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenScaffold } from '../components/ScreenScaffold';

const goals = [
  'Save money',
  'Eat healthier',
  'Recreate restaurant meals',
  'Learn to cook',
  'Make food content',
];

export function GoalScreen() {
  const navigation = useNavigation();

  return (
    <ScreenScaffold
      title="Pick a goal"
      body="Choose what you want Okyo to optimize for first."
    >
      <View style={styles.goalList}>
        {goals.map((goal) => (
          <Pressable
            key={goal}
            style={styles.goalButton}
            onPress={() => navigation.navigate('ScanScreen' as never)}
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
    backgroundColor: '#ffffff',
    borderColor: '#e4d6c3',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  goalText: {
    color: '#1d1b16',
    fontSize: 16,
    fontWeight: '700',
  },
});
