import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { uiLog } from '../utils/uiDebug';
import { EmptyState, RecipeCard, ScreenContainer, colors } from '../components/OkyoUI';
import { getSafeRecipeMode, isRecipeMode, type Recipe } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';

type LibraryNavigation = NativeStackNavigationProp<RootStackParamList>;

export function LibraryScreen() {
  const navigation = useNavigation<LibraryNavigation>();
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const removeSavedRecipe = useOkyoStore((state) => state.removeSavedRecipe);
  const setLatestAiDebugMetadata = useOkyoStore((state) => state.setLatestAiDebugMetadata);
  const setLatestScanFailure = useOkyoStore((state) => state.setLatestScanFailure);
  const setLatestScanRecipe = useOkyoStore((state) => state.setLatestScanRecipe);
  const setLatestScanRecipes = useOkyoStore((state) => state.setLatestScanRecipes);
  const setLatestScanResult = useOkyoStore((state) => state.setLatestScanResult);
  const setLatestScanStatus = useOkyoStore((state) => state.setLatestScanStatus);
  const setSelectedScanImage = useOkyoStore((state) => state.setSelectedScanImage);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const didTrackMalformedData = useRef(false);
  const safeSavedRecipes = Array.isArray(savedRecipes) ? savedRecipes : [];
  const savedRecipeLabel = safeSavedRecipes.length === 1 ? 'recipe saved' : 'recipes saved';
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


  const openSavedRecipe = (recipe: Recipe | null | undefined) => {
    if (!recipe?.id) {
      return;
    }

    const mode = getSafeRecipeMode(recipe.mode);
    uiLog('LibraryScreen', 'open_saved_recipe', { recipeId: recipe.id });
    setLatestAiDebugMetadata(null);
    setLatestScanFailure(null);
    setLatestScanRecipe(recipe);
    setLatestScanRecipes([recipe]);
    setLatestScanResult(null);
    setLatestScanStatus(null);
    setSelectedScanImage(null);
    if (isRecipeMode(recipe.mode)) {
      setSelectedMode(recipe.mode);
    }
    navigation.navigate('RecipeDetailScreen', { mode });
  };

  if (safeSavedRecipes.length === 0) {
    return (
      <EmptyState
        eyebrow="Recipe shelf"
        title="Your saved dupes will cozy up here."
        body="Scan a restaurant meal, save the inspired-by recipe you want to remake, and Okyo will start building your little dinner shelf."
        actionLabel="Scan a Meal"
        onAction={() => navigation.navigate('ScanScreen')}
      />
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.headerCard}>
        <Text style={styles.kicker}>Recipe shelf</Text>
        <Text style={styles.title}>Saved recipes worth remaking</Text>
        <Text style={styles.description}>
          Your restaurant-at-home favorites, tucked away for low-effort dinner ideas. Tap any recipe to cook it again.
        </Text>

        <View style={styles.libraryMetaRow}>
          <View style={styles.libraryMetaPill}>
            <Text style={styles.libraryMetaValue}>{safeSavedRecipes.length}</Text>
            <Text style={styles.libraryMetaLabel}>{savedRecipeLabel}</Text>
          </View>
          <Text style={styles.libraryNote}>Kept on this device for easy dinner repeats.</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>On your shelf</Text>
        <Text style={styles.sectionBody}>Pick a cozy favorite and bring it back to the table.</Text>
      </View>

      <View style={styles.cardList}>
        {safeSavedRecipes.map((recipe, index) => (
          <RecipeCard
            key={recipe?.id ?? `saved-recipe-${index}`}
            recipe={recipe}
            onPress={() => openSavedRecipe(recipe)}
            onRemove={() => recipe?.id ? (uiLog('LibraryScreen', 'remove_saved_recipe', { recipeId: recipe.id }), removeSavedRecipe(recipe.id)) : undefined}
          />
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#2f231a',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
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
  libraryMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  libraryMetaPill: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 18,
    minWidth: 92,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  libraryMetaValue: {
    color: colors.charcoal,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
  },
  libraryMetaLabel: {
    color: colors.body,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  libraryNote: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  sectionHeader: {
    marginTop: 24,
  },
  sectionLabel: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '900',
  },
  sectionBody: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  cardList: {
    gap: 14,
    marginTop: 12,
  },
});
