import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState, RecipeCard, ScreenContainer, colors } from '../components/OkyoUI';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';

type LibraryNavigation = NativeStackNavigationProp<RootStackParamList>;

export function LibraryScreen() {
  const navigation = useNavigation<LibraryNavigation>();
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const removeSavedRecipe = useOkyoStore((state) => state.removeSavedRecipe);

  if (savedRecipes.length === 0) {
    return (
      <EmptyState
        eyebrow="Library"
        title="Your saved dupes will appear here."
        body="Save a recipe from a scan result to build your local Okyo library."
      />
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.kicker}>Library</Text>
      <Text style={styles.title}>Saved recipes</Text>
      <Text style={styles.description}>
        {savedRecipes.length} local {savedRecipes.length === 1 ? 'dupe' : 'dupes'} saved.
      </Text>

      <View style={styles.cardList}>
        {savedRecipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onPress={() => navigation.navigate('RecipeDetailScreen', { mode: recipe.mode })}
            onRemove={() => removeSavedRecipe(recipe.id)}
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
