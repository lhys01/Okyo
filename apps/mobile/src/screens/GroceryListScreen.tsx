import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { uiLog } from '../utils/uiDebug';
import {
  EmptyState,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  colors,
  sharedStyles,
} from '../components/OkyoUI';
import {
  defaultScanResult,
  getSafeRecipeForMode,
  getSafeRecipeMode,
  isRecipeMode,
  type Recipe,
  type RecipeIngredient,
  type RecipeMode,
} from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';

type GroceryListRoute = RouteProp<RootStackParamList, 'GroceryListScreen'>;
type GroceryListNavigation = NativeStackNavigationProp<RootStackParamList, 'GroceryListScreen'>;
type GroceryCategory = 'Produce' | 'Dairy' | 'Protein' | 'Pantry' | 'Spices' | 'Other';
type GroceryItem = RecipeIngredient & {
  id: string;
  category: GroceryCategory;
};

const categoryOrder: GroceryCategory[] = ['Produce', 'Dairy', 'Protein', 'Pantry', 'Spices', 'Other'];
const spiceNames = ['pepper', 'flakes', 'chili', 'garlic powder', 'salt', 'seasoning'];
const dairyNames = ['cream', 'parmesan', 'milk', 'butter', 'yogurt', 'cheddar', 'cheese'];
const produceNames = ['spinach', 'kale', 'arugula', 'cucumber', 'greens'];
const proteinNames = ['chicken', 'falafel', 'shrimp'];
const pantryNames = ['pasta', 'rigatoni', 'tomato paste', 'olive oil', 'biscuit mix', 'grains'];

function getCategory(ingredient: RecipeIngredient): GroceryCategory {
  const name = ingredient.name.toLowerCase();

  if (spiceNames.some((keyword) => name.includes(keyword))) {
    return 'Spices';
  }
  if (dairyNames.some((keyword) => name.includes(keyword))) {
    return 'Dairy';
  }
  if (produceNames.some((keyword) => name.includes(keyword))) {
    return 'Produce';
  }
  if (proteinNames.some((keyword) => name.includes(keyword))) {
    return 'Protein';
  }
  if (ingredient.pantryItem || pantryNames.some((keyword) => name.includes(keyword))) {
    return 'Pantry';
  }

  return 'Other';
}

function buildItems(recipe: Recipe): GroceryItem[] {
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

  return ingredients.map((ingredient) => ({
    ...ingredient,
    category: getCategory(ingredient),
    id: `${recipe.id}-${ingredient.name}`,
  }));
}

function buildListText(recipe: Recipe, items: GroceryItem[]) {
  const grouped = categoryOrder
    .map((category) => {
      const categoryItems = items.filter((item) => item.category === category && !item.pantryItem);
      if (categoryItems.length === 0) {
        return '';
      }

      return [
        category,
        ...categoryItems.map((item) => `- ${item.quantity} ${item.name}`),
      ].join('\n');
    })
    .filter(Boolean);
  const pantryItems = items.filter((item) => item.pantryItem);

  if (pantryItems.length > 0) {
    grouped.push([
      'Pantry check',
      ...pantryItems.map((item) => `- ${item.quantity} ${item.name}`),
    ].join('\n'));
  }

  return [`${recipe.title} Grocery List`, ...grouped].join('\n\n');
}

export function GroceryListScreen() {
  const navigation = useNavigation<GroceryListNavigation>();
  const route = useRoute<GroceryListRoute>();
  const rawMode = route.params?.mode ?? defaultScanResult.modes[0];
  const selectedMode = getSafeRecipeMode(rawMode);
  const latestScanRecipes = useOkyoStore((state) => state.latestScanRecipes);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const isDemoScan = isExplicitDemoScan(selectedScanImage);
  const recipe = getGroceryRecipe(selectedMode, latestScanRecipes, latestScanRecipe, isDemoScan);
  const items = useMemo(() => (recipe ? buildItems(recipe) : []), [recipe]);
  const listText = useMemo(() => (recipe ? buildListText(recipe, items) : ''), [items, recipe]);
  const [checkedItemIds, setCheckedItemIds] = useState<string[]>([]);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const didTrackView = useRef(false);

  const groceryItems = items.filter((item) => !item.pantryItem);
  const pantryItems = items.filter((item) => item.pantryItem);

  useEffect(() => {
    if (didTrackView.current) {
      return;
    }

    uiLog('GroceryListScreen', 'enter', { mode: rawMode });

    didTrackView.current = true;
    if (!isRecipeMode(rawMode)) {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: 'Grocery list mode was missing or invalid.',
        screen: 'GroceryListScreen',
      });
    }

    track(analyticsEvents.GROCERY_LIST_VIEWED, {
      dishName: recipe?.title ?? 'Missing recipe',
      mode: selectedMode,
      screen: 'GroceryListScreen',
    });
  }, [rawMode, recipe?.title, selectedMode]);

  const toggleItem = (itemId: string) => {
    uiLog('GroceryListScreen', 'toggle_item', { itemId });
    setCheckedItemIds((currentIds) =>
      currentIds.includes(itemId)
        ? currentIds.filter((currentId) => currentId !== itemId)
        : [...currentIds, itemId],
    );
  };

  const copyList = async () => {
    try {
      uiLog('GroceryListScreen', 'copy_list', { recipeId: recipe?.id });
      if (!recipe || items.length === 0) {
        Alert.alert('List unavailable', 'This recipe does not have grocery items yet.');
        return;
      }

      await Clipboard.setStringAsync(listText);
      awardXPOnce(`export-grocery-list-${recipe.id}`, 10);
      unlockBadge('grocery-exporter');
      track(analyticsEvents.GROCERY_LIST_EXPORTED, {
        dishName: recipe?.title ?? 'Missing recipe',
        mode: selectedMode,
        screen: 'GroceryListScreen',
        source: 'copy',
      });
      Alert.alert('Copied', 'Grocery list copied.');
    } catch {
      Alert.alert('Copy unavailable', 'The grocery list could not be copied on this device.');
    }
  };

  const shareList = async () => {
    try {
      uiLog('GroceryListScreen', 'share_list', { recipeId: recipe?.id });
      if (!recipe || items.length === 0) {
        Alert.alert('List unavailable', 'This recipe does not have grocery items yet.');
        return;
      }

      const result = await Share.share({ message: listText, title: `${recipe.title} Grocery List` });
      if (result.action !== Share.sharedAction) {
        return;
      }

      awardXPOnce(`export-grocery-list-${recipe.id}`, 10);
      unlockBadge('grocery-exporter');
      track(analyticsEvents.GROCERY_LIST_EXPORTED, {
        dishName: recipe?.title ?? 'Missing recipe',
        mode: selectedMode,
        screen: 'GroceryListScreen',
        source: 'share',
      });
    } catch {
      Alert.alert('Share unavailable', 'The grocery list could not be shared on this device.');
    }
  };

  if (!recipe || items.length === 0) {
    return (
      <EmptyState
        eyebrow="Grocery list"
        title={recipe ? 'No ingredients yet' : 'Recipe needs another try'}
        body={recipe
          ? 'This recipe does not have grocery items yet.'
          : 'Okyo needs a generated recipe before it can build a grocery list for this real scan.'}
        actionLabel="Back to Recipe"
        onAction={() => navigation.navigate('RecipeDetailScreen', { mode: selectedMode })}
      />
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.kicker}>Grocery list</Text>
      <Text style={styles.title}>{recipe.title}</Text>
      <Text style={styles.description}>
        Estimated items for {selectedMode} mode. Pantry staples are separated so you can check before shopping.
      </Text>

      <View style={styles.actions}>
        <PrimaryButton onPress={copyList}>Copy List</PrimaryButton>
        <SecondaryButton onPress={shareList}>Share List</SecondaryButton>
      </View>

      {categoryOrder.map((category) => {
        const categoryItems = groceryItems.filter((item) => item.category === category);

        if (categoryItems.length === 0) {
          return null;
        }

        return (
          <View key={category} style={styles.section}>
            <Text style={styles.sectionTitle}>{category}</Text>
            {categoryItems.map((item) => (
              <Pressable key={item.id} style={styles.itemRow} onPress={() => toggleItem(item.id)}>
                <View style={[styles.checkbox, checkedItemIds.includes(item.id) ? styles.checkboxChecked : null]}>
                  <Text style={styles.checkboxText}>{checkedItemIds.includes(item.id) ? '✓' : ''}</Text>
                </View>
                <Text style={[styles.itemText, checkedItemIds.includes(item.id) ? styles.itemTextChecked : null]}>
                  {item.quantity} {item.name}
                </Text>
              </Pressable>
            ))}
          </View>
        );
      })}

      {pantryItems.length > 0 ? (
        <View style={styles.pantrySection}>
          <Text style={styles.sectionTitle}>Pantry check</Text>
          <Text style={styles.pantryNote}>You may already have these at home.</Text>
          {pantryItems.map((item) => (
            <Pressable key={item.id} style={styles.itemRow} onPress={() => toggleItem(item.id)}>
              <View style={[styles.checkbox, checkedItemIds.includes(item.id) ? styles.checkboxChecked : null]}>
                <Text style={styles.checkboxText}>{checkedItemIds.includes(item.id) ? '✓' : ''}</Text>
              </View>
              <Text style={[styles.itemText, checkedItemIds.includes(item.id) ? styles.itemTextChecked : null]}>
                {item.quantity} {item.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScreenContainer>
  );
}


function getGroceryRecipe(
  mode: RecipeMode,
  recipes: Recipe[],
  fallbackRecipe: Recipe | null,
  isDemoScan: boolean,
) {
  return recipes.find((recipe) => recipe.mode === mode) ??
    (fallbackRecipe?.mode === mode ? fallbackRecipe : null) ??
    (isDemoScan ? getSafeRecipeForMode(mode) : null);
}

function isExplicitDemoScan(image: { placeholder?: boolean; source?: string } | null) {
  return image?.placeholder === true && image.source === 'mock';
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
  actions: {
    gap: 10,
    marginTop: 22,
  },
  section: {
    ...sharedStyles.card,
    marginTop: 14,
    padding: 18,
  },
  pantrySection: {
    backgroundColor: colors.cream,
    borderRadius: 20,
    marginTop: 14,
    padding: 18,
  },
  sectionTitle: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  pantryNote: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  itemRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 42,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 2,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  checkboxChecked: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  checkboxText: {
    color: '#fffaf3',
    fontSize: 15,
    fontWeight: '900',
  },
  itemText: {
    color: colors.charcoal,
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  itemTextChecked: {
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
});
