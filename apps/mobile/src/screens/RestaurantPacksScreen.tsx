import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { uiLog } from '../utils/uiDebug';
import { colors, typography } from '../components/OkyoUI';
import {
  getRecommendationsByCategory,
  recommendationCategories,
  type RecommendationCategory,
} from '../data/recommendedRecipes';
import type { RootStackParamList } from '../navigation/types';
import { fontFamilies, radius, spacing } from '../theme/okyoTheme';

type RestaurantPacksNavigation = NativeStackNavigationProp<RootStackParamList>;

const categoryPalette: Record<RecommendationCategory, string> = {
  'Breakfast & Brunch': '#FFE7D6',
  'Proteins & Mains': '#FCE1E7',
  'Pasta & Noodles': '#FFF1BA',
  'Bowls & Grains': '#DDF3DD',
  'Salads & Vegetables': '#E9E1FF',
  'Handheld & Wraps': '#DDEEFF',
  'Soups & Stews': '#FFF7E9',
  'Vegetarian': '#DFF2E3',
  'Desserts & Treats': '#F7E3EC',
  'Dinner & Cooking Methods': '#FFDCD2',
};

export function RestaurantPacksScreen() {
  const navigation = useNavigation<RestaurantPacksNavigation>();
  const didTrackView = useRef(false);

  useEffect(() => {
    if (didTrackView.current) {
      return;
    }
    didTrackView.current = true;
    uiLog('RestaurantPacksScreen', 'enter');
  }, []);

  const openCategory = (category: RecommendationCategory) => {
    uiLog('RestaurantPacksScreen', 'open_category', { category });
    navigation.navigate('RecommendationCategoryScreen', { category });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Food inspiration</Text>
        <View style={styles.categoryGrid}>
          {recommendationCategories
            .filter((category) => getRecommendationsByCategory(category).length > 0)
            .map((category) => {
            const count = getRecommendationsByCategory(category).length;

            return (
              <Pressable
                key={category}
                accessibilityLabel={`${category}, ${count} recipes`}
                accessibilityRole="button"
                onPress={() => openCategory(category)}
                style={({ pressed }) => [styles.categoryTile, { backgroundColor: categoryPalette[category] }, pressed ? styles.pressed : null]}
              >
                <Text numberOfLines={2} style={styles.categoryName}>{category}</Text>
                <View pointerEvents="none" style={styles.categoryCountPill}>
                  <Text style={styles.categoryCount}>{count}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
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
  title: {
    ...typography.display,
    color: '#2B2B30',
    fontFamily: fontFamilies.extraBold,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 40,
  },
  description: {
    ...typography.body,
    marginTop: 8,
  },
  categoryGrid: {
    columnGap: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    rowGap: 10,
  },
  categoryTile: {
    borderRadius: radius.card,
    flexBasis: '48.5%',
    height: 108,
    justifyContent: 'center',
    maxWidth: '48.5%',
    padding: 14,
    position: 'relative',
  },
  categoryName: {
    color: '#2B2B30',
    fontFamily: fontFamilies.extraBold,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.38,
    lineHeight: 23,
    maxWidth: '80%',
  },
  categoryCountPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: radius.pill,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    top: 12,
    minWidth: 25,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  categoryCount: {
    color: '#2B2B30',
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
