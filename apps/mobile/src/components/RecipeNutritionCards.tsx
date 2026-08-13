import { StyleSheet, Text, View } from 'react-native';

import type { Recipe } from '../mocks';
import { isValidNutritionEstimate } from '../utils/nutrition';
import { colors, fontFamilies } from './OkyoUI';
import { recipeShadows } from '../theme/recipeTheme';

export function RecipeNutritionCards({
  nutrition,
}: {
  nutrition: Recipe['nutritionEstimate'];
}) {
  if (!isValidNutritionEstimate(nutrition)) {
    return null;
  }

  const macros = [
    { emphasis: true, label: 'Calories', value: `${nutrition.calories}` },
    { label: 'Protein', value: `${nutrition.proteinGrams} g` },
    { label: 'Carbs', value: `${nutrition.carbohydratesGrams} g` },
    { label: 'Fat', value: `${nutrition.fatGrams} g` },
  ];

  return (
    <View accessibilityLabel="Nutrition estimate" style={styles.section}>
      <Text style={styles.eyebrow}>Estimated per serving</Text>
      <View style={styles.macroRow}>
        {macros.map((macro) => (
          <View key={macro.label} style={[styles.macroCard, macro.emphasis ? styles.calorieCard : null]}>
            <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={[styles.macroValue, macro.emphasis ? styles.calorieValue : null]}>
              {macro.value}
            </Text>
            <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.macroLabel}>
              {macro.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 18,
  },
  eyebrow: {
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
  },
  macroCard: {
    alignItems: 'center',
    backgroundColor: '#FFFDFC',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 66,
    minWidth: 0,
    paddingHorizontal: 5,
    ...recipeShadows.card,
  },
  calorieCard: { backgroundColor: '#FFF6F7', flex: 1.18 },
  macroValue: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    fontWeight: '800',
  },
  calorieValue: { color: colors.coralDark, fontSize: 21 },
  macroLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 2,
  },
});
