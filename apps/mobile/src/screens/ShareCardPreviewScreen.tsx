import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import {
  ArrowRight,
  Camera,
  ClipboardCheck,
  Clock,
  Crown,
  Cutlery,
  MoneySquare,
  NavArrowLeft,
  ShareAndroid,
  Spark,
  TaskList,
} from 'iconoir-react-native';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { KikoMascot } from '../components/KikoMascot';
import { colors } from '../components/OkyoUI';
import {
  defaultRestaurantPack,
  defaultScanResult,
  getSafeRecipeForMode,
  getSafeRecipeMode,
  mockBadges,
  mockRestaurantPacks,
  type Difficulty,
  type Recipe,
  type RecipeMode,
  type ScanResult,
} from '../mocks';
import type { RootStackParamList, ShareCardType } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { getRecipeImageUrl } from '../utils/recipeImages';
import { checkImageFileExists, getStorageLocation } from '../utils/imageValidation';
import { imageTraceLog, uiLog } from '../utils/uiDebug';

type ShareCardRoute = RouteProp<RootStackParamList, 'ShareCardPreviewScreen'>;
type ShareCardNavigation = NativeStackNavigationProp<RootStackParamList, 'ShareCardPreviewScreen'>;
type SharePricingState = 'restaurant_price' | 'challenge_savings' | 'home_estimate';
type ShareCardData = {
  cardType: ShareCardType;
  dishName: string;
  eyebrow: string;
  flexLine: string;
  pricingState: SharePricingState;
  restaurantPrice: number;
  homemadeCost: number;
  estimatedSavings: number;
  selectedMode: RecipeMode | string;
  recipe: Recipe;
  scanResult?: ScanResult | null;
  imageUri?: string | null;
  homemadeImageUri?: string | null;
  caption: string;
};

const formatCurrency = (value: number) => `$${Math.max(0, value).toFixed(2)}`;

export function ShareCardPreviewScreen() {
  const navigation = useNavigation<ShareCardNavigation>();
  const route = useRoute<ShareCardRoute>();
  const cardType = getSafeCardType(route.params?.cardType);
  const storeMode = useOkyoStore((state) => state.selectedMode);
  const latestScanResult = useOkyoStore((state) => state.latestScanResult);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const completedChallenges = useOkyoStore((state) => state.completedChallenges);
  const leaderboardEntries = useOkyoStore((state) => state.leaderboardEntries);
  const unlockedBadges = useOkyoStore((state) => state.unlockedBadges);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const selectedMode = getSafeRecipeMode(route.params?.mode ?? storeMode);
  const scanContext = route.params?.scanContext;
  const shareImage = scanContext?.image ?? selectedScanImage;
  const isDemoScan = shareImage?.source === 'mock';
  const routeRecipe = scanContext?.recipe ?? null;
  const recipe = getShareRecipe(selectedMode, latestScanRecipe ? [latestScanRecipe] : [], latestScanRecipe, routeRecipe, isDemoScan);
  const scanResult = scanContext?.scanResult ?? latestScanResult ?? (isDemoScan ? defaultScanResult : null);
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
      id: 'badge',
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
  const cardRecipe = recipe ?? getSafeRecipeForMode(selectedMode);
  const hasScanShareContext = Boolean(
    cardType !== 'scan_result' ||
    recipe ||
    (scanResult && (scanContext?.recipe || latestScanRecipe)) ||
    isDemoScan,
  );
  const missingScanResult = cardType === 'scan_result' && !hasScanShareContext;

  const cardData = useMemo<ShareCardData>(() => {
    const scanDishName = scanResult?.dishName ?? recipe?.title ?? cardRecipe.title;
    const scanRestaurantPrice = getPositiveNumber(scanResult?.restaurantPrice);
    const scanHomemadeCost = getPositiveNumber(recipe?.estimatedHomemadeCost) ||
      getPositiveNumber(scanResult?.homemadeCost) ||
      getPositiveNumber(cardRecipe.estimatedHomemadeCost);
    const scanEstimatedSavings = scanRestaurantPrice > 0
      ? getPositiveNumber(scanResult?.estimatedSavings) || Math.max(0, scanRestaurantPrice - scanHomemadeCost)
      : 0;
    const packRestaurantPrice = getPositiveNumber(packDish?.restaurantPrice);
    const packHomemadeCost = getPositiveNumber(packDish?.homemadeCost);
    const challengeSavings = getPositiveNumber(latestChallenge?.moneySaved);

    const dataByType: Record<ShareCardType, Omit<ShareCardData, 'caption'>> = {
      scan_result: {
        cardType: 'scan_result',
        eyebrow: 'Restaurant-style swap',
        flexLine: scanRestaurantPrice > 0
          ? 'I remade this restaurant meal at home.'
          : 'Restaurant food, home-cooked.',
        pricingState: scanRestaurantPrice > 0 ? 'restaurant_price' : 'home_estimate',
        dishName: scanDishName,
        restaurantPrice: scanRestaurantPrice,
        homemadeCost: scanHomemadeCost,
        estimatedSavings: scanEstimatedSavings,
        selectedMode,
        recipe: cardRecipe,
        scanResult,
        imageUri: (!shareImage?.placeholder && shareImage?.uri) ? shareImage.uri : getRecipeImageUri(cardRecipe),
        homemadeImageUri: getHomemadeImageUri(cardRecipe),
      },
      challenge_result: {
        cardType: 'challenge_result',
        eyebrow: 'Challenge complete',
        dishName: latestChallenge?.recipeTitle ?? cardRecipe.title,
        flexLine: 'Restaurant food, home-cooked.',
        pricingState: challengeSavings > 0 ? 'challenge_savings' : 'home_estimate',
        restaurantPrice: 0,
        homemadeCost: getPositiveNumber(cardRecipe.estimatedHomemadeCost),
        estimatedSavings: challengeSavings,
        selectedMode: latestChallenge?.mode ?? selectedMode,
        recipe: cardRecipe,
        scanResult,
        imageUri: (!shareImage?.placeholder && shareImage?.uri) ? shareImage.uri : getRecipeImageUri(cardRecipe),
        homemadeImageUri: getHomemadeImageUri(cardRecipe),
      },
      ranking: {
        cardType: 'ranking',
        eyebrow: topLeaderboardEntry.category,
        dishName: topLeaderboardEntry.displayName,
        flexLine: 'Restaurant food, home-cooked.',
        pricingState: 'home_estimate',
        restaurantPrice: 0,
        homemadeCost: getPositiveNumber(cardRecipe.estimatedHomemadeCost),
        estimatedSavings: 0,
        selectedMode: topLeaderboardEntry.value,
        recipe: cardRecipe,
        scanResult,
        imageUri: (!shareImage?.placeholder && shareImage?.uri) ? shareImage.uri : getRecipeImageUri(cardRecipe),
        homemadeImageUri: getHomemadeImageUri(cardRecipe),
      },
      badge: {
        cardType: 'badge',
        eyebrow: unlockedBadge.name,
        dishName: recipe?.title ?? cardRecipe.title,
        flexLine: 'Restaurant food, home-cooked.',
        pricingState: 'home_estimate',
        restaurantPrice: 0,
        homemadeCost: getPositiveNumber(cardRecipe.estimatedHomemadeCost),
        estimatedSavings: 0,
        selectedMode,
        recipe: cardRecipe,
        scanResult,
        imageUri: (!shareImage?.placeholder && shareImage?.uri) ? shareImage.uri : getRecipeImageUri(cardRecipe),
        homemadeImageUri: getHomemadeImageUri(cardRecipe),
      },
      restaurant_pack: {
        cardType: 'restaurant_pack',
        eyebrow: selectedPack.name,
        dishName: packDish?.dishName ?? selectedPack.name,
        flexLine: 'I remade this restaurant meal at home.',
        pricingState: packRestaurantPrice > 0 ? 'restaurant_price' : 'home_estimate',
        restaurantPrice: packRestaurantPrice,
        homemadeCost: packHomemadeCost,
        estimatedSavings: packRestaurantPrice > 0
          ? getPositiveNumber(packDish?.estimatedSavings) || Math.max(0, packRestaurantPrice - packHomemadeCost)
          : 0,
        selectedMode: packDish?.difficulty ?? 'Pack',
        recipe: cardRecipe,
        scanResult,
        imageUri: (!shareImage?.placeholder && shareImage?.uri) ? shareImage.uri : getRecipeImageUri(cardRecipe),
        homemadeImageUri: getHomemadeImageUri(cardRecipe),
      },
    };
    const nextData = dataByType[cardType];

    return {
      ...nextData,
      caption: buildCaption(nextData),
    };
  }, [
    cardRecipe,
    cardType,
    latestChallenge?.mode,
    latestChallenge?.moneySaved,
    latestChallenge?.recipeTitle,
    packDish?.difficulty,
    packDish?.dishName,
    packDish?.estimatedSavings,
    packDish?.homemadeCost,
    packDish?.restaurantPrice,
    recipe,
    scanResult,
    selectedMode,
    selectedPack.name,
    shareImage?.placeholder,
    shareImage?.uri,
    topLeaderboardEntry.category,
    topLeaderboardEntry.displayName,
    topLeaderboardEntry.value,
    unlockedBadge.name,
  ]);
  const shareStats = useMemo(() => getShareStats(cardData), [cardData]);
  const didTrackGenerated = useRef(false);
  const cardRef = useRef<View | null>(null);

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

  useEffect(() => {
    const imageUri = cardData.imageUri ?? null;
    const usingFallback = Boolean(shareImage?.placeholder || !shareImage?.uri);
    checkImageFileExists(imageUri).then((fileExists) => {
      imageTraceLog('ShareCardPreviewScreen', {
        screen: 'ShareCardPreviewScreen',
        cardType,
        recipeId: cardRecipe.id,
        imageSource: !usingFallback ? 'shareImage.uri' : 'recipe.imageUri',
        imageUri,
        fileExists: imageUri ? fileExists : 'n/a',
        usingFallback,
        fallbackReason: usingFallback
          ? (shareImage?.placeholder ? 'placeholder_image' : 'no_share_image_uri')
          : null,
        storageLocation: getStorageLocation(imageUri),
      });
    });
  }, [cardData.imageUri, cardType]);

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('MainTabs', { screen: 'ScanScreen' });
  };

  const shareCard = async () => {
    try {
      uiLog('ShareCardPreviewScreen', 'share_tapped', { cardType, dishName: cardData.dishName });
      track(analyticsEvents.SHARE_TAPPED, {
        cardType,
        dishName: cardData.dishName,
        savings: cardData.estimatedSavings,
        screen: 'ShareCardPreviewScreen',
      });
      const didShareImage = await shareImageCard();
      if (didShareImage) {
        awardXPOnce(`share-card-${cardType}-${selectedMode}`, 20);
        track(analyticsEvents.SHARE_COMPLETED, {
          cardType,
          dishName: cardData.dishName,
          savings: cardData.estimatedSavings,
          screen: 'ShareCardPreviewScreen',
          source: 'image',
        });
        return;
      }

      const result = await Share.share({ message: cardData.caption, title: 'Okyo share card' });
      if (result.action !== Share.sharedAction) {
        return;
      }

      awardXPOnce(`share-card-${cardType}-${selectedMode}`, 20);
      track(analyticsEvents.SHARE_COMPLETED, {
        cardType,
        dishName: cardData.dishName,
        savings: cardData.estimatedSavings,
        screen: 'ShareCardPreviewScreen',
        source: 'caption',
      });
    } catch {
      Alert.alert('Share unavailable', 'This device could not open the native share sheet.');
    }
  };

  const shareImageCard = async () => {
    try {
      if (!cardRef.current || !(await Sharing.isAvailableAsync())) {
        return false;
      }

      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      await Sharing.shareAsync(uri, {
        dialogTitle: 'Share Okyo card',
        mimeType: 'image/png',
        UTI: 'public.png',
      });

      return true;
    } catch (error) {
      uiLog('ShareCardPreviewScreen', 'share_image_unavailable', {
        errorMessage: error instanceof Error ? error.message : 'Image share unavailable.',
      });
      return false;
    }
  };

  const copyCaption = async () => {
    try {
      uiLog('ShareCardPreviewScreen', 'copy_caption', { cardType });
      await Clipboard.setStringAsync(cardData.caption);
      Alert.alert('Copied', 'Share caption copied.');
    } catch {
      Alert.alert('Copy unavailable', 'The caption could not be copied on this device.');
    }
  };

  if (missingScanResult) {
    return (
      <ShareFrame>
        <ShareTopBar onBack={goBack} />
        <View style={styles.emptyCard}>
          <KikoMascot pose="wave" size={118} style={styles.emptyMascot} />
          <Text style={styles.emptyTitle}>Scan something first.</Text>
          <Text style={styles.emptyBody}>
            Okyo needs a completed food scan and recipe before it can build a share card.
          </Text>
          <PrimaryAction icon={<Camera color="#fffdf8" height={20} strokeWidth={2.2} width={20} />} label="Start a scan" onPress={() => navigation.navigate('MainTabs', { screen: 'ScanScreen' })} />
        </View>
      </ShareFrame>
    );
  }

  return (
    <ShareFrame>
      <ShareTopBar onBack={goBack} />

      <View style={styles.previewIntro}>
        <Text style={styles.previewKicker}>{cardData.eyebrow}</Text>
        <Text style={styles.previewTitle}>Share preview</Text>
        <Text style={styles.previewBody}>A post-ready card built from this Okyo recipe.</Text>
      </View>

      <View style={styles.cardShell}>
        <View ref={cardRef} collapsable={false} style={styles.shareCard}>
          <PhotoBlock
            dishName={cardData.dishName}
            imageUri={cardData.imageUri}
            homemadeImageUri={cardData.homemadeImageUri}
          />
          <Text adjustsFontSizeToFit minimumFontScale={0.62} numberOfLines={2} style={styles.cardTitle}>
            {cleanDisplayText(cardData.dishName)}
          </Text>
          <View style={styles.flexLineRow}>
            <View style={styles.remadeLine} />
            <Text style={styles.remadeText}>{cardData.flexLine}</Text>
            <View style={styles.remadeLine} />
          </View>

          {cardData.pricingState === 'restaurant_price' ? (
            <View style={styles.transformPill}>
              <Text style={styles.transformText}>Restaurant</Text>
              <ArrowRight color={colors.coral} height={24} strokeWidth={2.4} width={24} />
              <Text style={styles.transformText}>Homemade</Text>
            </View>
          ) : null}

          <View style={styles.statGrid}>
            {shareStats.map((stat) => (
              <ShareStat key={stat.label} stat={stat} />
            ))}
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterText}>Made with <Text style={styles.okyoText}>Okyo</Text></Text>
            <View style={styles.footerBadge}>
              <Spark color={colors.coral} height={20} strokeWidth={2} width={20} />
            </View>
          </View>
        </View>
      </View>

      <PriceSummary cardData={cardData} />

      <View style={styles.actions}>
        <PrimaryAction icon={<ShareAndroid color="#fffdf8" height={21} strokeWidth={2.2} width={21} />} label="Share Image" onPress={shareCard} />
        <SecondaryAction icon={<ClipboardCheck color={colors.coral} height={20} strokeWidth={2.2} width={20} />} label="Copy Caption" onPress={copyCaption} />
      </View>
    </ShareFrame>
  );
}

function ShareFrame({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function ShareTopBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.topBar}>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
        onPress={onBack}
      >
        <NavArrowLeft color={colors.charcoal} height={22} strokeWidth={2.35} width={22} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <Text style={styles.topTitle}>Share</Text>
      <View style={styles.topSpacer} />
    </View>
  );
}

function PhotoBlock({
  dishName,
  imageUri,
  homemadeImageUri,
}: {
  dishName: string;
  imageUri?: string | null;
  homemadeImageUri?: string | null;
}) {
  if (imageUri && homemadeImageUri) {
    return (
      <View style={styles.comparisonBlock}>
        <Image source={{ uri: imageUri }} style={styles.comparisonImageLeft} />
        <Image source={{ uri: homemadeImageUri }} style={styles.comparisonImageRight} />
      </View>
    );
  }

  if (imageUri) {
    return (
      <View style={styles.singlePhotoBlock}>
        <Image source={{ uri: imageUri }} style={styles.singlePhoto} />
      </View>
    );
  }

  return (
    <View style={styles.photoArt}>
      <Text style={styles.photoInitials}>{getInitials(dishName)}</Text>
      <Text style={styles.photoArtText}>Okyo-style homemade version</Text>
    </View>
  );
}

function ShareStat({ stat }: { stat: ShareStatData }) {
  return (
    <View style={styles.shareStat}>
      <View style={styles.shareStatTop}>
        <View style={styles.shareStatIcon}>{stat.icon}</View>
        <View style={styles.shareStatTextGroup}>
          <Text numberOfLines={1} style={styles.shareStatLabel}>{stat.label}</Text>
          <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.shareStatValue}>
            {stat.value}
          </Text>
        </View>
      </View>
      <View style={styles.shareStatTrack}>
        <View style={[styles.shareStatFill, { width: `${stat.strength}%` }]} />
      </View>
    </View>
  );
}

function PriceSummary({ cardData }: { cardData: ShareCardData }) {
  if (cardData.pricingState === 'restaurant_price') {
    return (
      <View style={styles.priceSummary}>
        <View style={styles.priceColumn}>
          <Text style={styles.priceLabel}>Restaurant</Text>
          <Text style={styles.priceValue}>{formatCurrency(cardData.restaurantPrice)}</Text>
        </View>
        <ArrowRight color={colors.green} height={22} strokeWidth={2.4} width={22} />
        <View style={styles.priceColumn}>
          <Text style={styles.priceLabel}>Home estimate</Text>
          <Text style={styles.priceValue}>{formatCurrency(cardData.homemadeCost)}</Text>
        </View>
        <View style={styles.savingsPill}>
          <Text style={styles.savingsPillLabel}>Saved</Text>
          <Text style={styles.savingsPillValue}>{formatCurrency(cardData.estimatedSavings)}</Text>
        </View>
      </View>
    );
  }

  if (cardData.pricingState === 'challenge_savings') {
    return (
      <View style={styles.priceSummary}>
        <View style={styles.priceColumnWide}>
          <Text style={styles.priceLabel}>Logged estimated savings</Text>
          <Text style={styles.priceValue}>{formatCurrency(cardData.estimatedSavings)}</Text>
        </View>
        <View style={styles.savingsPill}>
          <Text style={styles.savingsPillLabel}>Cooked</Text>
          <Text style={styles.savingsPillValue}>At home</Text>
        </View>
      </View>
    );
  }

  const totalTime = getTotalTime(cardData.recipe);
  return (
    <View style={styles.priceSummary}>
      <View style={styles.priceColumn}>
        <Text style={styles.priceLabel}>Home estimate</Text>
        <Text style={styles.priceValue}>{formatCurrency(cardData.homemadeCost)}</Text>
      </View>
      <View style={styles.priceColumn}>
        <Text style={styles.priceLabel}>Ready in</Text>
        <Text style={styles.priceValue}>{totalTime > 0 ? formatDuration(totalTime) : 'Flexible'}</Text>
      </View>
      <View style={styles.savingsPill}>
        <Text style={styles.savingsPillLabel}>Style</Text>
        <Text style={styles.savingsPillValue}>{getModeLabel(cardData.selectedMode)}</Text>
      </View>
    </View>
  );
}

function PrimaryAction({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.primaryAction, pressed ? styles.pressed : null]}
      onPress={onPress}
    >
      {icon}
      <Text style={styles.primaryActionText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryAction({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.secondaryAction, pressed ? styles.pressed : null]}
      onPress={onPress}
    >
      {icon}
      <Text style={styles.secondaryActionText}>{label}</Text>
    </Pressable>
  );
}

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

function buildCaption(data: Omit<ShareCardData, 'caption'>) {
  const dishName = cleanDisplayText(data.dishName);
  const modeLabel = typeof data.selectedMode === 'string' ? getModeLabel(data.selectedMode) : String(data.selectedMode);
  const totalTime = getTotalTime(data.recipe);

  if (data.pricingState === 'restaurant_price') {
    return `${dishName} remade at home with Okyo. Restaurant ${formatCurrency(data.restaurantPrice)} -> home estimate ${formatCurrency(data.homemadeCost)}. Saved about ${formatCurrency(data.estimatedSavings)} with a ${modeLabel} version. Made with Okyo.`;
  }

  if (data.pricingState === 'challenge_savings') {
    return `${dishName} cooked at home with Okyo. Logged about ${formatCurrency(data.estimatedSavings)} in estimated savings from a ${modeLabel} cooking win. Made with Okyo.`;
  }

  const timeText = totalTime > 0 ? ` Ready in about ${formatDuration(totalTime)}.` : '';
  return `${dishName} cooked at home with Okyo. Home estimate ${formatCurrency(data.homemadeCost)}.${timeText} ${modeLabel} style. Made with Okyo.`;
}

function getShareRecipe(
  mode: RecipeMode,
  recipes: Recipe[],
  fallbackRecipe: Recipe | null,
  routeRecipe: Recipe | null,
  isDemoScan: boolean,
) {
  // One canonical recipe per scan; the view mode is a lens. The explicit
  // route/scan-context recipe wins; otherwise match by mode for legacy
  // multi-recipe saves, then fall back to the single canonical recipe so sharing
  // works under any view lens. Demo scans fall back to a mock.
  return routeRecipe ??
    recipes.find((item) => item.mode === mode) ??
    fallbackRecipe ??
    recipes[0] ??
    (isDemoScan ? getSafeRecipeForMode(mode) : null);
}

type ShareStatData = {
  label: string;
  value: string;
  strength: number;
  icon: ReactNode;
};

function getShareStats(data: ShareCardData): ShareStatData[] {
  const recipe = data.recipe;
  const totalTime = getTotalTime(recipe);
  const stepsCount = getStepCount(recipe);
  const stats: ShareStatData[] = [];

  if (data.pricingState === 'restaurant_price') {
    stats.push(
      {
        label: 'Restaurant',
        value: formatCurrency(data.restaurantPrice),
        strength: 86,
        icon: <MoneySquare color={colors.coral} height={22} strokeWidth={1.9} width={22} />,
      },
      {
        label: 'Home',
        value: formatCurrency(data.homemadeCost),
        strength: 62,
        icon: <Cutlery color={colors.coral} height={22} strokeWidth={1.9} width={22} />,
      },
      {
        label: 'Saved',
        value: formatCurrency(data.estimatedSavings),
        strength: 92,
        icon: <Spark color={colors.coral} height={22} strokeWidth={1.9} width={22} />,
      },
    );
  } else if (data.pricingState === 'challenge_savings') {
    stats.push({
      label: 'Logged saved',
      value: formatCurrency(data.estimatedSavings),
      strength: 88,
      icon: <MoneySquare color={colors.coral} height={22} strokeWidth={1.9} width={22} />,
    });
  } else {
    stats.push({
      label: 'Home est.',
      value: formatCurrency(data.homemadeCost),
      strength: 70,
      icon: <MoneySquare color={colors.coral} height={22} strokeWidth={1.9} width={22} />,
    });
  }

  stats.push(
    {
      label: 'Time',
      value: totalTime > 0 ? formatDuration(totalTime) : 'Flexible',
      strength: getTimeStrength(totalTime),
      icon: <Clock color={colors.coral} height={22} strokeWidth={1.9} width={22} />,
    },
    {
      label: 'Difficulty',
      value: getShareDifficulty(recipe.difficulty),
      strength: getDifficultyStrength(recipe.difficulty),
      icon: <Crown color={colors.coral} height={22} strokeWidth={1.9} width={22} />,
    },
    {
      label: 'Style',
      value: getModeLabel(data.selectedMode),
      strength: 72,
      icon: <Cutlery color={colors.coral} height={22} strokeWidth={1.9} width={22} />,
    },
  );

  if (recipe.servings > 0 && stats.length < 6) {
    stats.push({
      label: 'Servings',
      value: `${recipe.servings}`,
      strength: Math.min(88, 36 + recipe.servings * 8),
      icon: <TaskList color={colors.coral} height={22} strokeWidth={1.9} width={22} />,
    });
  } else if (stepsCount > 0 && stats.length < 6) {
    stats.push({
      label: 'Steps',
      value: `${stepsCount} step${stepsCount === 1 ? '' : 's'}`,
      strength: Math.min(92, 35 + stepsCount * 8),
      icon: <TaskList color={colors.coral} height={22} strokeWidth={1.9} width={22} />,
    });
  }

  return stats.slice(0, 6);
}

function getTotalTime(recipe: Recipe) {
  const total = getFiniteNumber(recipe.totalTimeMinutes);
  return total > 0 ? total : getFiniteNumber(recipe.prepTimeMinutes) + getFiniteNumber(recipe.cookTimeMinutes);
}

function getStepCount(recipe: Recipe) {
  return recipe.structuredSteps?.length ?? recipe.steps?.length ?? 0;
}

function formatDuration(minutes: number) {
  if (minutes >= 120) {
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours.toFixed(0) : hours.toFixed(1)} hr`;
  }

  return `${minutes} min`;
}

function getShareDifficulty(difficulty: Difficulty) {
  switch (difficulty) {
    case 'Hard':
      return 'Advanced';
    case 'Medium':
      return 'Intermediate';
    case 'Easy':
    default:
      return 'Beginner';
  }
}

function getDifficultyStrength(difficulty: Difficulty) {
  switch (difficulty) {
    case 'Hard':
      return 86;
    case 'Medium':
      return 66;
    case 'Easy':
    default:
      return 42;
  }
}

function getTimeStrength(totalTime: number) {
  if (totalTime <= 0) {
    return 42;
  }

  return Math.min(92, Math.max(34, 30 + totalTime / 2));
}

function getModeLabel(mode: RecipeMode | string) {
  switch (mode) {
    case 'Budget':
      return 'Easy Shortcut';
    case 'Healthy':
      return 'Healthier';
    case 'Restaurant Copy':
      return 'Restaurant Style';
    default:
      return String(mode);
  }
}

function getRecipeImageUri(recipe: Recipe) {
  return getRecipeImageUrl(recipe);
}

function getHomemadeImageUri(recipe: Recipe) {
  const recipeWithImage = recipe as Recipe & {
    homemadeImageUri?: unknown;
    finalPhotoUri?: unknown;
    homemadeImage?: { uri?: unknown };
  };
  const uri = recipeWithImage.homemadeImageUri ?? recipeWithImage.finalPhotoUri ?? recipeWithImage.homemadeImage?.uri;
  return typeof uri === 'string' && uri.trim().length > 0 ? uri : null;
}

function getFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getPositiveNumber(value: unknown) {
  return Math.max(0, getFiniteNumber(value));
}

function cleanDisplayText(value: string) {
  const copyWord = `copy${'cat'}`;
  const copyStyle = `${copyWord}-style`;

  return value
    .replace(new RegExp(`\\b${copyStyle}\\b`, 'gi'), 'restaurant-style')
    .replace(new RegExp(`\\b${copyWord}\\b`, 'gi'), 'restaurant-style')
    .replace(/\bdupes?\b/gi, 'swaps')
    .replace(/\bmock\b/gi, 'demo')
    .trim();
}

function getInitials(title: string) {
  const words = cleanDisplayText(title).split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase()).join('') || 'OK';
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    gap: 12,
    padding: 24,
    paddingTop: 18,
    paddingBottom: 92,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 10,
  },
  backText: {
    color: colors.coral,
    fontSize: 14,
    fontWeight: '700',
  },
  topTitle: {
    color: colors.charcoal,
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  topSpacer: {
    width: 78,
  },
  previewIntro: {
    alignItems: 'center',
    gap: 3,
  },
  previewKicker: {
    color: colors.coral,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  previewTitle: {
    color: colors.charcoal,
    fontSize: 23,
    fontWeight: '700',
  },
  previewBody: {
    color: colors.body,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    maxWidth: 300,
    textAlign: 'center',
  },
  cardShell: {
    alignItems: 'center',
  },
  shareCard: {
    backgroundColor: '#fffdf8',
    borderRadius: 24,
    maxWidth: 326,
    padding: 14,
    shadowColor: '#3b2f20',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    width: '100%',
  },
  cardTitle: {
    color: colors.charcoal,
    fontFamily: undefined,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 30,
    marginTop: 12,
    textAlign: 'center',
  },
  flexLineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
  },
  remadeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
  },
  remadeLine: {
    backgroundColor: '#e8ad73',
    borderRadius: 999,
    height: 2,
    width: 38,
  },
  remadeText: {
    color: '#6e755a',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'center',
  },
  comparisonBlock: {
    aspectRatio: 1.18,
    borderRadius: 18,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  comparisonImageLeft: {
    backgroundColor: colors.cream,
    borderRightColor: '#fff8ef',
    borderRightWidth: 2,
    flex: 1,
  },
  comparisonImageRight: {
    backgroundColor: colors.cream,
    flex: 1,
  },
  singlePhotoBlock: {
    aspectRatio: 1.18,
    backgroundColor: colors.cream,
    borderRadius: 18,
    overflow: 'hidden',
  },
  singlePhoto: {
    height: '100%',
    width: '100%',
  },
  photoArt: {
    alignItems: 'center',
    aspectRatio: 1.18,
    backgroundColor: '#fff1df',
    borderRadius: 18,
    justifyContent: 'center',
    padding: 14,
  },
  photoInitials: {
    color: colors.coral,
    fontSize: 30,
    fontWeight: '800',
  },
  photoArtText: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  transformPill: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#fff8ef',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  transformText: {
    color: '#59634d',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
  },
  shareStat: {
    backgroundColor: '#fffaf3',
    borderRadius: 14,
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 74,
    padding: 8,
  },
  shareStatTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  shareStatIcon: {
    alignItems: 'center',
    backgroundColor: '#fff0dd',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  shareStatTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  shareStatLabel: {
    color: '#68725d',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  shareStatValue: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  shareStatTrack: {
    backgroundColor: '#f5e6d3',
    borderRadius: 999,
    height: 6,
    marginTop: 8,
    overflow: 'hidden',
  },
  shareStatFill: {
    backgroundColor: '#f47b21',
    borderRadius: 999,
    height: '100%',
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  cardFooterText: {
    color: colors.body,
    fontSize: 14,
    fontWeight: '700',
  },
  okyoText: {
    color: colors.coral,
    fontWeight: '800',
  },
  footerBadge: {
    alignItems: 'center',
    backgroundColor: '#fff1df',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  priceSummary: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    padding: 12,
  },
  priceColumn: {
    flex: 1,
    minWidth: 92,
  },
  priceColumnWide: {
    flex: 1,
    minWidth: 150,
  },
  priceLabel: {
    color: colors.body,
    fontSize: 11,
    fontWeight: '600',
  },
  priceValue: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 3,
  },
  savingsPill: {
    backgroundColor: colors.greenSoft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  savingsPillLabel: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  savingsPillValue: {
    color: colors.green,
    fontSize: 16,
    fontWeight: '700',
  },
  actions: {
    gap: 10,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  primaryActionText: {
    color: '#fffdf8',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  secondaryActionText: {
    color: colors.coral,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 26,
    gap: 14,
    marginTop: 24,
    padding: 24,
    shadowColor: '#4a3a28',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  emptyMascot: {
    marginBottom: 2,
  },
  emptyTitle: {
    color: colors.charcoal,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 31,
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.body,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
