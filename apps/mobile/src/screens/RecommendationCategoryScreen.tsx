import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavArrowLeft } from 'iconoir-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecommendationCard } from '../components/RecommendationCard';
import { colors, typography } from '../components/OkyoUI';
import {
  getRecommendationsByCategory,
  recommendationCategories,
  recommendedRecipes,
  type RecommendationCategory,
} from '../data/recommendedRecipes';
import type { RootStackParamList } from '../navigation/types';
import { radius } from '../theme/okyoTheme';
import { useOpenRecommendation } from '../utils/useOpenRecommendation';

type CategoryNavigation = NativeStackNavigationProp<RootStackParamList, 'RecommendationCategoryScreen'>;
type CategoryRoute = RouteProp<RootStackParamList, 'RecommendationCategoryScreen'>;

function isCategory(value: string | undefined): value is RecommendationCategory {
  return Boolean(value) && recommendationCategories.includes(value as RecommendationCategory);
}

export function RecommendationCategoryScreen() {
  const navigation = useNavigation<CategoryNavigation>();
  const route = useRoute<CategoryRoute>();
  const openRecommendation = useOpenRecommendation();
  const showAll = route.params?.showAll === true;
  const category: RecommendationCategory = isCategory(route.params?.category)
    ? route.params.category
    : 'Dinner & Cooking Methods';
  const recipes = showAll ? recommendedRecipes : getRecommendationsByCategory(category);

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('MainTabs', { screen: 'RestaurantPacksScreen' });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={goBack}
            style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
          >
            <NavArrowLeft color={colors.charcoal} height={24} strokeWidth={2.2} width={24} />
          </Pressable>
        </View>

        <Text style={styles.title}>{showAll ? 'All dishes' : category}</Text>
        <View style={styles.grid}>
          {recipes.map((recipe) => (
            <RecommendationCard key={recipe.id} recipe={recipe} onPress={() => openRecommendation(recipe)} />
          ))}
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
    paddingHorizontal: 20,
  },
  topBar: {
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 44,
  },
  backButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  hero: {
    alignItems: 'center',
    borderRadius: radius.hero,
    justifyContent: 'center',
    height: 190,
    overflow: 'hidden',
  },
  heroArt: { height: '100%', width: '100%' },
  kicker: {
    ...typography.caption,
    color: colors.coral,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 18,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.display,
    marginTop: 4,
  },
  subtitle: {
    ...typography.body,
    marginTop: 8,
  },
  grid: {
    columnGap: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 22,
    rowGap: 16,
  },
  pressed: {
    opacity: 0.8,
  },
});
