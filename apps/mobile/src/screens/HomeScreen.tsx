import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavArrowRight, Spark } from 'iconoir-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodImage } from '../components/FoodImage';
import { KikoMascot } from '../components/KikoMascot';
import { RecommendationCard } from '../components/RecommendationCard';
import { ScanEntryOptions } from '../components/ScanEntryOptions';
import { colors, typography } from '../components/OkyoUI';
import { getMealTimeForHour, getRecommendationsForMealTime } from '../data/recommendedRecipes';
import { getSafeRecipeMode, isRecipeMode, type Recipe } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { radius, shadows, spacing } from '../theme/okyoTheme';
import { getRealScanImageUri, getRecipeImageStatus, getRecipeImageUrl } from '../utils/recipeImages';
import { checkImageFileExists, getStorageLocation } from '../utils/imageValidation';
import { imageTraceLog, uiLog } from '../utils/uiDebug';
import { useOpenRecommendation } from '../utils/useOpenRecommendation';
import { preparePickedImage } from '../utils/scanImageProcessing';
import { startScan } from '../utils/scanController';
import { HOME_UPLOAD_TARGET_SCREEN, shouldStartPickedUpload } from '../utils/scanControllerUtils';

type HomeNavigation = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const latestScanSession = useOkyoStore((state) => state.latestScanSession);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const writeSavedRecipeContext = useOkyoStore((state) => state.writeSavedRecipeContext);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const uploadInFlight = useRef(false);
  const openRecommendation = useOpenRecommendation();
  const mealIdeas = useMemo(() => getRecommendationsForMealTime(getMealTimeForHour(new Date().getHours()), 4), []);
  const greeting = useMemo(() => getCompactGreeting(new Date().getHours()), []);

  const safeSavedRecipes = Array.isArray(savedRecipes) ? savedRecipes.filter((recipe) => recipe?.id && recipe?.title) : [];
  const recentRecipes = useMemo(() => safeSavedRecipes.slice().reverse().slice(0, 3), [safeSavedRecipes]);
  const hasMoreRecent = safeSavedRecipes.length > 3;
  const heroRecipe = latestScanRecipe ?? recentRecipes[0] ?? null;
  const heroImageUri = getRecipeImageUrl(
    heroRecipe,
    getRealScanImageUri(latestScanSession?.selectedScanImage) ?? getRealScanImageUri(selectedScanImage),
  );
  const heroImageStatus = getRecipeImageStatus(heroRecipe);

  const didTraceHero = useRef(false);
  useEffect(() => {
    if (didTraceHero.current) return;
    didTraceHero.current = true;
    const uri = heroImageUri ?? null;
    const hasStampedUri = Boolean((heroRecipe as { imageUri?: string } | null)?.imageUri);
    checkImageFileExists(uri).then((fileExists) => {
      imageTraceLog('HomeScreen', {
        screen: 'HomeScreen',
        recipeId: heroRecipe?.id ?? null,
        imageSource: hasStampedUri ? 'heroRecipe.imageUri'
          : latestScanSession?.selectedScanImage ? 'latestScanSession.selectedScanImage'
          : selectedScanImage ? 'selectedScanImage'
          : 'none',
        imageUri: uri,
        fileExists: uri ? fileExists : 'n/a',
        usingFallback: !hasStampedUri,
        fallbackReason: !hasStampedUri && !uri ? 'no_hero_recipe_or_scan_image' : null,
        storageLocation: getStorageLocation(uri),
      });
    });
  }, []);

  const openScan = () => {
    uiLog('HomeScreen', 'scan_cta');
    void openCameraImmediately();
  };

  const openPhotosImmediately = async () => {
    if (uploadInFlight.current) return;
    uploadInFlight.current = true;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        base64: false,
        mediaTypes: ['images'],
        quality: 1,
      });
      const assets = result.assets ?? [];
      if (!shouldStartPickedUpload(result.canceled, assets.length) || !assets[0]) return;
      const image = await preparePickedImage(assets[0], 'photos');
      await startScan({
        image, mode: useOkyoStore.getState().selectedMode,
        navigateToAnalysis: (scanSessionId) => navigation.navigate(HOME_UPLOAD_TARGET_SCREEN, { scanSessionId }),
        reason: 'Home.uploadPhoto', source: 'photos',
      });
    } catch {
      Alert.alert('Photo upload unavailable', 'Okyo could not open your photo library. Try again.');
    } finally {
      uploadInFlight.current = false;
    }
  };

  const openCameraImmediately = async () => {
    if (uploadInFlight.current) return;
    uploadInFlight.current = true;
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        uiLog('HomeScreen', 'camera_permission_denied');
        Alert.alert(
          'Camera permission needed',
          'Okyo needs camera permission to take a food photo. You can allow camera access in Settings or use Upload instead.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        base64: false,
        mediaTypes: ['images'],
        quality: 1,
      });
      const assets = result.assets ?? [];
      if (!shouldStartPickedUpload(result.canceled, assets.length) || !assets[0]) return;
      const image = await preparePickedImage(assets[0], 'camera');
      await startScan({
        image, mode: useOkyoStore.getState().selectedMode,
        navigateToAnalysis: (scanSessionId) => navigation.navigate(HOME_UPLOAD_TARGET_SCREEN, { scanSessionId }),
        reason: 'Home.takePhoto', source: 'camera',
      });
    } catch {
      Alert.alert('Camera unavailable', 'Okyo could not open the camera. Use Upload instead.');
    } finally {
      uploadInFlight.current = false;
    }
  };

  const openPlan = () => {
    uiLog('HomeScreen', 'open_plan');
    navigation.navigate('MainTabs', { screen: 'LibraryScreen' });
  };

  const openDiscover = () => {
    uiLog('HomeScreen', 'open_discover');
    navigation.navigate('MainTabs', { screen: 'RestaurantPacksScreen' });
  };

  const openRecipe = (recipe: Recipe) => {
    const mode = getSafeRecipeMode(recipe.mode);
    writeSavedRecipeContext({
      recipe,
      reason: 'open_home_recipe',
      source: 'HomeScreen.openRecipe',
    });
    if (isRecipeMode(recipe.mode)) {
      setSelectedMode(recipe.mode);
    }
    uiLog('HomeScreen', 'open_recent_recipe', { recipeId: recipe.id });
    navigation.navigate('MainTabs', { screen: 'RecipeDetailScreen', params: { mode } });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>{greeting}</Text>
          <Text style={styles.title}>What are we making today?</Text>
        </View>
        <HomeScanSection
          onOpenCamera={() => void openCameraImmediately()}
          onOpenPhotos={openPhotosImmediately}
          onDescribeMeal={() => navigation.navigate('DescribeMealScreen')}
        />

        {heroRecipe || heroImageUri ? (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.heroCard, pressed ? styles.pressed : null]}
            onPress={heroRecipe ? () => openRecipe(heroRecipe) : openScan}
          >
            <FoodImage
              fallbackLabel="Image coming soon"
              imageStatus={heroImageStatus}
              imageUrl={heroImageUri}
              showFallbackLabel
              style={styles.heroImage}
            />
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>Recent recipe</Text>
              <Text numberOfLines={2} style={styles.heroTitle}>
                {heroRecipe?.title ?? 'Latest scan'}
              </Text>
              <Text style={styles.heroBody}>
                {heroRecipe ? `${heroRecipe.totalTimeMinutes ?? heroRecipe.prepTimeMinutes + heroRecipe.cookTimeMinutes} min · ${heroRecipe.difficulty}` : 'Recipe'}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {mealIdeas.length > 0 ? (
          <View style={styles.ideasSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today's ideas</Text>
              <Pressable accessibilityRole="button" hitSlop={8} style={styles.sectionLink} onPress={openDiscover}>
                <Text style={styles.sectionLinkText}>Explore</Text>
                <NavArrowRight color={colors.charcoal} height={18} strokeWidth={2} width={18} />
              </Pressable>
            </View>
            <View style={styles.ideasGrid}>
              {mealIdeas.map((recipe) => (
                <RecommendationCard key={recipe.id} recipe={recipe} onPress={() => openRecommendation(recipe)} />
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.discoverPromptCard, pressed ? styles.pressed : null]}
              onPress={openDiscover}
            >
              <View style={styles.discoverPromptIcon}>
                <Spark color={colors.coral} height={18} strokeWidth={2.2} width={18} />
              </View>
              <View style={styles.discoverPromptCopy}>
                <Text style={styles.discoverPromptTitle}>Want more recommendations?</Text>
                <Text style={styles.discoverPromptBody}>Browse more Okyo ideas in Discover.</Text>
              </View>
              <NavArrowRight color={colors.coral} height={20} strokeWidth={2.2} width={20} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent meals</Text>
          {hasMoreRecent ? (
            <Pressable accessibilityRole="button" hitSlop={8} style={styles.sectionLink} onPress={openPlan}>
              <Text style={styles.sectionLinkText}>View all</Text>
              <NavArrowRight color={colors.charcoal} height={18} strokeWidth={2} width={18} />
            </Pressable>
          ) : null}
        </View>

        {recentRecipes.length > 0 ? (
          <View style={styles.timeline}>
            {recentRecipes.map((recipe, index) => (
              <Pressable
                key={recipe.id}
                accessibilityRole="button"
                style={({ pressed }) => [styles.timelineItem, pressed ? styles.pressed : null]}
                onPress={() => openRecipe(recipe)}
              >
                <View style={styles.timelineMarker}>
                  <Text style={styles.timelineNumber}>{index + 1}</Text>
                </View>
                <FoodImage
                  imageStatus={getRecipeImageStatus(recipe)}
                  imageUrl={getRecipeImageUrl(recipe)}
                  style={styles.timelineImage}
                />
                <View style={styles.timelineCopy}>
                  <Text numberOfLines={2} style={styles.timelineTitle}>{recipe.title}</Text>
                  <Text style={styles.timelineMeta}>{recipe.mode}</Text>
                </View>
                <NavArrowRight color={colors.muted} height={20} strokeWidth={2} width={20} />
              </Pressable>
            ))}
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.emptyRecent, pressed ? styles.pressed : null]}
            onPress={openScan}
          >
            <KikoMascot pose="wave" size={72} style={styles.emptyMascot} />
            <View style={styles.emptyRecentCopy}>
              <Spark color={colors.coral} height={22} strokeWidth={2} width={22} />
              <Text style={styles.emptyRecentTitle}>No recent meals yet.</Text>
              <Text style={styles.emptyRecentBody}>Scan once and this becomes your cooking timeline.</Text>
            </View>
          </Pressable>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function HomeScanSection({ onOpenCamera, onOpenPhotos, onDescribeMeal }: { onOpenCamera: () => void; onOpenPhotos: () => void; onDescribeMeal: () => void }) {
  return (
    <View style={styles.scanSection}>
      <View style={styles.scanSectionHeader}>
        <View style={styles.scanSectionCopy}>
          <Text style={styles.scanSectionBody}>Take or upload a photo, or describe a meal.</Text>
        </View>
        <KikoMascot pose="scanning" size={52} />
      </View>
      <ScanEntryOptions compact onTakePhoto={onOpenCamera} onUpload={onOpenPhotos} onDescribeMeal={onDescribeMeal} />
    </View>
  );
}

function getCompactGreeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    padding: spacing.screen,
    paddingBottom: 150,
  },
  header: {
    marginTop: 2,
    paddingHorizontal: 2,
  },
  scanSection: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  scanSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scanSectionCopy: {
    flex: 1,
    paddingRight: 10,
  },
  scanSectionTitle: {
    color: colors.charcoal,
    fontSize: 20,
    fontWeight: '800',
  },
  scanSectionBody: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  kicker: {
    ...typography.caption,
    color: colors.muted,
    fontSize: 13,
    marginBottom: 3,
  },
  title: {
    color: colors.charcoal,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    maxWidth: 330,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.hero,
    marginTop: 26,
    overflow: 'hidden',
    ...shadows.card,
  },
  heroImage: {
    aspectRatio: 1.15,
    backgroundColor: colors.cream,
    width: '100%',
  },
  heroCopy: {
    padding: 16,
  },
  heroEyebrow: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    ...typography.title,
  },
  heroBody: {
    color: colors.muted,
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
  },
  ideasSection: {
    marginTop: spacing.section,
  },
  ideasGrid: {
    columnGap: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    rowGap: 16,
  },
  discoverPromptCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    padding: 14,
  },
  discoverPromptIcon: {
    alignItems: 'center',
    backgroundColor: '#fff0d7',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  discoverPromptCopy: {
    flex: 1,
    minWidth: 0,
  },
  discoverPromptTitle: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '800',
  },
  discoverPromptBody: {
    ...typography.caption,
    marginTop: 2,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.section,
  },
  sectionTitle: {
    ...typography.heading,
  },
  sectionLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  sectionLinkText: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '700',
  },
  timeline: {
    gap: 12,
    marginTop: 14,
  },
  timelineItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minHeight: 82,
    padding: 16,
  },
  timelineMarker: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  timelineImage: {
    backgroundColor: colors.cream,
    borderRadius: 18,
    height: 58,
    width: 58,
  },
  timelineNumber: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '800',
  },
  timelineCopy: {
    flex: 1,
    minWidth: 0,
  },
  timelineTitle: {
    color: colors.charcoal,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  timelineMeta: {
    ...typography.caption,
    marginTop: 4,
  },
  emptyRecent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    padding: 20,
  },
  emptyMascot: {
    marginRight: 8,
  },
  emptyRecentCopy: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  emptyRecentTitle: {
    ...typography.heading,
  },
  emptyRecentBody: {
    ...typography.body,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
});
