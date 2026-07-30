import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavArrowRight, Spark } from 'iconoir-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useRef } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodImage } from '../components/FoodImage';
import { KikoMascot } from '../components/KikoMascot';
import { RecommendationCard } from '../components/RecommendationCard';
import { ScanEntryOptions } from '../components/ScanEntryOptions';
import { colors, typography } from '../components/OkyoUI';
import { getMealTimeForHour, getRecommendationsForMealTime } from '../data/recommendedRecipes';
import type { RootStackParamList } from '../navigation/types';
import {
  getRecipeIngredientPreview,
  resolveRecentRecipes,
  type CanonicalRecipe,
} from '../state/canonicalRecipes';
import { useOkyoStore } from '../state/useOkyoStore';
import { radius, shadows, spacing } from '../theme/okyoTheme';
import { getRecipeImageStatus, getRecipeImageUrl } from '../utils/recipeImages';
import { uiLog } from '../utils/uiDebug';
import { useOpenRecommendation } from '../utils/useOpenRecommendation';
import { preparePickedImage } from '../utils/scanImageProcessing';
import { startScan } from '../utils/scanController';
import { HOME_UPLOAD_TARGET_SCREEN, shouldStartPickedUpload } from '../utils/scanControllerUtils';

type HomeNavigation = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const recipesById = useOkyoStore((state) => state.recipesById);
  const recentRecipeIds = useOkyoStore((state) => state.recentRecipeIds);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const uploadInFlight = useRef(false);
  const openRecommendation = useOpenRecommendation();
  const mealIdeas = useMemo(() => getRecommendationsForMealTime(getMealTimeForHour(new Date().getHours()), 4), []);
  const greeting = useMemo(() => getCompactGreeting(new Date().getHours()), []);

  const allRecentRecipes = useMemo(
    () => resolveRecentRecipes(recipesById, recentRecipeIds),
    [recentRecipeIds, recipesById],
  );
  const recentRecipes = allRecentRecipes.slice(0, 3);

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

  const openDiscover = () => {
    uiLog('HomeScreen', 'open_discover');
    navigation.navigate('MainTabs', { screen: 'RestaurantPacksScreen' });
  };

  const openRecipe = (recipe: CanonicalRecipe) => {
    const mode = recipe.selectedMode;
    setSelectedMode(mode);
    uiLog('HomeScreen', 'open_recent_recipe', { recipeId: recipe.id });
    navigation.navigate('MainTabs', {
      screen: 'RecipeDetailScreen',
      params: { mode, recipeId: recipe.id },
    });
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

        {recentRecipes.length > 0 ? (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Recipes</Text>
            </View>
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
                    <Text numberOfLines={2} style={styles.timelineIngredients}>
                      {getRecipeIngredientPreview(recipe)}
                    </Text>
                    <Text style={styles.timelineMeta}>
                      {recipe.totalTimeMinutes ?? recipe.prepTimeMinutes + recipe.cookTimeMinutes} min
                    </Text>
                  </View>
                  <NavArrowRight color={colors.muted} height={20} strokeWidth={2} width={20} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {mealIdeas.length > 0 ? (
          <View style={styles.ideasSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today’s Ideas</Text>
              <Pressable accessibilityRole="button" hitSlop={8} style={styles.sectionLink} onPress={openDiscover}>
                <Text style={styles.sectionLinkText}>Explore</Text>
                <NavArrowRight color={colors.charcoal} height={18} strokeWidth={2} width={18} />
              </Pressable>
            </View>
            <View style={styles.ideasGrid}>
              {[mealIdeas.slice(0, 2), mealIdeas.slice(2, 4)].map((row, rowIndex) => (
                <View key={`idea-row-${rowIndex}`} style={styles.ideasRow}>
                  {row.map((recipe) => (
                    <RecommendationCard
                      key={recipe.id}
                      compact
                      recipe={recipe}
                      onPress={() => openRecommendation(recipe)}
                    />
                  ))}
                </View>
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
  recentSection: {
    marginTop: spacing.section,
  },
  ideasSection: {
    marginTop: spacing.section,
  },
  ideasGrid: {
    gap: 14,
    marginTop: 14,
  },
  ideasRow: {
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
    width: '100%',
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
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 104,
    overflow: 'hidden',
    padding: 16,
    ...shadows.card,
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
  timelineIngredients: {
    color: colors.body,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
});
