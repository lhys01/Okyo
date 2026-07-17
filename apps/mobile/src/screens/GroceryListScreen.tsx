import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, NavArrowRight, Plus, Trash } from 'iconoir-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KikoMascot } from '../components/KikoMascot';
import { getSafeRecipeMode, type Recipe } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { colors, layout, radius, spacing, surfaces, typography } from '../theme/okyoTheme';
import { consolidateRecipeIngredients } from '../utils/groceryConsolidation';

type GroceryNavigation = NativeStackNavigationProp<RootStackParamList>;

export function GroceryListScreen() {
  const navigation = useNavigation<GroceryNavigation>();
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const selectedIds = useOkyoStore((state) => state.groceryRecipeIds);
  const checkedIds = useOkyoStore((state) => state.groceryCheckedItemIds);
  const clearedIds = useOkyoStore((state) => state.groceryClearedItemIds);
  const addRecipe = useOkyoStore((state) => state.addRecipeToGrocery);
  const removeRecipe = useOkyoStore((state) => state.removeRecipeFromGrocery);
  const toggleItem = useOkyoStore((state) => state.toggleGroceryItem);
  const clearCompleted = useOkyoStore((state) => state.clearCompletedGroceryItems);
  const writeRecipeContext = useOkyoStore((state) => state.writeSavedRecipeContext);

  const validRecipes = useMemo(
    () => (Array.isArray(savedRecipes) ? savedRecipes.filter((recipe) => recipe?.id && recipe?.title) : []),
    [savedRecipes],
  );
  const selectedRecipes = validRecipes.filter((recipe) => selectedIds.includes(recipe.id));
  const items = useMemo(
    () => consolidateRecipeIngredients(selectedRecipes).filter((item) => !clearedIds.includes(item.id)),
    [clearedIds, selectedRecipes],
  );

  const openRecipe = (recipe: Recipe) => {
    writeRecipeContext({ recipe, reason: 'open_grocery_recipe', source: 'GroceryListScreen' });
    navigation.navigate('RecipeDetailScreen', { mode: getSafeRecipeMode(recipe.mode) });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>GROCERY</Text>
        <Text style={styles.title}>One list for your recipes</Text>
        <Text style={styles.body}>Choose saved recipes and Okyo will combine only compatible ingredients.</Text>

        <Text style={styles.sectionTitle}>Recipes</Text>
        {validRecipes.length > 0 ? (
          <View style={styles.recipeList}>
            {validRecipes.map((recipe) => {
              const selected = selectedIds.includes(recipe.id);
              return (
                <View key={recipe.id} style={styles.recipeRow}>
                  <Pressable accessibilityRole="button" style={styles.recipeOpen} onPress={() => openRecipe(recipe)}>
                    <Text numberOfLines={2} style={styles.recipeTitle}>{recipe.title}</Text>
                    <NavArrowRight color={colors.muted} height={19} strokeWidth={2} width={19} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${recipe.title} ${selected ? 'from' : 'to'} grocery list`}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.recipeToggle, selected ? styles.recipeToggleSelected : null, pressed ? styles.pressed : null]}
                    onPress={() => selected ? removeRecipe(recipe.id) : addRecipe(recipe.id)}
                  >
                    {selected ? <Check color={colors.onCoral} height={18} strokeWidth={2.5} width={18} /> : <Plus color={colors.coralDark} height={18} strokeWidth={2.5} width={18} />}
                    <Text style={[styles.recipeToggleText, selected ? styles.recipeToggleTextSelected : null]}>{selected ? 'Added' : 'Add'}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState body="Save a recipe first, then choose it here." title="No saved recipes yet" />
        )}

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Shopping list</Text>
          {checkedIds.length > 0 ? (
            <Pressable accessibilityRole="button" style={styles.clearButton} onPress={clearCompleted}>
              <Trash color={colors.coralDark} height={17} strokeWidth={2} width={17} />
              <Text style={styles.clearText}>Clear completed</Text>
            </Pressable>
          ) : null}
        </View>

        {selectedRecipes.length === 0 ? (
          <EmptyState body="Add one or more saved recipes to build this list." title="Nothing selected" />
        ) : items.length === 0 ? (
          <EmptyState body="All completed items are cleared, or these recipes do not have usable ingredients." title="List is clear" />
        ) : (
          <View style={styles.itemList}>
            {items.map((item) => {
              const checked = checkedIds.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  style={({ pressed }) => [styles.itemRow, pressed ? styles.pressed : null]}
                  onPress={() => toggleItem(item.id)}
                >
                  <View style={[styles.checkbox, checked ? styles.checkboxChecked : null]}>
                    {checked ? <Check color={colors.onCoral} height={16} strokeWidth={2.6} width={16} /> : null}
                  </View>
                  <View style={styles.itemCopy}>
                    <Text style={[styles.itemName, checked ? styles.itemChecked : null]}>{item.quantity} {item.name}</Text>
                    <Text numberOfLines={2} style={styles.itemSources}>
                      From {item.sources.map((source) => source.recipeTitle).join(', ')}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function EmptyState({ body, title }: { body: string; title: string }) {
  return (
    <View style={styles.empty}>
      <KikoMascot animated="idle" pose="groceryList" size={76} />
      <View style={styles.emptyCopy}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { padding: spacing.screen, paddingBottom: layout.scrollClearance },
  kicker: { ...typography.label, color: colors.coralDark },
  title: { ...typography.display, fontSize: 32, lineHeight: 38, marginTop: 6 },
  body: { ...typography.body, marginTop: 8 },
  sectionTitle: { color: colors.charcoal, fontSize: 21, fontWeight: '800', marginBottom: 10, marginTop: 24 },
  recipeList: { gap: 9 },
  recipeRow: { ...surfaces.card, alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 66, padding: 10 },
  recipeOpen: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minHeight: 46, paddingHorizontal: 5 },
  recipeTitle: { color: colors.charcoal, flex: 1, fontSize: 16, fontWeight: '800' },
  recipeToggle: { alignItems: 'center', backgroundColor: colors.cream, borderRadius: radius.chip, flexDirection: 'row', gap: 5, minHeight: 44, paddingHorizontal: 12 },
  recipeToggleSelected: { backgroundColor: colors.coral },
  recipeToggleText: { color: colors.coralDark, fontSize: 13, fontWeight: '800' },
  recipeToggleTextSelected: { color: colors.onCoral },
  listHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  clearButton: { alignItems: 'center', flexDirection: 'row', gap: 5, minHeight: 44, paddingHorizontal: 4 },
  clearText: { color: colors.coralDark, fontSize: 13, fontWeight: '800' },
  itemList: { gap: 8 },
  itemRow: { ...surfaces.panel, alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 68, padding: 13 },
  checkbox: { alignItems: 'center', borderColor: colors.muted, borderRadius: 8, borderWidth: 2, height: 28, justifyContent: 'center', width: 28 },
  checkboxChecked: { backgroundColor: colors.coral, borderColor: colors.coral },
  itemCopy: { flex: 1 },
  itemName: { color: colors.charcoal, fontSize: 16, fontWeight: '800' },
  itemChecked: { color: colors.muted, textDecorationLine: 'line-through' },
  itemSources: { ...typography.caption, marginTop: 4 },
  empty: { ...surfaces.panel, alignItems: 'center', flexDirection: 'row', gap: 12, padding: 16 },
  emptyCopy: { flex: 1 },
  emptyTitle: { color: colors.charcoal, fontSize: 17, fontWeight: '800' },
  emptyBody: { ...typography.body, marginTop: 4 },
  pressed: { opacity: 0.78 },
});
