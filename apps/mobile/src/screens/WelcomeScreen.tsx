import { useNavigation } from '@react-navigation/native';

import { ScreenScaffold } from '../components/ScreenScaffold';

export function WelcomeScreen() {
  const navigation = useNavigation();

  return (
    <ScreenScaffold
      title="Turn restaurant meals into homemade dupes."
      body="Scan a dish, get the recipe, see what it costs to make at home."
      primaryActionLabel="Scan a Meal"
      onPrimaryAction={() => navigation.navigate('GoalScreen' as never)}
    />
  );
}
