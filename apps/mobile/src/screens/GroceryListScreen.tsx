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
import { RewardToast } from '../components/OkyoUI';
import { colors, fontFamilies, layout, shadows, surfaces, typography } from '../theme/okyoTheme';
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
import { ingredientNameMatchesList } from '../utils/ingredientMatching';
import { getModeLabel } from '../utils/modeDisplay';
import { getRealScanImageUri, getRecipeImageStatus, getRecipeImageUrl } from '../utils/recipeImages';
import {
  buildSmartGroceryListText,
  buildSmartGrocerySummary,
  formatSmartGroceryItem,
  type SmartGroceryItem,
  type SmartGrocerySummary,
  type SmartGrocerySwap,
} from '../utils/smartGrocery';
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
  const smartSummary = useMemo(() => buildSmartGrocerySummary(recipe), [recipe]);
  const smartItems = useMemo(() => getSmartItems(smartSummary), [smartSummary]);
  const listText = useMemo(() => (recipe ? buildSmartGroceryListText(recipe, smartSummary) : ''), [recipe, smartSummary]);
  const savedGroceryRecipes = useMemo(
    () => (Array.isArray(savedRecipes) ? savedRecipes.filter((savedRecipe) => savedRecipe?.id && savedRecipe?.title).slice().reverse() : []),
    [savedRecipes],
  );
  const [checkedItemIds, setCheckedItemIds] = useState<string[]>([]);
  const [expandedRecipeIds, setExpandedRecipeIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<GroceryTab>('buy');
  const [exportToastVisible, setExportToastVisible] = useState(false);
  const [exportToastLabel, setExportToastLabel] = useState('Grocery list exported');
  const exportToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedAlertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const awardedXpEvents = useOkyoStore((state) => state.awardedXpEvents);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const didTrackView = useRef(false);
  const groceryItems = smartSummary.needToBuy;
  const pantryItems = smartSummary.probablyHave;
  const visibleItems = activeTab === 'buy' ? smartSummary.needToBuy : smartSummary.probablyHave;
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

  const showExportToast = (label: string) => {
    if (exportToastTimer.current) {
      clearTimeout(exportToastTimer.current);
    }
    setExportToastLabel(label);
    setExportToastVisible(true);
    exportToastTimer.current = setTimeout(() => setExportToastVisible(false), 1600);
  };

  useEffect(() => () => {
    if (exportToastTimer.current) {
      clearTimeout(exportToastTimer.current);
    }
    if (copiedAlertTimer.current) {
      clearTimeout(copiedAlertTimer.current);
    }
  }, []);

  const copyList = async () => {
    try {
      uiLog('GroceryListScreen', 'copy_list', { recipeId: recipe?.id });
      if (!recipe || smartItems.length === 0) {
        Alert.alert('List unavailable', 'This recipe does not have grocery items yet.');
        return;
      }

      await Clipboard.setStringAsync(listText);
      const exportEventId = `export-grocery-list-${recipe.id}`;
      const willAwardExportXp = !awardedXpEvents.includes(exportEventId);
      awardXPOnce(exportEventId, 10);
      unlockBadge('grocery-exporter');
      showExportToast(willAwardExportXp ? 'Grocery list exported +10 XP' : 'Grocery list exported');
      track(analyticsEvents.GROCERY_LIST_EXPORTED, {
        dishName: recipe?.title ?? 'Missing recipe',
        mode: selectedMode,
        screen: 'GroceryListScreen',
        source: 'copy',
      });
      if (copiedAlertTimer.current) {
        clearTimeout(copiedAlertTimer.current);
      }
      copiedAlertTimer.current = setTimeout(() => Alert.alert('Copied', 'Grocery list copied.'), 520);
    } catch {
      Alert.alert('Copy unavailable', 'The grocery list could not be copied on this device.');
    }
  };

  const shareList = async () => {
    try {
      uiLog('GroceryListScreen', 'share_list', { recipeId: recipe?.id });
      if (!recipe || smartItems.length === 0) {
        Alert.alert('List unavailable', 'This recipe does not have grocery items yet.');
        return;
      }

      const result = await Share.share({ message: listText, title: `${cleanDisplayText(recipe.title)} Grocery List` });
      if (result.action !== Share.sharedAction) {
        return;
      }

      const exportEventId = `export-grocery-list-${recipe.id}`;
      const willAwardExportXp = !awardedXpEvents.includes(exportEventId);
      awardXPOnce(exportEventId, 10);
      unlockBadge('grocery-exporter');
      showExportToast(willAwardExportXp ? 'Grocery list exported +10 XP' : 'Grocery list exported');
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
            <KikoMascot animated="idle" pose="groceryList" size={100} style={styles.savedEmptyMascot} />
            <Text style={styles.savedEmptyTitle}>Save a recipe to build your grocery list.</Text>
            <Text style={styles.savedEmptyBody}>
              When you save a scan or idea, Okyo will collect its ingredients here.
            </Text>
          </View>
        )}
      </ScreenFrame>
    );
  }

  if (!recipe || smartItems.length === 0) {
    return (
      <ScreenFrame onBack={goBack} title="Grocery List">
        <View style={styles.issueCard}>
          <Text style={styles.issueTitle}>{recipe ? 'No ingredients yet' : 'Recipe needs another try'}</Text>
          <Text style={styles.issueBody}>
            {recipe
              ? 'Okyo could not build a grocery list yet.'
              : 'Okyo needs a generated recipe before it can build a grocery list for this scan.'}
          </Text>
          <PrimaryAction label="Back to Recipe" onPress={() => navigation.navigate('RecipeDetailScreen', { mode: selectedMode })} />
        </View>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame
      onBack={goBack}
      rewardToast={<RewardToast label={exportToastLabel} tone={exportToastLabel.includes('XP') ? 'xp' : 'save'} visible={exportToastVisible} />}
      title="Grocery List"
      subtitle={cleanDisplayText(recipe.title)}
    >
      <RecipeSummaryRow imageStatus={recipeImageStatus} imageUrl={recipeImageUrl} recipe={recipe} />

      <SmartGrocerySummaryCard summary={smartSummary} />

      <View style={styles.controlsRow}>
        <Pressable
          accessibilityRole="button"
          onPress={markAllVisible}
          style={({ pressed }) => [styles.controlButton, pressed ? styles.pressed : null]}
        >
          <View style={[styles.smallCheckbox, allVisibleChecked ? styles.smallCheckboxChecked : null]}>
            {allVisibleChecked ? <Check color={colors.onCoral} height={13} strokeWidth={2.6} width={13} /> : null}
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

      <SmartGrocerySection
        checkedItemIds={checkedItemIds}
        items={smartSummary.needToBuy}
        onToggleItem={toggleItem}
        title="Need to buy"
      />
      <SmartGrocerySection
        checkedItemIds={checkedItemIds}
        emptyCopy="No pantry basics were detected for this recipe."
        items={smartSummary.probablyHave}
        onToggleItem={toggleItem}
        title="Probably already have"
      />
      {smartSummary.optional.length > 0 ? (
        <SmartGrocerySection
          checkedItemIds={checkedItemIds}
          items={smartSummary.optional}
          onToggleItem={toggleItem}
          title="Optional / nice to have"
        />
      ) : null}
      {smartSummary.swaps.length > 0 ? <SmartSwapsCard swaps={smartSummary.swaps} /> : null}

      <View style={styles.allSetCard}>
        <KikoMascot animated="success" pose="cooking" size={110} style={styles.allSetMascot} />
        <Text style={styles.allSetTitle}>All set!</Text>
        <Text style={styles.allSetBody}>You're ready to make something delicious.</Text>
      </View>

      <PrimaryAction icon={<PasteClipboard color={colors.onCoral} height={20} strokeWidth={2.15} width={20} />} label="Copy List" onPress={copyList} />
    </ScreenFrame>
  );
}

type ScreenFrameProps = {
  children: ReactNode;
  onBack: () => void;
  showBack?: boolean;
  rewardToast?: ReactNode;
  subtitle?: string;
  title: string;
};

function ScreenFrame({ children, onBack, rewardToast, showBack = true, subtitle, title }: ScreenFrameProps) {
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
      {rewardToast}
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
                    {isChecked ? <Check color={colors.onCoral} height={14} strokeWidth={2.6} width={14} /> : null}
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

function SmartGrocerySummaryCard({ summary }: { summary: SmartGrocerySummary }) {
  return (
    <View style={styles.smartSummaryCard}>
      <View style={styles.smartSummaryTopRow}>
        <View style={styles.smartSummaryIcon}>
          <KikoMascot pose="groceryList" size={46} />
        </View>
        <View style={styles.smartSummaryCopy}>
          <Text style={styles.smartSummaryTitle}>{summary.headline}</Text>
          <Text style={styles.smartSummaryBody}>{summary.subheadline}</Text>
        </View>
      </View>
      <View style={styles.smartMetricRow}>
        <SmartMetric label="Need to buy" value={summary.needToBuy.length} />
        <SmartMetric label="Probably have" value={summary.probablyHave.length} />
        <SmartMetric label="Swaps" value={summary.swaps.length} />
      </View>
      {summary.savingsHint ? <Text style={styles.smartSavingsHint}>{summary.savingsHint}</Text> : null}
    </View>
  );
}

function SmartMetric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.smartMetric}>
      <Text style={styles.smartMetricValue}>{value}</Text>
      <Text numberOfLines={1} style={styles.smartMetricLabel}>{label}</Text>
    </View>
  );
}

type SmartGrocerySectionProps = {
  checkedItemIds: string[];
  emptyCopy?: string;
  items: SmartGroceryItem[];
  onToggleItem: (itemId: string) => void;
  title: string;
};

function SmartGrocerySection({
  checkedItemIds,
  emptyCopy = 'Nothing here for this recipe.',
  items,
  onToggleItem,
  title,
}: SmartGrocerySectionProps) {
  if (items.length === 0) {
    return (
      <View style={styles.smartSectionCard}>
        <Text style={styles.smartSectionTitle}>{title}</Text>
        <Text style={styles.smartEmptyText}>{emptyCopy}</Text>
      </View>
    );
  }

  return (
    <View style={styles.smartSectionCard}>
      <View style={styles.smartSectionHeader}>
        <Text style={styles.smartSectionTitle}>{title}</Text>
        <Text style={styles.smartSectionCount}>{items.length}</Text>
      </View>
      {items.map((item, index) => {
        const isChecked = checkedItemIds.includes(item.id);

        return (
          <Pressable
            key={item.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isChecked }}
            onPress={() => onToggleItem(item.id)}
            style={({ pressed }) => [
              styles.itemRow,
              index === items.length - 1 ? styles.itemRowLast : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={[styles.checkbox, isChecked ? styles.checkboxChecked : null]}>
              {isChecked ? <Check color={colors.onCoral} height={14} strokeWidth={2.6} width={14} /> : null}
            </View>
            <View style={styles.smartItemCopy}>
              <Text style={[styles.itemText, isChecked ? styles.itemTextChecked : null]}>
                {formatSmartGroceryItem(item)}
              </Text>
              <Text style={styles.smartItemReason}>{item.reason}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function SmartSwapsCard({ swaps }: { swaps: SmartGrocerySwap[] }) {
  return (
    <View style={styles.smartSectionCard}>
      <View style={styles.smartSectionHeader}>
        <Text style={styles.smartSectionTitle}>Smart swaps</Text>
        <Text style={styles.smartSectionCount}>{swaps.length}</Text>
      </View>
      {swaps.map((swap, index) => (
        <View
          key={swap.id}
          style={[
            styles.smartSwapRow,
            index === swaps.length - 1 ? styles.itemRowLast : null,
          ]}
        >
          <View style={styles.smartSwapBadge}>
            <Text style={styles.smartSwapBadgeText}>{getSwapLabel(swap.kind)}</Text>
          </View>
          <Text style={styles.smartSwapText}>{swap.reason}</Text>
        </View>
      ))}
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

function getSmartItems(summary: SmartGrocerySummary) {
  return [...summary.needToBuy, ...summary.probablyHave, ...summary.optional];
}

function getSwapLabel(kind: SmartGrocerySwap['kind']) {
  switch (kind) {
    case 'cheaper':
      return 'Cheaper';
    case 'easier':
      return 'Easier';
    case 'healthier':
      return 'Balanced';
    case 'pantry':
    default:
      return 'Pantry';
  }
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
  const recipeIngredients = (Array.isArray(recipe.ingredients) ? recipe.ingredients : [])
    .filter((ingredient) => ingredient?.name?.trim());
  if (groceryItems.length > 0) {
    // recipe.ingredients is the source of truth: drop grocery entries that do
    // not resolve to a recipe ingredient. Protects against legacy saved recipes
    // with model-invented grocery items.
    const consistentItems = groceryItems.filter((item) => isRecipeBackedGroceryItem(item, recipeIngredients));
    if (consistentItems.length > 0) {
      return consistentItems.map((item) => ({
        ...item,
        category: getDisplayCategory(item.category),
        id: `${recipe.id}-${item.category}-${item.name}`,
        pantryItem: isPantryItem(item),
        pantryStaple: item.pantryStaple ?? isPantryItem(item),
      }));
    }
    // Every grocery entry failed the consistency check — rebuild from ingredients below.
  }

  return recipeIngredients.flatMap((ingredient) => toFallbackGroceryItems(recipe.id, ingredient));
}

function isRecipeBackedGroceryItem(item: GroceryListItem, recipeIngredients: RecipeIngredient[]) {
  if (recipeIngredients.length === 0) {
    return false;
  }

  return ingredientNameMatchesList(item.name, recipeIngredients) ||
    (item.sourceIngredient ? ingredientNameMatchesList(item.sourceIngredient, recipeIngredients) : false);
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
    .replace(new RegExp(`\\b${joinedCopyWord}(?:[-\\s]?style)?\\b`, 'gi'), 'inspired-by')
    .replace(new RegExp(`\\b${spacedCopyWord}(?:[-\\s]?style)?\\b`, 'gi'), 'inspired-by')
    .trim();
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    flexGrow: 1,
    paddingBottom: layout.scrollClearance,
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
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
    zIndex: 2,
    ...shadows.soft,
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
    fontFamily: fontFamilies.display,
    fontSize: 21,
    fontWeight: '800',
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
  savedRecipeCard: {
    ...surfaces.panel,
    overflow: 'hidden',
  },
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
    ...surfaces.card,
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
    ...surfaces.panel,
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
    ...typography.label,
    color: colors.coralDark,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 3,
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
  smartSummaryCard: {
    ...surfaces.card,
    marginTop: 14,
    padding: 16,
  },
  smartSummaryTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  smartSummaryIcon: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 999,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  smartSummaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  smartSummaryTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  smartSummaryBody: {
    color: colors.body,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  smartMetricRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  smartMetric: {
    backgroundColor: colors.cream,
    borderRadius: 16,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  smartMetricValue: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
  },
  smartMetricLabel: {
    color: colors.body,
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  smartSavingsHint: {
    color: colors.green,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 12,
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
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabButtonTextSelected: {
    color: colors.onCoral,
    fontFamily: fontFamilies.extraBold,
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
    ...surfaces.panel,
    marginTop: 16,
    overflow: 'hidden',
  },
  smartSectionCard: {
    ...surfaces.panel,
    marginTop: 14,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  smartSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  smartSectionTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  smartSectionCount: {
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  smartEmptyText: {
    color: colors.body,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 16,
    paddingTop: 8,
  },
  smartItemCopy: {
    flex: 1,
    minWidth: 0,
  },
  smartItemReason: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  smartSwapRow: {
    alignItems: 'flex-start',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
  },
  smartSwapBadge: {
    backgroundColor: colors.coralSoft,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  smartSwapBadgeText: {
    color: colors.coralDark,
    fontFamily: fontFamilies.extraBold,
    fontSize: 11,
    fontWeight: '800',
  },
  smartSwapText: {
    color: colors.charcoal,
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
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
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.1,
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
    borderColor: colors.mutedSoft,
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
    ...surfaces.panel,
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
    ...surfaces.card,
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
    fontFamily: fontFamilies.display,
    fontSize: 22,
    fontWeight: '800',
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
    ...shadows.cta,
  },
  primaryActionText: {
    color: colors.onCoral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
  },
  issueCard: {
    ...surfaces.card,
    marginTop: 18,
    padding: 18,
  },
  issueTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 31,
  },
  issueBody: {
    color: colors.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
