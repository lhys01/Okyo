import { useNavigation } from '@react-navigation/native';

import { ScreenScaffold } from '../components/ScreenScaffold';

export function ScanScreen() {
  const navigation = useNavigation();

  return (
    <ScreenScaffold
      title="Scan a meal"
      body="Placeholder scan/upload screen. Camera and image picker come later."
      primaryActionLabel="Use Placeholder Meal"
      onPrimaryAction={() => navigation.navigate('AnalysisLoadingScreen' as never)}
    />
  );
}
