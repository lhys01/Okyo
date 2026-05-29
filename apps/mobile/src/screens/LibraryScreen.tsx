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
  const savedRecipeLabel = safeSavedRecipes.length === 1 ? 'recipe tucked away' : 'recipes tucked away';

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
        eyebrow="Recipe shelf"
        title="Your cozy recipe shelf is waiting."
        body="Scan a meal you are craving, save the copycat-style recipe you love, and Okyo will keep it tucked here for your next dinner win."
        <Text style={styles.kicker}>Recipe shelf</Text>
        <Text style={styles.title}>Your saved Okyo bites</Text>
          A cozy little shelf for the restaurant-inspired recipes you want to cook again. Tap any card to open it, or clear out the ones you are done with.
          <View style={styles.libraryNoteWrap}>
            <Text style={styles.libraryNoteTitle}>Dinner ideas, ready when you are</Text>
            <Text style={styles.libraryNote}>Saved locally on this device for quick remake nights.</Text>
          </View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>On your shelf</Text>
        <Text style={styles.sectionHint}>Copycat-style favorites worth making at home.</Text>
      </View>

            onPress={() => {
              uiLog('LibraryScreen', 'open_saved_recipe', { recipeId: recipe?.id });
              navigation.navigate('RecipeDetailScreen', { mode: getSafeRecipeMode(recipe?.mode) });
            }}
    borderRadius: 28,
    padding: 20,
    letterSpacing: 0.5,
    fontSize: 31,
    lineHeight: 36,
    backgroundColor: colors.cream,
    borderRadius: 22,
    marginTop: 20,
    padding: 12,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    minWidth: 98,
    paddingHorizontal: 12,
    marginTop: 3,
    textAlign: 'center',
  libraryNoteWrap: {
  },
  libraryNoteTitle: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },
  libraryNote: {
    color: colors.body,
    marginTop: 3,
  },
  sectionHeader: {
    marginTop: 26,
    fontSize: 19,
  },
  sectionHint: {
    color: colors.body,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 4,
    marginTop: 14,
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
