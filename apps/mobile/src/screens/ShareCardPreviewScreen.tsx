import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef } from 'react';
import { Alert, Image, Share, StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { uiLog } from '../utils/uiDebug';
import { EmptyState, PrimaryButton, ScreenContainer, SecondaryButton, colors } from '../components/OkyoUI';
import {
  defaultRestaurantPack,
  defaultScanResult,
  getSafeRecipeForMode,
  getSafeRecipeMode,
  mockBadges,
  mockRestaurantPacks,
  type Recipe,
  type RecipeMode,
} from '../mocks';
import type { RootStackParamList, ShareCardType } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';

type ShareCardRoute = RouteProp<RootStackParamList, 'ShareCardPreviewScreen'>;
type ShareCardNavigation = NativeStackNavigationProp<RootStackParamList, 'ShareCardPreviewScreen'>;

type StoryCardData = {
  cardType: ShareCardType;
  eyebrow: string;
  dishName: string;
  restaurantPrice: number;
  homemadeCost: number;
  estimatedSavings: number;
  scoreLabel: string;
  selectedMode: RecipeMode | string;
  caption: string;
  fallbackNote?: string;
};

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

function getCardLabel(cardType: ShareCardType) {
  switch (cardType) {
    case 'challenge_result':
      return 'Challenge result';
    case 'ranking':
      return 'Weekly ranking';
    case 'badge':
      return 'Badge unlocked';
    case 'restaurant_pack':
      return 'Restaurant pack';
    case 'scan_result':
    default:
      return 'Scan result';
  }
}

function getSafeCardType(cardType: unknown): ShareCardType {
  const cardTypes: ShareCardType[] = ['scan_result', 'challenge_result', 'ranking', 'badge', 'restaurant_pack'];
  return typeof cardType === 'string' && cardTypes.includes(cardType as ShareCardType)
    ? cardType as ShareCardType
    : 'scan_result';
}

function buildCaption(data: StoryCardData) {
  return `${formatCurrency(data.restaurantPrice)} restaurant ${data.dishName.toLowerCase()} -> ${formatCurrency(
    data.homemadeCost,
  )} homemade dupe. Saved about ${formatCurrency(data.estimatedSavings)} with Okyo.`;
}

export function ShareCardPreviewScreen() {
  const navigation = useNavigation<ShareCardNavigation>();
  const route = useRoute<ShareCardRoute>();
  const cardType = getSafeCardType(route.params?.cardType);
  const storeMode = useOkyoStore((state) => state.selectedMode);
  const latestScanResult = useOkyoStore((state) => state.latestScanResult);
  const latestScanRecipes = useOkyoStore((state) => state.latestScanRecipes);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const completedChallenges = useOkyoStore((state) => state.completedChallenges);
  const leaderboardEntries = useOkyoStore((state) => state.leaderboardEntries);
  const unlockedBadges = useOkyoStore((state) => state.unlockedBadges);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const selectedMode = getSafeRecipeMode(route.params?.mode ?? storeMode);
  const scanContext = route.params?.scanContext;
  const shareImage = scanContext?.image ?? selectedScanImage;
  const isDemoScan = isExplicitDemoScan(shareImage);
  const recipe = getShareRecipe(
    selectedMode,
    latestScanRecipes,
    latestScanRecipe,
    scanContext?.recipe ?? null,
    isDemoScan,
  );
  const cardRecipe = recipe ?? getSafeRecipeForMode(selectedMode);
  const scanResult = scanContext?.scanResult ?? latestScanResult ?? (isDemoScan ? defaultScanResult : null);
  const fallbackScanResult = scanResult ?? defaultScanResult;
  const scanDishName = scanResult?.dishName ?? recipe?.title ?? '';
  const scanRestaurantPrice = scanResult?.restaurantPrice ?? getEstimatedRestaurantPrice(recipe);
  const scanHomemadeCost = recipe?.estimatedHomemadeCost ?? scanResult?.homemadeCost ?? cardRecipe.estimatedHomemadeCost;
  const scanEstimatedSavings = recipe?.estimatedSavings ?? scanResult?.estimatedSavings ?? cardRecipe.estimatedSavings;
  const scanScoreLabel = scanResult ? `${scanResult.matchScore.toFixed(1)}/10 match` : 'Generated dupe';
  const hasScanShareContext = Boolean(recipe && scanDishName && scanRestaurantPrice > 0);
  const safeCompletedChallenges = Array.isArray(completedChallenges) ? completedChallenges : [];
  const safeUnlockedBadges = Array.isArray(unlockedBadges) ? unlockedBadges : [];
  const latestChallenge = safeCompletedChallenges[safeCompletedChallenges.length - 1];
  const topLeaderboardEntry = (Array.isArray(leaderboardEntries) ? leaderboardEntries[0] : undefined) ?? {
    id: 'fallback-ranking',
    rank: 1,
    displayName: 'Okyo Cook',
    category: 'Rising Cook',
    value: '+0 XP',
    xp: 0,
  };
  const unlockedBadge =
    (Array.isArray(mockBadges) ? mockBadges.find((badge) => safeUnlockedBadges.includes(badge.id)) : undefined) ??
    mockBadges[0] ?? {
      id: 'fallback-badge',
      name: 'Okyo Badge',
      description: 'Keep scanning to unlock badges.',
      unlocked: false,
    };
  const selectedPack =
    mockRestaurantPacks.find((restaurantPack) => restaurantPack.id === route.params?.packId) ??
    defaultRestaurantPack;
  const packDish =
    selectedPack.dishes.find((dish) => dish.id === route.params?.dishId) ??
    selectedPack.dishes[0];
  const fallbackNote = isDemoScan && !latestScanResult && !scanContext?.scanResult
    ? 'Using the demo scan result.'
    : undefined;
  const missingScanResult = cardType === 'scan_result'
    ? !hasScanShareContext
    : cardType === 'challenge_result'
      ? !latestChallenge && !scanResult && !isDemoScan
      : false;

  const dataByType: Record<ShareCardType, StoryCardData> = {
    scan_result: {
      cardType: 'scan_result',
      eyebrow: 'I found a dupe',
      dishName: scanDishName || cardRecipe.title,
      restaurantPrice: scanRestaurantPrice,
      homemadeCost: scanHomemadeCost,
      estimatedSavings: scanEstimatedSavings,
      scoreLabel: scanScoreLabel,
      selectedMode,
      caption: '',
      fallbackNote,
    },
    challenge_result: {
      cardType: 'challenge_result',
      eyebrow: 'Dupe Challenge complete',
      dishName: latestChallenge?.recipeTitle ?? fallbackScanResult.dishName,
      restaurantPrice: fallbackScanResult.restaurantPrice,
      homemadeCost: cardRecipe.estimatedHomemadeCost,
      estimatedSavings: latestChallenge?.moneySaved ?? cardRecipe.estimatedSavings,
      scoreLabel: `${(latestChallenge?.matchScore ?? fallbackScanResult.matchScore).toFixed(1)}/10 match`,
      selectedMode: latestChallenge?.mode ?? selectedMode,
      caption: '',
      fallbackNote,
    },
    ranking: {
      cardType: 'ranking',
      eyebrow: topLeaderboardEntry.category,
      dishName: topLeaderboardEntry.displayName,
      restaurantPrice: fallbackScanResult.restaurantPrice,
      homemadeCost: cardRecipe.estimatedHomemadeCost,
      estimatedSavings: cardRecipe.estimatedSavings,
      scoreLabel: `#${topLeaderboardEntry.rank} this week`,
      selectedMode: topLeaderboardEntry.value,
      caption: '',
    },
    badge: {
      cardType: 'badge',
      eyebrow: unlockedBadge.name,
      dishName: fallbackScanResult.dishName,
      restaurantPrice: fallbackScanResult.restaurantPrice,
      homemadeCost: cardRecipe.estimatedHomemadeCost,
      estimatedSavings: cardRecipe.estimatedSavings,
      scoreLabel: unlockedBadge.description,
      selectedMode,
      caption: '',
      fallbackNote,
    },
    restaurant_pack: {
      cardType: 'restaurant_pack',
      eyebrow: selectedPack.name,
      dishName: packDish?.dishName ?? selectedPack.name,
      restaurantPrice: packDish?.restaurantPrice ?? 0,
      homemadeCost: packDish?.homemadeCost ?? 0,
      estimatedSavings: packDish?.estimatedSavings ?? 0,
      scoreLabel: `${selectedPack.dishes.length} inspired-by dupes`,
      selectedMode: packDish?.difficulty ?? 'Pack',
      caption: '',
    },
  };

  const cardData = dataByType[cardType];
  const caption = buildCaption(cardData);
  const didTrackGenerated = useRef(false);

  useEffect(() => {
    if (didTrackGenerated.current) {
      return;
    }
    uiLog('ShareCardPreviewScreen', 'enter', { cardType, missingScanResult });

    didTrackGenerated.current = true;
    if (missingScanResult) {
      track(analyticsEvents.RESULT_ERROR, {
        cardType,
        errorMessage: 'Share card opened without a latest scan result.',
        screen: 'ShareCardPreviewScreen',
      });
      return;
    }

    track(analyticsEvents.SHARE_CARD_GENERATED, {
      cardType,
      dishName: cardData.dishName,
      mode: cardData.selectedMode,
      savings: cardData.estimatedSavings,
      packName: cardType === 'restaurant_pack' ? selectedPack.name : undefined,
      screen: 'ShareCardPreviewScreen',
    });
  }, [cardData.dishName, cardData.estimatedSavings, cardData.selectedMode, cardType, missingScanResult, selectedPack.name]);

  if (missingScanResult) {
    return (
      <EmptyState
        eyebrow="Share preview"
        title="Scan something first"
        body="Okyo needs a completed scan with a generated recipe before it can build this savings card."
        actionLabel="Start a Scan"
        onAction={() => navigation.navigate('ScanScreen')}
      />
    );
  }

  const shareCard = async () => {
    try {
      uiLog('ShareCardPreviewScreen', 'share_tapped', { cardType, dishName: cardData.dishName });
      track(analyticsEvents.SHARE_TAPPED, {
        cardType,
        dishName: cardData.dishName,
        savings: cardData.estimatedSavings,
        screen: 'ShareCardPreviewScreen',
      });
      const result = await Share.share({ message: caption, title: 'Okyo dupe card' });
      if (result.action !== Share.sharedAction) {
        return;
      }

      awardXPOnce(`share-card-${cardType}-${selectedMode}`, 20);
      track(analyticsEvents.SHARE_COMPLETED, {
        cardType,
        dishName: cardData.dishName,
        savings: cardData.estimatedSavings,
        screen: 'ShareCardPreviewScreen',
      });
    } catch {
      Alert.alert('Share unavailable', 'This device could not open the native share sheet.');
    }
  };

  const copyCaption = async () => {
    try {
      uiLog('ShareCardPreviewScreen', 'copy_caption', { cardType });
      await Clipboard.setStringAsync(caption);
      Alert.alert('Copied', 'Share caption copied.');
    } catch {
      Alert.alert('Copy unavailable', 'The caption could not be copied on this device.');
    }
  };

  const saveToPhotos = () => {
    uiLog('ShareCardPreviewScreen', 'save_to_photos');
    Alert.alert('Coming soon', 'Saving share cards to Photos is a placeholder for now.');
  };

  return (
    <ScreenContainer>
      <Text style={styles.kicker}>{getCardLabel(cardData.cardType)}</Text>
      <Text style={styles.title}>Share preview</Text>
      <Text style={styles.description}>
        Mock story card using local Okyo data. Real image export comes later.
      </Text>

      <View style={styles.previewFrame}>
        <View style={styles.storyCard}>
          <View style={styles.imagePlaceholder}>
            {shareImage?.uri ? (
              <Image source={{ uri: shareImage.uri }} style={styles.scanImage} />
            ) : (
              <View style={styles.photoPlate}>
                <Text style={styles.imageMonogram}>OK</Text>
                <Text style={styles.imageLabel}>Food photo</Text>
              </View>
            )}
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.cardEyebrow}>{cardData.eyebrow}</Text>
            <Text style={styles.cardTitle}>{cardData.dishName}</Text>

            <View style={styles.priceRow}>
              <View>
                <Text style={styles.priceLabel}>Restaurant</Text>
                <Text style={styles.priceValue}>{formatCurrency(cardData.restaurantPrice)}</Text>
              </View>
              <Text style={styles.arrow}>-&gt;</Text>
              <View>
                <Text style={styles.priceLabel}>Homemade</Text>
                <Text style={styles.priceValue}>{formatCurrency(cardData.homemadeCost)}</Text>
              </View>
            </View>

            <View style={styles.savingsBlock}>
              <Text style={styles.savingsLabel}>Saved about</Text>
              <Text style={styles.savingsValue}>{formatCurrency(cardData.estimatedSavings)}</Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaPill}>{cardData.scoreLabel}</Text>
              <Text style={styles.metaPill}>{cardData.selectedMode}</Text>
            </View>

            <Text style={styles.watermark}>Made with Okyo</Text>
          </View>
        </View>
      </View>

      {cardData.fallbackNote ? <Text style={styles.fallbackNote}>{cardData.fallbackNote}</Text> : null}

      <View style={styles.actions}>
        <PrimaryButton onPress={shareCard}>Share</PrimaryButton>
        <SecondaryButton onPress={copyCaption}>Copy Caption</SecondaryButton>
        <SecondaryButton onPress={saveToPhotos}>Save to Photos</SecondaryButton>
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
  previewFrame: {
    alignItems: 'center',
    marginTop: 22,
  },
  storyCard: {
    aspectRatio: 9 / 16,
    backgroundColor: colors.charcoal,
    borderRadius: 28,
    maxWidth: 360,
    overflow: 'hidden',
    width: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.creamDeep,
    flex: 0.42,
    justifyContent: 'center',
  },
  scanImage: {
    height: '100%',
    width: '100%',
  },
  photoPlate: {
    alignItems: 'center',
    backgroundColor: '#fffdf8',
    borderColor: colors.coral,
    borderRadius: 74,
    borderWidth: 5,
    height: 148,
    justifyContent: 'center',
    width: 148,
  },
  imageMonogram: {
    color: colors.coral,
    fontSize: 42,
    fontWeight: '900',
  },
  imageLabel: {
    color: colors.body,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  cardBody: {
    flex: 0.58,
    justifyContent: 'space-between',
    padding: 18,
  },
  cardEyebrow: {
    color: '#ffb199',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: '#fffdf8',
    fontSize: 27,
    fontWeight: '900',
    lineHeight: 32,
  },
  priceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceLabel: {
    color: '#cabdab',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  priceValue: {
    color: '#fffdf8',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 2,
  },
  arrow: {
    color: '#ffb199',
    fontSize: 26,
    fontWeight: '900',
  },
  savingsBlock: {
    backgroundColor: '#99ebb9',
    borderRadius: 20,
    padding: 14,
  },
  savingsLabel: {
    color: '#173523',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  savingsValue: {
    color: '#102418',
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 42,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    backgroundColor: '#fffdf8',
    borderRadius: 999,
    color: colors.charcoal,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  watermark: {
    color: '#fffdf8',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  fallbackNote: {
    color: colors.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
    textAlign: 'center',
  },
  actions: {
    gap: 10,
    marginTop: 22,
  },
});

function getShareRecipe(
  mode: RecipeMode,
  recipes: Recipe[],
  fallbackRecipe: Recipe | null,
  routeRecipe: Recipe | null,
  isDemoScan: boolean,
) {
  return (routeRecipe?.mode === mode ? routeRecipe : null) ??
    recipes.find((recipe) => recipe.mode === mode) ??
    (fallbackRecipe?.mode === mode ? fallbackRecipe : null) ??
    (isDemoScan ? getSafeRecipeForMode(mode) : null);
}

function isExplicitDemoScan(image: { placeholder?: boolean; source?: string } | null) {
  return image?.placeholder === true && image.source === 'mock';
}

function getEstimatedRestaurantPrice(recipe: Recipe | null) {
  return recipe ? recipe.estimatedHomemadeCost + recipe.estimatedSavings : 0;
}
