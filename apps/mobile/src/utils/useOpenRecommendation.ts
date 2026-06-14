import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RecommendationRecipe } from '../data/recommendedRecipes';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { uiLog } from './uiDebug';

// Opens a non-scan recommendation recipe in Recipe Detail by loading it into the
// store the same way saved recipes are opened (writeSavedRecipeContext). This
// clears any scan image/result, so the recipe shows honestly with no fake scan
// photo and no fake savings — and it never touches the scan flow.
export function useOpenRecommendation() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const writeSavedRecipeContext = useOkyoStore((state) => state.writeSavedRecipeContext);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);

  return (recipe: RecommendationRecipe) => {
    uiLog('Recommendation', 'open_recipe', { recipeId: recipe.id });
    writeSavedRecipeContext({
      recipe,
      reason: 'open_recommendation',
      source: 'useOpenRecommendation',
    });
    setSelectedMode(recipe.mode);
    navigation.navigate('RecipeDetailScreen', { mode: recipe.mode });
  };
}
