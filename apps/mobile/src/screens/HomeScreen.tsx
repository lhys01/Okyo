import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  NavArrowRight,
  PasteClipboard,
  Spark,
} from 'iconoir-react-native';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedGradientBackground } from '../components/AnimatedGradientBackground';
import { FoodImage } from '../components/FoodImage';
import { KikoMascot } from '../components/KikoMascot';
import { PressableScale, RewardToast } from '../components/OkyoUI';
import { getSafeRecipeMode, isRecipeMode, type Recipe } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { colors, fontFamilies, layout, radius, shadows, spacing, surfaces, typography } from '../theme/okyoTheme';
import { getModeLabel } from '../utils/modeDisplay';
import { getRealScanImageUri, getRecipeImageStatus, getRecipeImageUrl } from '../utils/recipeImages';
import { checkImageFileExists, getStorageLocation } from '../utils/imageValidation';
import { deriveHomeCommandCenter, type HomeCommandCard } from '../utils/homeCommandCenter';
import { imageTraceLog, uiLog } from '../utils/uiDebug';

type HomeNavigation = NativeStackNavigationProp<RootStackParamList>;

const formatCurrency = (value: number) => `$${Math.max(0, value).toFixed(2)}`;

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const latestScanSession = useOkyoStore((state) => state.latestScanSession);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const savedFoodIdeas = useOkyoStore((state) => state.savedFoodIdeas);
  const lastDailyCheckInDate = useOkyoStore((state) => state.lastDailyCheckInDate);
  const claimDailyCheckIn = useOkyoStore((state) => state.claimDailyCheckIn);
  const writeSavedRecipeContext = useOkyoStore((state) => state.writeSavedRecipeContext);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const homeMoment = useMemo(() => getHomeMoment(), []);

  const safeSavedRecipes = Array.isArray(savedRecipes) ? savedRecipes.filter((recipe) => recipe?.id && recipe?.title) : [];
  const safeSavedFoodIdeas = Array.isArray(savedFoodIdeas) ? savedFoodIdeas.filter((idea) => idea?.id && idea?.title) : [];
  const recentRecipes = useMemo(() => safeSavedRecipes.slice().reverse().slice(0, 3), [safeSavedRecipes]);
  const hasMoreRecent = safeSavedRecipes.length > 3;
  const heroRecipe = latestScanRecipe ?? recentRecipes[0] ?? null;
  const heroImageUri = getRecipeImageUrl(
    heroRecipe,
    getRealScanImageUri(latestScanSession?.selectedScanImage) ?? getRealScanImageUri(selectedScanImage),
  );
  const heroImageStatus = getRecipeImageStatus(heroRecipe);
  const hasActivity = Boolean(heroRecipe || heroImageUri || safeSavedRecipes.length > 0);
  const todayKey = getLocalDateKey();
  const dailySpark = useMemo(() => getDailySpark(todayKey), [todayKey]);
  const [dailyRewardVisible, setDailyRewardVisible] = useState(false);
  const [claimedVisibleDailySpark, setClaimedVisibleDailySpark] = useState(false);
  const dailyRewardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldShowDailyCheckIn = lastDailyCheckInDate !== todayKey && !claimedVisibleDailySpark;
  const commandCenter = useMemo(
    () => deriveHomeCommandCenter({
      latestScanRecipe,
      savedFoodIdeas: safeSavedFoodIdeas,
      savedRecipes: safeSavedRecipes,
    }),
    [latestScanRecipe, safeSavedFoodIdeas, safeSavedRecipes],
  );

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
    navigation.navigate('MainTabs', { screen: 'ScanScreen' });
  };

  const openPlan = () => {
    uiLog('HomeScreen', 'open_plan');
    navigation.navigate('MainTabs', { screen: 'LibraryScreen' });
  };

  const openFoodIdea = () => {
    uiLog('HomeScreen', 'open_food_idea');
    navigation.navigate('FoodIdeaScreen');
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

  const openGroceryForRecipe = (recipe?: Recipe) => {
    if (!recipe) {
      openFoodIdea();
      return;
    }

    const mode = getSafeRecipeMode(recipe.mode);
    writeSavedRecipeContext({
      recipe,
      reason: 'open_home_grocery',
      source: 'HomeScreen.openGroceryForRecipe',
    });
    if (isRecipeMode(recipe.mode)) {
      setSelectedMode(recipe.mode);
    }
    uiLog('HomeScreen', 'open_home_grocery', { recipeId: recipe.id });
    navigation.navigate('MainTabs', { screen: 'GroceryListScreen', params: { mode } });
  };

  const openCommandCard = (card: HomeCommandCard) => {
    uiLog('HomeScreen', 'open_command_card', { cardId: card.id, action: card.action });
    switch (card.action) {
      case 'open_recipe':
        if (card.recipe) openRecipe(card.recipe);
        return;
      case 'open_food_idea':
        openFoodIdea();
        return;
      case 'open_grocery':
        openGroceryForRecipe(card.recipe);
        return;
      case 'open_scan':
      default:
        openScan();
    }
  };

  const claimTodaySpark = () => {
    if (dailyRewardTimer.current) {
      clearTimeout(dailyRewardTimer.current);
    }
    claimDailyCheckIn(todayKey);
    setClaimedVisibleDailySpark(true);
    setDailyRewardVisible(true);
    dailyRewardTimer.current = setTimeout(() => setDailyRewardVisible(false), 1600);
  };

  useEffect(() => {
    setClaimedVisibleDailySpark(false);
  }, [todayKey]);

  useEffect(() => () => {
    if (dailyRewardTimer.current) {
      clearTimeout(dailyRewardTimer.current);
    }
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedGradientBackground />
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>{homeMoment.greeting}</Text>
          <Text style={styles.title}>{commandCenter.headline}</Text>
          <Text style={styles.headerBody}>{commandCenter.subheadline}</Text>
        </View>

        {shouldShowDailyCheckIn ? (
          <PressableScale style={styles.dailyCheckInCard} onPress={claimTodaySpark}>
            <View style={styles.dailyKikoWrap}>
              <KikoMascot animated="success" pose="happy" size={58} />
            </View>
            <View style={styles.dailyCopy}>
              <Text style={styles.dailyLabel}>Daily kitchen spark</Text>
              <Text style={styles.dailyTitle}>{dailySpark.title}</Text>
              <Text style={styles.dailyBody}>{dailySpark.body}</Text>
            </View>
            <View style={styles.dailyRewardPill}>
              <Text style={styles.dailyRewardText}>+5 XP</Text>
            </View>
          </PressableScale>
        ) : null}

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.tonightCard, pressed ? styles.pressed : null]}
          onPress={() => openCommandCard(commandCenter.tonightCard)}
        >
          <View style={styles.tonightTopRow}>
            <View style={styles.tonightKikoWrap}>
              <KikoMascot animated="idle" pose="cooking" size={54} />
            </View>
            <View style={styles.tonightCopy}>
              <Text style={styles.tonightLabel}>Tonight's best move</Text>
              <Text numberOfLines={2} style={styles.tonightTitle}>{commandCenter.tonightCard.title}</Text>
              <Text style={styles.tonightBody}>{commandCenter.tonightCard.body}</Text>
            </View>
          </View>
          <View style={styles.tonightActionRow}>
            <Text style={styles.tonightCta}>{commandCenter.tonightCard.cta}</Text>
            <NavArrowRight color={colors.onCoral} height={20} strokeWidth={2.35} width={20} />
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.foxFindCard, pressed ? styles.pressed : null]}
          onPress={() => openCommandCard(commandCenter.foxFind)}
        >
          <View style={styles.foxMascotWrap}>
            <KikoMascot animated="success" pose="wave" size={52} />
          </View>
          <View style={styles.foxCopy}>
            <Text style={styles.foxTitle}>{commandCenter.foxFind.title}</Text>
            <Text style={styles.foxBody}>{commandCenter.foxFind.body}</Text>
            <Text style={styles.tasteNote}>{commandCenter.tasteNote}</Text>
          </View>
          <NavArrowRight color={colors.coral} height={19} strokeWidth={2.25} width={19} />
        </Pressable>

        <View style={styles.commandGrid}>
          {commandCenter.quickCards.map((card) => (
            <Pressable
              accessibilityRole="button"
              key={card.id}
              style={({ pressed }) => [
                styles.commandCard,
                card.tone === 'green' ? styles.commandCardGreen : null,
                card.tone === 'coral' ? styles.commandCardCoral : null,
                pressed ? styles.pressed : null,
              ]}
              onPress={() => openCommandCard(card)}
            >
              <Text numberOfLines={2} style={styles.commandTitle}>{card.title}</Text>
              <Text numberOfLines={3} style={styles.commandBody}>{card.body}</Text>
              <View style={styles.commandCtaRow}>
                <Text style={styles.commandCta}>{card.cta}</Text>
                <NavArrowRight color={colors.coral} height={17} strokeWidth={2.25} width={17} />
              </View>
            </Pressable>
          ))}
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
            <View style={styles.heroChip}>
              <Text style={styles.heroChipText}>{hasActivity ? 'Today in Okyo' : 'Latest photo'}</Text>
            </View>
            <View style={styles.heroCopy}>
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

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.foodIdeaCard, pressed ? styles.pressed : null]}
          onPress={openFoodIdea}
        >
          <View style={styles.foodIdeaIcon}>
            <PasteClipboard color={colors.coral} height={21} strokeWidth={2.25} width={21} />
          </View>
          <View style={styles.foodIdeaCopy}>
            <Text style={styles.foodIdeaTitle}>Save a food idea</Text>
            <Text style={styles.foodIdeaBody}>Paste a link, caption, or messy note and Okyo checks if it is cookable.</Text>
          </View>
          <NavArrowRight color={colors.coral} height={21} strokeWidth={2.25} width={21} />
        </Pressable>

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
                <FoodImage
                  imageStatus={getRecipeImageStatus(recipe)}
                  imageUrl={getRecipeImageUrl(recipe)}
                  style={styles.timelineImage}
                />
                <View style={styles.timelineCopy}>
                  <Text numberOfLines={2} style={styles.timelineTitle}>{recipe.title}</Text>
                  <Text style={styles.timelineMeta}>
                    {getModeLabel(getSafeRecipeMode(recipe.mode))} · saved about {formatCurrency(recipe.estimatedSavings)}
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
            <View style={styles.emptyMascotWrap}>
              <KikoMascot animated="idle" pose="wave" size={64} />
            </View>
            <View style={styles.emptyRecentCopy}>
              <View style={styles.emptyRecentSparkRow}>
                <Spark color={colors.coral} height={18} strokeWidth={2.2} width={18} />
                <Text style={styles.emptyRecentTitle}>No recent meals yet</Text>
              </View>
              <Text style={styles.emptyRecentBody}>Scan once and this becomes your cooking timeline.</Text>
            </View>
          </Pressable>
        )}

      </ScrollView>
      <RewardToast label={`${dailySpark.toast} +5 XP`} tone="xp" visible={dailyRewardVisible} />
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

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDailySpark(dateKey: string) {
  const sparks = [
    {
      title: 'Kiko found a cooking spark',
      body: 'One tiny idea for today: scan the meal you keep thinking about.',
      toast: 'Cooking spark found',
    },
    {
      title: 'Your kitchen rhythm is ready',
      body: 'A quick scan keeps your homemade ideas fresh for the week.',
      toast: 'Rhythm boost',
    },
    {
      title: 'New idea energy',
      body: 'Save one craving today and future-you gets an easier dinner.',
      toast: 'Kitchen idea saved',
    },
  ];
  const index = Array.from(dateKey).reduce((sum, char) => sum + char.charCodeAt(0), 0) % sparks.length;
  return sparks[index] ?? sparks[0];
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    padding: spacing.screen,
    paddingBottom: layout.scrollClearance + 96,
  },
  header: {
    marginTop: spacing.xs,
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
  headerBody: {
    ...typography.body,
    marginTop: 8,
    maxWidth: 340,
  },
  dailyCheckInCard: {
    ...surfaces.panel,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    padding: 14,
  },
  dailyKikoWrap: {
    alignItems: 'center',
    backgroundColor: colors.greenSoft,
    borderRadius: 999,
    height: 70,
    justifyContent: 'center',
    width: 70,
  },
  dailyCopy: {
    flex: 1,
    minWidth: 0,
  },
  dailyLabel: {
    ...typography.label,
    color: colors.green,
  },
  dailyTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 2,
  },
  dailyBody: {
    ...typography.caption,
    marginTop: 3,
  },
  dailyRewardPill: {
    backgroundColor: colors.coralSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dailyRewardText: {
    color: colors.coralDark,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '800',
  },
  tonightCard: {
    ...surfaces.card,
    backgroundColor: colors.coral,
    borderColor: colors.coralDark,
    borderRadius: radius.hero,
    marginTop: 24,
    overflow: 'hidden',
    padding: 18,
  },
  tonightTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  tonightKikoWrap: {
    alignItems: 'center',
    backgroundColor: colors.onCoral,
    borderRadius: 999,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  tonightCopy: {
    flex: 1,
    minWidth: 0,
  },
  tonightLabel: {
    color: colors.onCoral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '800',
    opacity: 0.88,
  },
  tonightTitle: {
    color: colors.onCoral,
    fontFamily: fontFamilies.display,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 31,
    marginTop: 2,
  },
  tonightBody: {
    color: colors.onCoral,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    opacity: 0.92,
  },
  tonightActionRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 253, 248, 0.18)',
    borderColor: 'rgba(255, 253, 248, 0.36)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  tonightCta: {
    color: colors.onCoral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    fontWeight: '800',
  },
  foxFindCard: {
    ...surfaces.panel,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    padding: 15,
  },
  foxMascotWrap: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 999,
    height: 66,
    justifyContent: 'center',
    width: 66,
  },
  foxCopy: {
    flex: 1,
    minWidth: 0,
  },
  foxTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  foxBody: {
    color: colors.body,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  tasteNote: {
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 8,
  },
  commandGrid: {
    columnGap: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    rowGap: 12,
  },
  commandCard: {
    ...surfaces.panel,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 150,
    padding: 14,
  },
  commandCardGreen: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.greenSoft,
  },
  commandCardCoral: {
    backgroundColor: colors.coralSoft,
    borderColor: colors.coralSoft,
  },
  commandTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  commandBody: {
    color: colors.body,
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 7,
  },
  commandCtaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 10,
  },
  commandCta: {
    color: colors.coral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '800',
  },
  heroCard: {
    ...surfaces.card,
    ...shadows.hero,
    borderRadius: radius.hero,
    marginTop: 26,
    overflow: 'hidden',
  },
  heroImage: {
    aspectRatio: 1.15,
    backgroundColor: colors.cream,
    width: '100%',
  },
  heroChip: {
    ...surfaces.glassChip,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: 'absolute',
    top: 16,
  },
  heroChipText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
  },
  heroCopy: {
    padding: 22,
  },
  heroTitle: {
    ...typography.title,
  },
  heroBody: {
    ...typography.body,
    marginTop: 8,
  },
  foodIdeaCard: {
    ...surfaces.panel,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  foodIdeaIcon: {
    alignItems: 'center',
    backgroundColor: colors.coralSoft,
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  foodIdeaCopy: {
    flex: 1,
    minWidth: 0,
  },
  foodIdeaTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  foodIdeaBody: {
    color: colors.body,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
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
    ...surfaces.panel,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minHeight: 82,
    padding: 14,
  },
  timelineImage: {
    backgroundColor: colors.cream,
    borderRadius: 18,
    height: 58,
    width: 58,
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
    ...surfaces.card,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginTop: 14,
    padding: spacing.card,
  },
  emptyMascotWrap: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 999,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  emptyRecentCopy: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  emptyRecentSparkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  emptyRecentTitle: {
    ...typography.heading,
  },
  emptyRecentBody: {
    ...typography.body,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
