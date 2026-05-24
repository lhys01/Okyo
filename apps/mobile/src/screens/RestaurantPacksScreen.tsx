import { useNavigation } from '@react-navigation/native';

import { ScreenScaffold } from '../components/ScreenScaffold';

export function RestaurantPacksScreen() {
  const navigation = useNavigation();

  return (
    <ScreenScaffold
      title="Restaurant Packs"
      body="Placeholder list of static restaurant packs."
      primaryActionLabel="Open Placeholder Pack"
      onPrimaryAction={() => navigation.navigate('RestaurantPackDetailScreen' as never)}
    />
  );
}
