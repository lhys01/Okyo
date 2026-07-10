import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavArrowRight } from 'iconoir-react-native';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { uiLog } from '../utils/uiDebug';
import { PackCard } from '../components/OkyoUI';
import {
  getCategoryArt,
  getRecommendationsByCategory,
  recommendationCategories,
  type RecommendationCategory,
} from '../data/recommendedRecipes';
import { mockRestaurantPacks, type RestaurantPack } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, shadows, spacing, typography } from '../theme/okyoTheme';

type RestaurantPacksNavigation = NativeStackNavigationProp<RootStackParamList>;

function getPackDescription(packName: string) {
  const name = packName.replace('-inspired', '');
  return `Homemade swaps inspired by ${name} favorites.`;
}

function getAverageSavings(pack: RestaurantPack) {
  const dishes = Array.isArray(pack.dishes) ? pack.dishes : [];

  if (dishes.length === 0) {
    return 0;
  }

  return dishes.reduce((total, dish) => total + (typeof dish?.estimatedSavings === 'number' ? dish.estimatedSavings : 0), 0) / dishes.length;
}

export function RestaurantPacksScreen() {
  const navigation = useNavigation<RestaurantPacksNavigation>();
  const didTrackView = useRef(false);
  const safePacks = Array.isArray(mockRestaurantPacks)
    ? mockRestaurantPacks.filter((pack) => pack?.id && pack?.name && Array.isArray(pack?.dishes))
    : [];

  useEffect(() => {
    if (didTrackView.current) {
      return;
    }
    didTrackView.current = true;
    uiLog('RestaurantPacksScreen', 'enter', { packCount: safePacks.length });
  }, [safePacks.length]);

  const openCategory = (category: RecommendationCategory) => {
    uiLog('RestaurantPacksScreen', 'open_category', { category });
    navigation.navigate('RecommendationCategoryScreen', { category });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>Discover</Text>
        <Text style={styles.title}>Food inspiration</Text>
        <Text style={styles.description}>
          Browse meal ideas by craving, then tap one to get the full homemade recipe.
        </Text>

        <View style={styles.categoryGrid}>
          {recommendationCategories.map((category) => {
            const art = getCategoryArt(category);
            const count = getRecommendationsByCategory(category).length;

            return (
              <Pressable
                key={category}
                accessibilityRole="button"
                onPress={() => openCategory(category)}
                style={({ pressed }) => [styles.categoryTile, { backgroundColor: art.tint }, pressed ? styles.pressed : null]}
              >
                <Text style={styles.categoryEmoji}>{art.emoji}</Text>
                <Text numberOfLines={2} style={styles.categoryName}>{category}</Text>
                <Text style={styles.categoryCount}>{count} {count === 1 ? 'recipe' : 'recipes'}</Text>
              </Pressable>
            );
          })}
        </View>

        {safePacks.length > 0 ? (
          <View style={styles.packsSection}>
            <Text style={styles.sectionTitle}>Restaurant-style collections</Text>
            <Text style={styles.sectionSubtitle}>Curated packs inspired by takeout favorites.</Text>
            <View style={styles.packGrid}>
              {safePacks.map((pack, index) => {
                const packDishes = Array.isArray(pack.dishes) ? pack.dishes : [];
                const topDish = [...packDishes].sort((a, b) => b.estimatedSavings - a.estimatedSavings)[0];
                const label = index < 3 ? 'Free' : 'Premium preview';

                return (
                  <PackCard
                    key={pack.id}
                    pack={pack}
                    label={label}
                    description={getPackDescription(pack.name)}
                    averageSavings={getAverageSavings(pack)}
                    topDish={topDish?.dishName}
                    onPress={() => { uiLog('RestaurantPacksScreen', 'open_pack', { packId: pack.id }); navigation.navigate('RestaurantPackDetailScreen', { packId: pack.id }); }}
                  />
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    paddingBottom: 150,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.screen,
  },
  kicker: {
    color: colors.coral,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.display,
  },
  description: {
    ...typography.body,
    marginTop: 8,
  },
  categoryGrid: {
    columnGap: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 22,
    rowGap: 14,
  },
  categoryTile: {
    borderRadius: radius.card,
    justifyContent: 'space-between',
    minHeight: 116,
    padding: 16,
    width: '48%',
  },
  categoryEmoji: {
    fontSize: 34,
  },
  categoryName: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginTop: 10,
  },
  categoryCount: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  packsSection: {
    marginTop: spacing.section,
  },
  sectionTitle: {
    ...typography.heading,
  },
  sectionSubtitle: {
    ...typography.caption,
    marginTop: 4,
  },
  packGrid: {
    gap: 14,
    marginTop: 16,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
