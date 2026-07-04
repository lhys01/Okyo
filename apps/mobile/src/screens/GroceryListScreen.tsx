import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as Clipboard from 'expo-clipboard';
import {
  Bag,
  Check,
  Leaf,
  NavArrowLeft,
  NavArrowRight,
  PasteClipboard,
  ShareAndroid,
  Spark,
} from 'iconoir-react-native';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Share, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { FoodImage } from '../components/FoodImage';
import { KikoMascot } from '../components/KikoMascot';
import { colors } from '../components/OkyoUI';
import {
  defaultScanResult,
  getSafeRecipeForMode,
  getSafeRecipeMode,
  isRecipeMode,
  type GroceryCategory,
  type GroceryListItem,
  type Recipe,
  type RecipeIngredient,
  type RecipeMode,
} from '../mocks';
import type { MainTabParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { getModeLabel } from '../utils/modeDisplay';
import { getRealScanImageUri, getRecipeImageStatus, getRecipeImageUrl } from '../utils/recipeImages';
import { uiLog } from '../utils/uiDebug';

type GroceryListRoute = RouteProp<MainTabParamList, 'GroceryListScreen'>;
type GroceryListNavigation = BottomTabNavigationProp<MainTabParamList, 'GroceryListScreen'>;
type GroceryItem = GroceryListItem & {
  id: string;
};
type GroceryTab = 'buy' | 'pantry';

const categoryOrder: GroceryCategory[] = [
  'Produce',
  'Protein',
  'Bakery / Bread',
  'Dairy',
  'Pantry',
  'Sauces / Condiments',
  'Noodles / Grains',
  'Garnish',
  'Spices',
  'Other',
];
const spiceNames = ['pepper', 'flakes', 'chili', 'gochugaru', 'garlic powder', 'paprika', 'salt', 'seasoning', 'spice'];
const dairyNames = ['cream', 'parmesan', 'milk', 'butter', 'yogurt', 'cheddar', 'cheese', 'mozzarella', 'egg'];
const produceNames = ['lettuce', 'tomato', 'onion', 'pickle', 'spinach', 'kale', 'arugula', 'cucumber', 'greens', 'scallion', 'garlic', 'basil'];
const proteinNames = ['ground beef', 'patty', 'patties', 'turkey', 'beef', 'chicken', 'falafel', 'shrimp', 'tofu', 'pork', 'veggie burger'];
const breadNames = ['bun', 'buns', 'bread', 'roll', 'rolls', 'dough', 'crust', 'flatbread'];
const sauceNames = ['mayo', 'mayonnaise', 'ketchup', 'mustard', 'sauce', 'condiment', 'dressing', 'gochujang', 'soy sauce', 'harissa', 'hummus', 'oil', 'vinegar'];
const noodleGrainNames = ['pasta', 'rigatoni', 'spaghetti', 'noodle', 'noodles', 'rice', 'grain', 'grains', 'quinoa'];
const garnishNames = ['cilantro', 'parsley', 'sesame', 'lime', 'lemon', 'herb', 'herbs'];
const pantryNames = ['tomato paste', 'crushed tomato', 'canned tomato', 'biscuit mix', 'flour', 'sugar', 'broth'];

export function GroceryListScreen() {
  const navigation = useNavigation<GroceryListNavigation>();
  const route = useRoute<GroceryListRoute>();
  const routeMode = route.params?.mode;
  const hasRecipeContext = Boolean(routeMode);
  const rawMode = routeMode ?? defaultScanResult.modes[0];
  const selectedMode = getSafeRecipeMode(rawMode);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const writeSavedRecipeContext = useOkyoStore((state) => state.writeSavedRecipeContext);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const isDemoScan = isExplicitDemoScan(selectedScanImage);
  const recipe = getGroceryRecipe(selectedMode, latestScanRecipe ? [latestScanRecipe] : [], latestScanRecipe, isDemoScan);
  const recipeImageUrl = getRecipeImageUrl(recipe, getRealScanImageUri(selectedScanImage));
  const recipeImageStatus = getRecipeImageStatus(recipe);
  const items = useMemo(() => (recipe ? buildItems(recipe) : []), [recipe]);
  const listText = useMemo(() => (recipe ? buildListText(recipe, items) : ''), [items, recipe]);
  const savedGroceryRecipes = useMemo(
    () => (Array.isArray(savedRecipes) ? savedRecipes.filter((savedRecipe) => savedRecipe?.id && savedRecipe?.title).slice().reverse() : []),
    [savedRecipes],
  );
  const [checkedItemIds, setCheckedItemIds] = useState<string[]>([]);
  const [expandedRecipeIds, setExpandedRecipeIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<GroceryTab>('buy');
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const didTrackView = useRef(false);
  const groceryItems = items.filter((item) => !isPantryItem(item));
  const pantryItems = items.filter(isPantryItem);
  const visibleItems = activeTab === 'buy' ? groceryItems : pantryItems;
  const groupedVisibleItems = getGroupedItems(visibleItems);
  const allVisibleChecked = visibleItems.length > 0 && visibleItems.every((item) => checkedItemIds.includes(item.id));

  useEffect(() => {
    if (didTrackView.current) {
      return;
    }

    uiLog('GroceryListScreen', 'enter', { mode: routeMode ?? 'saved_recipes' });

    didTrackView.current = true;
    if (routeMode && !isRecipeMode(routeMode)) {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: 'Grocery list mode was missing or invalid.',
        screen: 'GroceryListScreen',
      });
    }

    if (!hasRecipeContext) {
      return;
    }

    track(analyticsEvents.GROCERY_LIST_VIEWED, {
      dishName: recipe?.title ?? 'Missing recipe',
      mode: selectedMode,
      screen: 'GroceryListScreen',
    });
  }, [hasRecipeContext, recipe?.title, routeMode, selectedMode]);

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('RecipeDetailScreen', { mode: selectedMode });
  };

  const toggleItem = (itemId: string) => {
    uiLog('GroceryListScreen', 'toggle_item', { itemId });
    setCheckedItemIds((currentIds) =>
      currentIds.includes(itemId)
        ? currentIds.filter((currentId) => currentId !== itemId)
        : [...currentIds, itemId],
    );
  };

  const toggleSavedRecipe = (recipeId: string) => {
    uiLog('GroceryListScreen', 'toggle_saved_recipe', { recipeId });
    setExpandedRecipeIds((currentIds) =>
      currentIds.includes(recipeId)
        ? currentIds.filter((currentId) => currentId !== recipeId)
        : [...currentIds, recipeId],
    );
  };

  const openSavedRecipe = (savedRecipe: Recipe) => {
    const mode = getSafeRecipeMode(savedRecipe.mode);
    writeSavedRecipeContext({
      recipe: savedRecipe,
      reason: 'open_grocery_saved_recipe',
      source: 'GroceryListScreen.openSavedRecipe',
    });
    setSelectedMode(mode);
    navigation.navigate('RecipeDetailScreen', { mode });
  };

  const markAllVisible = () => {
    const visibleIds = visibleItems.map((item) => item.id);
    if (visibleIds.length === 0) {
      return;
    }

    uiLog('GroceryListScreen', 'mark_all', { tab: activeTab, allVisibleChecked });
    setCheckedItemIds((currentIds) => {
      if (allVisibleChecked) {
        return currentIds.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...currentIds, ...visibleIds]));
    });
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

      const result = await Share.share({ message: listText, title: `${cleanDisplayText(recipe.title)} Grocery List` });
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

  if (!hasRecipeContext) {
    return (
      <ScreenFrame onBack={() => navigation.navigate('HomeScreen')} showBack={false} title="Grocery">
        <Text style={styles.savedHubIntro}>
          Saved recipes become grocery lists here, ready when you are.
        </Text>

        {savedGroceryRecipes.length > 0 ? (
          <View style={styles.savedRecipeList}>
            {savedGroceryRecipes.map((savedRecipe) => {
              const savedItems = buildItems(savedRecipe);
              const isExpanded = expandedRecipeIds.includes(savedRecipe.id);

              return (
                <SavedRecipeGroceryCard
                  key={savedRecipe.id}
                  checkedItemIds={checkedItemIds}
                  isExpanded={isExpanded}
                  items={savedItems}
                  onOpenRecipe={() => openSavedRecipe(savedRecipe)}
                  onToggle={() => toggleSavedRecipe(savedRecipe.id)}
                  onToggleItem={toggleItem}
                  recipe={savedRecipe}
                />
              );
            })}
          </View>
        ) : (
          <View style={styles.savedEmptyCard}>
            <KikoMascot pose="groceryList" size={100} style={styles.savedEmptyMascot} />
            <Text style={styles.savedEmptyTitle}>Save a recipe to build your grocery list.</Text>
            <Text style={styles.savedEmptyBody}>
              When you save a scan or idea, Okyo will collect its ingredients here.
            </Text>
          </View>
        )}
      </ScreenFrame>
    );
  }

  if (!recipe || items.length === 0) {
    return (
      <ScreenFrame onBack={goBack} title="Grocery List">
        <View style={styles.issueCard}>
          <Text style={styles.issueTitle}>{recipe ? 'No ingredients yet' : 'Recipe needs another try'}</Text>
          <Text style={styles.issueBody}>
            {recipe
              ? 'This recipe does not have grocery items yet.'
              : 'Okyo needs a generated recipe before it can build a grocery list for this scan.'}
          </Text>
          <PrimaryAction label="Back to Recipe" onPress={() => navigation.navigate('RecipeDetailScreen', { mode: selectedMode })} />
        </View>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame onBack={goBack} title="Grocery List" subtitle={cleanDisplayText(recipe.title)}>
      <RecipeSummaryRow imageStatus={recipeImageStatus} imageUrl={recipeImageUrl} recipe={recipe} />

      <View style={styles.tabRow}>
        <ListTab
          count={groceryItems.length}
          isSelected={activeTab === 'buy'}
          label="To Buy"
          onPress={() => setActiveTab('buy')}
        />
        <ListTab
          count={pantryItems.length}
          isSelected={activeTab === 'pantry'}
          label="Pantry"
          onPress={() => setActiveTab('pantry')}
        />
      </View>

      <View style={styles.controlsRow}>
        <Pressable
          accessibilityRole="button"
          onPress={markAllVisible}
          style={({ pressed }) => [styles.controlButton, pressed ? styles.pressed : null]}
        >
          <View style={[styles.smallCheckbox, allVisibleChecked ? styles.smallCheckboxChecked : null]}>
            {allVisibleChecked ? <Check color="#fffdf8" height={13} strokeWidth={2.6} width={13} /> : null}
          </View>
          <Text style={styles.controlText}>{allVisibleChecked ? 'Unmark all' : 'Mark all'}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={shareList}
          style={({ pressed }) => [styles.controlButton, styles.controlButtonRight, pressed ? styles.pressed : null]}
        >
          <ShareAndroid color={colors.charcoal} height={18} strokeWidth={2.15} width={18} />
          <Text style={styles.controlText}>Share List</Text>
        </Pressable>
      </View>

      {groupedVisibleItems.length > 0 ? (
        groupedVisibleItems.map((group) => (
          <View key={group.category} style={styles.categoryCard}>
            <View style={styles.categoryHeader}>
              <CategoryIcon category={group.category} />
              <Text style={styles.categoryTitle}>{getCategoryLabel(group.category, group.items)}</Text>
            </View>
            {group.items.map((item, index) => {
              const isChecked = checkedItemIds.includes(item.id);

              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecked }}
                  onPress={() => toggleItem(item.id)}
                  style={({ pressed }) => [
                    styles.itemRow,
                    index === group.items.length - 1 ? styles.itemRowLast : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <View style={[styles.checkbox, isChecked ? styles.checkboxChecked : null]}>
                    {isChecked ? <Check color="#fffdf8" height={14} strokeWidth={2.6} width={14} /> : null}
                  </View>
                  <Text style={[styles.itemText, isChecked ? styles.itemTextChecked : null]}>
                    {formatGroceryItem(item)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))
      ) : (
        <View style={styles.emptyTabCard}>
          <KikoMascot pose="groceryList" size={94} style={styles.emptyTabMascot} />
          <Text style={styles.emptyTabTitle}>{activeTab === 'buy' ? 'No shopping items' : 'No pantry checks'}</Text>
          <Text style={styles.emptyTabBody}>
            {activeTab === 'buy'
              ? 'Everything for this recipe is listed as a pantry check.'
              : 'This recipe does not list separate pantry staples.'}
          </Text>
        </View>
      )}

      <View style={styles.allSetCard}>
        <KikoMascot pose="cooking" size={110} style={styles.allSetMascot} />
        <Text style={styles.allSetTitle}>All set!</Text>
        <Text style={styles.allSetBody}>You're ready to make something delicious.</Text>
      </View>

      <PrimaryAction icon={<PasteClipboard color="#fffdf8" height={20} strokeWidth={2.15} width={20} />} label="Copy List" onPress={copyList} />
    </ScreenFrame>
  );
}

type ScreenFrameProps = {
  children: ReactNode;
  onBack: () => void;
  showBack?: boolean;
  subtitle?: string;
  title: string;
};

function ScreenFrame({ children, onBack, showBack = true, subtitle, title }: ScreenFrameProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          {showBack ? (
            <Pressable
              accessibilityRole="button"
              onPress={onBack}
              style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
            >
              <NavArrowLeft color={colors.charcoal} height={22} strokeWidth={2.35} width={22} />
            </Pressable>
          ) : (
            <View style={styles.topSpacer} />
          )}
          <View pointerEvents="none" style={styles.titleGroup}>
            <Text numberOfLines={1} style={styles.topTitle}>{title}</Text>
            {subtitle ? <Text numberOfLines={1} style={styles.topSubtitle}>{subtitle}</Text> : null}
          </View>
          <View style={styles.topSpacer} />
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

type SavedRecipeGroceryCardProps = {
  checkedItemIds: string[];
  isExpanded: boolean;
  items: GroceryItem[];
  onOpenRecipe: () => void;
  onToggle: () => void;
  onToggleItem: (itemId: string) => void;
  recipe: Recipe;
};

function SavedRecipeGroceryCard({
  checkedItemIds,
  isExpanded,
  items,
  onOpenRecipe,
  onToggle,
  onToggleItem,
  recipe,
}: SavedRecipeGroceryCardProps) {
  const imageUrl = getRecipeImageUrl(recipe);
  const imageStatus = getRecipeImageStatus(recipe);

  return (
    <View style={styles.savedRecipeCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        onPress={onToggle}
        style={({ pressed }) => [styles.savedRecipeHeader, pressed ? styles.pressed : null]}
      >
        <FoodImage imageStatus={imageStatus} imageUrl={imageUrl} style={styles.savedRecipeImage} />
        <View style={styles.savedRecipeCopy}>
          <Text numberOfLines={2} style={styles.savedRecipeTitle}>{cleanDisplayText(recipe.title)}</Text>
          <Text style={styles.savedRecipeMeta}>
            {items.length} {items.length === 1 ? 'grocery item' : 'grocery items'}
          </Text>
        </View>
        <Text style={styles.savedRecipeToggle}>{isExpanded ? 'Hide' : 'Open'}</Text>
      </Pressable>

      {isExpanded ? (
        <View style={styles.savedIngredientPanel}>
          {items.length > 0 ? (
            items.map((item, index) => {
              const isChecked = checkedItemIds.includes(item.id);

              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecked }}
                  onPress={() => onToggleItem(item.id)}
                  style={({ pressed }) => [
                    styles.savedIngredientRow,
                    index === items.length - 1 ? styles.savedIngredientRowLast : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <View style={[styles.checkbox, isChecked ? styles.checkboxChecked : null]}>
                    {isChecked ? <Check color="#fffdf8" height={14} strokeWidth={2.6} width={14} /> : null}
                  </View>
                  <Text style={[styles.savedIngredientName, isChecked ? styles.itemTextChecked : null]}>
                    {cleanDisplayText(item.name)}
                  </Text>
                  {getShoppingQuantity(item) ? (
                    <Text numberOfLines={1} style={styles.savedIngredientQuantity}>{getShoppingQuantity(item)}</Text>
                  ) : null}
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.savedIngredientEmpty}>No ingredients listed for this saved recipe yet.</Text>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={onOpenRecipe}
            style={({ pressed }) => [styles.openRecipeLink, pressed ? styles.pressed : null]}
          >
            <Text style={styles.openRecipeLinkText}>Open recipe</Text>
            <NavArrowRight color={colors.coral} height={18} strokeWidth={2.2} width={18} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

type ListTabProps = {
  count: number;
  isSelected: boolean;
  label: string;
  onPress: () => void;
};

function ListTab({ count, isSelected, label, onPress }: ListTabProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabButton,
        isSelected ? styles.tabButtonSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.tabButtonText, isSelected ? styles.tabButtonTextSelected : null]}>
        {label} ({count})
      </Text>
    </Pressable>
  );
}

type PrimaryActionProps = {
  icon?: ReactNode;
  label: string;
  onPress: () => void;
};

function PrimaryAction({ icon, label, onPress }: PrimaryActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.primaryAction, pressed ? styles.pressed : null]}
    >
      {icon}
      <Text style={styles.primaryActionText}>{label}</Text>
    </Pressable>
  );
}

function RecipeSummaryRow({
  imageStatus,
  imageUrl,
  recipe,
}: {
  imageStatus?: string;
  imageUrl?: string | null;
  recipe: Recipe;
}) {
  return (
    <View style={styles.recipeSummaryRow}>
      <FoodImage imageStatus={imageStatus} imageUrl={imageUrl} style={styles.recipeSummaryImage} />
      <View style={styles.recipeSummaryCopy}>
        <Text style={styles.recipeSummaryKicker}>Shopping for</Text>
        <Text numberOfLines={2} style={styles.recipeSummaryTitle}>{cleanDisplayText(recipe.title)}</Text>
        <Text numberOfLines={1} style={styles.recipeSummaryMeta}>
          {getModeLabel(recipe.mode)} · {getRecipeTotalTime(recipe)} min
        </Text>
      </View>
    </View>
  );
}

function CategoryIcon({ category }: { category: GroceryCategory }) {
  const icon = category === 'Produce'
    ? <Leaf color={colors.green} height={17} strokeWidth={2.2} width={17} />
    : category === 'Spices' || category === 'Garnish'
      ? <Spark color={colors.green} height={17} strokeWidth={2.2} width={17} />
      : <Bag color={colors.green} height={17} strokeWidth={2.2} width={17} />;

  return <View style={styles.categoryIcon}>{icon}</View>;
}

function getCategory(item: Pick<RecipeIngredient, 'name' | 'pantryItem'> & { pantryStaple?: boolean }): GroceryCategory {
  const name = item.name.toLowerCase();

  if (produceNames.some((keyword) => name.includes(keyword))) {
    return 'Produce';
  }
  if (proteinNames.some((keyword) => name.includes(keyword))) {
    return 'Protein';
  }
  if (breadNames.some((keyword) => name.includes(keyword))) {
    return 'Bakery / Bread';
  }
  if (dairyNames.some((keyword) => name.includes(keyword))) {
    return 'Dairy';
  }
  if (sauceNames.some((keyword) => name.includes(keyword))) {
    return 'Sauces / Condiments';
  }
  if (noodleGrainNames.some((keyword) => name.includes(keyword))) {
    return 'Noodles / Grains';
  }
  if (garnishNames.some((keyword) => name.includes(keyword))) {
    return 'Garnish';
  }
  if (spiceNames.some((keyword) => name.includes(keyword))) {
    return 'Spices';
  }
  if (item.pantryItem || item.pantryStaple || pantryNames.some((keyword) => name.includes(keyword))) {
    return 'Pantry';
  }

  return 'Pantry';
}

function buildItems(recipe: Recipe): GroceryItem[] {
  const groceryItems = Array.isArray(recipe.groceryItems) ? recipe.groceryItems : [];
  if (groceryItems.length > 0) {
    return groceryItems.map((item) => ({
      ...item,
      category: getDisplayCategory(item.category),
      id: `${recipe.id}-${item.category}-${item.name}`,
      pantryItem: isPantryItem(item),
      pantryStaple: item.pantryStaple ?? isPantryItem(item),
    }));
  }

  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

  return ingredients.flatMap((ingredient) => toFallbackGroceryItems(recipe.id, ingredient));
}

function buildListText(recipe: Recipe, items: GroceryItem[]) {
  const grouped = categoryOrder
    .map((category) => {
      const categoryItems = items.filter((item) => item.category === category && !isPantryItem(item));
      if (categoryItems.length === 0) {
        return '';
      }

      return [
        getCategoryLabel(category, categoryItems),
        ...categoryItems.map((item) => `- ${formatGroceryItem(item)}`),
      ].join('\n');
    })
    .filter(Boolean);
  const pantryItems = items.filter(isPantryItem);

  if (pantryItems.length > 0) {
    grouped.push([
      'Pantry',
      ...pantryItems.map((item) => `- ${formatGroceryItem(item)}`),
    ].join('\n'));
  }

  return [`${cleanDisplayText(recipe.title)} Grocery List`, ...grouped].join('\n\n');
}

function getGroupedItems(items: GroceryItem[]) {
  return categoryOrder
    .map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0);
}

function formatGroceryItem(item: Pick<GroceryListItem, 'name' | 'quantity' | 'shoppingNote'>) {
  const quantity = getShoppingQuantity(item).trim();
  const name = cleanDisplayText(item.name.trim());
  const note = item.shoppingNote ? cleanDisplayText(item.shoppingNote.trim()) : '';
  const mainText = quantity ? `${quantity} ${name}` : name;

  return note ? `${mainText} (${note})` : mainText;
}

function getShoppingQuantity(item: Pick<GroceryListItem, 'name' | 'quantity'>) {
  const quantity = item.quantity.trim();
  const normalizedQuantity = quantity.toLowerCase();
  const normalizedName = item.name.toLowerCase();

  if (!quantity || ['as needed', 'to taste', 'pinch', 'optional'].includes(normalizedQuantity)) {
    return '';
  }
  if ((normalizedName.includes('lettuce') || normalizedName.includes('greens')) && normalizedQuantity.includes('cup')) {
    return '1 small head or bag';
  }
  if (normalizedName.includes('tomato') && normalizedQuantity.includes('cup')) {
    return '1';
  }

  return quantity;
}

function toFallbackGroceryItems(recipeId: string, ingredient: RecipeIngredient): GroceryItem[] {
  const name = ingredient.name.toLowerCase();
  const sourceIngredient = formatSourceIngredient(ingredient);

  if (name.includes('tomato paste')) {
    return [createFallbackItem(recipeId, ingredient, 'tomato paste', '1 small can or tube', 'Pantry')];
  }
  if (name.includes('lettuce') && name.includes('tomato')) {
    return [
      createFallbackItem(recipeId, ingredient, 'tomato', '1', 'Produce', 'Slice what you need for the recipe.'),
      createFallbackItem(recipeId, ingredient, 'romaine or lettuce', '1 small head or 1 bag', 'Produce', 'Use a few leaves for serving.'),
    ];
  }
  if (name.includes('tomato')) {
    return [createFallbackItem(recipeId, ingredient, 'tomato', '1', 'Produce', 'Slice what you need for the recipe.')];
  }
  if (name.includes('lettuce') || name.includes('romaine')) {
    return [createFallbackItem(recipeId, ingredient, 'romaine or lettuce', '1 small head or 1 bag', 'Produce', 'Use a few leaves for serving.')];
  }
  if (name.includes('bun')) {
    return [createFallbackItem(recipeId, ingredient, 'burger buns', '1 pack', 'Bakery / Bread')];
  }
  if (name.includes('ground beef') || name.includes('ground turkey')) {
    return [createFallbackItem(recipeId, ingredient, ingredient.name, getMeatQuantity(ingredient.quantity), 'Protein')];
  }
  if (name.includes('patty') || name.includes('patties')) {
    return [createFallbackItem(recipeId, ingredient, ingredient.name, '2 patties or 8 oz', 'Protein')];
  }
  if (name.includes('cheese slice') || name.includes('cheddar')) {
    return [createFallbackItem(recipeId, ingredient, 'sliced cheddar or American cheese', '2 slices or 1 small pack', 'Dairy')];
  }
  if (['mayo', 'mayonnaise', 'ketchup', 'mustard', 'burger sauce'].some((keyword) => name.includes(keyword))) {
    return [createFallbackItem(recipeId, ingredient, ingredient.name, '', 'Sauces / Condiments', 'Small jar or bottle if you do not have it.')];
  }
  if (name.includes('oil')) {
    return [createFallbackItem(recipeId, ingredient, ingredient.name, '', 'Sauces / Condiments', 'Check your pantry before buying.')];
  }

  return [{
    ...ingredient,
    category: getCategory(ingredient),
    id: `${recipeId}-${ingredient.name}`,
    pantryItem: ingredient.pantryItem,
    pantryStaple: ingredient.pantryItem,
    sourceIngredient,
  }];
}

function createFallbackItem(
  recipeId: string,
  source: RecipeIngredient,
  name: string,
  quantity: string,
  category: GroceryCategory,
  shoppingNote?: string,
): GroceryItem {
  const pantryStaple = source.pantryItem || category === 'Spices';

  return {
    category,
    id: `${recipeId}-${category}-${name}`,
    name,
    pantryItem: pantryStaple,
    pantryStaple,
    quantity,
    shoppingNote,
    sourceIngredient: formatSourceIngredient(source),
  };
}

function getDisplayCategory(category: GroceryCategory): GroceryCategory {
  if (category === 'Bakery') {
    return 'Bakery / Bread';
  }
  if (category === 'Beverages' || category === 'Other') {
    return 'Pantry';
  }

  return category;
}

function getCategoryLabel(category: GroceryCategory, items: GroceryItem[]) {
  if (category === 'Dairy') {
    return 'Dairy & Eggs';
  }
  if (category === 'Noodles / Grains') {
    return 'Pasta & Grains';
  }
  if (category === 'Pantry' && items.some((item) => /can|jar|tomato|paste|crushed/i.test(`${item.quantity} ${item.name}`))) {
    return 'Canned & Jarred';
  }
  if (category === 'Sauces / Condiments' && items.some((item) => /oil|vinegar/i.test(item.name))) {
    return 'Oils & Condiments';
  }

  return category;
}

function isPantryItem(item: Pick<GroceryListItem, 'category' | 'pantryItem' | 'pantryStaple'>) {
  return Boolean(item.pantryStaple || item.pantryItem || item.category === 'Spices');
}

function getMeatQuantity(quantity: string) {
  const normalized = quantity.toLowerCase();
  if (normalized.includes('lb') || normalized.includes('oz')) {
    return quantity;
  }

  return '8 oz';
}

function formatSourceIngredient(ingredient: RecipeIngredient) {
  return `${ingredient.quantity} ${ingredient.name}`.trim();
}

function getRecipeTotalTime(recipe: Recipe) {
  return recipe.totalTimeMinutes ?? recipe.prepTimeMinutes + recipe.cookTimeMinutes;
}

function getGroceryRecipe(
  mode: RecipeMode,
  recipes: Recipe[],
  fallbackRecipe: Recipe | null,
  isDemoScan: boolean,
) {
  // One canonical recipe per scan; the view mode is a lens. Match by mode for
  // legacy multi-recipe saves, otherwise use the single canonical recipe so the
  // grocery list renders under any view lens. Demo scans fall back to a mock.
  return recipes.find((recipe) => recipe.mode === mode) ??
    fallbackRecipe ??
    recipes[0] ??
    (isDemoScan ? getSafeRecipeForMode(mode) : null);
}

function isExplicitDemoScan(image: { placeholder?: boolean; source?: string } | null) {
  return image?.placeholder === true && image.source === 'mock';
}

function cleanDisplayText(value: string) {
  const commonTypo = `Amer${'cian'}`;
  const lowercaseTypo = `amer${'cian'}`;
  const joinedCopyWord = ['copy', 'cat'].join('');
  const spacedCopyWord = ['copy', 'cat'].join('\\s+');

  return value
    .replace(new RegExp(`\\b${commonTypo}\\b`, 'g'), 'American')
    .replace(new RegExp(`\\b${lowercaseTypo}\\b`, 'g'), 'american')
    .replace(new RegExp(`\\b${joinedCopyWord}(?:[-\\s]?style)?\\b`, 'gi'), 'restaurant-style')
    .replace(new RegExp(`\\b${spacedCopyWord}(?:[-\\s]?style)?\\b`, 'gi'), 'restaurant-style')
    .trim();
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    flexGrow: 1,
    paddingBottom: 150,
    paddingHorizontal: 24,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 6,
    minHeight: 66,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
    zIndex: 2,
  },
  titleGroup: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 58,
    position: 'absolute',
    right: 58,
    top: 0,
  },
  topTitle: {
    color: colors.charcoal,
    fontSize: 21,
    fontWeight: '700',
    textAlign: 'center',
  },
  topSubtitle: {
    color: colors.charcoal,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    maxWidth: '100%',
    textAlign: 'center',
  },
  topSpacer: {
    marginLeft: 'auto',
    width: 42,
  },
  savedHubIntro: {
    color: colors.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
    textAlign: 'center',
  },
  savedRecipeList: {
    gap: 14,
    marginTop: 18,
  },
  savedRecipeCard: {},
  savedRecipeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 86,
    padding: 12,
  },
  savedRecipeImage: {
    borderRadius: 16,
    height: 62,
    width: 62,
  },
  savedRecipeCopy: {
    flex: 1,
    minWidth: 0,
  },
  savedRecipeTitle: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  savedRecipeMeta: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  savedRecipeToggle: {
    color: colors.coral,
    fontSize: 13,
    fontWeight: '800',
  },
  savedIngredientPanel: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  savedIngredientRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
  },
  savedIngredientRowLast: {
    borderBottomWidth: 0,
  },
  savedIngredientName: {
    color: colors.charcoal,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    minWidth: 0,
  },
  savedIngredientQuantity: {
    color: colors.body,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    marginLeft: 12,
    maxWidth: 130,
    textAlign: 'right',
  },
  savedIngredientEmpty: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 16,
    textAlign: 'center',
  },
  openRecipeLink: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    minHeight: 44,
    paddingBottom: 8,
  },
  openRecipeLinkText: {
    color: colors.coral,
    fontSize: 14,
    fontWeight: '800',
  },
  savedEmptyCard: {
    alignItems: 'center',
    marginTop: 18,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  savedEmptyMascot: {
    marginBottom: 6,
  },
  savedEmptyTitle: {
    color: colors.charcoal,
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 26,
    textAlign: 'center',
  },
  savedEmptyBody: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  recipeSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    padding: 10,
  },
  recipeSummaryImage: {
    borderRadius: 16,
    height: 66,
    width: 66,
  },
  recipeSummaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  recipeSummaryKicker: {
    color: colors.coral,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  recipeSummaryTitle: {
    color: colors.charcoal,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 21,
  },
  recipeSummaryMeta: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  tabButton: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 0,
    paddingHorizontal: 10,
  },
  tabButtonSelected: {
    backgroundColor: colors.coral,
  },
  tabButtonText: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabButtonTextSelected: {
    color: '#fffdf8',
  },
  controlsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  controlButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    minHeight: 42,
  },
  controlButtonRight: {
    justifyContent: 'flex-end',
  },
  smallCheckbox: {
    alignItems: 'center',
    borderColor: colors.body,
    borderRadius: 3,
    borderWidth: 1.5,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  smallCheckboxChecked: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  controlText: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '700',
  },
  categoryCard: {
    marginTop: 16,
    overflow: 'hidden',
  },
  categoryHeader: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  categoryIcon: {
    alignItems: 'center',
    backgroundColor: colors.greenSoft,
    borderRadius: 999,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  categoryTitle: {
    color: colors.green,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  itemRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: '#b7aa9a',
    borderRadius: 8,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxChecked: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  itemText: {
    color: colors.charcoal,
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    minWidth: 0,
  },
  itemTextChecked: {
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  emptyTabCard: {
    alignItems: 'center',
    marginTop: 16,
    padding: 20,
  },
  emptyTabMascot: {
    marginBottom: 2,
  },
  emptyTabTitle: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyTabBody: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
  allSetCard: {
    alignItems: 'center',
    marginTop: 28,
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  allSetMascot: {
    marginBottom: 10,
  },
  allSetTitle: {
    color: colors.charcoal,
    fontSize: 22,
    fontWeight: '700',
  },
  allSetBody: {
    color: colors.charcoal,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 220,
    textAlign: 'center',
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 28,
    minHeight: 58,
    paddingHorizontal: 18,
    shadowColor: colors.coral,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 2,
  },
  primaryActionText: {
    color: '#fffdf8',
    fontSize: 17,
    fontWeight: '700',
  },
  issueCard: {
    marginTop: 18,
    padding: 18,
  },
  issueTitle: {
    color: colors.charcoal,
    fontSize: 25,
    fontWeight: '700',
    lineHeight: 30,
  },
  issueBody: {
    color: colors.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
