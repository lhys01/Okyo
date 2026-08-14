import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecommendationCard } from '../components/RecommendationCard';
import { MetricCarousel } from '../components/home/MetricCarousel';
import { RecentDishCard } from '../components/home/RecentDishCard';
import { WeekStrip } from '../components/home/WeekStrip';
import { ScanActionSheet } from '../components/okyo/ScanFab';
import { SectionHeader } from '../components/okyo/SectionHeader';
import { recommendedRecipes } from '../data/recommendedRecipes';
import { useStartPickedScan } from '../hooks/useStartPickedScan';
import type { RootStackParamList } from '../navigation/types';
import { resolveCanonicalRecipe, resolveRecentRecipes, type CanonicalRecipe } from '../state/canonicalRecipes';
import { getHomeActivityDates, getHomeMetricOrder, isFutureDateKey, selectHomeMetrics } from '../state/homeMetrics';
import { readPersonalizedHomeProfile } from '../state/primaryGoalBridge';
import { useOkyoStore } from '../state/useOkyoStore';
import { findFoodPreferenceConflicts, useFoodPreferences } from '../state/foodPreferences';
import { resolveActiveCookingStep, type ActiveCookingSession } from '../state/activeCooking';
import { colors, radius, shadows, spacing, typography } from '../theme/okyoTheme';
import { buildGuidedCookingSteps } from '../utils/guidedCookingSteps';
import { classifyRecipeStepTiming, formatRecipeDuration, formatRecipeStepTimingLines, getRecipeTiming } from '../utils/recipeIntegrity';
import { uiLog } from '../utils/uiDebug';
import { useOpenRecommendation } from '../utils/useOpenRecommendation';

type HomeNavigation = NativeStackNavigationProp<RootStackParamList>;
const HOME_START_DATE_KEY = 'okyo:home-start-date:v1';
const HOME_FIRST_SEEN_AT_KEY = 'okyo:home-first-seen-at:v1';
const scanButtonVideo = require('../../assets/button background/scan-button-gradient.mp4');

/** Home surfaces two ideas; the rest live behind Explore. */
const HOME_IDEA_COUNT = 2;

// These have been visually reviewed for food-forward imagery without baked-in
// text. Keep the Home row independent from dynamic scans and from cache-only
// URLs so every hourly pairing stays appetizing and reliably visible.
const HOME_IDEA_RECIPE_IDS = [
  'rec-scrambled-eggs-toast',
  'rec-berry-banana-smoothie',
  'rec-breakfast-burrito',
  'rec-crispy-tofu-power-bowl',
  'rec-creamy-tomato-rigatoni',
  'rec-greek-salad',
  'rec-smash-cheeseburger',
  'rec-sheet-pan-lemon-chicken',
] as const;

const HOME_IDEA_RECIPES = HOME_IDEA_RECIPE_IDS
  .map((id) => recommendedRecipes.find((recipe) => recipe.id === id))
  .filter((recipe): recipe is (typeof recommendedRecipes)[number] => Boolean(recipe));

function getHourlyIdeas(hour: number, candidates = HOME_IDEA_RECIPES, limit = HOME_IDEA_COUNT) {
  if (candidates.length === 0 || limit <= 0) {
    return [];
  }

  const start = (Math.max(0, Math.floor(hour)) * limit) % candidates.length;
  return Array.from({ length: Math.min(limit, candidates.length) }, (_, index) => candidates[(start + index) % candidates.length]);
}

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const { height, width } = useWindowDimensions();
  const scanButtonPlayer = useVideoPlayer(scanButtonVideo, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });
  const recipesById = useOkyoStore((state) => state.recipesById);
  const recentRecipeIds = useOkyoStore((state) => state.recentRecipeIds);
  const activeCookingSession = useOkyoStore((state) => state.activeCookingSession);
  const completedMeals = useOkyoStore((state) => state.completedMeals);
  const weeklyScanCount = useOkyoStore((state) => state.weeklyScanCount);
  const primaryGoal = useOkyoStore((state) => state.primaryGoal);
  const endCookingRecipe = useOkyoStore((state) => state.endCookingRecipe);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const openRecommendation = useOpenRecommendation();
  const { preferences: foodPreferences } = useFoodPreferences();
  const startPickedScan = useStartPickedScan(navigation as unknown as { navigate: (screen: string, params?: unknown) => void });
  const compact = width < 380 || height < 700;
  const gutter = width > 430 ? 24 : 20;
  const cardWidth = width - 40;
  // Larger than the initial compact state, with an explicit cap so it remains
  // a supporting illustration rather than taking over the Home screen.
  const firstUseKikoWidth = Math.min(300, Math.round(width * 0.72));
  const metricHeight = compact ? 162 : 176;
  const recentHeight = compact ? 96 : 108;
  const [savedName, setSavedName] = useState<string | null>(null);
  const [homeStartDateKey, setHomeStartDateKey] = useState<string | null>(null);
  const [homeFirstSeenAt, setHomeFirstSeenAt] = useState<number | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => toDateKey(new Date()));
  const [scanOptionsVisible, setScanOptionsVisible] = useState(false);
  const [ideaHour, setIdeaHour] = useState(() => new Date().getHours());
  const greeting = useMemo(() => getCompactGreeting(new Date().getHours()), []);
  // Home shows exactly two safe, bundled ideas. The pairing advances at each
  // local hour boundary instead of staying unchanged for an entire meal period.
  const mealIdeas = useMemo(() => getHourlyIdeas(
    ideaHour,
    HOME_IDEA_RECIPES.filter((recipe) => !foodPreferences || findFoodPreferenceConflicts(recipe.ingredients.map((ingredient) => ingredient.name), foodPreferences).length === 0),
  ), [foodPreferences, ideaHour]);
  const metrics = useMemo(() => selectHomeMetrics({ completedMeals, recipesById, selectedDayKey: selectedDateKey }), [completedMeals, recipesById, selectedDateKey]);
  const metricOrder = useMemo(() => getHomeMetricOrder(primaryGoal), [primaryGoal]);
  const activityDates = useMemo(() => getHomeActivityDates(recipesById), [recipesById]);
  const futureSelectedDay = isFutureDateKey(selectedDateKey);
  const allRecentRecipes = useMemo(() => resolveRecentRecipes(recipesById, recentRecipeIds)
    .filter((recipe) => homeFirstSeenAt === null || new Date(recipe.createdAt).getTime() >= homeFirstSeenAt), [homeFirstSeenAt, recentRecipeIds, recipesById]);
  const activeCookingRecipe = useMemo(() => resolveCanonicalRecipe(recipesById, activeCookingSession?.recipeId), [activeCookingSession?.recipeId, recipesById]);
  const recentRecipes = allRecentRecipes.filter((recipe) => recipe.id !== activeCookingSession?.recipeId).slice(0, 3);

  useEffect(() => {
    let mounted = true;
    void readPersonalizedHomeProfile(AsyncStorage).then((profile) => {
      if (mounted) setSavedName(profile?.name ?? null);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleHourlyRefresh = () => {
      const now = new Date();
      const millisecondsUntilNextHour = ((60 - now.getMinutes()) * 60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 50;
      timer = setTimeout(() => {
        setIdeaHour(new Date().getHours());
        scheduleHourlyRefresh();
      }, millisecondsUntilNextHour);
    };

    scheduleHourlyRefresh();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(HOME_FIRST_SEEN_AT_KEY).then(async (stored) => {
      const existing = stored ? Number(stored) : NaN;
      if (Number.isFinite(existing)) {
        if (mounted) setHomeFirstSeenAt(existing);
        return;
      }
      const now = Date.now();
      await AsyncStorage.setItem(HOME_FIRST_SEEN_AT_KEY, String(now));
      if (mounted) setHomeFirstSeenAt(now);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(HOME_START_DATE_KEY).then(async (stored) => {
      const storedKey = stored ? toDateKey(new Date(stored)) : null;
      if (storedKey) {
        if (mounted) setHomeStartDateKey(storedKey);
        return;
      }
      const now = new Date();
      const key = toDateKey(now);
      await AsyncStorage.setItem(HOME_START_DATE_KEY, now.toISOString());
      if (mounted) setHomeStartDateKey(key);
    });
    return () => { mounted = false; };
  }, []);

  const openRecipe = (recipe: CanonicalRecipe) => {
    setSelectedMode(recipe.selectedMode);
    uiLog('HomeScreen', 'open_recent_recipe', { recipeId: recipe.id });
    navigation.navigate('MainTabs', { screen: 'RecipeDetailScreen', params: { mode: recipe.selectedMode, recipeId: recipe.id } });
  };
  const openDiscover = () => navigation.navigate('MainTabs', { screen: 'RestaurantPacksScreen' });
  // Opens the same three-action scan chooser as the global FAB.
  const openScanOptions = () => {
    uiLog('HomeScreen', 'first_use_cta_scan');
    setScanOptionsVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: spacing.scrollClearance + 84 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.greeting}>{savedName ? `${greeting}, ${savedName}` : greeting}</Text>
        </View>

        <WeekStrip activityDates={activityDates} installDateKey={homeStartDateKey} onDayPress={setSelectedDateKey} selectedDateKey={selectedDateKey} />
        {homeStartDateKey && selectedDateKey < homeStartDateKey ? (
          <View accessibilityLabel="Your Okyo week starts here" style={styles.dayEmpty}>
            <Text style={styles.dayEmptyText}>Your Okyo week starts here.</Text>
          </View>
        ) : null}

        <View style={[styles.carouselBleed, { marginHorizontal: -gutter }]}>
          <MetricCarousel cardHeight={metricHeight} cardWidth={cardWidth} futureDay={futureSelectedDay} metrics={metrics} order={metricOrder} />
        </View>

        {activeCookingRecipe && activeCookingSession ? (
          <ActiveCookingCard
            recipe={activeCookingRecipe}
            session={activeCookingSession}
            onContinue={() => navigation.navigate('MainTabs', { screen: 'RecipeStepsScreen', params: { completion: false, mode: activeCookingRecipe.selectedMode, recipeId: activeCookingRecipe.id } })}
            onViewRecipe={() => navigation.navigate('MainTabs', { screen: 'RecipeDetailScreen', params: { mode: activeCookingRecipe.selectedMode, recipeId: activeCookingRecipe.id } })}
            onEnd={() => Alert.alert('End cooking session?', 'Your current step will be cleared, but the recipe will remain in your recipes.', [
              { text: 'Keep Cooking', style: 'cancel' },
              { text: 'End Session', style: 'destructive', onPress: () => endCookingRecipe(activeCookingRecipe.id) },
            ])}
          />
        ) : null}

        {/* Returning users see their real activity; the first-use CTA is shown
            only while there is genuinely nothing to list. */}
        {homeFirstSeenAt !== null && recentRecipes.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Recent dishes" />
            <View style={styles.recentList}>
              {recentRecipes.map((recipe) => <RecentDishCard key={recipe.id} height={recentHeight} onPress={() => openRecipe(recipe)} recipe={recipe} />)}
            </View>
          </View>
        ) : homeFirstSeenAt !== null && activityDates.length === 0 ? (
          <View accessibilityLabel="Scan your first dish to get started" style={styles.firstUseCard}>
            {/* Approved three-Kiko row — the only empty-state artwork Home
                ever renders here; there is no single-fox fallback. The
                responsive width keeps the artwork prominent while its native
                3:1 aspect ratio keeps all three Kikos crisp and uncropped. */}
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              source={require('../../assets/kiko-static/approved/kiko-soup.png')}
              style={[styles.firstUseKikos, { height: Math.round(firstUseKikoWidth / 3), width: firstUseKikoWidth }]}
            />
            <Text maxFontSizeMultiplier={1.3} style={styles.firstUseBody}>Scan your first dish to get started.</Text>
            <Pressable
              accessibilityLabel="Scan a dish"
              accessibilityRole="button"
              onPress={openScanOptions}
              style={({ pressed }) => [styles.firstUseButton, pressed ? styles.pressed : null]}
            >
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <VideoView contentFit="cover" nativeControls={false} player={scanButtonPlayer} style={StyleSheet.absoluteFill} surfaceType="textureView" />
              </View>
              <Text style={styles.firstUseButtonText}>Scan a dish</Text>
            </Pressable>
          </View>
        ) : null}

        {mealIdeas.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader actionLabel="Explore" onAction={openDiscover} title="Today’s ideas" />
            <View style={styles.ideasGrid}>
              <View style={styles.ideasRow}>
                {mealIdeas.map((recipe) => <RecommendationCard key={recipe.id} compact recipe={recipe} onPress={() => openRecommendation(recipe)} />)}
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
      <ScanActionSheet
        onClose={() => setScanOptionsVisible(false)}
        onDescribeMeal={() => navigation.navigate('DescribeMealScreen')}
        onTakePhoto={() => void startPickedScan('camera')}
        onUpload={() => void startPickedScan('photos')}
        visible={scanOptionsVisible}
      />
    </SafeAreaView>
  );
}

function ActiveCookingCard({ onContinue, onEnd, onViewRecipe, recipe, session }: { onContinue: () => void; onEnd: () => void; onViewRecipe: () => void; recipe: CanonicalRecipe; session: ActiveCookingSession }) {
  const guidedSteps = buildGuidedCookingSteps(recipe);
  const totalSteps = guidedSteps.length;
  const currentIndex = totalSteps > 0 ? Math.max(0, Math.min(session.currentStepIndex, totalSteps - 1)) : 0;
  const guidedStep = resolveActiveCookingStep(guidedSteps, session.currentStepIndex);
  const currentStepTitle = guidedStep?.title || `Step ${currentIndex + 1}`;
  const currentStepTiming = guidedStep?.timing;
  const currentStepKind = currentStepTiming ? classifyRecipeStepTiming(currentStepTiming) : 'hands-on';
  const currentStepState = currentStepKind === 'mixed' ? 'Hands-on + waiting' : currentStepKind === 'waiting' ? 'Waiting' : 'Hands-on';
  const progress = totalSteps > 0 ? ((currentIndex + 1) / totalSteps) * 100 : 0;
  const timing = getRecipeTiming(recipe);

  return (
    <View accessibilityLabel={`Cooking now: ${recipe.title}, step ${currentIndex + 1} of ${totalSteps}`} style={styles.activeCard}>
      <View style={styles.activeHeader}>
        <View style={styles.activeCopy}>
          <Text style={styles.activeLabel}>Cooking now</Text>
          <Text numberOfLines={1} style={styles.activeTitle}>{recipe.title}</Text>
          <Text style={styles.activeStep}>Step {currentIndex + 1} of {totalSteps} · {currentStepTitle}</Text>
          <Text style={styles.activeState}>{currentStepState}</Text>
          {currentStepTiming ? formatRecipeStepTimingLines(currentStepTiming).slice(0, 1).map((line) => <Text key={line} style={styles.activeTiming}>{line}</Text>) : null}
        </View>
        <Text style={styles.activePercent}>{Math.round(progress)}%</Text>
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View>
      <Text style={styles.activeTiming}>Total {formatRecipeDuration(timing.totalMinutes)}</Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onContinue} style={({ pressed }) => [styles.continueButton, pressed ? styles.pressed : null]}><Text style={styles.continueText}>Continue cooking</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={onViewRecipe} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}><Text style={styles.secondaryText}>Full recipe</Text></Pressable>
      </View>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={onEnd} style={styles.endButton}><Text style={styles.endText}>End cooking</Text></Pressable>
    </View>
  );
}

function getCompactGreeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  activeCard: { backgroundColor: colors.surface, borderRadius: radius.card, marginTop: spacing.xl, padding: 18, ...shadows.card },
  activeCopy: { flex: 1, paddingRight: 12 },
  activeHeader: { alignItems: 'flex-start', flexDirection: 'row' },
  activeLabel: { ...typography.label, color: colors.coralDark },
  activePercent: { ...typography.numericStat, color: colors.coralDark },
  activeState: { ...typography.caption, color: colors.coralDark, marginTop: 5 },
  activeStep: { ...typography.caption, color: colors.body, marginTop: 5 },
  activeTiming: { ...typography.caption, color: colors.body, marginTop: 5 },
  activeTitle: { ...typography.section, marginTop: 4 },
  carouselBleed: { marginTop: spacing.sm },
  content: { paddingTop: 2 },
  dayEmpty: { backgroundColor: colors.surfaceMuted, borderRadius: radius.panel, marginTop: 4, paddingHorizontal: 16, paddingVertical: 11 },
  dayEmptyText: { ...typography.caption, color: colors.body, textAlign: 'center' },
  continueButton: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: radius.button, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 14 },
  continueText: { ...typography.bodySmall, color: colors.surface, fontFamily: typography.button.fontFamily },
  endButton: { alignSelf: 'flex-start', marginTop: 12 },
  endText: { ...typography.caption, color: colors.coralDark },
  fill: { backgroundColor: colors.coral, borderRadius: 4, height: 7 },
  // First-use section: a Kiko row, short line, and coral CTA without a tinted card.
  firstUseCard: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingBottom: 4,
  },
  // 3:1 matches the source artwork, so the three Kikos never crop or squash.
  // Dimensions are provided by the screen so the artwork remains a small,
  // uncropped supporting illustration on every phone width.
  firstUseKikos: { alignSelf: 'center', marginVertical: 8 },
  firstUseBody: { ...typography.bodySmall, color: colors.body, marginTop: 6, textAlign: 'center' },
  firstUseButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.coral,
    borderRadius: radius.button,
    overflow: 'hidden',
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 50,
    paddingHorizontal: 20,
    ...shadows.card,
  },
  firstUseButtonText: { ...typography.body, color: colors.surface, fontFamily: typography.button.fontFamily },
  greeting: { ...typography.title, flex: 1, fontSize: 24, lineHeight: 30 },
  header: { alignItems: 'center', flexDirection: 'row', height: 48, justifyContent: 'space-between' },
  ideasGrid: { gap: 12, marginTop: 12 },
  ideasRow: { flexDirection: 'row', gap: 12, minWidth: 0, width: '100%' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  recentList: { gap: 8, marginTop: 10 },
  safeArea: { backgroundColor: colors.canvas, flex: 1 },
  secondaryButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.button, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 14 },
  secondaryText: { ...typography.bodySmall, color: colors.ink, fontFamily: typography.button.fontFamily },
  section: { marginTop: spacing.lg },
  track: { backgroundColor: colors.canvasSunk, borderRadius: 4, height: 7, marginTop: 14, overflow: 'hidden' },
});
