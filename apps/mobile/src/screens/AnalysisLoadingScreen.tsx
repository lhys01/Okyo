import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native';

import { ScreenScaffold } from '../components/ScreenScaffold';

export function AnalysisLoadingScreen() {
  const navigation = useNavigation();

  return (
    <ScreenScaffold
      title="Building your homemade dupe"
      body="Placeholder analysis state. Real AI is not connected yet."
      primaryActionLabel="Show Result"
      onPrimaryAction={() => navigation.navigate('ResultSummaryScreen' as never)}
    >
      <Text>Identifying the dish...</Text>
    </ScreenScaffold>
  );
}
