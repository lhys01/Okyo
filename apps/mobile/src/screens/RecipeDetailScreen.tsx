import { useNavigation } from '@react-navigation/native';

import { ScreenScaffold } from '../components/ScreenScaffold';

export function RecipeDetailScreen() {
  const navigation = useNavigation();

  return (
    <ScreenScaffold
      title="Recipe detail"
      body="Placeholder recipe steps, ingredients, and modes."
      primaryActionLabel="Open App Tabs"
      onPrimaryAction={() => navigation.navigate('MainTabs' as never)}
      secondaryActionLabel="Grocery List"
      onSecondaryAction={() => navigation.navigate('GroceryListScreen' as never)}
    />
  );
}
