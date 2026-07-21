import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Camera,
  Cart,
  Clock,
  Cutlery,
  MoneySquare,
  Search,
  ThreePointsCircle,
} from 'iconoir-react-native';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { FoodImage } from '../components/FoodImage';
import { KikoMascot } from '../components/KikoMascot';
import { colors, fontFamilies, layout, shadows, surfaces, typography } from '../theme/okyoTheme';
import { getSafeRecipeMode, isRecipeMode, type Recipe } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { getModeChipPalette, getModeLabel } from '../utils/modeDisplay';
import { getRecipeImageStatus, getRecipeImageUrl } from '../utils/recipeImages';
import { checkImageFileExists, getStorageLocation } from '../utils/imageValidation';
import { imageTraceLog, uiLog } from '../utils/uiDebug';

type LibraryNavigation = NativeStackNavigationProp<RootStackParamList>;
type LibraryFilter = 'all' | 'restaurant' | 'budget' | 'lighter' | 'fast';
type LibrarySort = 'newest' | 'name' | 'fastest';

const filters: Array<{ id: LibraryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'budget', label: 'Budget' },
  { id: 'lighter', label: 'Lighter' },
  { id: 'fast', label: 'Fast' },
];
const sortOptions: Array<{ id: LibrarySort; label: string }> = [
  { id: 'newest', label: 'Newest' },
  { id: 'name', label: 'A-Z' },
  { id: 'fastest', label: 'Fastest' },
];

const formatCurrency = (value: number) => `$${Math.max(0, value).toFixed(2)}`;

export function LibraryScreen() {
  const navigation = useNavigation<LibraryNavigation>();
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const removeSavedRecipe = useOkyoStore((state) => state.removeSavedRecipe);
  const writeSavedRecipeContext = useOkyoStore((state) => state.writeSavedRecipeContext);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<LibraryFilter>('all');
  const [activeSort, setActiveSort] = useState<LibrarySort>('newest');
  const didTrackMalformedData = useRef(false);

  const safeSavedRecipes = Array.isArray(savedRecipes) ? savedRecipes.filter((recipe) => recipe?.id && recipe?.title) : [];
  const malformedRecipeCount = Array.isArray(savedRecipes)
    ? savedRecipes.filter((recipe) => !recipe?.id || !recipe?.title).length
    : 0;
  const sortedRecipes = useMemo(() => sortSavedRecipes(safeSavedRecipes, activeSort), [activeSort, safeSavedRecipes]);
  const filteredRecipes = useMemo(
    () => filterRecipes(sortedRecipes, activeFilter, searchQuery),
    [activeFilter, searchQuery, sortedRecipes],
  );
  const totalHomemadeEstimate = safeSavedRecipes.reduce((total, recipe) => total + getFiniteNumber(recipe.estimatedHomemadeCost), 0);
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

  const prepareRecipeContext = (recipe: Recipe) => {
    const mode = getSafeRecipeMode(recipe.mode);
    writeSavedRecipeContext({
      recipe,
      reason: 'open_saved_recipe',
      source: 'LibraryScreen.prepareRecipeContext',
    });
    if (isRecipeMode(recipe.mode)) {
      setSelectedMode(recipe.mode);
    }
    return mode;
  };

  const openSavedRecipe = (recipe: Recipe | null | undefined) => {
    if (!recipe?.id) {
      return;
    }

    const mode = prepareRecipeContext(recipe);
    const imageUri = getRecipeImageUrl(recipe) ?? null;
    const hasStampedUri = Boolean((recipe as { imageUri?: string }).imageUri);
    checkImageFileExists(imageUri).then((fileExists) => {
      imageTraceLog('LibraryScreen', {
        screen: 'LibraryScreen',
        recipeId: recipe.id,
        imageSource: hasStampedUri ? 'recipe.imageUri' : 'recipe.imageUrl',
        imageUri,
        fileExists: imageUri ? fileExists : 'n/a',
        usingFallback: !hasStampedUri,
        fallbackReason: !hasStampedUri ? 'recipe_imageUri_not_stamped' : null,
        storageLocation: getStorageLocation(imageUri),
      });
    });
    uiLog('LibraryScreen', 'cook_again', { recipeId: recipe.id });
    navigation.navigate('MainTabs', { screen: 'RecipeDetailScreen', params: { mode } });
  };

  const openGroceries = (recipe: Recipe | null | undefined) => {
    if (!recipe?.id) {
      return;
    }

    const mode = prepareRecipeContext(recipe);
    uiLog('LibraryScreen', 'open_groceries', { recipeId: recipe.id });
    navigation.navigate('MainTabs', { screen: 'GroceryListScreen', params: { mode } });
  };

  const goToScan = () => {
    uiLog('LibraryScreen', 'empty_scan_cta');
    navigation.navigate('MainTabs', { screen: 'HomeScreen' });
  };

  const confirmRemove = (recipe: Recipe) => {
    Alert.alert(
      'Remove from Library?',
      `${cleanDisplayText(recipe.title)} will leave your saved meals.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            uiLog('LibraryScreen', 'remove_saved_recipe', { recipeId: recipe.id });
            removeSavedRecipe(recipe.id);
          },
        },
      ],
    );
  };

  if (safeSavedRecipes.length === 0) {
    return (
      <LibraryFrame>
        <TopBar title="Saved" />
        <View style={styles.emptyCard}>
          <KikoMascot animated="idle" pose="wave" size={118} style={styles.emptyMascot} />
          <Text style={styles.emptyTitle}>Saved meals worth remaking will live here.</Text>
          <Text style={styles.emptyBody}>
            Scan a craving, save the homemade version, and Okyo will build your dinner shelf.
          </Text>
          <PrimaryAction icon={<Camera color={colors.onCoral} height={20} strokeWidth={2.2} width={20} />} label="Scan a meal" onPress={goToScan} />
        </View>
      </LibraryFrame>
    );
  }

  return (
    <LibraryFrame>
      <TopBar title="Saved" />

      <View style={styles.heroCard}>
        <Text style={styles.heroKicker}>{safeSavedRecipes.length} saved · {formatCurrency(totalHomemadeEstimate)} home est.</Text>
        <Text style={styles.heroTitle}>Recipes worth remaking</Text>
        <Text style={styles.heroBody}>Your scan-inspired meals, ready for another dinner.</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search color={colors.mutedSoft} height={22} strokeWidth={2} width={22} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={setSearchQuery}
            placeholder="Search saved recipes"
            placeholderTextColor={colors.mutedSoft}
            returnKeyType="search"
            style={styles.searchInput}
            value={searchQuery}
          />
        </View>
      </View>

      <View style={styles.sortControl}>
        {sortOptions.map((option) => {
          const selected = activeSort === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setActiveSort(option.id)}
              style={[styles.sortOption, selected ? styles.sortOptionSelected : null]}
            >
              <Text style={[styles.sortText, selected ? styles.sortTextSelected : null]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.filterList} horizontal showsHorizontalScrollIndicator={false}>
        {filters.map((filter) => {
          const selected = activeFilter === filter.id;

          return (
            <Pressable
              key={filter.id}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.filterChip,
                selected ? styles.filterChipSelected : null,
                pressed ? styles.pressed : null,
              ]}
              onPress={() => {
                uiLog('LibraryScreen', 'select_filter', { filter: filter.id });
                setActiveFilter(filter.id);
              }}
            >
              <Text style={[styles.filterText, selected ? styles.filterTextSelected : null]}>{filter.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.recipeList}>
        {filteredRecipes.length > 0 ? (
          filteredRecipes.map((recipe) => (
            <SavedRecipeCard
              key={recipe.id}
              recipe={recipe}
              onCook={() => openSavedRecipe(recipe)}
              onGroceries={() => openGroceries(recipe)}
              onRemove={() => confirmRemove(recipe)}
            />
          ))
        ) : (
          <View style={styles.noMatchesCard}>
            <Text style={styles.noMatchesTitle}>No saved meals match that yet.</Text>
            <Text style={styles.noMatchesBody}>Try another search or switch filters to see more of your recipe shelf.</Text>
          </View>
        )}
      </View>
    </LibraryFrame>
  );
}

function LibraryFrame({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function TopBar({ title }: { title: string }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topSpacer} />
      <Text style={styles.topTitle}>{title}</Text>
      <View style={styles.topSpacer} />
    </View>
  );
}

function SavedRecipeCard({
  recipe,
  onCook,
  onGroceries,
  onRemove,
}: {
  recipe: Recipe;
  onCook: () => void;
  onGroceries: () => void;
  onRemove: () => void;
}) {
  const mode = getSafeRecipeMode(recipe.mode);
  const modeLabel = getModeLabel(mode);
  const modePalette = getModeChipPalette(mode);

  return (
    <View style={styles.recipeCard}>
      <View style={styles.recipeTop}>
        <RecipeThumb recipe={recipe} />
        <View style={styles.recipeContent}>
          <View style={styles.cardTopRow}>
            <View style={[styles.modePill, { backgroundColor: modePalette.bg }]}>
              <Cutlery color={modePalette.text} height={13} strokeWidth={2.2} width={13} />
              <Text numberOfLines={1} style={[styles.modePillText, { color: modePalette.text }]}>{modeLabel}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.moreButton, pressed ? styles.pressed : null]}
              onPress={onRemove}
            >
              <ThreePointsCircle color={colors.body} height={20} strokeWidth={2.2} width={20} />
            </Pressable>
          </View>
          <Text numberOfLines={2} style={styles.recipeTitle}>{cleanDisplayText(recipe.title)}</Text>
          <Text numberOfLines={1} style={styles.recipeSubtitle}>Inspired-by homemade version</Text>
          <View style={styles.recipeMetaRow}>
            <MetaChip icon={<Clock color={colors.charcoal} height={15} strokeWidth={2} width={15} />} label={`${getTotalTime(recipe)} min`} />
            <MetaChip icon={<Cutlery color={colors.charcoal} height={15} strokeWidth={2} width={15} />} label={getDifficulty(recipe)} />
            <MetaChip icon={<MoneySquare color={colors.green} height={15} strokeWidth={2} width={15} />} label={`Home est. ${formatCurrency(getFiniteNumber(recipe.estimatedHomemadeCost))}`} tone="green" />
          </View>
        </View>
      </View>
      <View style={styles.cardActions}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.cookButton, pressed ? styles.pressed : null]}
          onPress={onCook}
        >
          <Text style={styles.cookButtonText}>Cook again</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.groceryButton, pressed ? styles.pressed : null]}
          onPress={onGroceries}
        >
          <Cart color={colors.coral} height={16} strokeWidth={2.1} width={16} />
          <Text style={styles.groceryButtonText}>Groceries</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RecipeThumb({ recipe }: { recipe: Recipe }) {
  return (
    <FoodImage
      imageStatus={getRecipeImageStatus(recipe)}
      imageUrl={getRecipeImageUrl(recipe)}
      style={styles.recipeImage}
    />
  );
}

function MetaChip({ icon, label, tone = 'default' }: { icon: ReactNode; label: string; tone?: 'default' | 'green' }) {
  return (
    <View style={styles.metaChip}>
      {icon}
      <Text numberOfLines={1} style={[styles.metaText, tone === 'green' ? styles.metaTextGreen : null]}>{label}</Text>
    </View>
  );
}

function PrimaryAction({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.primaryAction, pressed ? styles.pressed : null]}
      onPress={onPress}
    >
      {icon}
      <Text style={styles.primaryActionText}>{label}</Text>
    </Pressable>
  );
}

function filterRecipes(recipes: Recipe[], activeFilter: LibraryFilter, searchQuery: string) {
  const query = searchQuery.trim().toLowerCase();

  return recipes.filter((recipe) => {
    const matchesSearch = query.length === 0 || getSearchText(recipe).includes(query);
    if (!matchesSearch) {
      return false;
    }

    switch (activeFilter) {
      case 'restaurant':
        return recipe.mode === 'Restaurant Copy';
      case 'budget':
        return recipe.mode === 'Budget';
      case 'lighter':
        return recipe.mode === 'Healthy';
      case 'fast':
        return getTotalTime(recipe) <= 30;
      case 'all':
      default:
        return true;
    }
  });
}

function sortSavedRecipes(recipes: Recipe[], sort: LibrarySort) {
  if (sort === 'name') {
    return recipes.slice().sort((a, b) => a.title.localeCompare(b.title));
  }
  if (sort === 'fastest') {
    return recipes.slice().sort((a, b) => getTotalTime(a) - getTotalTime(b));
  }

  return recipes.slice().sort((a, b) => {
    const aTime = getSavedTime(a);
    const bTime = getSavedTime(b);
    if (aTime || bTime) {
      return bTime - aTime;
    }

    return recipes.indexOf(b) - recipes.indexOf(a);
  });
}

function getSavedTime(recipe: Recipe) {
  const maybeSavedAt = (recipe as Recipe & { savedAt?: unknown; createdAt?: unknown }).savedAt ??
    (recipe as Recipe & { savedAt?: unknown; createdAt?: unknown }).createdAt;

  if (typeof maybeSavedAt !== 'string') {
    return 0;
  }

  const date = new Date(maybeSavedAt);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

function getSearchText(recipe: Recipe) {
  const ingredientText = recipe.ingredients?.map((ingredient) => ingredient.name).join(' ') ?? '';
  return `${recipe.title} ${recipe.description} ${recipe.mode} ${ingredientText}`.toLowerCase();
}

function getTotalTime(recipe: Recipe) {
  const total = getFiniteNumber(recipe.totalTimeMinutes);
  return total > 0 ? total : getFiniteNumber(recipe.prepTimeMinutes) + getFiniteNumber(recipe.cookTimeMinutes);
}

function getDifficulty(recipe: Recipe) {
  return recipe.skillLevel ?? recipe.difficulty ?? 'Easy';
}

function getFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function cleanDisplayText(value: string) {
  const copyWord = `copy${'cat'}`;
  const copyStyle = `${copyWord}-style`;

  return value
    .replace(new RegExp(`\\b${copyStyle}\\b`, 'gi'), 'restaurant-style')
    .replace(new RegExp(`\\b${copyWord}\\b`, 'gi'), 'restaurant-style')
    .replace(/\bdupes?\b/gi, 'swaps')
    .replace(/\bmock\b/gi, 'demo')
    .trim();
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    gap: 12,
    padding: 24,
    paddingBottom: layout.scrollClearance,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  topTitle: {
    ...typography.title,
    flex: 1,
    fontSize: 26,
    lineHeight: 33,
    textAlign: 'center',
  },
  topSpacer: {
    width: 48,
  },
  heroCard: {
    borderBottomColor: colors.borderStrong,
    borderBottomWidth: 1,
    paddingBottom: 16,
    paddingTop: 4,
  },
  heroCopy: {},
  heroKicker: {
    ...typography.label,
    color: colors.coralDark,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  heroTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 31,
  },
  heroBody: {
    color: colors.body,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    marginTop: 6,
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 16,
    ...shadows.soft,
  },
  searchInput: {
    color: colors.charcoal,
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    minWidth: 0,
    paddingVertical: 0,
  },
  filterList: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 24,
  },
  sortControl: {
    backgroundColor: colors.creamDeep,
    borderRadius: 8,
    flexDirection: 'row',
    padding: 3,
  },
  sortOption: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
  },
  sortOptionSelected: {
    backgroundColor: colors.card,
    ...shadows.soft,
  },
  sortText: {
    color: colors.body,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
  },
  sortTextSelected: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
  },
  filterChip: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 12,
  },
  filterChipSelected: {
    backgroundColor: colors.coralSoft,
  },
  filterText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  filterTextSelected: {
    color: colors.coralDark,
    fontFamily: fontFamilies.extraBold,
  },
  recipeList: {
    gap: 12,
  },
  recipeCard: {
    ...surfaces.panel,
    gap: 9,
    padding: 10,
  },
  recipeTop: {
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  recipeImage: {
    backgroundColor: colors.cream,
    borderRadius: 8,
    height: 80,
    width: 80,
  },
  recipeContent: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 2,
  },
  cardTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  modePill: {
    alignItems: 'center',
    backgroundColor: colors.coralSoft,
    borderRadius: 6,
    flexDirection: 'row',
    gap: 5,
    maxWidth: '82%',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  modePillText: {
    color: colors.coralDark,
    flexShrink: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    fontWeight: '700',
  },
  moreButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  recipeTitle: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
    marginTop: 5,
  },
  recipeSubtitle: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  recipeMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 6,
  },
  metaChip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    maxWidth: '100%',
  },
  metaText: {
    color: colors.charcoal,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  metaTextGreen: {
    color: colors.green,
    fontWeight: '700',
  },
  cardActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 0,
  },
  cookButton: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 999,
    justifyContent: 'center',
    flex: 1,
    minHeight: 38,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  cookButtonText: {
    color: colors.onCoral,
    fontSize: 14,
    fontWeight: '700',
  },
  groceryButton: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  groceryButtonText: {
    color: colors.coralDark,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
  },
  noMatchesCard: {
    ...surfaces.panel,
    padding: 20,
  },
  noMatchesTitle: {
    color: colors.charcoal,
    fontSize: 19,
    fontWeight: '700',
  },
  noMatchesBody: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  emptyCard: {
    ...surfaces.card,
    alignItems: 'center',
    gap: 14,
    marginTop: 24,
    padding: 24,
  },
  emptyMascot: {
    marginBottom: 2,
  },
  emptyTitle: {
    color: colors.charcoal,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 31,
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.body,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  primaryAction: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.coral,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 18,
    ...shadows.cta,
  },
  primaryActionText: {
    color: colors.onCoral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
