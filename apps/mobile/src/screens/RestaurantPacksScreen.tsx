import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { EmptyState, PackCard, ScreenContainer, colors } from '../components/OkyoUI';
import { mockRestaurantPacks, type RestaurantPack } from '../mocks';
import type { RootStackParamList } from '../navigation/types';

type RestaurantPacksNavigation = NativeStackNavigationProp<RootStackParamList>;

function getPackDescription(packName: string) {
  const name = packName.replace('-inspired', '');
  return `Copycat-style dupes inspired by ${name} favorites.`;
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
  const didTrackMalformedData = useRef(false);
  const safePacks = Array.isArray(mockRestaurantPacks)
    ? mockRestaurantPacks.filter((pack) => pack?.id && pack?.name && Array.isArray(pack?.dishes))
    : [];
  const malformedPackCount = Array.isArray(mockRestaurantPacks)
    ? mockRestaurantPacks.length - safePacks.length
    : 1;

  useEffect(() => {
    if (didTrackMalformedData.current || malformedPackCount <= 0) {
      return;
    }

    didTrackMalformedData.current = true;
    track(analyticsEvents.RESULT_ERROR, {
      errorMessage: 'Restaurant pack data was missing required fields.',
      screen: 'RestaurantPacksScreen',
    });
  }, [malformedPackCount]);

  if (safePacks.length === 0) {
    return (
      <EmptyState
        eyebrow="Packs"
        title="No packs yet"
        body="Static inspired-by restaurant packs will appear here. You can still start with the first mock scan."
        actionLabel="Start a Scan"
        onAction={() => navigation.navigate('ScanScreen')}
      />
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.kicker}>Packs</Text>
      <Text style={styles.title}>Restaurant-inspired packs</Text>
      <Text style={styles.description}>
        Browse static inspired-by dupes. These are not official restaurant recipes.
      </Text>

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
              onPress={() => navigation.navigate('RestaurantPackDetailScreen', { packId: pack.id })}
            />
          );
        })}
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
  description: {
    color: colors.body,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
  },
  packGrid: {
    gap: 14,
    marginTop: 22,
  },
});
