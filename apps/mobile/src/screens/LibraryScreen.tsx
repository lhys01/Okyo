import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { uiLog } from '../utils/uiDebug';
import { EmptyState, RecipeCard, ScreenContainer, colors } from '../components/OkyoUI';
import { getSafeRecipeMode } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';

type LibraryNavigation = NativeStackNavigationProp<RootStackParamList>;

export function LibraryScreen() {
  const navigation = useNavigation<LibraryNavigation>();
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const removeSavedRecipe = useOkyoStore((state) => state.removeSavedRecipe);
  const didTrackMalformedData = useRef(false);
  const safeSavedRecipes = Array.isArray(savedRecipes) ? savedRecipes : [];
  const malformedRecipeCount = safeSavedRecipes.filter((recipe) => !recipe?.id || !recipe?.title).length;

  useEffect(() => {
    if (didTrackMalformedData.current || malformedRecipeCount === 0) {
      return;
    }

    uiLog('LibraryScreen', 'enter', { malformedRecipeCount });

    didTrackMalformedData.current = true;
    track(analyticsEvents.RESULT_ERROR, {
      errorMessage: 'Saved recipe data was missing fields.',
      screen: 'LibraryScreen',
    });
  }, [malformedRecipeCount]);

  if (safeSavedRecipes.length === 0) {
    return (
      <EmptyState
        eyebrow="Library"
        title="Your saved dupes will appear here."
        body="Save a recipe from a scan result to build your local Okyo library."
        actionLabel="Start a Scan"
        onAction={() => navigation.navigate('ScanScreen')}
      />
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.kicker}>Library</Text>
      <Text style={styles.title}>Saved recipes</Text>
      <Text style={styles.description}>
        {safeSavedRecipes.length} local {safeSavedRecipes.length === 1 ? 'dupe' : 'dupes'} saved.
      </Text>

      <View style={styles.cardList}>
        {safeSavedRecipes.map((recipe, index) => (
          <RecipeCard
            key={recipe?.id ?? `saved-recipe-${index}`}
            recipe={recipe}
            onPress={() => { uiLog('LibraryScreen', 'open_saved_recipe', { recipeId: recipe?.id }); navigation.navigate('RecipeDetailScreen', { mode: getSafeRecipeMode(recipe?.mode) }); }}
            onRemove={() => recipe?.id ? (uiLog('LibraryScreen', 'remove_saved_recipe', { recipeId: recipe.id }), removeSavedRecipe(recipe.id)) : undefined}
          />
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: colors.coral,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.charcoal,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 37,
  },
  description: {
    color: colors.body,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
  },
  cardList: {
    gap: 14,
    marginTop: 22,
  },
});
