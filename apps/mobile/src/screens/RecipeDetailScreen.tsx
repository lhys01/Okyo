import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import type { AiDebugMetadata } from '../api/types';
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
  type Recipe,
  type RecipeMode,
} from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
type RecipeDetailNavigation = NativeStackNavigationProp<RootStackParamList, 'RecipeDetailScreen'>;
type RecipeDetailRoute = RouteProp<RootStackParamList, 'RecipeDetailScreen'>;
type DisplayRecipeStep = {
  text: string;
  timeEstimate?: string;
  visualCue?: string;
  whyItMatters?: string;
  safetyNote?: string;
  flavorBoost?: string;
  cookingTerm?: NonNullable<Recipe['cookingTerms']>[number];
};

export function RecipeDetailScreen() {
  const navigation = useNavigation<RecipeDetailNavigation>();
  const route = useRoute<RecipeDetailRoute>();
  const routeMode = route.params?.mode;
  const initialMode = getSafeRecipeMode(routeMode ?? defaultScanResult.modes[0]);
  const storeSelectedMode = useOkyoStore((state) => state.selectedMode);
  const setStoreSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const latestScanResult = useOkyoStore((state) => state.latestScanResult);
  const latestScanRecipes = useOkyoStore((state) => state.latestScanRecipes);
  const latestScanStatus = useOkyoStore((state) => state.latestScanStatus);
  const saveRecipe = useOkyoStore((state) => state.saveRecipe);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const latestAiDebugMetadata = useOkyoStore((state) => state.latestAiDebugMetadata);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const [selectedMode, setSelectedMode] = useState<RecipeMode>(
    getSafeRecipeMode(initialMode ?? storeSelectedMode),
  );
  const isDemoScan = isExplicitDemoScan(selectedScanImage);
  const storedRecipe = getStoredRecipeForMode(latestScanRecipes, selectedMode, latestScanRecipe);
  const recipe = storedRecipe ?? (isDemoScan ? getSafeRecipeForMode(selectedMode) : null);
  const scanResult = latestScanResult ?? (isDemoScan ? defaultScanResult : null);
  const recipeSourceLabel = getRecipeSourceLabel(latestAiDebugMetadata);
  const restaurantPrice = scanResult?.restaurantPrice ?? getEstimatedRestaurantPrice(recipe);
  const availableModes = scanResult?.modes ?? getAvailableModes(latestScanRecipes, latestScanRecipe, isDemoScan);
  const spicePairings = getSafeTextList(recipe?.spicePairings);
  const cookingTerms = getSafeCookingTerms(recipe?.cookingTerms);
  const ingredientGroups = getSafeIngredientGroups(recipe);
  const equipment = getSafeTextList(recipe?.equipment);
  const displaySteps = getRecipeDisplaySteps(recipe);
  const isGeneratedRecipeMissing = Boolean(
    latestScanStatus === 'success' &&
    latestScanResult &&
    latestAiDebugMetadata?.aiSource === 'openrouter_ai' &&
    !storedRecipe,
  );

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
      dishName: recipe?.title ?? scanResult?.dishName ?? 'Missing recipe',
      mode,
      screen: 'RecipeDetailScreen',
    });
  };

  const saveSelectedRecipe = () => {
    if (!recipe) {
      return;
    }

    const alreadySaved = savedRecipes.some((savedRecipe) => savedRecipe.id === recipe.id);
    uiLog('RecipeDetailScreen', 'save_recipe', { recipeId: recipe.id });
    saveRecipe(recipe);
    if (!alreadySaved) {
      awardXPOnce(`save-recipe-${recipe.id}`, 5);
    }
    unlockBadge('first-dupe');
    track(analyticsEvents.RECIPE_SAVED, {
      dishName: recipe?.title ?? scanResult?.dishName ?? 'Missing recipe',
      mode: recipe.mode,
      savings: recipe.estimatedSavings,
      screen: 'RecipeDetailScreen',
    });
    Alert.alert('Saved', `${recipe.title} was added to your library.`);
  };

  const openShareDupe = () => {
    if (!recipe) {
      return;
    }

    navigation.navigate('ShareCardPreviewScreen', {
      cardType: 'scan_result',
      mode: selectedMode,
      scanContext: {
        image: selectedScanImage,
        recipe,
        scanResult,
      },
    });
  };

  if (!recipe) {
    return (
      <ScreenContainer>
        <View style={styles.headerRow}>
          <Text style={styles.kicker}>Recipe issue</Text>
          <BadgePill tone="dark">{selectedMode}</BadgePill>
        </View>
        <Text style={styles.title}>This recipe needs another try.</Text>
        <Text style={styles.description}>
          {scanResult
            ? `Okyo scanned ${scanResult.dishName}, but no safe ${selectedMode} recipe was returned for this real photo.`
            : 'Okyo needs a completed scan before it can show a real recipe.'}
        </Text>
        <View style={styles.fallbackNote}>
          <Text style={styles.fallbackNoteText}>
            No mock pasta recipe is shown for real scan data. Try scanning again or use Try Demo Scan from the scan screen.
          </Text>
        </View>
        <View style={styles.actions}>
          <PrimaryButton onPress={() => navigation.navigate('ScanScreen')}>Try Another Photo</PrimaryButton>
          <SecondaryButton onPress={() => navigation.navigate('MainTabs')}>Back Home</SecondaryButton>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>Recipe</Text>
        <BadgePill tone="dark">{selectedMode}</BadgePill>
      </View>

      <Text style={styles.title}>{recipe.title}</Text>
      <Text style={styles.description}>{recipe.description}</Text>
      {__DEV__ && recipeSourceLabel ? (
        <Text style={styles.aiDebugLine}>{recipeSourceLabel}</Text>
      ) : null}
      {!isRecipeMode(routeMode ?? storeSelectedMode) ? (
        <View style={styles.fallbackNote}>
          <Text style={styles.fallbackNoteText}>
            We could not find that mode, so Okyo is showing Restaurant Copy.
          </Text>
        </View>
      ) : null}
      {isGeneratedRecipeMissing ? (
        <View style={styles.fallbackNote}>
          <Text style={styles.fallbackNoteText}>
            Okyo did not receive a generated {selectedMode} recipe for this scan, so this mode is showing a local starter fallback.
          </Text>
        </View>
      ) : null}

      <ModeTabs modes={availableModes} selectedMode={selectedMode} onSelectMode={chooseMode} />

      <View style={styles.statsGrid}>
        <StatCard label="Prep" value={`${recipe.prepTimeMinutes} min`} />
        <StatCard label="Cook" value={`${recipe.cookTimeMinutes} min`} />
        <StatCard label="Total" value={`${recipe.totalTimeMinutes ?? recipe.prepTimeMinutes + recipe.cookTimeMinutes} min`} />
        {recipe.activeTimeMinutes ? (
          <StatCard label="Active" value={`${recipe.activeTimeMinutes} min`} />
        ) : null}
        <StatCard label="Serves" value={`${recipe.servings}`} />
        <StatCard label="Skill" value={recipe.skillLevel ?? recipe.difficulty} />
        <StatCard label="Cost" value={formatCurrency(recipe.estimatedHomemadeCost)} />
      </View>

      <View style={styles.savingsCard}>
        <Text style={styles.savingsLabel}>Estimated savings</Text>
        <Text style={styles.savingsValue}>{formatCurrency(recipe.estimatedSavings)}</Text>
        <Text style={styles.savingsNote}>
          Compared with a {formatCurrency(restaurantPrice)} restaurant estimate.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What you're making</Text>
        <Text style={styles.listItem}>{recipe.description}</Text>
        {recipe.mainIngredientsSummary ? (
          <Text style={styles.listItem}>Main ingredients: {recipe.mainIngredientsSummary}</Text>
        ) : null}
        {recipe.bestFor ? (
          <Text style={styles.listItem}>Best for: {recipe.bestFor}</Text>
        ) : null}
        {equipment.length > 0 ? (
          <Text style={styles.listItem}>Equipment: {equipment.join(', ')}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {ingredientGroups.length > 0 ? (
          ingredientGroups.map((group) => (
            <View key={`${recipe.id}-${group.component}`} style={styles.ingredientGroup}>
              <Text style={styles.groupTitle}>{group.component}</Text>
              {group.items.map((ingredient) => (
                <Text key={`${recipe.id}-${group.component}-${ingredient.name}`} style={styles.listItem}>
                  {formatIngredient(ingredient)}
                  {ingredient.pantryItem ? ' (pantry)' : ''}
                </Text>
              ))}
            </View>
          ))
        ) : (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).length > 0 ? (
          recipe.ingredients.map((ingredient) => (
          <Text key={`${recipe.id}-${ingredient.name}`} style={styles.listItem}>
            {formatIngredient(ingredient)}
            {ingredient.pantryItem ? ' (pantry)' : ''}
          </Text>
          ))
        ) : (
          <Text style={styles.listItem}>Ingredients are not available for this recipe yet.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Instructions</Text>
        {displaySteps.length > 0 ? (
          displaySteps.map((step, index) => {
            const stepTerms = step.cookingTerm ? [step.cookingTerm] : getStepCookingTerms(step.text, cookingTerms);
            const stepBoosters = step.flavorBoost
              ? [step.flavorBoost]
              : getStepBoosters(step.text, index, displaySteps.length, spicePairings);

            return (
              <View key={`${recipe.id}-step-${step.text}`} style={styles.stepBlock}>
                <View style={styles.stepRow}>
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepText}>{step.text}</Text>
                    {step.timeEstimate || step.visualCue ? (
                      <Text style={styles.stepMeta}>
                        {[step.timeEstimate, step.visualCue].filter(Boolean).join(' • ')}
                      </Text>
                    ) : null}
                    {step.safetyNote ? (
                      <Text style={styles.stepMeta}>Safety: {step.safetyNote}</Text>
                    ) : null}
                    {step.whyItMatters ? (
                      <Text style={styles.stepMeta}>Why it matters: {step.whyItMatters}</Text>
                    ) : null}
                  </View>
                </View>
                {stepBoosters.length > 0 ? (
                  <View style={styles.stepBoostCard}>
                    <Text style={styles.stepBoostLabel}>Optional boost</Text>
                    <View style={styles.chipRow}>
                      {stepBoosters.map((pairing) => (
                        <Text key={`${recipe.id}-step-${index}-pairing-${pairing}`} style={styles.flavorChip}>
                          {pairing}
                        </Text>
                      ))}
                    </View>
                  </View>
                ) : null}
                {stepTerms.map((term) => (
                  <View key={`${recipe.id}-step-${index}-term-${term.term}`} style={styles.termTipCard}>
                    <Text style={styles.termName}>What does {term.term.toLowerCase()} mean?</Text>
                    <Text style={styles.termMeaning}>{term.meaning}</Text>
                  </View>
                ))}
              </View>
            );
          })
        ) : (
          <Text style={styles.listItem}>Steps are not available yet. Try Restaurant Copy mode.</Text>
        )}
      </View>

      {recipe.avoidMistake ? (
        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Avoid this mistake</Text>
          <Text style={styles.noteText}>{recipe.avoidMistake}</Text>
        </View>
      ) : null}

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

      {recipe.storageAndReheating ? (
        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Storage and reheating</Text>
          <Text style={styles.noteText}>{recipe.storageAndReheating}</Text>
        </View>
      ) : null}

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Pantry note</Text>
        <Text style={styles.noteText}>{recipe.pantryNote}</Text>
        <Text style={styles.confidenceText}>{recipe.confidenceNote}</Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton onPress={openShareDupe}>Share Dupe</PrimaryButton>
        <SecondaryButton onPress={saveSelectedRecipe}>Save Recipe</SecondaryButton>
        <SecondaryButton onPress={() => navigation.navigate('GroceryListScreen', { mode: selectedMode })}>
          Grocery List
        </SecondaryButton>
        <SecondaryButton onPress={() => navigation.navigate('DupeChallengeScreen', { mode: selectedMode })}>
          Start Dupe Challenge
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
  aiDebugLine: {
    color: '#315399',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 8,
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
  stepBoostCard: {
    backgroundColor: '#fff7ed',
    borderColor: '#ffd0b8',
    borderRadius: 14,
    borderWidth: 1,
    marginLeft: 35,
    marginTop: -2,
    padding: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flavorChip: {
    backgroundColor: '#fffdf8',
    borderColor: '#ffd0b8',
    borderRadius: 999,
    borderWidth: 1,
    color: colors.charcoal,
    fontSize: 13,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  termsInlineSection: {
    backgroundColor: '#f4f8f1',
    borderColor: '#d7e8d0',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
    padding: 12,
  },
  termTipCard: {
    backgroundColor: '#fffdf8',
    borderColor: '#d7e8d0',
    borderRadius: 14,
    borderWidth: 1,
    marginLeft: 35,
    marginTop: -2,
    padding: 12,
  },
  stepBoostLabel: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  termName: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '900',
  },
  termMeaning: {
    color: colors.body,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 4,
  },
  sectionTitle: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  ingredientGroup: {
    marginBottom: 8,
  },
  groupTitle: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 6,
    textTransform: 'uppercase',
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
  },
  stepBlock: {
    gap: 10,
    marginBottom: 14,
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
    fontSize: 15,
    lineHeight: 22,
  },
  stepContent: {
    flex: 1,
  },
  stepMeta: {
    color: colors.body,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 5,
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

function isExplicitDemoScan(image: { placeholder?: boolean; source?: string } | null) {
  return image?.placeholder === true && image.source === 'mock';
}

function getRecipeSourceLabel(metadata: AiDebugMetadata | null) {
  switch (metadata?.aiSource) {
    case 'openrouter_ai':
      return 'Recipe source: OpenRouter AI';
    case 'mock_ai':
      return 'Recipe source: Mock AI';
    case 'fallback_ai':
      return metadata.fallbackReason
        ? `Recipe source: Fallback (${metadata.fallbackReason})`
        : 'Recipe source: Fallback';
    default:
      return null;
  }
}

function getStoredRecipeForMode(recipes: Recipe[], mode: RecipeMode, fallbackRecipe: Recipe | null) {
  return recipes.find((candidate) => candidate.mode === mode) ??
    (fallbackRecipe?.mode === mode ? fallbackRecipe : null);
}

function getAvailableModes(recipes: Recipe[], fallbackRecipe: Recipe | null, isDemoScan: boolean) {
  const modes = [
    ...recipes.map((recipe) => recipe.mode),
    ...(fallbackRecipe ? [fallbackRecipe.mode] : []),
  ];
  const uniqueModes = modes.filter((mode, index) => modes.indexOf(mode) === index);

  return uniqueModes.length > 0 || !isDemoScan ? uniqueModes : defaultScanResult.modes;
}

function getEstimatedRestaurantPrice(recipe: Recipe | null) {
  return recipe ? recipe.estimatedHomemadeCost + recipe.estimatedSavings : 0;
}

function getSafeTextList(values: string[] | undefined) {
  return (Array.isArray(values) ? values : [])
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function getSafeCookingTerms(recipeTerms: Recipe['cookingTerms']) {
  return (Array.isArray(recipeTerms) ? recipeTerms : [])
    .map((term) => ({
      term: term.term.trim(),
      meaning: term.meaning.trim(),
    }))
    .filter((term) => term.term && term.meaning)
    .slice(0, 4);
}

function getStepCookingTerms(step: string, terms: NonNullable<Recipe['cookingTerms']>) {
  const normalizedStep = step.toLowerCase();
  return terms.filter((term) => normalizedStep.includes(term.term.toLowerCase()));
}

function getStepBoosters(step: string, index: number, stepCount: number, pairings: string[]) {
  if (pairings.length === 0) {
    return [];
  }

  const normalizedStep = step.toLowerCase();
  const isFlavorStep = [
    'sauce',
    'season',
    'taste',
    'finish',
    'serve',
    'garnish',
  ].some((keyword) => normalizedStep.includes(keyword));

  if (!isFlavorStep && index !== stepCount - 1) {
    return [];
  }

  return pairings.slice(0, 2);
}

function formatIngredient(ingredient: Recipe['ingredients'][number]) {
  const quantity = ingredient.quantity.trim();
  const name = ingredient.name.trim();

  if (!quantity) {
    return name;
  }

  return `${quantity} ${name}`.trim();
}

function getSafeIngredientGroups(recipe: Recipe | null) {
  return (Array.isArray(recipe?.ingredientGroups) ? recipe.ingredientGroups : [])
    .map((group) => ({
      component: group.component.trim(),
      items: Array.isArray(group.items) ? group.items : [],
    }))
    .filter((group) => group.component && group.items.length > 0)
    .slice(0, 6);
}

function getRecipeDisplaySteps(recipe: Recipe | null): DisplayRecipeStep[] {
  const structuredSteps = (Array.isArray(recipe?.structuredSteps) ? recipe.structuredSteps : [])
    .map((step) => ({
      ...step,
      text: step.text.trim(),
      timeEstimate: step.timeEstimate?.trim(),
      visualCue: step.visualCue?.trim(),
      whyItMatters: step.whyItMatters?.trim(),
      safetyNote: step.safetyNote?.trim(),
      flavorBoost: step.flavorBoost?.trim(),
      cookingTerm: step.cookingTerm && step.cookingTerm.term.trim() && step.cookingTerm.meaning.trim()
        ? {
          term: step.cookingTerm.term.trim(),
          meaning: step.cookingTerm.meaning.trim(),
        }
        : undefined,
    }))
    .filter((step) => step.text)
    .slice(0, 8);

  if (structuredSteps.length > 0) {
    return structuredSteps;
  }

  return (Array.isArray(recipe?.steps) ? recipe.steps : [])
    .map((step) => ({ text: step.trim() }))
    .filter((step) => step.text)
    .slice(0, 8);
}
