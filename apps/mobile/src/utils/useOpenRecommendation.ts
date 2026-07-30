import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RecommendationRecipe } from '../data/recommendedRecipes';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { uiLog } from './uiDebug';

// Recommendations are registered by their own ID and never written into scan or
// Recent state. Recipe screens still resolve them through the same exact-ID map.
export function useOpenRecommendation() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const registerRecipe = useOkyoStore((state) => state.registerRecipe);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);

  return (recipe: RecommendationRecipe) => {
    uiLog('Recommendation', 'open_recipe', { recipeId: recipe.id });
    registerRecipe(recipe, 'recommendation');
    setSelectedMode(recipe.mode);
    navigation.navigate('MainTabs', {
      screen: 'RecipeDetailScreen',
      params: { mode: recipe.mode, recipeId: recipe.id },
    });
  };
}
