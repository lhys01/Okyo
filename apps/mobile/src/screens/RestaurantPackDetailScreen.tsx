import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { uiLog } from '../utils/uiDebug';
import {
  BadgePill,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  colors,
  sharedStyles,
} from '../components/OkyoUI';
import {
  mockRestaurantPacks,
  type Recipe,
  type RecipeMode,
  type RestaurantPack,
  type RestaurantPackDish,
} from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';

type RestaurantPackDetailNavigation = NativeStackNavigationProp<RootStackParamList, 'RestaurantPackDetailScreen'>;
type RestaurantPackDetailRoute = RouteProp<RootStackParamList, 'RestaurantPackDetailScreen'>;
const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

function getPackDescription(packName: string) {
  const name = packName.replace('-inspired', '');
  return `A static pack of restaurant-style dupes inspired by ${name} menu favorites.`;
}

function getAverageSavings(pack: RestaurantPack) {
  const dishes = Array.isArray(pack.dishes) ? pack.dishes : [];

  if (dishes.length === 0) {
    return 0;
  }

  return dishes.reduce((total, dish) => total + (typeof dish?.estimatedSavings === 'number' ? dish.estimatedSavings : 0), 0) / dishes.length;
}

function getClosestMode(dish: RestaurantPackDish): RecipeMode {
  const name = dish.dishName.toLowerCase();
  if (name.includes('bowl') || name.includes('wellness') || name.includes('kale')) {
    return 'Healthy';
  }
  if (dish.estimatedSavings >= 25 || name.includes('budget')) {
    return 'Budget';
  }

  return 'Restaurant Copy';
}

function makePackRecipe(pack: RestaurantPack, dish: RestaurantPackDish): Recipe {
  const mode = getClosestMode(dish);

  return {
    id: `pack-recipe-${dish.id}`,
    scanResultId: dish.id,
    title: `${dish.dishName} Okyo-style`,
    mode,
    description: `Inspired-by ${pack.name} dupe made for home kitchens.`,
    prepTimeMinutes: dish.difficulty === 'Easy' ? 10 : 15,
    cookTimeMinutes: dish.difficulty === 'Easy' ? 20 : 30,
    servings: 2,
    difficulty: dish.difficulty,
    estimatedHomemadeCost: dish.homemadeCost,
    estimatedSavings: dish.estimatedSavings,
    ingredients: [
      { name: 'main ingredients', quantity: '1 set' },
      { name: 'sauce or seasoning', quantity: 'to taste', pantryItem: true },
    ],
    steps: [
      'Use this pack recipe as a saved placeholder.',
      'Follow the closest matching Okyo mock recipe when starting a challenge.',
    ],
    substitutions: ['Adjust protein, sauce, or base ingredients based on what you have.'],
    pantryNote: 'Assumes salt, pepper, oil, and basic seasonings are available.',
    confidenceNote: 'Static inspired-by pack recipe using estimated costs and savings.',
  };
}

export function RestaurantPackDetailScreen() {
  const navigation = useNavigation<RestaurantPackDetailNavigation>();
  const route = useRoute<RestaurantPackDetailRoute>();
  const packId = route.params?.packId;
  const pack = mockRestaurantPacks.find((restaurantPack) => restaurantPack.id === packId);
  const saveRecipe = useOkyoStore((state) => state.saveRecipe);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const didTrackView = useRef(false);

  useEffect(() => {
    if (didTrackView.current) {
      return;
    }

    uiLog('RestaurantPackDetailScreen', 'enter', { packId });

    didTrackView.current = true;
    if (!pack) {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: 'Restaurant pack was missing or not found.',
        packName: packId,
        screen: 'RestaurantPackDetailScreen',
      });
      return;
    }

    track(analyticsEvents.RESTAURANT_PACK_VIEWED, {
      packName: pack.name,
      screen: 'RestaurantPackDetailScreen',
    });
  }, [pack, packId]);

  if (!pack) {
    return (
      <ScreenContainer scroll={false} centered>
        <Text style={styles.kicker}>Restaurant Pack</Text>
        <Text style={styles.title}>Pack not found</Text>
        <Text style={styles.description}>
          This inspired-by pack is not available in the mock data yet.
        </Text>
        <View style={styles.primaryAction}>
          <PrimaryButton onPress={() => navigation.navigate('MainTabs')}>Back to Packs</PrimaryButton>
        </View>
      </ScreenContainer>
    );
  }
  const safeDishes = Array.isArray(pack.dishes) ? pack.dishes : [];

  const saveDish = (dish: RestaurantPackDish) => {
    uiLog('RestaurantPackDetailScreen', 'save_dish', { dishId: dish.id });
    const recipe = makePackRecipe(pack, dish);
    const alreadySaved = savedRecipes.some((savedRecipe) => savedRecipe.id === recipe.id);
    saveRecipe(recipe);
    if (!alreadySaved) {
      awardXPOnce(`save-recipe-${recipe.id}`, 5);
      unlockBadge('first-dupe');
    }
    track(analyticsEvents.RECIPE_SAVED, {
      dishName: recipe.title,
      mode: recipe.mode,
      packName: pack.name,
      savings: recipe.estimatedSavings,
      screen: 'RestaurantPackDetailScreen',
    });
    Alert.alert('Saved', `${recipe.title} was added to your library.`);
  };

  const startChallenge = (dish: RestaurantPackDish) => {
    uiLog('RestaurantPackDetailScreen', 'start_challenge', { dishId: dish.id });
    navigation.navigate('DupeChallengeScreen', { mode: getClosestMode(dish) });
  };

  const sharePack = (dish?: RestaurantPackDish) => {
    uiLog('RestaurantPackDetailScreen', 'share_pack', { dishId: dish?.id });
    navigation.navigate('ShareCardPreviewScreen', {
      cardType: 'restaurant_pack',
      packId: pack.id,
      dishId: dish?.id,
      mode: dish ? getClosestMode(dish) : undefined,
    });
  };

  return (
    <ScreenContainer>
      <Text style={styles.kicker}>Restaurant Pack</Text>
      <Text style={styles.title}>{pack.name}</Text>
      <Text style={styles.disclaimer}>Inspired-by recipes made for home kitchens.</Text>
      <Text style={styles.description}>{getPackDescription(pack.name)}</Text>

      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>Average savings</Text>
          <Text style={styles.savings}>{formatCurrency(getAverageSavings(pack))}</Text>
        </View>
        <View>
          <Text style={styles.summaryLabel}>Dishes</Text>
          <Text style={styles.summaryValue}>{safeDishes.length}</Text>
        </View>
      </View>

      <View style={styles.primaryAction}>
        <PrimaryButton onPress={() => sharePack()}>Share Pack</PrimaryButton>
      </View>

      <View style={styles.dishList}>
        {safeDishes.length > 0 ? safeDishes.map((dish) => (
          <View key={dish.id} style={styles.dishCard}>
            <View style={styles.dishHeader}>
              <Text style={styles.dishName}>{dish.dishName}</Text>
              <BadgePill tone="cream">{dish.difficulty}</BadgePill>
            </View>
            <View style={styles.priceGrid}>
              <View style={styles.priceCell}>
                <Text style={styles.priceLabel}>Restaurant</Text>
                <Text style={styles.priceValue}>{formatCurrency(dish.restaurantPrice)}</Text>
              </View>
              <View style={styles.priceCell}>
                <Text style={styles.priceLabel}>Homemade</Text>
                <Text style={styles.priceValue}>{formatCurrency(dish.homemadeCost)}</Text>
              </View>
              <View style={styles.priceCell}>
                <Text style={styles.priceLabel}>Savings</Text>
                <Text style={styles.dishSavings}>{formatCurrency(dish.estimatedSavings)}</Text>
              </View>
            </View>
            <View style={styles.actions}>
              <SecondaryButton onPress={() => saveDish(dish)}>Save Recipe</SecondaryButton>
              <SecondaryButton onPress={() => startChallenge(dish)}>Start Challenge</SecondaryButton>
              <SecondaryButton onPress={() => sharePack(dish)}>Share Dish</SecondaryButton>
            </View>
          </View>
        )) : (
          <View style={styles.dishCard}>
            <Text style={styles.dishName}>No dishes in this pack yet</Text>
            <Text style={styles.description}>
              This pack exists, but its mock dish list is empty.
            </Text>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: colors.coral,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.charcoal,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 37,
  },
  disclaimer: {
    backgroundColor: colors.cream,
    borderRadius: 16,
    color: '#5c4528',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
    marginTop: 12,
    padding: 12,
  },
  description: {
    color: colors.body,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 12,
  },
  summaryCard: {
    ...sharedStyles.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    padding: 18,
  },
  summaryLabel: {
    color: colors.body,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.charcoal,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  savings: {
    color: colors.green,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  primaryAction: {
    marginTop: 14,
  },
  dishList: {
    gap: 14,
    marginTop: 18,
  },
  dishCard: {
    ...sharedStyles.card,
    padding: 18,
  },
  dishHeader: {
    alignItems: 'flex-start',
    gap: 10,
  },
  dishName: {
    color: colors.charcoal,
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 26,
  },
  priceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  priceCell: {
    backgroundColor: colors.cream,
    borderRadius: 14,
    padding: 12,
    width: '48%',
  },
  priceLabel: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '800',
  },
  priceValue: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  dishSavings: {
    color: colors.green,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  actions: {
    gap: 10,
    marginTop: 16,
  },
});
