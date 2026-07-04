import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  NavArrowRight,
  Spark,
} from 'iconoir-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodImage } from '../components/FoodImage';
import { KikoMascot } from '../components/KikoMascot';
import { RecommendationCard } from '../components/RecommendationCard';
import { colors, typography } from '../components/OkyoUI';
import {
  getMealContextForHour,
  getMealTimesForContext,
  isDessertRecommendation,
  isMainMealContext,
  isTreatRecommendation,
  recommendedRecipes,
  type MealContext,
  type MealTime,
  type RecommendationRecipe,
} from '../data/recommendedRecipes';
import { getSafeRecipeMode, isRecipeMode, type Recipe } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { radius, shadows, spacing } from '../theme/okyoTheme';
import { getRealScanImageUri, getRecipeImageStatus, getRecipeImageUrl } from '../utils/recipeImages';
import { checkImageFileExists, getStorageLocation } from '../utils/imageValidation';
import { getModeLabel } from '../utils/modeDisplay';
import { imageTraceLog, uiLog } from '../utils/uiDebug';
import { useOpenRecommendation } from '../utils/useOpenRecommendation';

type HomeNavigation = NativeStackNavigationProp<RootStackParamList>;

const formatCurrency = (value: number) => `$${Math.max(0, value).toFixed(2)}`;

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const latestScanSession = useOkyoStore((state) => state.latestScanSession);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const completedChallenges = useOkyoStore((state) => state.completedChallenges);
  const writeSavedRecipeContext = useOkyoStore((state) => state.writeSavedRecipeContext);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const openRecommendation = useOpenRecommendation();
  const homeDate = useMemo(() => new Date(), []);
  const mealContext = useMemo(() => getMealContextForHour(homeDate.getHours()), [homeDate]);
  const homeMoment = useMemo(() => getHomeMoment(homeDate), [homeDate]);
  const safeSavedRecipes = useMemo(
    () => Array.isArray(savedRecipes) ? savedRecipes.filter((recipe) => recipe?.id && recipe?.title) : [],
    [savedRecipes],
  );
  const recentRecipes = useMemo(() => safeSavedRecipes.slice().reverse().slice(0, 3), [safeSavedRecipes]);
  const hasMoreRecent = safeSavedRecipes.length > 3;
  const latestRecipe = latestScanSession?.latestScanRecipe ?? latestScanRecipe;
  const recentlySavedRecipes = useMemo(() => safeSavedRecipes.slice(-6), [safeSavedRecipes]);
  const recentRecommendationRefs = useMemo(
    () => getRecentRecommendationRefs({
      completedChallenges,
      latestRecipe,
      recentlySavedRecipes,
    }),
    [completedChallenges, latestRecipe, recentlySavedRecipes],
  );
  const heroRecommendation = useMemo(
    () => getHomeHeroRecommendation(mealContext, homeDate, recentRecommendationRefs),
    [homeDate, mealContext, recentRecommendationRefs],
  );
  const mealIdeas = useMemo(
    () => getHomeMealIdeas(
      mealContext,
      homeDate,
      heroRecommendation ? [heroRecommendation, ...recentRecommendationRefs] : recentRecommendationRefs,
      4,
    ),
    [heroRecommendation, homeDate, mealContext, recentRecommendationRefs],
  );
  const heroImageUri = getRecipeImageUrl(heroRecommendation);
  const heroImageStatus = getRecipeImageStatus(heroRecommendation);
  const latestScanImageUri = getRealScanImageUri(latestScanSession?.selectedScanImage) ?? getRealScanImageUri(selectedScanImage);
  const latestScanCardImageUri = getRecipeImageUrl(latestRecipe, latestScanImageUri);
  const latestScanImageStatus = getRecipeImageStatus(latestRecipe);
  const hasLatestScanCard = Boolean(latestRecipe || latestScanCardImageUri);

  const didTraceHero = useRef(false);
  useEffect(() => {
    if (didTraceHero.current) return;
    didTraceHero.current = true;
    const uri = heroImageUri ?? null;
    checkImageFileExists(uri).then((fileExists) => {
      imageTraceLog('HomeScreen', {
        screen: 'HomeScreen',
        recipeId: heroRecommendation?.id ?? null,
        imageSource: heroRecommendation ? 'daily_home_recommendation' : 'none',
        imageUri: uri,
        fileExists: uri ? fileExists : 'n/a',
        usingFallback: !uri,
        fallbackReason: !uri ? 'no_home_recommendation_image' : null,
        storageLocation: getStorageLocation(uri),
      });
    });
  }, []);

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

        {heroRecommendation ? (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.heroCard, pressed ? styles.pressed : null]}
            onPress={() => openRecommendation(heroRecommendation)}
          >
            <FoodImage
              fallbackLabel={heroRecommendation.category}
              imageStatus={heroImageStatus}
              imageUrl={heroImageUri}
              showFallbackLabel
              style={styles.heroImage}
            />
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>{getHeroEyebrow(mealContext)}</Text>
              <Text numberOfLines={2} style={styles.heroTitle}>
                {heroRecommendation.title}
              </Text>
              <Text style={styles.heroBody}>
                {heroRecommendation.difficulty} · {heroRecommendation.totalTimeMinutes ?? heroRecommendation.prepTimeMinutes + heroRecommendation.cookTimeMinutes} min · about {formatCurrency(heroRecommendation.estimatedHomemadeCost)} at home
              </Text>
            </View>
          </Pressable>
        ) : null}

        {hasLatestScanCard ? (
          <View style={styles.latestScanSection}>
            <View style={styles.sectionHeaderCompact}>
              <Text style={styles.sectionTitleSmall}>Latest scan</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.latestScanCard, pressed ? styles.pressed : null]}
              onPress={latestRecipe ? () => openRecipe(latestRecipe) : openScan}
            >
              <FoodImage
                fallbackLabel="Latest scan"
                imageStatus={latestScanImageStatus}
                imageUrl={latestScanCardImageUri}
                style={styles.latestScanImage}
              />
              <View style={styles.latestScanCopy}>
                <Text numberOfLines={1} style={styles.latestScanTitle}>
                  {latestRecipe?.title ?? 'Latest food photo'}
                </Text>
                <Text numberOfLines={2} style={styles.latestScanMeta}>
                  {latestRecipe
                    ? `${getModeLabel(getSafeRecipeMode(latestRecipe.mode))} · from your scan`
                    : 'Photo saved for this session. Scan again to build a recipe.'}
                </Text>
              </View>
              <NavArrowRight color={colors.muted} height={20} strokeWidth={2} width={20} />
            </Pressable>
          </View>
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
          <Text style={styles.sectionTitle}>Recently saved</Text>
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
                  <Text style={styles.timelineMeta}>
                    {getSavedRecipeMeta(recipe)}
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
              <Text style={styles.emptyRecentTitle}>No saved meals yet.</Text>
              <Text style={styles.emptyRecentBody}>Save a recipe and it becomes your quick list here.</Text>
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

function getSavedRecipeMeta(recipe: Recipe) {
  const cookedCount = getCookedCount(recipe);
  const totalTime = getTotalTime(recipe);
  const homeEstimate = typeof recipe.estimatedHomemadeCost === 'number' && Number.isFinite(recipe.estimatedHomemadeCost)
    ? recipe.estimatedHomemadeCost
    : 0;
  const parts = [getModeLabel(getSafeRecipeMode(recipe.mode))];

  if (cookedCount > 0) {
    parts.push(formatCookedCount(cookedCount));
  } else if (totalTime > 0) {
    parts.push(`${totalTime} min`);
  }

  if (homeEstimate > 0) {
    parts.push(`home est. ${formatCurrency(homeEstimate)}`);
  }

  return parts.join(' · ');
}

function getCookedCount(recipe: Recipe) {
  return typeof recipe.cookedCount === 'number' && Number.isFinite(recipe.cookedCount)
    ? Math.max(0, recipe.cookedCount)
    : 0;
}

function formatCookedCount(count: number) {
  return `cooked ${count} ${count === 1 ? 'time' : 'times'}`;
}

function getTotalTime(recipe: Recipe) {
  const total = typeof recipe.totalTimeMinutes === 'number' && Number.isFinite(recipe.totalTimeMinutes)
    ? recipe.totalTimeMinutes
    : 0;
  if (total > 0) {
    return total;
  }

  const prep = typeof recipe.prepTimeMinutes === 'number' && Number.isFinite(recipe.prepTimeMinutes)
    ? recipe.prepTimeMinutes
    : 0;
  const cook = typeof recipe.cookTimeMinutes === 'number' && Number.isFinite(recipe.cookTimeMinutes)
    ? recipe.cookTimeMinutes
    : 0;
  return prep + cook;
}

type RecommendationRef = {
  id?: string | null;
  recipeId?: string | null;
  recipeTitle?: string | null;
  title?: string | null;
};

function getRecentRecommendationRefs({
  completedChallenges,
  latestRecipe,
  recentlySavedRecipes,
}: {
  completedChallenges: RecommendationRef[];
  latestRecipe: Recipe | null;
  recentlySavedRecipes: Recipe[];
}): RecommendationRef[] {
  return [
    latestRecipe,
    ...recentlySavedRecipes.slice().reverse(),
    ...completedChallenges.slice(-6).reverse().map((challenge) => ({
      id: challenge.recipeId,
      title: challenge.recipeTitle,
    })),
  ].filter(Boolean) as RecommendationRef[];
}

function getHomeHeroRecommendation(
  context: MealContext,
  date: Date,
  excludedRefs: RecommendationRef[],
): RecommendationRecipe | null {
  const sameMealPool = getContextRecommendationPool(context, { excludeTreatsForHero: true });
  const adjacentPool = getAdjacentRecommendationPool(context, { excludeTreatsForHero: true });
  const broadPool = getBroadRecommendationPool(context, { excludeTreatsForHero: true });

  return getFirstAvailableRecommendation(sameMealPool, excludedRefs, date, `${context}:hero:same`) ??
    getFirstAvailableRecommendation(adjacentPool, excludedRefs, date, `${context}:hero:adjacent`) ??
    getFirstAvailableRecommendation(broadPool, excludedRefs, date, `${context}:hero:broad`) ??
    getFirstAvailableRecommendation(sameMealPool, [], date, `${context}:hero:same-repeat`) ??
    null;
}

function getHomeMealIdeas(
  context: MealContext,
  date: Date,
  excludedRefs: RecommendationRef[],
  limit: number,
): RecommendationRecipe[] {
  const ideas: RecommendationRecipe[] = [];
  appendUniqueRecommendations(
    ideas,
    getAvailableRecommendations(
      getContextRecommendationPool(context, { excludeDessertsForMainMeals: true }),
      excludedRefs,
      date,
      `${context}:ideas:same`,
    ),
    limit,
  );
  appendUniqueRecommendations(
    ideas,
    getAvailableRecommendations(
      getAdjacentRecommendationPool(context, { excludeDessertsForMainMeals: true }),
      [...excludedRefs, ...ideas],
      date,
      `${context}:ideas:adjacent`,
    ),
    limit,
  );
  appendUniqueRecommendations(
    ideas,
    getAvailableRecommendations(
      getBroadRecommendationPool(context, { excludeDessertsForMainMeals: true }),
      [...excludedRefs, ...ideas],
      date,
      `${context}:ideas:broad`,
    ),
    limit,
  );

  return ideas.slice(0, limit);
}

function getContextRecommendationPool(
  context: MealContext,
  options: { excludeDessertsForMainMeals?: boolean; excludeTreatsForHero?: boolean } = {},
) {
  const mealTimes = getMealTimesForContext(context);
  return filterRecommendationsForMealRules(
    recommendedRecipes.filter((recipe) => mealTimes.some((mealTime) => recipe.mealTimes.includes(mealTime))),
    context,
    options,
  );
}

function getAdjacentRecommendationPool(
  context: MealContext,
  options: { excludeDessertsForMainMeals?: boolean; excludeTreatsForHero?: boolean } = {},
) {
  const mealTimes = getAdjacentMealTimes(context);
  return filterRecommendationsForMealRules(
    recommendedRecipes.filter((recipe) => mealTimes.some((mealTime) => recipe.mealTimes.includes(mealTime))),
    context,
    options,
  );
}

function getBroadRecommendationPool(
  context: MealContext,
  options: { excludeDessertsForMainMeals?: boolean; excludeTreatsForHero?: boolean } = {},
) {
  return filterRecommendationsForMealRules(recommendedRecipes, context, options);
}

function filterRecommendationsForMealRules(
  recipes: RecommendationRecipe[],
  context: MealContext,
  options: { excludeDessertsForMainMeals?: boolean; excludeTreatsForHero?: boolean },
) {
  return recipes.filter((recipe) => {
    if (options.excludeTreatsForHero && isMainMealContext(context) && isTreatRecommendation(recipe)) {
      return false;
    }

    if (options.excludeDessertsForMainMeals && isMainMealContext(context) && isDessertRecommendation(recipe)) {
      return false;
    }

    return true;
  });
}

function getAdjacentMealTimes(context: MealContext): MealTime[] {
  switch (context) {
    case 'breakfast':
      return ['afternoon'];
    case 'lunch':
      return ['evening'];
    case 'dinner':
      return ['afternoon'];
    case 'snack_dessert':
    default:
      return ['afternoon', 'evening'];
  }
}

function getFirstAvailableRecommendation(
  recipes: RecommendationRecipe[],
  excludedRefs: RecommendationRef[],
  date: Date,
  seedKey: string,
) {
  return getAvailableRecommendations(recipes, excludedRefs, date, seedKey)[0] ?? null;
}

function getAvailableRecommendations(
  recipes: RecommendationRecipe[],
  excludedRefs: RecommendationRef[],
  date: Date,
  seedKey: string,
) {
  return rotateRecommendations(recipes, date, seedKey).filter((recipe) => !isRecommendationExcluded(recipe, excludedRefs));
}

function appendUniqueRecommendations(
  destination: RecommendationRecipe[],
  candidates: RecommendationRecipe[],
  limit: number,
) {
  for (const candidate of candidates) {
    if (destination.length >= limit) {
      return;
    }
    if (!destination.some((recipe) => recipe.id === candidate.id)) {
      destination.push(candidate);
    }
  }
}

function rotateRecommendations<T>(items: T[], date: Date, seedKey: string) {
  if (items.length <= 1) {
    return items;
  }

  const offset = getDailySeed(date, seedKey) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function getDailySeed(date: Date, seedKey: string) {
  const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const source = `${dayKey}:${seedKey}`;
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function isRecommendationExcluded(recipe: RecommendationRecipe, refs: RecommendationRef[]) {
  return refs.some((ref) => {
    const refId = ref.id ?? ref.recipeId;
    if (refId && (refId === recipe.id || refId === recipe.scanResultId)) {
      return true;
    }

    return areSimilarRecipeTitles(recipe.title, ref.title ?? ref.recipeTitle);
  });
}

function areSimilarRecipeTitles(first: string | null | undefined, second: string | null | undefined) {
  const normalizedFirst = normalizeRecipeTitle(first);
  const normalizedSecond = normalizeRecipeTitle(second);
  if (!normalizedFirst || !normalizedSecond) {
    return false;
  }

  if (normalizedFirst === normalizedSecond) {
    return true;
  }

  if (
    normalizedFirst.length >= 8 &&
    normalizedSecond.length >= 8 &&
    (normalizedFirst.includes(normalizedSecond) || normalizedSecond.includes(normalizedFirst))
  ) {
    return true;
  }

  const firstTokens = getTitleTokens(normalizedFirst);
  const secondTokens = getTitleTokens(normalizedSecond);
  if (firstTokens.length < 3 || secondTokens.length < 3) {
    return false;
  }

  const secondTokenSet = new Set(secondTokens);
  const overlap = firstTokens.filter((token) => secondTokenSet.has(token)).length;
  return overlap / Math.min(firstTokens.length, secondTokens.length) >= 0.8;
}

function normalizeRecipeTitle(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/copycat|copy-cat|restaurant-style|inspired-by/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getTitleTokens(normalizedTitle: string) {
  const stopWords = new Set(['and', 'with', 'the', 'style', 'recipe']);
  return normalizedTitle
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function getHeroEyebrow(context: MealContext) {
  switch (context) {
    case 'breakfast':
      return 'Fresh breakfast idea';
    case 'lunch':
      return 'Fresh lunch idea';
    case 'dinner':
      return 'Fresh dinner idea';
    case 'snack_dessert':
    default:
      return 'Fresh snack idea';
  }
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
    borderRadius: radius.hero,
    marginTop: 26,
    overflow: 'hidden',
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
  latestScanSection: {
    marginTop: 20,
  },
  sectionHeaderCompact: {
    marginBottom: 10,
  },
  sectionTitleSmall: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '800',
  },
  latestScanCard: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    flexDirection: 'row',
    gap: 12,
    minHeight: 84,
    padding: 14,
  },
  latestScanImage: {
    backgroundColor: colors.cream,
    borderRadius: 18,
    height: 58,
    width: 58,
  },
  latestScanCopy: {
    flex: 1,
    minWidth: 0,
  },
  latestScanTitle: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '800',
  },
  latestScanMeta: {
    ...typography.caption,
    marginTop: 3,
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
