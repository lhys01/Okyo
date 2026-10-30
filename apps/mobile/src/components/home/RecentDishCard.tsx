import { Clock, NavArrowRight } from 'iconoir-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CanonicalRecipe } from '../../state/canonicalRecipes';
import { colors, iconSizes, radius, shadows, typography } from '../../theme/okyoTheme';
import { getRecipeImageSource, getRecipeImageStatus, getRecipeImageUrl } from '../../utils/recipeImages';
import { isUserScanRecipe } from '../../utils/recipeImageSource';
import { FoodImage } from '../FoodImage';
import { FitText } from '../FitText';

export function RecentDishCard({ height, onPress, recipe }: { height: number; onPress: () => void; recipe: CanonicalRecipe }) {
  const minutes = recipe.totalTimeMinutes ?? recipe.prepTimeMinutes + recipe.cookTimeMinutes;
  const protein = recipe.nutritionEstimate?.proteinGrams;
  const metadata = protein ? `${minutes} min · ${Math.round(protein)}g protein` : `${minutes} min`;
  const isDescription = recipe.origin === 'description';
  const imageSize = Math.max(72, height - 16);
  return (
    <Pressable accessibilityLabel={`${recipe.title}. ${metadata}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, isDescription ? styles.textOnlyCard : null, isDescription ? { minHeight: height } : { height }, pressed ? styles.pressed : null]}>
      {isDescription ? null : <FoodImage disableFallback={isUserScanRecipe(recipe)} imageSource={getRecipeImageSource(recipe)} imageStatus={getRecipeImageStatus(recipe)} imageUrl={getRecipeImageUrl(recipe)} style={[styles.image, { height: imageSize, width: imageSize }]} />}
      <View style={styles.copy}>
        <Text maxFontSizeMultiplier={1.2} numberOfLines={isDescription ? undefined : 2} style={styles.title}>{recipe.title}</Text>
        <View style={[styles.metaRow, isDescription ? styles.textOnlyMetaRow : null]}>
          <Clock color={colors.coralDark} height={iconSizes.small} strokeWidth={2.1} width={iconSizes.small} />
          <FitText maxFontSizeMultiplier={1.2} minimumFontScale={0.72} style={styles.metaText}>{metadata}</FitText>
        </View>
      </View>
      <NavArrowRight color={colors.muted} height={iconSizes.medium} strokeWidth={2.1} width={iconSizes.medium} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radius.panel, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, padding: 8, ...shadows.card },
  textOnlyCard: { paddingHorizontal: 16, paddingVertical: 14 },
  copy: { flex: 1, justifyContent: 'center', minWidth: 0 },
  image: { borderRadius: 15, flexShrink: 0 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 6, minWidth: 0 },
  textOnlyMetaRow: { marginTop: 10 },
  metaText: { ...typography.caption, color: colors.body, flexShrink: 1 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  title: { ...typography.section, color: colors.ink, fontSize: 17, lineHeight: 22 },
});
