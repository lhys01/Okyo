import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  NavArrowRight,
  Spark,
} from 'iconoir-react-native';
import { useMemo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodImage } from '../components/FoodImage';
import { KikoMascot } from '../components/KikoMascot';
import { RecommendationCard } from '../components/RecommendationCard';
import { colors, typography } from '../components/OkyoUI';
import { getMealTimeForHour, getRecommendationsForMealTime } from '../data/recommendedRecipes';
import { getSafeRecipeMode, isRecipeMode, type Recipe } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { radius, shadows, spacing } from '../theme/okyoTheme';
import { getRealScanImageUri, getRecipeImageStatus, getRecipeImageUrl } from '../utils/recipeImages';
import { uiLog } from '../utils/uiDebug';
import { useOpenRecommendation } from '../utils/useOpenRecommendation';

type HomeNavigation = NativeStackNavigationProp<RootStackParamList>;

const formatCurrency = (value: number) => `$${Math.max(0, value).toFixed(2)}`;

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const latestScanSession = useOkyoStore((state) => state.latestScanSession);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const weeklyScanCount = useOkyoStore((state) => state.weeklyScanCount);
  const writeSavedRecipeContext = useOkyoStore((state) => state.writeSavedRecipeContext);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const openRecommendation = useOpenRecommendation();
  const homeMoment = useMemo(() => getHomeMoment(), []);
  const mealIdeas = useMemo(() => getRecommendationsForMealTime(getMealTimeForHour(new Date().getHours()), 4), []);

  const safeSavedRecipes = Array.isArray(savedRecipes) ? savedRecipes.filter((recipe) => recipe?.id && recipe?.title) : [];
  const recentRecipes = useMemo(() => safeSavedRecipes.slice().reverse().slice(0, 3), [safeSavedRecipes]);
  const hasMoreRecent = safeSavedRecipes.length > 3;
  const heroRecipe = latestScanRecipe ?? recentRecipes[0] ?? null;
  const heroImageUri = getRecipeImageUrl(
    heroRecipe,
    getRealScanImageUri(latestScanSession?.selectedScanImage) ?? getRealScanImageUri(selectedScanImage),
  );
  const heroImageStatus = getRecipeImageStatus(heroRecipe);
  const hasActivity = Boolean(heroRecipe || heroImageUri || safeSavedRecipes.length > 0 || weeklyScanCount > 0);

  const openScan = () => {
    uiLog('HomeScreen', 'scan_cta');
    navigation.navigate('MainTabs', { screen: 'ScanScreen' });
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
          <Text style={styles.kicker}>{homeMoment.greeting}</Text>
          <Text style={styles.title}>{homeMoment.title}</Text>
        </View>

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
              <Text style={styles.heroEyebrow}>{hasActivity ? 'Today in Okyo' : 'Latest photo'}</Text>
              <Text numberOfLines={2} style={styles.heroTitle}>
                {heroRecipe?.title ?? 'Latest scan'}
              </Text>
              <Text style={styles.heroBody}>
                {heroRecipe
                  ? `${heroRecipe.difficulty} · about ${formatCurrency(heroRecipe.estimatedHomemadeCost)} at home`
                  : 'Your latest photo is here. Save a recipe and it becomes part of your cooking timeline.'}
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
                <View style={styles.timelineCopy}>
                  <Text numberOfLines={2} style={styles.timelineTitle}>{recipe.title}</Text>
                  <Text style={styles.timelineMeta}>
                    {recipe.mode} · saved about {formatCurrency(recipe.estimatedSavings)}
                  </Text>
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

type HomeMoment = {
  greeting: string;
  title: string;
};

function getHomeMoment(date = new Date()): HomeMoment {
  const hour = date.getHours();

  if (hour >= 22 || hour < 5) {
    return {
      greeting: getStablePhrase(['Still hungry?', 'Late-night kitchen?'], date),
      title: getStablePhrase(['What should a late-night bite become?', 'What should this snack turn into?'], date),
    };
  }

  if (hour < 11) {
    return {
      greeting: 'Good morning',
      title: getStablePhrase(['What should breakfast become?', 'What should the morning bite become?'], date),
    };
  }

  if (hour < 17) {
    return {
      greeting: 'Good afternoon',
      title: getStablePhrase(['What should lunch become?', 'What should the midday craving become?'], date),
    };
  }

  return {
    greeting: 'Good evening',
    title: getStablePhrase(['What should dinner become?', 'What should tonight become?'], date),
  };
}

function getStablePhrase(phrases: string[], date: Date) {
  return phrases[(date.getDate() + date.getHours()) % phrases.length] ?? phrases[0];
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
    marginTop: 8,
  },
  kicker: {
    ...typography.caption,
    color: colors.muted,
    marginBottom: 8,
  },
  title: {
    ...typography.display,
    maxWidth: 330,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radius.hero,
    marginTop: 26,
    overflow: 'hidden',
    ...shadows.hero,
  },
  heroImage: {
    aspectRatio: 1.15,
    backgroundColor: colors.cream,
    width: '100%',
  },
  heroCopy: {
    padding: 22,
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
    ...typography.body,
    marginTop: 8,
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
    backgroundColor: '#fff8eb',
    borderColor: '#f3dac1',
    borderRadius: 20,
    borderWidth: 1,
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
    borderRadius: radius.card,
    flexDirection: 'row',
    gap: 14,
    minHeight: 82,
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
    backgroundColor: colors.card,
    borderRadius: radius.card,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    padding: 20,
    ...shadows.card,
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
