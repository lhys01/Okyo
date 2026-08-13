import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check } from 'iconoir-react-native';

import { actionIcons } from '../assets/actionIcons';
import type { Recipe, RecipeIngredient } from '../mocks';
import { scaleIngredient } from '../utils/servingScale';
import { colors, fontFamilies } from './OkyoUI';
import { recipeShadows } from '../theme/recipeTheme';

const GENERIC_GROUP_NAMES = /^(main|ingredients?|finishing|for serving|to serve|serving|garnish|optional garnish)$/i;

export function RecipeIngredientsAssistant({
  onAddIngredient,
  selectedIngredientIds = [],
  onServingsChange,
  recipe,
  servings,
}: {
  onAddIngredient?: (ingredient: RecipeIngredient) => void;
  selectedIngredientIds?: string[];
  onServingsChange: (servings: number) => void;
  recipe: Recipe;
  servings: number;
}) {
  const selectedIngredientIdSet = new Set(selectedIngredientIds.map((id) => id.trim().toLowerCase()));
  const groups = recipe.ingredientGroups?.length
    ? recipe.ingredientGroups
    : [{ component: '', items: recipe.ingredients }];
  const changeServings = (nextServings: number) => {
    if (nextServings === servings) return;
    void Haptics.selectionAsync().catch(() => undefined);
    onServingsChange(nextServings);
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Ingredients</Text>
        <View style={styles.servingsControl}>
          <Pressable accessibilityLabel="Decrease servings" accessibilityRole="button" accessibilityState={{ disabled: servings <= 1 }} disabled={servings <= 1} hitSlop={5} onPress={() => changeServings(Math.max(1, servings - 1))} style={[styles.servingButton, servings <= 1 ? styles.servingButtonDisabled : null]}>
            <Text style={styles.servingButtonText}>−</Text>
          </Pressable>
          <Text style={styles.servingsText}>{servings} servings</Text>
          <Pressable accessibilityLabel="Increase servings" accessibilityRole="button" accessibilityState={{ disabled: servings >= 12 }} disabled={servings >= 12} hitSlop={5} onPress={() => changeServings(Math.min(12, servings + 1))} style={[styles.servingButton, servings >= 12 ? styles.servingButtonDisabled : null]}>
            <Text style={styles.servingButtonText}>+</Text>
          </Pressable>
        </View>
      </View>
      {groups.map((group) => (
        <View key={group.component || 'ingredients'} style={styles.group}>
          {getGroupTitle(group.component) ? <Text style={styles.groupTitle}>{getGroupTitle(group.component)}</Text> : null}
          {group.items.map((source, index) => {
            const ingredient = scaleIngredient(source, recipe.servings, servings);
            const ingredientId = source.name.trim().toLowerCase();
            const isAdded = selectedIngredientIdSet.has(ingredientId);
            return (
              <View key={`${source.name}-${index}`} style={styles.row}>
                <View style={styles.nameWrap}>
                  <Text style={styles.name}>{ingredient.name}</Text>
                  {ingredient.optional ? <Text style={styles.optional}>Optional</Text> : null}
                  {ingredient.pantryItem ? <Text style={styles.pantry}>You may already have this</Text> : null}
                </View>
                <Text style={styles.quantity}>{ingredient.quantity}</Text>
                {onAddIngredient ? (
                  <Pressable accessibilityLabel={isAdded ? `Remove ${ingredient.name} from groceries` : `Add ${ingredient.name} to groceries`} accessibilityRole="button" accessibilityState={{ selected: isAdded }} hitSlop={6} onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                    onAddIngredient(ingredient);
                  }} style={({ pressed }) => [styles.groceryButton, isAdded ? styles.groceryButtonAdded : null, pressed ? styles.pressed : null]}>
                    {isAdded ? <Check color={colors.coralDark} height={19} width={19} /> : <Image accessibilityElementsHidden resizeMode="contain" source={actionIcons.grocery} style={styles.groceryIcon} />}
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
      {servings !== recipe.servings ? (
        <Text style={styles.scaleNote}>Quantities are safely scaled where possible. “To taste” and other flexible amounts stay unchanged.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 20, fontWeight: '800' },
  servingsControl: { alignItems: 'center', backgroundColor: '#FFF8F7', borderRadius: 16, flexDirection: 'row', padding: 3, ...recipeShadows.card },
  servingButton: { alignItems: 'center', backgroundColor: '#FFF0F4', borderRadius: 12, height: 32, justifyContent: 'center', width: 32 },
  servingButtonDisabled: { opacity: 0.3 },
  servingButtonText: { color: colors.coralDark, fontFamily: fontFamilies.extraBold, fontSize: 20, fontWeight: '800' },
  servingsText: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 12, fontWeight: '700', minWidth: 72, textAlign: 'center' },
  group: { gap: 8, marginTop: 12 },
  groupTitle: { color: colors.muted, fontFamily: fontFamilies.extraBold, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 1, textTransform: 'uppercase' },
  row: { alignItems: 'center', backgroundColor: '#FFFDFC', borderRadius: 15, flexDirection: 'row', minHeight: 58, paddingHorizontal: 12, paddingVertical: 8, ...recipeShadows.card },
  nameWrap: { flex: 1, minWidth: 0 },
  name: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 14, fontWeight: '700' },
  pantry: { color: '#8A847D', fontFamily: fontFamilies.body, fontSize: 10.5, marginTop: 3 },
  optional: { color: '#8A6A32', fontFamily: fontFamilies.bold, fontSize: 10.5, marginTop: 3 },
  quantity: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 13, marginLeft: 10, textAlign: 'right' },
  groceryButton: { alignItems: 'center', backgroundColor: 'transparent', borderRadius: 17, height: 36, justifyContent: 'center', marginLeft: 5, width: 36 },
  groceryIcon: { height: 29, width: 29 },
  groceryButtonAdded: { backgroundColor: '#FFE5EC' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  scaleNote: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 11, lineHeight: 16, marginTop: 9 },
});

function getGroupTitle(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || GENERIC_GROUP_NAMES.test(trimmed)) return '';
  return trimmed.replace(/^of\s+/i, '').trim();
}
