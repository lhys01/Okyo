import { useNavigation } from '@react-navigation/native';

import { ScreenScaffold } from '../components/ScreenScaffold';

export function DupeChallengeScreen() {
  const navigation = useNavigation();

  return (
    <ScreenScaffold
      title="Dupe Challenge"
      body="Placeholder challenge screen for rating a homemade match."
      primaryActionLabel="Complete Challenge"
      onPrimaryAction={() => navigation.navigate('ChallengeCompleteScreen' as never)}
    />
  );
}
