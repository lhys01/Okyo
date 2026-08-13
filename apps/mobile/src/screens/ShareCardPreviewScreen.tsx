import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import {
  Camera,
  ClipboardCheck,
  Check,
  Coins,
  Clock,
  Crown,
  Cutlery,
  Droplet,
  NavArrowLeft,
  ShareAndroid,
  Star,
  TaskList,
  User,
} from 'iconoir-react-native';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Image, LayoutAnimation, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
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
  type Recipe,
  type RecipeMode,
  type ScanResult,
} from '../mocks';
import type { RootStackParamList, ShareCardType } from '../navigation/types';
import { resolveCanonicalRecipe } from '../state/canonicalRecipes';
import { useOkyoStore } from '../state/useOkyoStore';
import { getDefaultShareMetricKeys, getMetricRows, getShareMetrics, type ShareMetric, type ShareMetricKey } from '../utils/shareCardMetrics';
import { getRecipeImageUrl } from '../utils/recipeImages';
import { checkImageFileExists, getStorageLocation } from '../utils/imageValidation';
import { imageTraceLog, uiLog } from '../utils/uiDebug';

type ShareCardRoute = RouteProp<RootStackParamList, 'ShareCardPreviewScreen'>;
type ShareCardNavigation = NativeStackNavigationProp<RootStackParamList, 'ShareCardPreviewScreen'>;
type ShareCardData = {
  cardType: ShareCardType;
  dishName: string;
  eyebrow: string;
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

export function ShareCardPreviewScreen() {
  const navigation = useNavigation<ShareCardNavigation>();
  const route = useRoute<ShareCardRoute>();
  const cardType = getSafeCardType(route.params?.cardType);
  const storeMode = useOkyoStore((state) => state.selectedMode);
  const recipesById = useOkyoStore((state) => state.recipesById);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const completedChallenges = useOkyoStore((state) => state.completedChallenges);
  const leaderboardEntries = useOkyoStore((state) => state.leaderboardEntries);
  const unlockedBadges = useOkyoStore((state) => state.unlockedBadges);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const recipeServingOverrides = useOkyoStore((state) => state.recipeServingOverrides ?? {});
  const recipeFeedbackById = useOkyoStore((state) => state.recipeFeedbackById ?? {});
  const requestedRecipeId = route.params?.recipeId;
  const canonicalRecipe = requestedRecipeId
    ? resolveCanonicalRecipe(recipesById, requestedRecipeId)
    : null;
  const selectedMode = getSafeRecipeMode(canonicalRecipe?.selectedMode ?? route.params?.mode ?? storeMode);
  const scanContext = route.params?.scanContext;
  const shareImage = canonicalRecipe?.originalImage ??
    scanContext?.image ??
    (selectedScanImage?.source === 'mock' ? selectedScanImage : null);
  const isDemoScan = shareImage?.source === 'mock';
  const routeRecipe = scanContext?.recipe ?? null;
  const recipe = requestedRecipeId
    ? canonicalRecipe
    : (isDemoScan ? routeRecipe ?? getSafeRecipeForMode(selectedMode) : null);
  const scanResult = canonicalRecipe?.scanResult ??
    scanContext?.scanResult ??
    (isDemoScan ? defaultScanResult : null);
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
  const fallbackScanResult = scanResult ?? defaultScanResult;
  const hasScanShareContext = Boolean(
    cardType !== 'scan_result' ||
    (recipe && scanResult) ||
    isDemoScan,
  );
  const missingScanResult = cardType === 'scan_result' && !hasScanShareContext;

  const cardData = useMemo<ShareCardData>(() => {
    const scanDishName = scanResult?.dishName ?? recipe?.title ?? cardRecipe.title;
    const scanRestaurantPrice = scanResult?.restaurantPrice ?? getEstimatedRestaurantPrice(recipe);
    const scanHomemadeCost = recipe?.estimatedHomemadeCost ?? scanResult?.homemadeCost ?? cardRecipe.estimatedHomemadeCost;
    const scanEstimatedSavings = recipe?.estimatedSavings ?? scanResult?.estimatedSavings ?? cardRecipe.estimatedSavings;

    const dataByType: Record<ShareCardType, Omit<ShareCardData, 'caption'>> = {
      scan_result: {
        cardType: 'scan_result',
        eyebrow: 'Homemade recipe',
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
        dishName: latestChallenge?.recipeTitle ?? fallbackScanResult.dishName,
        restaurantPrice: fallbackScanResult.restaurantPrice,
        homemadeCost: cardRecipe.estimatedHomemadeCost,
        estimatedSavings: latestChallenge?.moneySaved ?? cardRecipe.estimatedSavings,
        selectedMode: latestChallenge?.mode ?? selectedMode,
        recipe: cardRecipe,
        scanResult: fallbackScanResult,
        imageUri: (!shareImage?.placeholder && shareImage?.uri) ? shareImage.uri : getRecipeImageUri(cardRecipe),
        homemadeImageUri: getHomemadeImageUri(cardRecipe),
      },
      ranking: {
        cardType: 'ranking',
        eyebrow: topLeaderboardEntry.category,
        dishName: topLeaderboardEntry.displayName,
        restaurantPrice: fallbackScanResult.restaurantPrice,
        homemadeCost: cardRecipe.estimatedHomemadeCost,
        estimatedSavings: cardRecipe.estimatedSavings,
        selectedMode: topLeaderboardEntry.value,
        recipe: cardRecipe,
        scanResult: fallbackScanResult,
        imageUri: (!shareImage?.placeholder && shareImage?.uri) ? shareImage.uri : getRecipeImageUri(cardRecipe),
        homemadeImageUri: getHomemadeImageUri(cardRecipe),
      },
      badge: {
        cardType: 'badge',
        eyebrow: unlockedBadge.name,
        dishName: fallbackScanResult.dishName,
        restaurantPrice: fallbackScanResult.restaurantPrice,
        homemadeCost: cardRecipe.estimatedHomemadeCost,
        estimatedSavings: cardRecipe.estimatedSavings,
        selectedMode,
        recipe: cardRecipe,
        scanResult: fallbackScanResult,
        imageUri: (!shareImage?.placeholder && shareImage?.uri) ? shareImage.uri : getRecipeImageUri(cardRecipe),
        homemadeImageUri: getHomemadeImageUri(cardRecipe),
      },
      restaurant_pack: {
        cardType: 'restaurant_pack',
        eyebrow: selectedPack.name,
        dishName: packDish?.dishName ?? selectedPack.name,
        restaurantPrice: packDish?.restaurantPrice ?? 0,
        homemadeCost: packDish?.homemadeCost ?? 0,
        estimatedSavings: packDish?.estimatedSavings ?? 0,
        selectedMode: packDish?.difficulty ?? 'Pack',
        recipe: cardRecipe,
        scanResult: fallbackScanResult,
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
    fallbackScanResult,
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
    shareImage?.uri,
    topLeaderboardEntry.category,
    topLeaderboardEntry.displayName,
    topLeaderboardEntry.value,
    unlockedBadge.name,
  ]);
  const effectiveServings = recipeServingOverrides[cardData.recipe.id] ?? cardData.recipe.servings;
  const availableMetrics = useMemo(
    () => getShareMetrics(cardData.recipe, effectiveServings, recipeFeedbackById[cardData.recipe.id]),
    [cardData.recipe, effectiveServings, recipeFeedbackById],
  );
  const [selectedMetricKeys, setSelectedMetricKeys] = useState<ShareMetricKey[] | null>(null);
  const selectedKeys = selectedMetricKeys ?? getDefaultShareMetricKeys(availableMetrics);
  const selectedMetrics = availableMetrics.filter((metric) => selectedKeys.includes(metric.key));
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

    navigation.navigate('MainTabs', { screen: 'HomeScreen' });
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

  const toggleMetric = (key: ShareMetricKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedMetricKeys((current) => {
      const active = current ?? getDefaultShareMetricKeys(availableMetrics);
      return active.includes(key) ? active.filter((item) => item !== key) : [...active, key];
    });
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
          <PrimaryAction icon={<Camera color="#fffdf8" height={20} strokeWidth={2.2} width={20} />} label="Scan another meal" onPress={() => navigation.navigate('MainTabs', { screen: 'HomeScreen' })} />
        </View>
      </ShareFrame>
    );
  }

  return (
    <ShareFrame>
      <ShareTopBar onBack={goBack} />

      <View style={styles.previewIntro}>
        <Text style={styles.previewTitle}>Share this recipe</Text>
        <Text style={styles.previewBody}>A simple card to share with friends.</Text>
      </View>

      <View style={styles.customizeSection}>
        <Text style={styles.customizeTitle}>Customize card</Text>
        <Text style={styles.customizeBody}>Choose what to include on your card. Changes update instantly.</Text>
        <View style={styles.chipList}>
          {availableMetrics.map((metric) => (
            <MetricChip key={metric.key} metric={metric} selected={selectedKeys.includes(metric.key)} onPress={() => toggleMetric(metric.key)} />
          ))}
        </View>
      </View>

      <View style={styles.cardShell}>
        <View ref={cardRef} collapsable={false} style={styles.shareCard}>
          <Text adjustsFontSizeToFit minimumFontScale={0.62} numberOfLines={2} style={styles.cardTitle}>
            {cleanDisplayText(cardData.dishName)}
          </Text>
          <View style={styles.remadeRow}>
            <View style={styles.remadeLine} />
            <Text style={styles.remadeText}>Dish → Recipe</Text>
            <View style={styles.remadeLine} />
          </View>

          <PhotoBlock
            dishName={cardData.dishName}
            imageUri={cardData.imageUri}
          />

          {selectedMetrics.length > 0 ? <MetricGrid metrics={selectedMetrics} /> : null}

          <View style={styles.cardFooter}>
            <Image accessibilityIgnoresInvertColors source={require('../../assets/icon.png')} style={styles.okyoIcon} />
            <View style={styles.footerCopy}>
              <Text style={styles.cardFooterText}>Made with <Text style={styles.okyoText}>Okyo</Text></Text>
              <Text style={styles.cardFooterTagline}>Turn any dish into a recipe</Text>
            </View>
          </View>
        </View>
      </View>

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
}: {
  dishName: string;
  imageUri?: string | null;
}) {
  if (imageUri) {
    return (
      <View style={styles.singlePhotoBlock}>
        <Image resizeMode="cover" source={{ uri: imageUri }} style={styles.singlePhoto} />
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

function MetricChip({ metric, onPress, selected }: { metric: ShareMetric; onPress: () => void; selected: boolean }) {
  return (
    <Pressable
      accessibilityLabel={`${metric.label}, ${selected ? 'selected' : 'not selected'}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.metricChip, selected ? styles.metricChipSelected : null, pressed ? styles.pressed : null]}
    >
      {getMetricIcon(metric.key, selected ? colors.coralDark : colors.charcoal, 17)}
      <Text style={[styles.metricChipText, selected ? styles.metricChipTextSelected : null]}>{metric.label}</Text>
      {selected ? <Check color={colors.coralDark} height={15} strokeWidth={3} width={15} /> : null}
    </Pressable>
  );
}

function MetricGrid({ metrics }: { metrics: ShareMetric[] }) {
  return (
    <View style={styles.statGrid}>
      {getMetricRows(metrics).map((row, index) => (
        <View key={`${row.map((metric) => metric.key).join('-')}-${index}`} style={[styles.statRow, row.length < 3 ? styles.statRowPartial : null]}>
          {row.map((metric) => <ShareStat key={metric.key} metric={metric} rowLength={row.length} />)}
        </View>
      ))}
    </View>
  );
}

function ShareStat({ metric, rowLength }: { metric: ShareMetric; rowLength: number }) {
  return (
    <View style={[styles.shareStat, rowLength === 1 ? styles.shareStatSingle : null]}>
      {getMetricIcon(metric.key, colors.coralDark, 21)}
      <Text adjustsFontSizeToFit minimumFontScale={0.68} numberOfLines={1} style={styles.shareStatValue}>{metric.value}</Text>
      <Text numberOfLines={1} style={styles.shareStatLabel}>{metric.label}</Text>
    </View>
  );
}

function getMetricIcon(key: ShareMetricKey, color: string, size: number) {
  const iconProps = { color, height: size, strokeWidth: 2, width: size };
  switch (key) {
    case 'time': return <Clock {...iconProps} />;
    case 'difficulty': return <Crown {...iconProps} />;
    case 'calories': return <Cutlery {...iconProps} />;
    case 'carbs': return <TaskList {...iconProps} />;
    case 'fat': return <Droplet {...iconProps} />;
    case 'servings': return <User {...iconProps} />;
    case 'steps': return <TaskList {...iconProps} />;
    case 'cuisine': return <Cutlery {...iconProps} />;
    case 'cost': return <Coins {...iconProps} />;
    case 'rating': return <Star {...iconProps} />;
    case 'protein':
    default: return <Cutlery {...iconProps} />;
  }
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
  const totalTime = getTotalTime(data.recipe);
  const calories = getNutritionValue(data.recipe.nutritionEstimate?.calories, 'kcal');
  const protein = getNutritionValue(data.recipe.nutritionEstimate?.proteinGrams, 'g');
  const details = [
    totalTime > 0 ? formatDuration(totalTime) : null,
    calories === '—' ? null : calories,
    protein === '—' ? null : protein,
  ].filter((value): value is string => Boolean(value));

  return `${dishName} — turned into a recipe with Okyo.${details.length > 0 ? ` ${details.join(' · ')}.` : ''}`;
}

function getEstimatedRestaurantPrice(recipe: Recipe | null) {
  return recipe ? getFiniteNumber(recipe.estimatedHomemadeCost) + getFiniteNumber(recipe.estimatedSavings) : 0;
}

function getTotalTime(recipe: Recipe) {
  const total = getFiniteNumber(recipe.totalTimeMinutes);
  return total > 0 ? total : getFiniteNumber(recipe.prepTimeMinutes) + getFiniteNumber(recipe.cookTimeMinutes);
}

function formatDuration(minutes: number) {
  return minutes >= 60 ? `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}` : `${minutes} min`;
}

function getNutritionValue(value: unknown, suffix: 'g' | 'kcal') {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return '—';
  }

  return `${Math.round(value)}${suffix === 'kcal' ? ' kcal' : 'g'}`;
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

function cleanDisplayText(value: string) {
  const copyWord = `copy${'cat'}`;
  const copyStyle = `${copyWord}-style`;

  return value
    .replace(new RegExp(`\\b${copyStyle}\\b`, 'gi'), 'homemade')
    .replace(new RegExp(`\\b${copyWord}\\b`, 'gi'), 'homemade')
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
    gap: 4,
  },
  previewTitle: {
    color: colors.charcoal,
    fontSize: 27,
    fontWeight: '800',
  },
  previewBody: {
    color: colors.body,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    maxWidth: 300,
    textAlign: 'center',
  },
  customizeSection: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
    padding: 16,
  },
  customizeTitle: { color: colors.charcoal, fontSize: 17, fontWeight: '800' },
  customizeBody: { color: colors.body, fontSize: 13, lineHeight: 18 },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  metricChip: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 5, minHeight: 40, paddingHorizontal: 11 },
  metricChipSelected: { backgroundColor: colors.coralSoft, borderColor: '#FFC2D3' },
  metricChipText: { color: colors.charcoal, fontSize: 13, fontWeight: '700' },
  metricChipTextSelected: { color: colors.coralDark },
  cardShell: {
    alignItems: 'center',
  },
  shareCard: {
    backgroundColor: '#fffdf8',
    borderRadius: 24,
    maxWidth: 340,
    padding: 16,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    width: '100%',
  },
  cardTitle: {
    color: colors.charcoal,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 30,
    textAlign: 'center',
  },
  remadeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
  },
  remadeLine: {
    backgroundColor: colors.coral,
    borderRadius: 999,
    height: 2,
    width: 38,
  },
  remadeText: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  singlePhotoBlock: {
    aspectRatio: 1.1,
    backgroundColor: colors.cream,
    borderRadius: 18,
    marginTop: 12,
    overflow: 'hidden',
  },
  singlePhoto: {
    height: '100%',
    width: '100%',
  },
  photoArt: {
    alignItems: 'center',
    aspectRatio: 1.82,
    backgroundColor: colors.coralSoft,
    borderRadius: 18,
    justifyContent: 'center',
    marginTop: 12,
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
  statGrid: {
    gap: 7,
    marginTop: 12,
  },
  statRow: { flexDirection: 'row', gap: 7, width: '100%' },
  statRowPartial: { justifyContent: 'center' },
  shareStat: {
    backgroundColor: '#fffaf3',
    borderRadius: 14,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 82,
    padding: 9,
  },
  shareStatSingle: { flexGrow: 0, minWidth: '58%' },
  shareStatLabel: {
    color: colors.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  shareStatValue: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 5,
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
  },
  okyoIcon: { borderRadius: 14, height: 52, width: 52 },
  footerCopy: { gap: 1 },
  cardFooterText: {
    color: colors.body,
    fontSize: 14,
    fontWeight: '700',
  },
  cardFooterTagline: { color: colors.body, fontSize: 11, fontWeight: '600' },
  okyoText: {
    color: colors.coral,
    fontWeight: '800',
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
