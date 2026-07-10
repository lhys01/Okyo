import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FoodImage } from './FoodImage';
import { colors, radius, spacing } from '../theme/okyoTheme';
import type { RecommendationRecipe } from '../data/recommendedRecipes';
import { getRecipeImageUrl } from '../utils/recipeImages';

type RecommendationCardProps = {
  recipe: RecommendationRecipe;
  onPress: () => void;
};

export function RecommendationCard({ recipe, onPress }: RecommendationCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <FoodImage
        fallbackLabel={recipe.category}
        imageStatus={recipe.imageStatus}
        imageUrl={getRecipeImageUrl(recipe)}
        style={styles.art}
      >
        <View style={styles.categoryPill}>
          <Text numberOfLines={1} style={styles.categoryPillText}>{recipe.category}</Text>
        </View>
      </FoodImage>
      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.title}>{recipe.title}</Text>
        <Text numberOfLines={2} style={styles.blurb}>{recipe.blurb}</Text>
        <Text style={styles.meta}>{recipe.difficulty} · {recipe.totalTimeMinutes ?? recipe.prepTimeMinutes + recipe.cookTimeMinutes} min</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    overflow: 'hidden',
    width: '48%',
  },
  art: {
    alignItems: 'center',
    aspectRatio: 1.4,
    justifyContent: 'center',
    width: '100%',
  },
  categoryPill: {
    backgroundColor: colors.glassFill,
    borderRadius: 999,
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    position: 'absolute',
  },
  categoryPillText: {
    color: colors.charcoal,
    fontSize: 10,
    fontWeight: '700',
  },
  body: {
    gap: 4,
    padding: spacing.sm,
  },
  title: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 19,
  },
  blurb: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  meta: {
    color: colors.coral,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
