import { StyleSheet, Text, View } from 'react-native';
import type { Recipe } from '../../mocks';
import { isValidNutritionEstimate } from '../../utils/nutrition';
import { colors, onboardingFontFamilies as fonts } from '../../theme/okyoTheme';

/** Only real recipe nutrition can populate this payoff; never the teaching example. */
export function MacrosRecipePayoff({ recipe, focus, obstacle, priorities = [] }: { recipe: Recipe; focus: string; obstacle?: string | null; priorities?: readonly string[] }) {
  const nutrition = recipe.nutritionEstimate;
  if (!isValidNutritionEstimate(nutrition)) return <Text style={styles.note}>Nutrition estimates aren’t available for this recipe yet.</Text>;
  const protein = focus === 'Protein';
  const calories = focus === 'Calories';
  const portions = focus === 'Portions';
  const lessTracking = focus === 'Less tracking';
  const balanced = focus === 'Balanced macros';
  const guidance = obstacle === 'Boring meals' ? 'Flavor-preserving adjustments come first.'
    : obstacle === 'Not enough time' ? `Active time: ${recipe.totalTimeMinutes ?? 'shown above'}.`
      : obstacle === 'I get too hungry' ? 'Serving information and satisfying ingredients stay easy to find.'
        : obstacle === 'Eating out throws me off' ? 'A practical homemade version of food you already order.'
          : obstacle === 'Planning takes too much effort' ? 'Start with one clear recommended adjustment.'
            : obstacle === 'Keeping it consistent' ? 'Repeatable changes make this easier to return to.' : null;
  const priorityLine = priorities.length ? `Built around: ${priorities.join(' · ')}.` : null;
  return <View style={styles.section} accessibilityLabel="Your recipe’s estimated nutrition per serving">
    <Text style={styles.label}>{protein ? 'YOUR PROTEIN, RIGHT HERE' : calories ? 'YOUR SERVING, IN CONTEXT' : portions ? 'YOUR PORTION, CLEARLY SHOWN' : lessTracking ? 'ONE USEFUL RECOMMENDATION' : 'YOUR MEAL AT A GLANCE'}</Text>
    {protein || calories ? <View style={styles.hero}><Text style={styles.value}>{protein ? `${nutrition.proteinGrams}g` : nutrition.calories}</Text><Text style={styles.unit}>{protein ? 'protein' : 'calories'}</Text></View> : null}
    {portions ? <Text style={styles.serving}>{recipe.servings} servings · values shown per serving</Text> : null}
    <View style={styles.macros}>{!protein ? <View><Text style={styles.number}>{nutrition.proteinGrams}g</Text><Text style={styles.note}>Protein</Text></View> : null}
      {(balanced || !protein) ? <View><Text style={styles.number}>{nutrition.carbohydratesGrams}g</Text><Text style={styles.note}>Carbs</Text></View> : null}
      {(balanced || !protein) ? <View><Text style={styles.number}>{nutrition.fatGrams}g</Text><Text style={styles.note}>Fat</Text></View> : null}
    </View>
    <Text style={styles.note}>{!calories ? `${nutrition.calories} calories · ` : ''}Estimated per serving. Not exact nutrition.</Text>
    {guidance ? <Text style={styles.guidance}>{guidance}</Text> : null}
    {priorityLine ? <Text style={styles.note}>{priorityLine}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  section: { marginVertical: 24 }, label: { fontFamily: fonts.bold, color: colors.macros, fontSize: 11, lineHeight: 18, letterSpacing: 1.2 },
  hero: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 12, marginTop: 6 },
  value: { fontFamily: fonts.extraBold, color: colors.macros, fontSize: 66, lineHeight: 78, letterSpacing: -2 },
  unit: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 22, lineHeight: 30 },
  macros: { flexDirection: 'row', flexWrap: 'wrap', gap: 28, marginVertical: 12 },
  number: { fontFamily: fonts.bold, color: colors.ink, fontSize: 26, lineHeight: 34 },
  note: { fontFamily: fonts.body, color: colors.body, fontSize: 13, lineHeight: 20 },
  serving: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, marginBottom: 8 },
  guidance: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 21, marginTop: 8 },
});
