import { Clock, NavArrowRight } from 'iconoir-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CanonicalRecipe } from '../../state/canonicalRecipes';
import { colors, radius, shadows, typography } from '../../theme/okyoTheme';
import { getRecipeImageSource, getRecipeImageStatus, getRecipeImageUrl } from '../../utils/recipeImages';
import { FoodImage } from '../FoodImage';

export function RecentDishCard({ height, onPress, recipe }: { height: number; onPress: () => void; recipe: CanonicalRecipe }) {
  const minutes = recipe.totalTimeMinutes ?? recipe.prepTimeMinutes + recipe.cookTimeMinutes;
  const protein = recipe.nutritionEstimate?.proteinGrams;
  const metadata = protein ? `${minutes} min · ${Math.round(protein)}g protein` : `${minutes} min`;
  const imageSize = Math.max(72, height - 16);
  return (
    <Pressable accessibilityLabel={`${recipe.title}. ${metadata}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, { height }, pressed ? styles.pressed : null]}>
      <FoodImage imageSource={getRecipeImageSource(recipe)} imageStatus={getRecipeImageStatus(recipe)} imageUrl={getRecipeImageUrl(recipe)} style={[styles.image, { height: imageSize, width: imageSize }]} />
      <View style={styles.copy}>
        <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={styles.title}>{recipe.title}</Text>
        <View style={styles.metaRow}>
          <Clock color={colors.coralDark} height={15} strokeWidth={2.1} width={15} />
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.metaText}>{metadata}</Text>
        </View>
      </View>
      <NavArrowRight color={colors.muted} height={20} strokeWidth={2.1} width={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radius.panel, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, padding: 8, ...shadows.card },
  copy: { flex: 1, justifyContent: 'center', minWidth: 0 },
  image: { borderRadius: 15, flexShrink: 0 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 6, minWidth: 0 },
  metaText: { ...typography.caption, color: colors.body, flexShrink: 1 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  title: { ...typography.section, color: colors.ink, fontSize: 17, lineHeight: 22 },
});
