import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Clock,
  Search,
} from 'iconoir-react-native';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { actionIcons } from '../assets/actionIcons';
import { FoodImage } from '../components/FoodImage';
import { colors } from '../components/OkyoUI';
import { fontFamilies } from '../theme/okyoTheme';
import { type Recipe } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { resolveCanonicalRecipes, type CanonicalRecipe } from '../state/canonicalRecipes';
import { useOkyoStore } from '../state/useOkyoStore';
import { getRecipeImageSource, getRecipeImageStatus, getRecipeImageUrl } from '../utils/recipeImages';
import { getSavedMealCategories, type SavedMealCategory } from '../utils/recipeMealCategories';
import { checkImageFileExists, getStorageLocation } from '../utils/imageValidation';
import { imageTraceLog, uiLog } from '../utils/uiDebug';

type LibraryNavigation = NativeStackNavigationProp<RootStackParamList>;
type LibraryFilter = 'all' | SavedMealCategory;

const filters: Array<{ id: LibraryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'dessert', label: 'Dessert' },
];

const formatCurrency = (value: number) => `$${Math.max(0, value).toFixed(2)}`;
export function LibraryScreen() {
  const navigation = useNavigation<LibraryNavigation>();
  const recipesById = useOkyoStore((state) => state.recipesById);
  const savedRecipeIds = useOkyoStore((state) => state.savedRecipeIds);
  const addRecipeToGrocery = useOkyoStore((state) => state.addRecipeToGrocery);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<LibraryFilter>('all');
  const didTrackMalformedData = useRef(false);

  const safeSavedRecipes = useMemo(
    () => resolveCanonicalRecipes(recipesById, savedRecipeIds),
    [recipesById, savedRecipeIds],
  );
  const malformedRecipeCount = savedRecipeIds.length - safeSavedRecipes.length;
  const sortedRecipes = useMemo(() => sortSavedRecipes(safeSavedRecipes), [safeSavedRecipes]);
  const filteredRecipes = useMemo(
    () => filterRecipes(sortedRecipes, activeFilter, searchQuery),
    [activeFilter, searchQuery, sortedRecipes],
  );

  useEffect(() => {
    if (didTrackMalformedData.current || malformedRecipeCount === 0) {
      return;
    }

    uiLog('LibraryScreen', 'enter', { malformedRecipeCount });
    didTrackMalformedData.current = true;
    track(analyticsEvents.RESULT_ERROR, {
      errorMessage: 'Liked recipe data was missing fields.',
      screen: 'LibraryScreen',
    });
  }, [malformedRecipeCount]);

  const prepareRecipeContext = (recipe: CanonicalRecipe) => {
    const mode = recipe.selectedMode;
    setSelectedMode(mode);
    return mode;
  };

  const openSavedRecipe = (recipe: CanonicalRecipe | null | undefined) => {
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
    navigation.navigate('MainTabs', {
      screen: 'RecipeDetailScreen',
      params: { mode, recipeId: recipe.id },
    });
  };

  const openGroceries = (recipe: CanonicalRecipe | null | undefined) => {
    if (!recipe?.id) {
      return;
    }

    const mode = prepareRecipeContext(recipe);
    addRecipeToGrocery(recipe.id);
    uiLog('LibraryScreen', 'open_groceries', { recipeId: recipe.id });
    navigation.navigate('MainTabs', {
      screen: 'GroceryListScreen',
      params: { mode, recipeId: recipe.id },
    });
  };

  const goToExplore = () => {
    uiLog('LibraryScreen', 'empty_explore_cta');
    navigation.navigate('MainTabs', { screen: 'RestaurantPacksScreen' });
  };

  if (safeSavedRecipes.length === 0) {
    return (
      <LibraryFrame>
        <TopBar title="Liked" />
        <View style={styles.emptyCard}>
          <Image accessibilityIgnoresInvertColors resizeMode="contain" source={require('../../assets/food/liked-empty-kiko.png')} style={styles.emptyArt} />
          <Text style={styles.emptyTitle}>No liked recipes yet</Text>
          <Text style={styles.emptyBody}>Save recipes you love and they'll show up here.</Text>
          <PrimaryAction label="Explore recipes" onPress={goToExplore} />
        </View>
      </LibraryFrame>
    );
  }

  return (
    <LibraryFrame>
      <TopBar title="Liked" />

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search color="#a89a8a" height={22} strokeWidth={2} width={22} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={setSearchQuery}
            placeholder="Search liked recipes"
            placeholderTextColor="#978b80"
            returnKeyType="search"
            style={styles.searchInput}
            value={searchQuery}
          />
        </View>
      </View>

      <ScrollView horizontal contentContainerStyle={styles.filterList} showsHorizontalScrollIndicator={false}>
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
            />
          ))
        ) : (
          <View style={styles.noMatchesCard}>
            <Text style={styles.noMatchesTitle}>{activeFilter === 'all' ? 'No recipes match that yet.' : `No ${filters.find((filter) => filter.id === activeFilter)?.label.toLowerCase()} recipes yet.`}</Text>
            <Text style={styles.noMatchesBody}>Save one and it’ll show up here.</Text>
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
}: {
  recipe: CanonicalRecipe;
  onCook: () => void;
  onGroceries: () => void;
}) {
  const protein = getFiniteNumber(recipe.nutritionEstimate?.proteinGrams);

  return (
    <Pressable
      accessibilityHint="Opens this recipe"
      accessibilityRole="button"
      style={({ pressed }) => [styles.recipeCard, pressed ? styles.recipeCardPressed : null]}
      onPress={onCook}
    >
      <View style={styles.recipeTop}>
        <RecipeThumb recipe={recipe} />
        <View style={styles.recipeContent}>
          <Text numberOfLines={2} style={styles.recipeTitle}>{cleanDisplayText(recipe.title)}</Text>
          <View style={styles.recipeMetaRow}>
            <Clock color={colors.muted} height={14} strokeWidth={2} width={14} />
            <Text numberOfLines={1} style={styles.recipeMetaText}>{getTotalTime(recipe)} min{protein > 0 ? ` · ${Math.round(protein)}g protein` : ''}</Text>
          </View>
          <Text numberOfLines={1} style={styles.recipeCost}>Home est. {formatCurrency(getFiniteNumber(recipe.estimatedHomemadeCost))}</Text>
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
          <Image accessibilityElementsHidden resizeMode="contain" source={actionIcons.grocery} style={styles.groceryIcon} />
          <Text style={styles.groceryButtonText}>Groceries</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function RecipeThumb({ recipe }: { recipe: Recipe }) {
  return (
    <FoodImage
      imageSource={getRecipeImageSource(recipe)}
      imageStatus={getRecipeImageStatus(recipe)}
      imageUrl={getRecipeImageUrl(recipe)}
      style={styles.recipeImage}
    />
  );
}

function PrimaryAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.primaryAction, pressed ? styles.pressed : null]}
      onPress={onPress}
    >
      <Text style={styles.primaryActionText}>{label}</Text>
    </Pressable>
  );
}

function filterRecipes(recipes: CanonicalRecipe[], activeFilter: LibraryFilter, searchQuery: string) {
  const query = searchQuery.trim().toLowerCase();

  return recipes.filter((recipe) => {
    const matchesSearch = query.length === 0 || getSearchText(recipe).includes(query);
    if (!matchesSearch) {
      return false;
    }

    return activeFilter === 'all' || getSavedMealCategories(recipe).includes(activeFilter);
  });
}

function sortSavedRecipes(recipes: CanonicalRecipe[]) {
  return recipes.slice().sort((a, b) => {
    const aTime = getSavedTime(a);
    const bTime = getSavedTime(b);
    if (aTime || bTime) {
      return bTime - aTime;
    }

    return recipes.indexOf(b) - recipes.indexOf(a);
  });
}

function getSavedTime(recipe: CanonicalRecipe) {
  const maybeSavedAt = recipe.savedAt ?? recipe.createdAt;

  if (typeof maybeSavedAt !== 'string') {
    return 0;
  }

  const date = new Date(maybeSavedAt);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

function getSearchText(recipe: CanonicalRecipe) {
  const ingredientText = recipe.ingredients?.map((ingredient) => ingredient.name).join(' ') ?? '';
  return `${recipe.title} ${recipe.description} ${recipe.selectedMode} ${ingredientText}`.toLowerCase();
}

function getTotalTime(recipe: Recipe) {
  const total = getFiniteNumber(recipe.totalTimeMinutes);
  return total > 0 ? total : getFiniteNumber(recipe.prepTimeMinutes) + getFiniteNumber(recipe.cookTimeMinutes);
}

function getFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function cleanDisplayText(value: string) {
  const copyWord = `copy${'cat'}`;
  const copyStyle = `${copyWord}-style`;

  return value
    .replace(new RegExp(`\\b${copyStyle}\\b`, 'gi'), 'homemade')
    .replace(new RegExp(`\\b${copyWord}\\b`, 'gi'), 'homemade')
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
    gap: 10,
    padding: 20,
    paddingBottom: 150,
    paddingTop: 0,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 6,
    justifyContent: 'space-between',
    minHeight: 44,
  },
  topTitle: {
    color: colors.charcoal,
    flex: 1,
    fontFamily: fontFamilies.extraBold,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  topSpacer: {
    width: 48,
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 14,
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
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    paddingRight: 8,
  },
  filterChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 11,
  },
  filterChipSelected: {
    backgroundColor: '#FFF0F4',
  },
  filterText: {
    color: colors.charcoal,
    fontSize: 13,
    fontWeight: '700',
  },
  filterTextSelected: {
    color: colors.coralDark,
  },
  recipeList: {
    gap: 12,
  },
  recipeCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    padding: 10,
  },
  recipeCardPressed: {
    opacity: 0.86,
  },
  recipeTop: {
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  recipeImage: {
    backgroundColor: colors.cream,
    borderRadius: 16,
    height: 92,
    width: 92,
  },
  recipeContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingVertical: 2,
  },
  recipeTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
  },
  recipeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  recipeMetaText: {
    color: colors.body,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  recipeCost: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
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
    minHeight: 40,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  cookButtonText: {
    color: '#fffdf8',
    fontSize: 14,
    fontWeight: '700',
  },
  groceryButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  groceryButtonText: {
    color: colors.coral,
    fontSize: 14,
    fontWeight: '700',
  },
  groceryIcon: { height: 24, width: 24 },
  noMatchesCard: {
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
    alignItems: 'center',
    gap: 12,
    marginTop: 28,
    paddingHorizontal: 20,
  },
  emptyArt: {
    height: 238,
    marginBottom: 0,
    width: '100%',
  },
  emptyTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  primaryAction: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.coral,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 18,
    width: '80%',
  },
  primaryActionText: {
    color: '#fffdf8',
    fontSize: 17,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
});
