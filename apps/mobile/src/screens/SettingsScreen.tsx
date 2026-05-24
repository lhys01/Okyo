import { useNavigation } from '@react-navigation/native';

import { ScreenScaffold } from '../components/ScreenScaffold';

export function SettingsScreen() {
  const navigation = useNavigation();

  return (
    <ScreenScaffold
      title="Settings"
      body="Placeholder settings, privacy, and support screen."
      primaryActionLabel="View Okyo Plus"
      onPrimaryAction={() => navigation.navigate('PaywallScreen' as never)}
    />
  );
}
