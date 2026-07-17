import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Cart, Search, Trash } from 'iconoir-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodImage } from '../components/FoodImage';
import { KikoMascot } from '../components/KikoMascot';
import { getSafeRecipeMode, type Recipe } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { colors, layout, radius, spacing, surfaces, typography } from '../theme/okyoTheme';
import { getRecipeImageStatus, getRecipeImageUrl } from '../utils/recipeImages';

type SavedNavigation = NativeStackNavigationProp<RootStackParamList>;
type SavedSort = 'recent' | 'oldest' | 'name' | 'shortest';
type DifficultyFilter = 'All' | Recipe['difficulty'];

const sortOptions: Array<{ id: SavedSort; label: string }> = [
  { id: 'recent', label: 'Recently saved' },
  { id: 'oldest', label: 'Oldest saved' },
  { id: 'name', label: 'Recipe name' },
  { id: 'shortest', label: 'Shortest cook' },
];
const difficultyOptions: DifficultyFilter[] = ['All', 'Easy', 'Medium', 'Hard'];

export function LibraryScreen() {
  const navigation = useNavigation<SavedNavigation>();
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const groceryRecipeIds = useOkyoStore((state) => state.groceryRecipeIds);
  const addRecipeToGrocery = useOkyoStore((state) => state.addRecipeToGrocery);
  const removeRecipeFromGrocery = useOkyoStore((state) => state.removeRecipeFromGrocery);
  const removeSavedRecipe = useOkyoStore((state) => state.removeSavedRecipe);
  const writeRecipeContext = useOkyoStore((state) => state.writeSavedRecipeContext);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SavedSort>('recent');
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('All');

  const recipes = useMemo(() => {
    const valid = (Array.isArray(savedRecipes) ? savedRecipes : []).filter(
      (recipe) => recipe?.id && recipe?.title?.trim(),
    );
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = valid.filter((recipe) =>
      (difficulty === 'All' || recipe.difficulty === difficulty) &&
      (!normalizedQuery || `${recipe.title} ${recipe.description}`.toLowerCase().includes(normalizedQuery)),
    );
    return filtered.slice().sort((a, b) => compareRecipes(a, b, sort, valid));
  }, [difficulty, query, savedRecipes, sort]);

  const openRecipe = (recipe: Recipe) => {
    writeRecipeContext({ recipe, reason: 'open_saved_recipe', source: 'LibraryScreen' });
    navigation.navigate('RecipeDetailScreen', { mode: getSafeRecipeMode(recipe.mode) });
  };

  const confirmUnsave = (recipe: Recipe) => {
    Alert.alert('Remove saved recipe?', recipe.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeSavedRecipe(recipe.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>SAVED</Text>
        <Text style={styles.title}>Your recipes</Text>
        <Text style={styles.body}>Only recipes you intentionally saved appear here.</Text>

        <View style={styles.searchWrap}>
          <Search color={colors.muted} height={20} strokeWidth={2} width={20} />
          <TextInput
            accessibilityLabel="Search saved recipes"
            autoCapitalize="none"
            placeholder="Search recipes"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <Text style={styles.controlLabel}>Sort</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {sortOptions.map((option) => (
            <Chip key={option.id} active={sort === option.id} label={option.label} onPress={() => setSort(option.id)} />
          ))}
        </ScrollView>

        <Text style={styles.controlLabel}>Difficulty</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {difficultyOptions.map((option) => (
            <Chip key={option} active={difficulty === option} label={option} onPress={() => setDifficulty(option)} />
          ))}
        </ScrollView>

        {recipes.length > 0 ? (
          <View style={styles.list}>
            {recipes.map((recipe) => {
              const inGrocery = groceryRecipeIds.includes(recipe.id);
              return (
                <View key={recipe.id} style={styles.card}>
                  <Pressable accessibilityRole="button" style={styles.cardMain} onPress={() => openRecipe(recipe)}>
                    <FoodImage imageStatus={getRecipeImageStatus(recipe)} imageUrl={getRecipeImageUrl(recipe)} style={styles.image} />
                    <View style={styles.cardCopy}>
                      <Text numberOfLines={2} style={styles.recipeTitle}>{recipe.title}</Text>
                      <Text style={styles.meta}>{recipe.difficulty} · {recipe.cookTimeMinutes} min cook</Text>
                    </View>
                  </Pressable>
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      style={styles.action}
                      onPress={() => inGrocery ? removeRecipeFromGrocery(recipe.id) : addRecipeToGrocery(recipe.id)}
                    >
                      <Cart color={colors.coralDark} height={18} strokeWidth={2} width={18} />
                      <Text style={styles.actionText}>{inGrocery ? 'Remove from Grocery' : 'Add to Grocery'}</Text>
                    </Pressable>
                    <Pressable accessibilityLabel={`Unsave ${recipe.title}`} accessibilityRole="button" style={styles.iconAction} onPress={() => confirmUnsave(recipe)}>
                      <Trash color={colors.danger} height={19} strokeWidth={2} width={19} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.empty}>
            <KikoMascot animated="idle" pose="recipe" size={92} />
            <Text style={styles.emptyTitle}>{savedRecipes.length > 0 ? 'No recipes match' : 'Nothing saved yet'}</Text>
            <Text style={styles.emptyBody}>{savedRecipes.length > 0 ? 'Try a different search or filter.' : 'Save a recipe and it will stay here.'}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.chip, active ? styles.chipActive : null]} onPress={onPress}>
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function compareRecipes(a: Recipe, b: Recipe, sort: SavedSort, allRecipes: Recipe[]) {
  if (sort === 'name') return a.title.localeCompare(b.title);
  if (sort === 'shortest') return a.cookTimeMinutes - b.cookTimeMinutes || a.title.localeCompare(b.title);
  const aTime = Date.parse(a.savedAt ?? '') || allRecipes.indexOf(a);
  const bTime = Date.parse(b.savedAt ?? '') || allRecipes.indexOf(b);
  return sort === 'oldest' ? aTime - bTime : bTime - aTime;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { padding: spacing.screen, paddingBottom: layout.scrollClearance },
  kicker: { ...typography.label, color: colors.coralDark },
  title: { ...typography.display, fontSize: 32, lineHeight: 38, marginTop: 6 },
  body: { ...typography.body, marginTop: 8 },
  searchWrap: { ...surfaces.panel, alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 20, minHeight: 52, paddingHorizontal: 14 },
  searchInput: { color: colors.charcoal, flex: 1, fontSize: 16, minHeight: 48 },
  controlLabel: { color: colors.charcoal, fontSize: 14, fontWeight: '800', marginBottom: 8, marginTop: 16 },
  chips: { gap: 8, paddingRight: 10 },
  chip: { backgroundColor: colors.cream, borderColor: colors.border, borderRadius: radius.chip, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  chipActive: { backgroundColor: colors.coral, borderColor: colors.coral },
  chipText: { color: colors.charcoal, fontSize: 13, fontWeight: '800' },
  chipTextActive: { color: colors.onCoral },
  list: { gap: 12, marginTop: 22 },
  card: { ...surfaces.card, overflow: 'hidden', padding: 12 },
  cardMain: { alignItems: 'center', flexDirection: 'row', gap: 13, minHeight: 84 },
  image: { borderRadius: 15, height: 78, width: 78 },
  cardCopy: { flex: 1 },
  recipeTitle: { color: colors.charcoal, fontSize: 18, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 6 },
  actions: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10 },
  action: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 7, minHeight: 44, paddingHorizontal: 4 },
  actionText: { color: colors.coralDark, fontSize: 13, fontWeight: '800' },
  iconAction: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  empty: { ...surfaces.panel, alignItems: 'center', marginTop: 24, padding: 22 },
  emptyTitle: { color: colors.charcoal, fontSize: 19, fontWeight: '800', marginTop: 6 },
  emptyBody: { ...typography.body, marginTop: 5, textAlign: 'center' },
});
