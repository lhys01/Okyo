import type { RefObject } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FoodImage } from './FoodImage';
import { colors } from './OkyoUI';
import { radius, typography } from '../theme/okyoTheme';
import type { RecommendationRecipe } from '../data/recommendedRecipes';
import { getRecipeImageFallbackSource, getRecipeImageSource, getRecipeImageUrl } from '../utils/recipeImages';

type RecommendationCardProps = {
  compact?: boolean;
  recipe: RecommendationRecipe;
  onPress: () => void;
  /** Optional tour anchor for the real pressable card, never a wrapper. */
  tourAnchorRef?: RefObject<View | null>;
};

export function RecommendationCard({ compact = false, recipe, onPress, tourAnchorRef }: RecommendationCardProps) {
  return (
    <View style={[styles.shadowWrap, compact ? styles.compactWrap : styles.regularWrap]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        ref={tourAnchorRef}
        style={({ pressed }) => [styles.card, compact ? styles.compactCard : styles.regularCard, pressed ? styles.pressed : null]}
      >
      <FoodImage
        fallbackLabel={recipe.category}
        fallbackSource={getRecipeImageFallbackSource(recipe)}
        imageAccessibilityLabel={`${recipe.title} food image`}
        imageStatus={recipe.imageStatus}
        imageSource={getRecipeImageSource(recipe)}
        imageUrl={getRecipeImageUrl(recipe)}
        style={[styles.art, compact ? styles.compactArt : styles.regularArt]}
      />
      <View style={[styles.body, compact ? styles.compactBody : null]}>
        <Text maxFontSizeMultiplier={1.3} style={styles.title}>{recipe.title}</Text>
        {!compact ? <Text style={styles.blurb}>{recipe.blurb}</Text> : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  shadowWrap: {
    shadowColor: '#4A4850',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 1,
    elevation: 3,
  },
  regularCard: {
    width: '100%',
  },
  regularWrap: {
    flex: 1,
  },
  compactCard: { flex: 1, minHeight: 222, width: '100%' },
  compactWrap: {
    alignSelf: 'stretch',
  },
  art: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  regularArt: {
    aspectRatio: 1.4,
  },
  compactArt: { aspectRatio: 1.3, minHeight: 100 },
  body: {
    gap: 4,
    flex: 1,
    padding: 12,
  },
  compactBody: {
    gap: 2,
    justifyContent: 'flex-start',
    minHeight: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  title: {
    ...typography.heading,
    color: colors.charcoal,
    fontSize: 15,
    lineHeight: 20,
  },
  blurb: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  meta: {
    ...typography.caption,
    color: colors.muted,
    fontSize: 11,
    marginTop: 'auto',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
