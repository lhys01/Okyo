import { StyleSheet, Text, View } from 'react-native';

import type { Recipe } from '../mocks';
import { isValidNutritionEstimate } from '../utils/nutrition';
import { colors, fontFamilies } from './OkyoUI';

export function RecipeNutritionCards({
  nutrition,
}: {
  nutrition: Recipe['nutritionEstimate'];
}) {
  if (!isValidNutritionEstimate(nutrition)) {
    return null;
  }

  const macros = [
    { label: 'Protein', value: `${nutrition.proteinGrams} g` },
    { label: 'Carbohydrates', value: `${nutrition.carbohydratesGrams} g` },
    { label: 'Fat', value: `${nutrition.fatGrams} g` },
  ];

  return (
    <View accessibilityLabel="Nutrition estimate" style={styles.section}>
      <Text style={styles.eyebrow}>Estimated per serving</Text>
      <View style={styles.caloriesCard}>
        <Text style={styles.caloriesValue}>{nutrition.calories} kcal</Text>
        <Text style={styles.caloriesLabel}>Calories</Text>
      </View>
      <View style={styles.macroRow}>
        {macros.map((macro) => (
          <View key={macro.label} style={styles.macroCard}>
            <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={styles.macroValue}>
              {macro.value}
            </Text>
            <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.macroLabel}>
              {macro.label}
            </Text>
          </View>
        ))}
      </View>
      {typeof nutrition.fiberGrams === 'number' ? (
        <Text style={styles.fiber}>Fiber estimate · {nutrition.fiberGrams} g per serving</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 22,
  },
  eyebrow: {
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  caloriesCard: {
    backgroundColor: '#fff0e8',
    borderColor: '#ffd7c8',
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  caloriesValue: {
    color: colors.coralDark,
    fontFamily: fontFamilies.display,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 34,
  },
  caloriesLabel: {
    color: colors.body,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 9,
  },
  macroCard: {
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: 17,
    borderWidth: 1,
    flex: 1,
    minHeight: 74,
    minWidth: 0,
    paddingHorizontal: 9,
    paddingVertical: 12,
  },
  macroValue: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
  },
  macroLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 5,
  },
  fiber: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 12,
    marginTop: 9,
  },
});
