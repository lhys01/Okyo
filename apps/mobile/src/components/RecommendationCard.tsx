import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FoodImage } from './FoodImage';
import { colors } from './OkyoUI';
import { radius, shadows } from '../theme/okyoTheme';
import type { RecommendationRecipe } from '../data/recommendedRecipes';
import { getRecipeImageUrl } from '../utils/recipeImages';

type RecommendationCardProps = {
  compact?: boolean;
  recipe: RecommendationRecipe;
  onPress: () => void;
};

export function RecommendationCard({ compact = false, recipe, onPress }: RecommendationCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact ? styles.compactCard : styles.regularCard,
        pressed ? styles.pressed : null,
      ]}
    >
      <FoodImage
        fallbackLabel={recipe.category}
        imageStatus={recipe.imageStatus}
        imageUrl={getRecipeImageUrl(recipe)}
        style={[styles.art, compact ? styles.compactArt : styles.regularArt]}
      >
        <View style={styles.categoryPill}>
          <Text numberOfLines={1} style={styles.categoryPillText}>{recipe.category}</Text>
        </View>
      </FoodImage>
      <View style={[styles.body, compact ? styles.compactBody : null]}>
        <Text maxFontSizeMultiplier={1.3} numberOfLines={2} style={styles.title}>{recipe.title}</Text>
        {!compact ? <Text numberOfLines={2} style={styles.blurb}>{recipe.blurb}</Text> : null}
        <Text
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.3}
          minimumFontScale={0.78}
          numberOfLines={1}
          style={styles.meta}
        >
          {recipe.difficulty} · {recipe.totalTimeMinutes ?? recipe.prepTimeMinutes + recipe.cookTimeMinutes} min
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...shadows.card,
  },
  regularCard: {
    minHeight: 278,
    width: '48%',
  },
  compactCard: {
    flex: 1,
    height: 214,
    minWidth: 0,
  },
  art: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  regularArt: {
    aspectRatio: 1.4,
  },
  compactArt: {
    height: 112,
    minHeight: 112,
  },
  categoryPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
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
    flex: 1,
    padding: 12,
  },
  compactBody: {
    justifyContent: 'space-between',
    minHeight: 88,
    padding: 10,
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
