import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from './OkyoUI';
import { radius, shadows } from '../theme/okyoTheme';
import type { RecommendationRecipe } from '../data/recommendedRecipes';

type RecommendationCardProps = {
  recipe: RecommendationRecipe;
  onPress: () => void;
};

// A visual food-inspiration tile sized for a two-column grid. Uses a local color
// tint + emoji as safe placeholder art — no external or copyrighted images.
// TODO: render a generated top-down dish image here once a safe pipeline exists.
export function RecommendationCard({ recipe, onPress }: RecommendationCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={[styles.art, { backgroundColor: recipe.tint }]}>
        <Text style={styles.emoji}>{recipe.emoji}</Text>
        <View style={styles.categoryPill}>
          <Text numberOfLines={1} style={styles.categoryPillText}>{recipe.category}</Text>
        </View>
      </View>
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
    backgroundColor: colors.card,
    borderRadius: radius.card,
    overflow: 'hidden',
    width: '48%',
    ...shadows.card,
  },
  art: {
    alignItems: 'center',
    aspectRatio: 1.4,
    justifyContent: 'center',
    width: '100%',
  },
  emoji: {
    fontSize: 48,
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
    padding: 12,
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
