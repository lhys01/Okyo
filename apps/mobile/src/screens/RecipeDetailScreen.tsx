import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { uiLog } from '../utils/uiDebug';
import {
  BadgePill,
  ModeTabs,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  StatCard,
  colors,
  sharedStyles,
} from '../components/OkyoUI';
import {
  defaultScanResult,
  getSafeRecipeForMode,
  getSafeRecipeMode,
  isRecipeMode,
  type RecipeMode,
} from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
type RecipeDetailNavigation = NativeStackNavigationProp<RootStackParamList, 'RecipeDetailScreen'>;
type RecipeDetailRoute = RouteProp<RootStackParamList, 'RecipeDetailScreen'>;

export function RecipeDetailScreen() {
  const navigation = useNavigation<RecipeDetailNavigation>();
  const route = useRoute<RecipeDetailRoute>();
  const routeMode = route.params?.mode;
  const initialMode = getSafeRecipeMode(routeMode ?? defaultScanResult.modes[0]);
  const storeSelectedMode = useOkyoStore((state) => state.selectedMode);
  const setStoreSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const saveRecipe = useOkyoStore((state) => state.saveRecipe);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const [selectedMode, setSelectedMode] = useState<RecipeMode>(
    getSafeRecipeMode(initialMode ?? storeSelectedMode),
  );
  const recipe = getSafeRecipeForMode(selectedMode);

  useEffect(() => {
    const safeMode = getSafeRecipeMode(routeMode ?? storeSelectedMode);
    setSelectedMode(safeMode);

    uiLog('RecipeDetailScreen', 'enter', { routeMode, safeMode });

    if (routeMode && !isRecipeMode(routeMode)) {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: 'Recipe mode was missing or invalid.',
        screen: 'RecipeDetailScreen',
      });
    }
  }, [routeMode, storeSelectedMode]);

  const chooseMode = (mode: RecipeMode) => {
    setSelectedMode(mode);
    setStoreSelectedMode(mode);
    uiLog('RecipeDetailScreen', 'choose_mode', { mode });
    track(analyticsEvents.MODE_SELECTED, {
      dishName: recipe.title,
      mode,
      screen: 'RecipeDetailScreen',
    });
  };

  const saveSelectedRecipe = () => {
    const alreadySaved = savedRecipes.some((savedRecipe) => savedRecipe.id === recipe.id);
    uiLog('RecipeDetailScreen', 'save_recipe', { recipeId: recipe.id });
    saveRecipe(recipe);
    if (!alreadySaved) {
      awardXPOnce(`save-recipe-${recipe.id}`, 5);
    }
    unlockBadge('first-dupe');
    track(analyticsEvents.RECIPE_SAVED, {
      dishName: recipe.title,
      mode: recipe.mode,
      savings: recipe.estimatedSavings,
      screen: 'RecipeDetailScreen',
    });
    Alert.alert('Saved', `${recipe.title} was added to your library.`);
  };

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>Recipe</Text>
        <BadgePill tone="dark">{selectedMode}</BadgePill>
      </View>

      <Text style={styles.title}>{recipe.title}</Text>
      <Text style={styles.description}>{recipe.description}</Text>
      {!isRecipeMode(routeMode ?? storeSelectedMode) ? (
        <View style={styles.fallbackNote}>
          <Text style={styles.fallbackNoteText}>
            We could not find that mode, so Okyo is showing Restaurant Copy.
          </Text>
        </View>
      ) : null}

      <ModeTabs modes={defaultScanResult.modes} selectedMode={selectedMode} onSelectMode={chooseMode} />

      <View style={styles.statsGrid}>
        <StatCard label="Prep" value={`${recipe.prepTimeMinutes} min`} />
        <StatCard label="Cook" value={`${recipe.cookTimeMinutes} min`} />
        <StatCard label="Difficulty" value={recipe.difficulty} />
        <StatCard label="Cost" value={formatCurrency(recipe.estimatedHomemadeCost)} />
      </View>

      <View style={styles.savingsCard}>
        <Text style={styles.savingsLabel}>Estimated savings</Text>
        <Text style={styles.savingsValue}>{formatCurrency(recipe.estimatedSavings)}</Text>
        <Text style={styles.savingsNote}>
          Compared with a {formatCurrency(defaultScanResult.restaurantPrice)} restaurant estimate.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {(Array.isArray(recipe.ingredients) ? recipe.ingredients : []).length > 0 ? (
          recipe.ingredients.map((ingredient) => (
          <Text key={`${recipe.id}-${ingredient.name}`} style={styles.listItem}>
            {ingredient.quantity} {ingredient.name}
            {ingredient.pantryItem ? ' (pantry)' : ''}
          </Text>
          ))
        ) : (
          <Text style={styles.listItem}>Ingredients are not available for this mock recipe yet.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Instructions</Text>
        {(Array.isArray(recipe.steps) ? recipe.steps : []).length > 0 ? (
          recipe.steps.map((step, index) => (
          <View key={`${recipe.id}-step-${step}`} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
          ))
        ) : (
          <Text style={styles.listItem}>Steps are not available yet. Try Restaurant Copy mode.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Substitutions</Text>
        {(Array.isArray(recipe.substitutions) ? recipe.substitutions : []).length > 0 ? (
          recipe.substitutions.map((substitution) => (
          <Text key={`${recipe.id}-${substitution}`} style={styles.listItem}>
            {substitution}
          </Text>
          ))
        ) : (
          <Text style={styles.listItem}>No substitutions listed yet.</Text>
        )}
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Pantry note</Text>
        <Text style={styles.noteText}>{recipe.pantryNote}</Text>
        <Text style={styles.confidenceText}>{recipe.confidenceNote}</Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton onPress={saveSelectedRecipe}>Save Recipe</PrimaryButton>
        <SecondaryButton onPress={() => navigation.navigate('GroceryListScreen', { mode: selectedMode })}>
          Grocery List
        </SecondaryButton>
        <SecondaryButton onPress={() => navigation.navigate('DupeChallengeScreen', { mode: selectedMode })}>
          Start Dupe Challenge
        </SecondaryButton>
        <SecondaryButton onPress={() => navigation.navigate('ShareCardPreviewScreen', { cardType: 'scan_result', mode: selectedMode })}>
          Share Dupe
        </SecondaryButton>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  kicker: {
    color: colors.coral,
    fontSize: 13,
    fontWeight: '900',
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
  fallbackNote: {
    backgroundColor: colors.cream,
    borderRadius: 16,
    marginTop: 14,
    padding: 14,
  },
  fallbackNoteText: {
    color: colors.body,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 20,
  },
  savingsCard: {
    backgroundColor: colors.greenSoft,
    borderRadius: 20,
    marginTop: 12,
    padding: 16,
  },
  savingsLabel: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '800',
  },
  savingsValue: {
    color: colors.green,
    fontSize: 30,
    fontWeight: '900',
    marginTop: 2,
  },
  savingsNote: {
    color: '#3f6a52',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  section: {
    ...sharedStyles.card,
    marginTop: 14,
    padding: 18,
  },
  sectionTitle: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  listItem: {
    color: colors.charcoal,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  stepNumber: {
    backgroundColor: colors.coral,
    borderRadius: 999,
    color: '#fffdf8',
    fontSize: 13,
    fontWeight: '900',
    height: 25,
    lineHeight: 25,
    overflow: 'hidden',
    textAlign: 'center',
    width: 25,
  },
  stepText: {
    color: colors.charcoal,
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  noteCard: {
    backgroundColor: colors.cream,
    borderRadius: 20,
    marginTop: 14,
    padding: 18,
  },
  noteTitle: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
  },
  noteText: {
    color: colors.charcoal,
    fontSize: 15,
    lineHeight: 22,
  },
  confidenceText: {
    color: colors.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  actions: {
    gap: 10,
    marginTop: 20,
  },
});
