import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState, PackCard, ScreenContainer, colors } from '../components/OkyoUI';
import { mockRestaurantPacks, type RestaurantPack } from '../mocks';
import type { RootStackParamList } from '../navigation/types';

type RestaurantPacksNavigation = NativeStackNavigationProp<RootStackParamList>;

function getPackDescription(packName: string) {
  const name = packName.replace('-inspired', '');
  return `Copycat-style dupes inspired by ${name} favorites.`;
}

function getAverageSavings(pack: RestaurantPack) {
  if (pack.dishes.length === 0) {
    return 0;
  }

  return pack.dishes.reduce((total, dish) => total + dish.estimatedSavings, 0) / pack.dishes.length;
}

export function RestaurantPacksScreen() {
  const navigation = useNavigation<RestaurantPacksNavigation>();

  if (mockRestaurantPacks.length === 0) {
    return (
      <EmptyState
        eyebrow="Packs"
        title="No packs yet"
        body="Static inspired-by restaurant packs will appear here."
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
        {mockRestaurantPacks.map((pack, index) => {
          const topDish = [...pack.dishes].sort((a, b) => b.estimatedSavings - a.estimatedSavings)[0];
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
