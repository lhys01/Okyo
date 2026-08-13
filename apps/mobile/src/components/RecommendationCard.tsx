import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FoodImage } from './FoodImage';
import { colors } from './OkyoUI';
import { radius } from '../theme/okyoTheme';
import type { RecommendationRecipe } from '../data/recommendedRecipes';
import { getRecipeImageSource, getRecipeImageUrl } from '../utils/recipeImages';

type RecommendationCardProps = {
  compact?: boolean;
  recipe: RecommendationRecipe;
  onPress: () => void;
};

export function RecommendationCard({ compact = false, recipe, onPress }: RecommendationCardProps) {
  return (
    <View style={[styles.shadowWrap, compact ? styles.compactCard : styles.regularWrap]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.card, compact ? styles.compactCard : styles.regularCard, pressed ? styles.pressed : null]}
      >
      <FoodImage
        fallbackLabel={recipe.category}
        imageStatus={recipe.imageStatus}
        imageSource={getRecipeImageSource(recipe)}
        imageUrl={getRecipeImageUrl(recipe)}
        style={[styles.art, compact ? styles.compactArt : styles.regularArt]}
      />
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
    minHeight: 278,
    width: '100%',
  },
  regularWrap: {
    width: '48%',
  },
  compactCard: {
    flex: 1,
    height: 222,
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
    height: 138,
    minHeight: 138,
  },
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
    color: colors.charcoal,
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: -0.25,
    lineHeight: 19,
  },
  blurb: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  meta: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 1,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
