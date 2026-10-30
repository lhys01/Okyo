import { StyleSheet, Text, View } from 'react-native';

import type { Recipe } from '../mocks';
import { isValidNutritionEstimate } from '../utils/nutrition';
import { colors, fontFamilies, typography } from './OkyoUI';
import { recipeShadows } from '../theme/recipeTheme';
import { FitText } from './FitText';

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
            <FitText minimumFontScale={0.68} style={[styles.macroValue, macro.emphasis ? styles.calorieValue : null]}>
              {macro.value}
            </FitText>
            <FitText minimumFontScale={0.72} style={styles.macroLabel}>
              {macro.label}
            </FitText>
          </View>
        ))}
      </View>
    </View>
  );
}

// Alias required by the restored onboarding OnboardingRecipePreview screen,
// which imports { NutritionSummary } and passes an extra `servings` prop.
// Thin wrapper so Okyo-1's card design is unchanged.
export function NutritionSummary({
  nutrition,
}: {
  nutrition: Recipe['nutritionEstimate'];
  servings?: Recipe['servings'];
}) {
  return <RecipeNutritionCards nutrition={nutrition} />;
}

const styles = StyleSheet.create({
  section: {
    marginTop: 18,
  },
  eyebrow: {
    ...typography.label,
    color: colors.muted,
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
    ...typography.numericStat,
    color: colors.charcoal,
    fontSize: 16,
  },
  calorieValue: { color: colors.coralDark, fontSize: 21 },
  macroLabel: {
    ...typography.captionSmall,
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    marginTop: 2,
  },
});
