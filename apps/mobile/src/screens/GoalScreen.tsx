import { useNavigation } from '@react-navigation/native';

import { ScreenScaffold } from '../components/ScreenScaffold';

export function GoalScreen() {
  const navigation = useNavigation();

  return (
    <ScreenScaffold
      title="Pick a goal"
      body="Placeholder goal selection for the first scan flow."
      primaryActionLabel="Continue"
      onPrimaryAction={() => navigation.navigate('ScanScreen' as never)}
    />
  );
}
