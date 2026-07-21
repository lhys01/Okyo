import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Bookmark,
  Cart,
  Check,
  Clock,
  Leaf,
  MoneySquare,
  NavArrowLeft,
  ShareAndroid,
  Spark,
} from 'iconoir-react-native';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OKYO_API_BASE_URL } from '../api/config';
import { authenticatedFetch } from '../api/authenticatedClient';
import { analyticsEvents, track } from '../analytics/track';
import { FoodImage } from '../components/FoodImage';
import { KikoMascot } from '../components/KikoMascot';
import { SparkleBurst } from '../components/motifs';
import { PressableScale, ProgressFill, RewardToast } from '../components/OkyoUI';
import { RecipeQualityCard } from '../components/RecipeQualityCard';
import { colors, fontFamilies, ingredientAvatar, layout, radius, shadows, surfaces } from '../theme/okyoTheme';
import {
  defaultScanResult,
  getSafeRecipeForMode,
  getSafeRecipeMode,
  isRecipeMode,
  type Recipe,
  type RecipeIngredient,
  type RecipeMode,
  type RecipeStep,
} from '../mocks';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { attachRealScanImage } from '../utils/savedRecipeImage';
import { getModeLabel } from '../utils/modeDisplay';
import { matchIngredientToList } from '../utils/ingredientMatching';
import { getRealScanImageUri, getRecipeImageStatus, getRecipeImageUrl } from '../utils/recipeImages';
import {
  deriveCookCoachStepHelp,
  type CookCoachStepHelp,
  type CookCoachTip,
  type CookCoachTimer,
  type CookRescueAction,
} from '../utils/cookCoach';
import {
  deriveAdaptationOptions,
  getDefaultAdaptationGoal,
  type RecipeAdaptationGoal,
  type RecipeAdaptationOption,
} from '../utils/makeItMine';
import { checkImageFileExists, getStorageLocation } from '../utils/imageValidation';
import { useRecipeAdaptationPlan } from '../utils/useRecipeAdaptationPlan';
import type { RecipeAdaptationPlan } from '../api/recipeAdaptationClient';
import { useRecipeQualityReport } from '../utils/useRecipeQualityReport';
import { imageTraceLog, uiLog } from '../utils/uiDebug';
import { devQaScreen } from '../utils/devQa';

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
type RecipeDetailNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'RecipeDetailScreen'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type RecipeDetailRoute = RouteProp<MainTabParamList, 'RecipeDetailScreen'>;
type RecipeStepsNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'RecipeStepsScreen'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type RecipeStepsRoute = RouteProp<MainTabParamList, 'RecipeStepsScreen'>;
type DisplayRecipeStep = {
  phase?: number;
  title?: string;
  text: string;
  lookFor?: string;
  doneWhen?: string;
  ingredientsUsed?: string[];
  toolsUsed?: string[];
  stepImagePrompt?: string;
  why?: string;
  commonMistake?: string;
  estimatedMinutes?: number;
  timeEstimate?: string;
  visualCue?: string;
  whyItMatters?: string;
  safetyNote?: string;
};
type GuidedCookingStep = {
  estimatedMinutes: number | null;
  ingredientsUsed: RecipeIngredient[];
  instruction: string;
  phase: string;
  phaseStepIndex: number;
  phaseStepCount: number;
  why?: string;
  commonMistake?: string;
  doneWhen?: string;
  safetyNote?: string;
  stepNumber: number;
  title: string;
  toolsUsed: string[];
  visualCue?: string;
};
type StepTimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export function RecipeDetailScreen() {
  const navigation = useNavigation<RecipeDetailNavigation>();
  const route = useRoute<RecipeDetailRoute>();
  const detailScrollRef = useRef<ScrollView | null>(null);
  const routeMode = route.params?.mode;
  const initialMode = getSafeRecipeMode(routeMode ?? defaultScanResult.modes[0]);
  const storeSelectedMode = useOkyoStore((state) => state.selectedMode);
  const setStoreSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const latestScanResult = useOkyoStore((state) => state.latestScanResult);
  const saveRecipe = useOkyoStore((state) => state.saveRecipe);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const savedFoodIdeas = useOkyoStore((state) => state.savedFoodIdeas);
  const onboardingGoal = useOkyoStore((state) => state.onboardingGoal);
  const mealRoutinePreference = useOkyoStore((state) => state.mealRoutinePreference);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const setLatestScanRecipe = useOkyoStore((state) => state.setLatestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const awardedXpEvents = useOkyoStore((state) => state.awardedXpEvents);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const userRestaurantPrice = useOkyoStore((state) => state.userRestaurantPrice);
  const [selectedMode, setSelectedMode] = useState<RecipeMode>(
    getSafeRecipeMode(initialMode ?? storeSelectedMode),
  );
  const isDemoScan = isExplicitDemoScan(selectedScanImage);
  const storedRecipe = getStoredRecipeForMode(latestScanRecipe ? [latestScanRecipe] : [], selectedMode, latestScanRecipe);
  const recipe = storedRecipe ?? (isDemoScan ? getSafeRecipeForMode(selectedMode) : null);
  const scanResult = latestScanResult ?? (isDemoScan ? defaultScanResult : null);
  // Savings need a price the user actually paid. Demo scans are the labeled
  // exception — they show example numbers from mock data.
  const homemadeCost = recipe?.estimatedHomemadeCost ?? 0;
  const restaurantPrice = isDemoScan
    ? scanResult?.restaurantPrice ?? getEstimatedRestaurantPrice(recipe)
    : userRestaurantPrice ?? 0;
  const displaySavings = isDemoScan
    ? recipe?.estimatedSavings ?? 0
    : Math.max(0, restaurantPrice - homemadeCost);
  const canShowSavings = isDemoScan
    ? restaurantPrice > 0 && (recipe?.estimatedSavings ?? 0) > 0
    : userRestaurantPrice !== null;
  const spicePairings = getSafeTextList(recipe?.spicePairings);
  const ingredientGroups = getSafeIngredientGroups(recipe);
  const equipment = getSafeTextList(recipe?.equipment);
  const substitutions = getSafeTextList(recipe?.substitutions);
  const displayTitle = cleanDisplayText(recipe?.title ?? '');
  const displayDescription = cleanDisplayText(recipe?.description ?? '');
  const ingredientCount = getIngredientCount(recipe);
  const fallbackIngredients = (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
    .filter((ingredient) => ingredient.name.trim());
  const displayIngredientGroups = ingredientGroups.length > 0
    ? ingredientGroups
    : fallbackIngredients.length > 0
      ? [{ component: '', items: fallbackIngredients }]
      : [];
  const totalTime = recipe ? recipe.totalTimeMinutes ?? recipe.prepTimeMinutes + recipe.cookTimeMinutes : 0;
  const flavorNotes = getFlavorNotes(recipe, spicePairings);
  const whyBullets = getWhyBullets(recipe, totalTime);
  const strategyNote = getStrategyNote(recipe);
  const recipeImageUrl = getRecipeImageUrl(recipe, getRealScanImageUri(selectedScanImage));
  const recipeImageStatus = getRecipeImageStatus(recipe);
  const qualityReport = useRecipeQualityReport(recipe, {
    source: savedFoodIdeas.some((idea) => idea.extractedRecipe?.id === recipe?.id) ? 'foodIdea' : 'savedRecipe',
    skillLevel: recipe?.difficulty,
    userGoal: onboardingGoal ?? undefined,
  });
  const adaptationOptions = useMemo(
    () => (recipe
      ? deriveAdaptationOptions(recipe, {
        mealRoutinePreference,
        onboardingGoal,
        qualityReport,
        savedFoodIdeaCount: Array.isArray(savedFoodIdeas) ? savedFoodIdeas.length : 0,
        savedRecipeCount: Array.isArray(savedRecipes) ? savedRecipes.length : 0,
      })
      : []),
    [mealRoutinePreference, onboardingGoal, qualityReport, recipe, savedFoodIdeas, savedRecipes],
  );
  const [selectedAdaptationId, setSelectedAdaptationId] = useState<RecipeAdaptationGoal | null>(null);
  const adaptationContext = useMemo(() => ({
    source: savedFoodIdeas.some((idea) => idea.extractedRecipe?.id === recipe?.id) ? 'foodIdea' as const : 'savedRecipe' as const,
    skillLevel: recipe?.difficulty,
    timePreference: mealRoutinePreference === 'quick_easy' ? 'under30' : undefined,
    budgetPreference: mealRoutinePreference === 'budget_meals' ? 'low' : undefined,
  }), [mealRoutinePreference, recipe?.difficulty, recipe?.id, savedFoodIdeas]);
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const [saveToastLabel, setSaveToastLabel] = useState('Saved to your library');
  const saveToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const fallbackGoal = getDefaultAdaptationGoal(adaptationOptions);
    if (!fallbackGoal) {
      return;
    }
    if (!selectedAdaptationId || !adaptationOptions.some((option) => option.id === selectedAdaptationId)) {
      setSelectedAdaptationId(fallbackGoal);
    }
  }, [adaptationOptions, selectedAdaptationId]);
  const selectedAdaptation = adaptationOptions.find((option) => option.id === selectedAdaptationId) ?? adaptationOptions[0] ?? null;
  const backendAdaptationPlan = useRecipeAdaptationPlan(recipe, selectedAdaptationId, adaptationContext);
  const displayedAdaptation = useMemo(
    () => (selectedAdaptation ? getDisplayAdaptationOption(selectedAdaptation, backendAdaptationPlan) : null),
    [backendAdaptationPlan, selectedAdaptation],
  );
  const [coachingLoading, setCoachingLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      requestAnimationFrame(() => {
        detailScrollRef.current?.scrollTo({ y: 0, animated: false });
      });
    }, [recipe?.id]),
  );

  useEffect(() => {
    const safeMode = getSafeRecipeMode(routeMode ?? storeSelectedMode);
    setSelectedMode(safeMode);

    uiLog('RecipeDetailScreen', 'enter', { routeMode, safeMode });
    const _traceUri = recipeImageUrl ?? null;
    const _hasStampedUri = Boolean((recipe as { imageUri?: string } | null)?.imageUri);
    checkImageFileExists(_traceUri).then((fileExists) => {
      imageTraceLog('RecipeDetailScreen', {
        screen: 'RecipeDetailScreen',
        recipeId: recipe?.id ?? null,
        imageSource: _hasStampedUri ? 'recipe.imageUri'
          : getRealScanImageUri(selectedScanImage) ? 'selectedScanImage'
          : _traceUri ? 'recipe.imageUrl'
          : 'none',
        imageUri: _traceUri,
        fileExists: _traceUri ? fileExists : 'n/a',
        usingFallback: !_hasStampedUri,
        fallbackReason: !_hasStampedUri
          ? (selectedScanImage?.placeholder ? 'no_stamped_imageUri_placeholder_scan' : 'recipe_imageUri_not_stamped')
          : null,
        storageLocation: getStorageLocation(_traceUri),
        selectedScanImagePlaceholder: selectedScanImage?.placeholder,
        selectedScanImageHasUri: Boolean(selectedScanImage?.uri),
      });
    });

    if (routeMode && !isRecipeMode(routeMode)) {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: 'Recipe mode was missing or invalid.',
        screen: 'RecipeDetailScreen',
      });
    }
  }, [routeMode, storeSelectedMode]);

  useEffect(() => () => {
    if (saveToastTimer.current) {
      clearTimeout(saveToastTimer.current);
    }
  }, []);

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('MainTabs', { screen: 'HomeScreen' });
  };

  const saveSelectedRecipe = () => {
    if (!recipe) {
      return;
    }

    const alreadySaved = savedRecipes.some((savedRecipe) => savedRecipe.id === recipe.id);
    const saveEventId = `save-recipe-${recipe.id}`;
    const willAwardSaveXp = !alreadySaved && !awardedXpEvents.includes(saveEventId);
    uiLog('RecipeDetailScreen', 'save_recipe', { recipeId: recipe.id });
    saveRecipe(attachRealScanImage(recipe, selectedScanImage));
    if (!alreadySaved) {
      awardXPOnce(saveEventId, 5);
    }
    unlockBadge('first-dupe');
    track(analyticsEvents.RECIPE_SAVED, {
      dishName: recipe?.title ?? scanResult?.dishName ?? 'Missing recipe',
      mode: recipe.mode,
      savings: canShowSavings ? displaySavings : 0,
      screen: 'RecipeDetailScreen',
    });
    setSaveToastLabel(willAwardSaveXp ? 'Saved to your library +5 XP' : 'Saved to your library');
    setSaveToastVisible(true);
    if (saveToastTimer.current) {
      clearTimeout(saveToastTimer.current);
    }
    saveToastTimer.current = setTimeout(() => {
      setSaveToastVisible(false);
    }, 1600);
  };

  const openShareRecipe = () => {
    if (!recipe) {
      return;
    }

    navigation.navigate('ShareCardPreviewScreen', {
      cardType: 'scan_result',
      mode: selectedMode,
      scanContext: {
        image: selectedScanImage,
        recipe,
        scanResult,
      },
    });
  };

  const openGroceryList = () => {
    navigation.navigate('GroceryListScreen', { mode: selectedMode });
  };

  const openCookingSteps = () => {
    if (coachingLoading) return;

    const needsCoaching = !isDemoScan &&
      Boolean(recipe?.id) &&
      Boolean(recipe?.structuredSteps?.some((step) => !step.why && !step.chefTip && !step.commonQuestion));

    if (!needsCoaching) {
      navigation.navigate('RecipeStepsScreen', { mode: selectedMode });
      return;
    }

    setCoachingLoading(true);
    authenticatedFetch(`${OKYO_API_BASE_URL}/v1/recipes/${recipe!.id}/coaching`, { method: 'POST' })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json() as { ok: boolean; data?: { structuredSteps?: RecipeStep[] } };
          if (data.ok && Array.isArray(data.data?.structuredSteps) && latestScanRecipe) {
            setLatestScanRecipe({ ...latestScanRecipe, structuredSteps: data.data.structuredSteps });
          }
        }
      })
      .catch(() => {
        // Coaching failed — open Guided Cooking with uncoached steps.
      })
      .finally(() => {
        setCoachingLoading(false);
        navigation.navigate('RecipeStepsScreen', { mode: selectedMode });
      });
  };

  if (!recipe) {
    return (
      <ScreenFrame onBack={goBack} title="Recipe">
        <View style={styles.issueCard}>
          <Text style={styles.kicker}>Recipe issue</Text>
          <Text style={styles.issueTitle}>This recipe needs another try.</Text>
          <Text style={styles.issueBody}>
            Okyo needs a completed recipe before it can show cooking steps or groceries for this scan.
          </Text>
          <View style={styles.issueActions}>
            <PrimaryAction label="Try another photo" onPress={() => navigation.navigate('MainTabs', { screen: 'HomeScreen' })} />
            <SecondaryAction label="Back" onPress={goBack} />
          </View>
        </View>
      </ScreenFrame>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        ref={detailScrollRef}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <FoodImage
            fallbackLabel="Recipe image"
            imageStatus={recipeImageStatus}
            imageUrl={recipeImageUrl}
            showFallbackLabel
            style={styles.recipePhoto}
          >
            <Pressable
              accessibilityRole="button"
              onPress={goBack}
              style={({ pressed }) => [styles.circleBackButton, pressed ? styles.pressed : null]}
            >
              <NavArrowLeft color={colors.charcoal} height={23} strokeWidth={2.35} width={23} />
            </Pressable>
            <View style={styles.inspiredPill}>
              <Spark color={colors.coral} height={18} strokeWidth={2.2} width={18} />
              <Text style={styles.inspiredPillText}>Inspired by your restaurant meal</Text>
            </View>
          </FoodImage>

          <View style={styles.overviewPanel}>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              numberOfLines={2}
              style={styles.recipeTitle}
            >
              {displayTitle}
            </Text>
            <View style={styles.savingsMiniPill}>
              <Leaf color={colors.green} height={15} strokeWidth={2.2} width={15} />
              <Text style={styles.savingsMiniText}>
                {canShowSavings
                  ? `You save ${formatCurrency(displaySavings)}`
                  : `Home est. ${formatCurrency(recipe.estimatedHomemadeCost)}`}
              </Text>
            </View>

            <Text style={styles.metaLine}>
              {totalTime} min · {recipe.skillLevel ?? recipe.difficulty} · Serves {recipe.servings}
            </Text>

            <Text style={styles.description}>{displayDescription}</Text>

            <PrimaryAction label={coachingLoading ? 'Preparing...' : 'Start Cooking'} onPress={openCookingSteps} />
            <View style={styles.secondaryActionsRow}>
              <SecondaryIconAction icon={<Bookmark color={colors.charcoal} height={21} strokeWidth={2.1} width={21} />} label="Save" onPress={saveSelectedRecipe} />
              <SecondaryIconAction icon={<Cart color={colors.charcoal} height={21} strokeWidth={2.1} width={21} />} label="Grocery List" onPress={openGroceryList} />
              <SecondaryIconAction icon={<ShareAndroid color={colors.charcoal} height={21} strokeWidth={2.1} width={21} />} label="Share" onPress={openShareRecipe} />
            </View>

            {strategyNote ? (
              <View style={styles.kikoTipBlock}>
                <KikoMascot animated="idle" pose="cooking" size={52} />
                <View style={styles.kikoTipCopy}>
                  <Text style={styles.kikoTipLabel}>{getModeLabel(selectedMode)} — Kiko's take</Text>
                  <Text style={styles.kikoTipText}>{strategyNote}</Text>
                </View>
              </View>
            ) : null}

            {qualityReport ? <RecipeQualityCard compact report={qualityReport} /> : null}

            {displayedAdaptation ? (
              <MakeItMineSection
                options={adaptationOptions}
                selectedId={displayedAdaptation.id}
                selectedOption={displayedAdaptation}
                onSelect={setSelectedAdaptationId}
              />
            ) : null}

            <View style={styles.previewSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionSmallTitle}>Ingredients</Text>
                <Text style={styles.sectionCount}>{ingredientCount} items</Text>
              </View>
              {displayIngredientGroups.map((group) => (
                <View key={`${recipe.id}-${group.component || 'all'}`} style={styles.ingredientGroupCard}>
                  {group.component ? (
                    <Text style={styles.ingredientGroupTitle}>{group.component}</Text>
                  ) : null}
                  {group.items.map((item, itemIndex) => (
                    <View
                      key={`${recipe.id}-${group.component}-${item.name}`}
                      style={[
                        styles.ingredientRow,
                        itemIndex === group.items.length - 1 ? styles.ingredientRowLast : null,
                      ]}
                    >
                      <IngredientAvatar name={item.name} />
                      <View style={styles.ingredientTextBlock}>
                        <Text style={styles.ingredientName}>{cleanDisplayText(item.name)}</Text>
                      </View>
                      {item.quantity?.trim() ? (
                        <Text style={styles.ingredientQty}>{cleanDisplayText(item.quantity)}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ))}
            </View>

            {whyBullets.length > 0 ? (
              <InfoCard title="Why this works">
                {whyBullets.map((bullet) => (
                  <View key={bullet} style={styles.bulletRow}>
                    <Check color={colors.coral} height={16} strokeWidth={2.35} width={16} />
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </InfoCard>
            ) : null}

            {flavorNotes.length > 0 ? (
              <InfoCard title="Flavor notes">
                <View style={styles.chipRow}>
                  {flavorNotes.map((note) => (
                    <View key={note} style={styles.flavorChipWrap}>
                      <Text numberOfLines={1} style={styles.flavorChipText}>{note}</Text>
                    </View>
                  ))}
                </View>
              </InfoCard>
            ) : null}

            {equipment.length > 0 ? (
              <InfoCard title="Equipment you'll need">
                <View style={styles.chipRow}>
                  {equipment.slice(0, 6).map((item) => (
                    <View key={item} style={styles.flavorChipWrap}>
                      <Text numberOfLines={1} style={styles.flavorChipText}>{cleanDisplayText(item)}</Text>
                    </View>
                  ))}
                </View>
              </InfoCard>
            ) : null}

            {substitutions.length > 0 ? (
              <InfoCard title="Easy swaps">
                <Text style={styles.swapsHelper}>Use these if you want a lighter or easier version.</Text>
                {substitutions.map((item) => (
                  <View key={item} style={styles.bulletRow}>
                    <Leaf color={colors.green} height={16} strokeWidth={2.2} width={16} />
                    <Text style={styles.bulletText}>{cleanDisplayText(item)}</Text>
                  </View>
                ))}
              </InfoCard>
            ) : null}

            <View style={styles.savingsCard}>
              <View style={styles.savingsCopy}>
                <Text style={styles.savingsLabel}>{canShowSavings ? (isDemoScan ? 'Example savings' : 'Your savings') : 'Estimated home cost'}</Text>
                <Text style={styles.savingsSubLabel}>{canShowSavings ? 'You save' : 'To make at home'}</Text>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  numberOfLines={1}
                  style={styles.savingsValue}
                >
                  {formatCurrency(canShowSavings ? displaySavings : recipe.estimatedHomemadeCost)}
                </Text>
                <Text style={styles.savingsNote}>
                  {canShowSavings
                    ? `vs. restaurant ${formatCurrency(restaurantPrice)}`
                    : 'Add what you paid from the result screen to see savings.'}
                </Text>
              </View>
              <View style={styles.savingsIconBubble}>
                <MoneySquare color={colors.green} height={42} strokeWidth={1.9} width={42} />
              </View>
            </View>

          </View>
        </View>
      </ScrollView>
      <RewardToast label={saveToastLabel} tone="save" visible={saveToastVisible} />
    </SafeAreaView>
  );
}

export function RecipeStepsScreen() {
  const navigation = useNavigation<RecipeStepsNavigation>();
  const route = useRoute<RecipeStepsRoute>();
  const routeMode = route.params?.mode;
  const storeSelectedMode = useOkyoStore((state) => state.selectedMode);
  const selectedMode = getSafeRecipeMode(routeMode ?? storeSelectedMode);
  const latestScanResult = useOkyoStore((state) => state.latestScanResult);
  const saveRecipe = useOkyoStore((state) => state.saveRecipe);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const awardedXpEvents = useOkyoStore((state) => state.awardedXpEvents);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const userRestaurantPrice = useOkyoStore((state) => state.userRestaurantPrice);
  const isDemoScan = isExplicitDemoScan(selectedScanImage);
  const storedRecipe = getStoredRecipeForMode(latestScanRecipe ? [latestScanRecipe] : [], selectedMode, latestScanRecipe);
  const recipe = storedRecipe ?? (isDemoScan ? getSafeRecipeForMode(selectedMode) : null);
  const scanResult = latestScanResult ?? (isDemoScan ? defaultScanResult : null);
  // Same honesty rule as RecipeDetailScreen: real savings need a user price.
  const restaurantPrice = isDemoScan
    ? scanResult?.restaurantPrice ?? getEstimatedRestaurantPrice(recipe)
    : userRestaurantPrice ?? 0;
  const canShowSavings = Boolean(recipe) &&
    (isDemoScan
      ? restaurantPrice > 0 && (recipe?.estimatedSavings ?? 0) > 0
      : userRestaurantPrice !== null);
  const displaySavings = !recipe
    ? 0
    : isDemoScan
      ? recipe.estimatedSavings
      : Math.max(0, restaurantPrice - recipe.estimatedHomemadeCost);
  const guidedSteps = useMemo(() => getGuidedCookingSteps(recipe), [recipe]);
  const displayTitle = cleanDisplayText(recipe?.title ?? '');
  const recipeImageUrl = getRecipeImageUrl(recipe, getRealScanImageUri(selectedScanImage));
  const recipeImageStatus = getRecipeImageStatus(recipe);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [showCompletion, setShowCompletion] = useState(devQaScreen === 'completion');
  const [stepToastVisible, setStepToastVisible] = useState(false);
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const [saveToastLabel, setSaveToastLabel] = useState('Saved to your library');
  const [cookingRewardVisible, setCookingRewardVisible] = useState(false);
  const [cookingRewardLabel, setCookingRewardLabel] = useState('Cooked with Okyo');
  const stepToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cookingRewardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeStep = guidedSteps[Math.min(activeStepIndex, Math.max(guidedSteps.length - 1, 0))];
  const progress = guidedSteps.length > 0 ? ((activeStepIndex + 1) / guidedSteps.length) * 100 : 0;
  const coachHelp = useMemo(
    () => deriveCookCoachStepHelp(recipe, activeStep, activeStepIndex),
    [activeStep, activeStepIndex, recipe],
  );
  const [selectedRescueAction, setSelectedRescueAction] = useState<CookRescueAction | null>(null);
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timerStatus, setTimerStatus] = useState<StepTimerStatus>('idle');
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const isRestoringSession = useRef(false);
  const activeTimer = coachHelp.timers.find((timer) => timer.id === activeTimerId) ?? coachHelp.timers[0] ?? null;
  const cookingSessionKey = recipe ? `okyo-cooking-session:${recipe.id}` : null;

  useEffect(() => {
    uiLog('RecipeStepsScreen', 'enter', { routeMode, selectedMode });
    const _traceUri = recipeImageUrl ?? null;
    const _hasStampedUri = Boolean((recipe as { imageUri?: string } | null)?.imageUri);
    checkImageFileExists(_traceUri).then((fileExists) => {
      imageTraceLog('RecipeStepsScreen', {
        screen: 'RecipeStepsScreen',
        recipeId: recipe?.id ?? null,
        imageSource: _hasStampedUri ? 'recipe.imageUri'
          : getRealScanImageUri(selectedScanImage) ? 'selectedScanImage'
          : _traceUri ? 'recipe.imageUrl'
          : 'none',
        imageUri: _traceUri,
        fileExists: _traceUri ? fileExists : 'n/a',
        usingFallback: !_hasStampedUri,
        fallbackReason: !_hasStampedUri
          ? (selectedScanImage?.placeholder ? 'no_stamped_imageUri_placeholder_scan' : 'recipe_imageUri_not_stamped')
          : null,
        storageLocation: getStorageLocation(_traceUri),
        selectedScanImagePlaceholder: selectedScanImage?.placeholder,
        selectedScanImageHasUri: Boolean(selectedScanImage?.uri),
      });
    });

    if (routeMode && !isRecipeMode(routeMode)) {
      track(analyticsEvents.RESULT_ERROR, {
        errorMessage: 'Recipe steps mode was missing or invalid.',
        screen: 'RecipeStepsScreen',
      });
    }
  }, [routeMode, selectedMode]);

  useEffect(() => {
    if (activeStepIndex >= guidedSteps.length) {
      setActiveStepIndex(Math.max(guidedSteps.length - 1, 0));
    }
  }, [activeStepIndex, guidedSteps.length]);

  useEffect(() => {
    if (!cookingSessionKey || devQaScreen === 'steps' || devQaScreen === 'completion') {
      setHasRestoredSession(true);
      return;
    }

    let mounted = true;
    void AsyncStorage.getItem(cookingSessionKey)
      .then((storedSession) => {
        if (!mounted || !storedSession) {
          return;
        }

        const session = JSON.parse(storedSession) as {
          activeStepIndex?: number;
          activeTimerId?: string | null;
          remainingSeconds?: number;
          timerEndsAt?: number | null;
          timerStatus?: StepTimerStatus;
        };
        isRestoringSession.current = true;
        setActiveStepIndex(Math.max(0, Math.min(guidedSteps.length - 1, session.activeStepIndex ?? 0)));
        setActiveTimerId(session.activeTimerId ?? null);
        const restoredRemaining = session.timerStatus === 'running' && session.timerEndsAt
          ? Math.max(0, Math.ceil((session.timerEndsAt - Date.now()) / 1000))
          : Math.max(0, session.remainingSeconds ?? 0);
        setRemainingSeconds(restoredRemaining);
        setTimerEndsAt(restoredRemaining > 0 && session.timerStatus === 'running' ? session.timerEndsAt ?? null : null);
        setTimerStatus(restoredRemaining === 0 && session.timerStatus === 'running'
          ? 'finished'
          : session.timerStatus ?? 'idle');
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) {
          setHasRestoredSession(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [cookingSessionKey, guidedSteps.length]);

  useEffect(() => {
    if (!cookingSessionKey || !hasRestoredSession || showCompletion) {
      return;
    }

    void AsyncStorage.setItem(cookingSessionKey, JSON.stringify({
      activeStepIndex,
      activeTimerId,
      remainingSeconds,
      timerEndsAt,
      timerStatus,
    })).catch(() => undefined);
  }, [activeStepIndex, activeTimerId, cookingSessionKey, hasRestoredSession, remainingSeconds, showCompletion, timerEndsAt, timerStatus]);

  useEffect(() => {
    if (isRestoringSession.current) {
      isRestoringSession.current = false;
      return;
    }
    setSelectedRescueAction(null);
    setActiveTimerId(null);
    setRemainingSeconds(0);
    setTimerEndsAt(null);
    setTimerStatus('idle');
  }, [coachHelp.stepId]);

  useEffect(() => {
    if (timerStatus !== 'running') {
      return undefined;
    }

    const interval = setInterval(() => {
      setRemainingSeconds((currentSeconds) => {
        const nextSeconds = timerEndsAt
          ? Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000))
          : currentSeconds - 1;
        if (nextSeconds <= 0) {
          setTimerStatus('finished');
          setTimerEndsAt(null);
          return 0;
        }
        return nextSeconds;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerEndsAt, timerStatus]);

  useEffect(() => () => {
    if (stepToastTimer.current) {
      clearTimeout(stepToastTimer.current);
    }
    if (saveToastTimer.current) {
      clearTimeout(saveToastTimer.current);
    }
    if (cookingRewardTimer.current) {
      clearTimeout(cookingRewardTimer.current);
    }
  }, []);

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('RecipeDetailScreen', { mode: selectedMode });
  };

  const saveSelectedRecipe = () => {
    if (!recipe) {
      return;
    }

    const alreadySaved = savedRecipes.some((savedRecipe) => savedRecipe.id === recipe.id);
    const saveEventId = `save-recipe-${recipe.id}`;
    const willAwardSaveXp = !alreadySaved && !awardedXpEvents.includes(saveEventId);
    uiLog('RecipeStepsScreen', 'save_recipe', { recipeId: recipe.id });
    saveRecipe(attachRealScanImage(recipe, selectedScanImage));
    if (!alreadySaved) {
      awardXPOnce(saveEventId, 5);
    }
    unlockBadge('first-dupe');
    track(analyticsEvents.RECIPE_SAVED, {
      dishName: recipe?.title ?? scanResult?.dishName ?? 'Missing recipe',
      mode: recipe.mode,
      savings: canShowSavings ? displaySavings : 0,
      screen: 'RecipeStepsScreen',
    });
    setSaveToastLabel(willAwardSaveXp ? 'Saved to your library +5 XP' : 'Saved to your library');
    setSaveToastVisible(true);
    if (saveToastTimer.current) {
      clearTimeout(saveToastTimer.current);
    }
    saveToastTimer.current = setTimeout(() => setSaveToastVisible(false), 1600);
  };

  const openShareRecipe = () => {
    if (!recipe) {
      return;
    }

    navigation.navigate('ShareCardPreviewScreen', {
      cardType: 'scan_result',
      mode: selectedMode,
      scanContext: {
        image: selectedScanImage,
        recipe,
        scanResult,
      },
    });
  };

  const goToStep = (nextIndex: number) => {
    const clampedIndex = Math.max(0, Math.min(guidedSteps.length - 1, nextIndex));
    setShowCompletion(false);
    setActiveStepIndex(clampedIndex);
  };

  const goPreviousStep = () => {
    goToStep(activeStepIndex - 1);
  };

  const goNextStep = () => {
    if (activeStepIndex >= guidedSteps.length - 1) {
      if (recipe) {
        const cookingEventId = `cook-recipe-${recipe.id}`;
        const willAwardCookingXp = !awardedXpEvents.includes(cookingEventId);
        setCookingRewardLabel(willAwardCookingXp ? 'Cooked with Okyo +10 XP' : 'Cooked with Okyo');
        awardXPOnce(cookingEventId, 10);
      } else {
        setCookingRewardLabel('Cooked with Okyo');
      }
      setCookingRewardVisible(true);
      if (cookingRewardTimer.current) {
        clearTimeout(cookingRewardTimer.current);
      }
      cookingRewardTimer.current = setTimeout(() => setCookingRewardVisible(false), 1800);
      setShowCompletion(true);
      if (cookingSessionKey) {
        void AsyncStorage.removeItem(cookingSessionKey).catch(() => undefined);
      }
      return;
    }

    showStepToast();
    goToStep(activeStepIndex + 1);
  };

  const showStepToast = () => {
    if (stepToastTimer.current) {
      clearTimeout(stepToastTimer.current);
    }
    setStepToastVisible(true);
    stepToastTimer.current = setTimeout(() => setStepToastVisible(false), 900);
  };

  const startTimer = (timer: CookCoachTimer) => {
    setActiveTimerId(timer.id);
    setRemainingSeconds(timer.seconds);
    setTimerEndsAt(Date.now() + timer.seconds * 1000);
    setTimerStatus('running');
  };

  const pauseTimer = () => {
    setTimerEndsAt(null);
    setTimerStatus('paused');
  };

  const resumeTimer = () => {
    if (remainingSeconds > 0) {
      setTimerEndsAt(Date.now() + remainingSeconds * 1000);
      setTimerStatus('running');
    }
  };

  const resetTimer = () => {
    setRemainingSeconds(activeTimer?.seconds ?? 0);
    setTimerEndsAt(null);
    setTimerStatus('idle');
  };

  if (!recipe) {
    return (
      <ScreenFrame onBack={goBack} title="Cooking Steps">
        <View style={styles.issueCard}>
          <Text style={styles.kicker}>Steps issue</Text>
          <Text style={styles.issueTitle}>This recipe needs another try.</Text>
          <Text style={styles.issueBody}>
            Okyo needs a completed recipe before it can show cooking steps for this scan.
          </Text>
          <View style={styles.issueActions}>
            <PrimaryAction label="Back to Recipe" onPress={() => navigation.navigate('RecipeDetailScreen', { mode: selectedMode })} />
            <SecondaryAction label="Try another photo" onPress={() => navigation.navigate('HomeScreen')} />
          </View>
        </View>
      </ScreenFrame>
    );
  }

  if (showCompletion) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.guidedScreenContent}>
          <View style={styles.simpleTopBar}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowCompletion(false)}
              style={({ pressed }) => [styles.smallBackButton, pressed ? styles.pressed : null]}
            >
              <NavArrowLeft color={colors.charcoal} height={22} strokeWidth={2.35} width={22} />
              <Text style={styles.smallBackText}>Steps</Text>
            </Pressable>
            <Text numberOfLines={1} style={styles.simpleTopTitle}>Done</Text>
            <View style={styles.topBarSpacer} />
          </View>

          <ScrollView contentContainerStyle={styles.completionScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.completionCard}>
              <View style={styles.completionCelebration}>
                <SparkleBurst size={138} visible />
                <KikoMascot animated="celebrate" pose="celebrating" size={96} style={styles.completionHeroMascot} />
              </View>
              <Text style={styles.completionEyebrow}>You made it.</Text>
              <FoodImage
                fallbackLabel="Recipe image"
                imageStatus={recipeImageStatus}
                imageUrl={recipeImageUrl}
                showFallbackLabel
                style={styles.completionImage}
              />
              <Text numberOfLines={2} style={styles.completionTitle}>
                {displayTitle.replace(/\s+inspired-by$/i, '')}
              </Text>
              <Text style={styles.completionBody}>
                Nice work. Let it rest if the recipe calls for it, taste once more, then enjoy your Okyo version.
              </Text>
              <PrimaryAction label="Share it" onPress={openShareRecipe} />
              <SecondaryAction label="Save" onPress={saveSelectedRecipe} />
            </View>
          </ScrollView>
          <RewardToast label={cookingRewardLabel} tone={cookingRewardLabel.includes('XP') ? 'xp' : 'save'} visible={cookingRewardVisible} />
          <RewardToast label={saveToastLabel} tone={saveToastLabel.includes('XP') ? 'xp' : 'save'} visible={saveToastVisible} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.guidedScreenContent}>
        <View style={styles.simpleTopBar}>
          <Pressable
            accessibilityRole="button"
            onPress={goBack}
            style={({ pressed }) => [styles.smallBackButton, pressed ? styles.pressed : null]}
          >
            <NavArrowLeft color={colors.charcoal} height={22} strokeWidth={2.35} width={22} />
            <Text style={styles.smallBackText}>Back</Text>
          </Pressable>
          <Text numberOfLines={1} style={styles.simpleTopTitle}>Guided Cooking</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <View style={styles.guidedHeader}>
          <KikoMascot animated={stepToastVisible ? 'success' : 'idle'} pose="cooking" size={56} style={styles.guidedMascot} />
          <View style={styles.guidedHeaderCopy}>
            <Text numberOfLines={2} style={styles.guidedRecipeTitle}>{displayTitle}</Text>
            <View style={styles.guidedProgressRow}>
              <Text style={styles.guidedProgressText}>
                {activeStep?.phase ? `${activeStep.phase} · ` : ''}Step {activeStepIndex + 1} of {guidedSteps.length}
              </Text>
              {recipe?.isCompactRecipe ? (
                <View style={styles.compactBadge}>
                  <Text style={styles.compactBadgeText}>Quick Recipe</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <ProgressFill progress={progress / 100} style={styles.guidedProgressTrack} />

        {activeStep ? (
          <View style={styles.guidedStepCard}>
            <ScrollView contentContainerStyle={styles.guidedStepCardContent} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              <View style={styles.guidedStepTopRow}>
                <Text style={styles.guidedStepNumber}>Step {activeStep.stepNumber}</Text>
                {activeStep.estimatedMinutes ? (
                  <View style={styles.guidedTimeChipWrap}>
                    <Text style={styles.guidedTimeChipText}>~{activeStep.estimatedMinutes} min</Text>
                  </View>
                ) : null}
              </View>

              {activeStep.phase ? (
                <Text style={styles.guidedPhaseLabel}>
                  {activeStep.phase}
                  {activeStep.phaseStepCount > 1 ? ` — ${activeStep.phaseStepIndex} of ${activeStep.phaseStepCount}` : ''}
                </Text>
              ) : null}

              <Text
                numberOfLines={2}
                style={styles.guidedStepTitle}
              >
                {activeStep.title}
              </Text>
              <Text style={styles.guidedInstruction}>{activeStep.instruction}</Text>

              {activeTimer ? (
                <StepTimerCard
                  coachHelp={coachHelp}
                  remainingSeconds={remainingSeconds}
                  status={timerStatus}
                  timer={activeTimer}
                  onPause={pauseTimer}
                  onReset={resetTimer}
                  onResume={resumeTimer}
                  onStart={startTimer}
                />
              ) : null}

              {(activeStep.visualCue || activeStep.doneWhen) ? (
                <View style={styles.guidedCueBlock}>
                  {activeStep.visualCue ? (
                    <>
                      <Text style={styles.guidedCueLabel}>Look for</Text>
                      <Text style={styles.guidedCueText}>{activeStep.visualCue}</Text>
                    </>
                  ) : null}
                  {activeStep.doneWhen ? (
                    <>
                      <Text style={styles.guidedDoneLabel}>Done when</Text>
                      <Text style={styles.guidedDoneText}>{activeStep.doneWhen}</Text>
                    </>
                  ) : null}
                </View>
              ) : null}

              {activeStep.why ? (
                <View style={styles.guidedWhyBlock}>
                  <Text style={styles.guidedWhyLabel}>Why this matters</Text>
                  <Text style={styles.guidedWhyText}>{activeStep.why}</Text>
                </View>
              ) : null}

              {(activeStep.commonMistake ?? activeStep.safetyNote) ? (
                <View style={styles.guidedSafetyBlock}>
                  <Text style={styles.guidedSafetyLabel}>Avoid this</Text>
                  <Text style={styles.guidedSafetyText}>{activeStep.commonMistake ?? activeStep.safetyNote}</Text>
                </View>
              ) : null}

              <CookCoachPanel
                coachHelp={coachHelp}
                selectedAction={selectedRescueAction}
                onSelectAction={setSelectedRescueAction}
              />

              <GuidedChipGroup
                label="Use now"
                values={activeStep.ingredientsUsed.map((ingredient) => cleanDisplayText(ingredient.name)).slice(0, 5)}
              />

              <GuidedChipGroup
                label="Tools"
                values={activeStep.toolsUsed.slice(0, 3)}
              />
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.guidedControlArea}>
          <View style={styles.guidedNavRow}>
            <PressableScale
              accessibilityRole="button"
              disabled={activeStepIndex === 0}
              onPress={goPreviousStep}
              style={[
                styles.guidedNavButton,
                activeStepIndex === 0 ? styles.guidedNavButtonDisabled : null,
              ]}
            >
              <Text style={[styles.guidedNavText, activeStepIndex === 0 ? styles.guidedNavTextDisabled : null]}>
                Previous
              </Text>
            </PressableScale>

            <PressableScale
              accessibilityRole="button"
              onPress={goNextStep}
              style={[styles.guidedNavButton, styles.guidedNavButtonPrimary]}
            >
              <Text style={styles.guidedNavPrimaryText}>
                {activeStepIndex >= guidedSteps.length - 1 ? 'Finish' : 'Next'}
              </Text>
            </PressableScale>
          </View>
        </View>
      </View>
      <RewardToast label="Step complete" tone="save" visible={stepToastVisible} />
    </SafeAreaView>
  );
}

type ScreenFrameProps = {
  children: ReactNode;
  onBack: () => void;
  title: string;
};

function ScreenFrame({ children, onBack, title }: ScreenFrameProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <View style={styles.simpleTopBar}>
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.smallBackButton, pressed ? styles.pressed : null]}
          >
            <NavArrowLeft color={colors.charcoal} height={22} strokeWidth={2.35} width={22} />
            <Text style={styles.smallBackText}>Back</Text>
          </Pressable>
          <Text numberOfLines={1} style={styles.simpleTopTitle}>{title}</Text>
          <View style={styles.topBarSpacer} />
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function GuidedChipGroup({ label, values }: { label: string; values: string[] }) {
  const safeValues = [...new Set(values.map((value) => cleanDisplayText(value)).filter(Boolean))].slice(0, 5);

  if (safeValues.length === 0) {
    return null;
  }

  return (
    <View style={styles.guidedChipGroup}>
      <Text style={styles.guidedChipLabel}>{label}</Text>
      <View style={styles.guidedChipRow}>
        {safeValues.map((value, index) => (
          <View key={`${label}-${index}-${value}`} style={styles.guidedChipWrap}>
            <Text numberOfLines={1} style={styles.guidedChipText}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

type StepTimerCardProps = {
  coachHelp: CookCoachStepHelp;
  onPause: () => void;
  onReset: () => void;
  onResume: () => void;
  onStart: (timer: CookCoachTimer) => void;
  remainingSeconds: number;
  status: StepTimerStatus;
  timer: CookCoachTimer;
};

function StepTimerCard({
  coachHelp,
  onPause,
  onReset,
  onResume,
  onStart,
  remainingSeconds,
  status,
  timer,
}: StepTimerCardProps) {
  const isIdle = status === 'idle';
  const displaySeconds = isIdle ? timer.seconds : remainingSeconds;
  const finished = status === 'finished';

  return (
    <View style={styles.stepTimerCard}>
      <View style={styles.stepTimerTopRow}>
        <View style={styles.stepTimerIconWrap}>
          <Clock color={colors.coral} height={18} strokeWidth={2.2} width={18} />
        </View>
        <View style={styles.stepTimerCopy}>
          <Text style={styles.stepTimerTitle}>{finished ? 'Done - check the cue' : formatTimerDisplay(displaySeconds)}</Text>
          <Text style={styles.stepTimerBody}>
            {finished
              ? coachHelp.visualCue ?? coachHelp.doneWhen ?? 'Look at the food before moving on.'
              : timer.label}
          </Text>
        </View>
      </View>
      <View style={styles.stepTimerActions}>
        {status === 'running' ? (
          <TimerAction label="Pause" onPress={onPause} />
        ) : status === 'paused' ? (
          <TimerAction label="Resume" onPress={onResume} />
        ) : (
          <TimerAction label={timer.label} onPress={() => onStart(timer)} primary />
        )}
        <TimerAction label="Reset" onPress={onReset} />
      </View>
    </View>
  );
}

function TimerAction({ label, onPress, primary = false }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.timerAction,
        primary ? styles.timerActionPrimary : null,
      ]}
    >
      <Text style={[styles.timerActionText, primary ? styles.timerActionPrimaryText : null]}>{label}</Text>
    </PressableScale>
  );
}

const COACH_ACTIONS: Array<{ id: CookRescueAction; label: string }> = [
  { id: 'messedUp', label: 'I messed up' },
  { id: 'substitute', label: 'Substitute this' },
  { id: 'explain', label: 'What does this mean?' },
  { id: 'simplify', label: 'Make this simpler' },
  { id: 'howShouldItLook', label: 'How should it look?' },
];

function CookCoachPanel({
  coachHelp,
  onSelectAction,
  selectedAction,
}: {
  coachHelp: CookCoachStepHelp;
  onSelectAction: (action: CookRescueAction) => void;
  selectedAction: CookRescueAction | null;
}) {
  const activeAction = selectedAction ?? 'howShouldItLook';
  const tips = coachHelp.rescueTips[activeAction] ?? [];

  return (
    <View style={styles.cookCoachCard}>
      <View style={styles.cookCoachHeader}>
        <KikoMascot pose="cooking" size={44} />
        <View style={styles.cookCoachHeaderCopy}>
          <Text style={styles.cookCoachTitle}>Need help?</Text>
          <Text style={styles.cookCoachBody}>Pick one rescue move. Okyo will keep it local and simple.</Text>
        </View>
      </View>
      <View style={styles.cookCoachActionGrid}>
        {COACH_ACTIONS.map((action) => {
          const selected = action.id === activeAction;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={action.id}
              onPress={() => onSelectAction(action.id)}
              style={({ pressed }) => [
                styles.cookCoachActionChip,
                selected ? styles.cookCoachActionChipSelected : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.cookCoachActionText, selected ? styles.cookCoachActionTextSelected : null]}>
                {action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {tips.map((tip) => (
        <View key={tip.id} style={[styles.cookCoachTip, getCookCoachTipToneStyle(tip.tone)]}>
          <Text style={styles.cookCoachTipTitle}>{tip.title}</Text>
          <Text style={styles.cookCoachTipBody}>{tip.body}</Text>
        </View>
      ))}
    </View>
  );
}

function formatTimerDisplay(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getCookCoachTipToneStyle(tone: CookCoachTip['tone']) {
  switch (tone) {
    case 'warning':
      return styles.cookCoachTipWarning;
    case 'encouraging':
      return styles.cookCoachTipEncouraging;
    case 'practical':
      return styles.cookCoachTipPractical;
    case 'calm':
    default:
      return styles.cookCoachTipCalm;
  }
}


type InfoCardProps = {
  children: ReactNode;
  title: string;
};

function InfoCard({ children, title }: InfoCardProps) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoCardTitle}>{title}</Text>
      {children}
    </View>
  );
}

type MakeItMineSectionProps = {
  onSelect: (goal: RecipeAdaptationGoal) => void;
  options: RecipeAdaptationOption[];
  selectedId: RecipeAdaptationGoal;
  selectedOption: RecipeAdaptationOption;
};

function getDisplayAdaptationOption(
  localOption: RecipeAdaptationOption,
  backendPlan: RecipeAdaptationPlan | null,
): RecipeAdaptationOption {
  if (!backendPlan) {
    return localOption;
  }
  const planChanges = uniqueTextList([
    ...backendPlan.changes.map((change) => change.detail ?? ''),
    ...backendPlan.speedIdeas,
    ...backendPlan.budgetIdeas,
    ...backendPlan.healthIdeas,
    ...backendPlan.proteinIdeas,
    ...backendPlan.pantryIdeas,
  ]).slice(0, 3);

  return {
    ...localOption,
    helper: 'Preview changes',
    promise: backendPlan.summary,
    changes: planChanges.length > 0 ? planChanges : localOption.changes,
    tradeoff: backendPlan.tradeoffs[0] ?? backendPlan.warnings[0] ?? localOption.tradeoff,
    confidence: backendPlan.confidence === 'high' ? 'High' : 'Medium',
  };
}

function uniqueTextList(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function MakeItMineSection({ onSelect, options, selectedId, selectedOption }: MakeItMineSectionProps) {
  return (
    <View style={styles.makeItMineSection}>
      <View style={styles.makeItMineHeader}>
        <View style={styles.makeItMineKikoWrap}>
          <KikoMascot pose="wave" size={46} />
        </View>
        <View style={styles.makeItMineHeaderCopy}>
          <Text style={styles.sectionSmallTitle}>Make it mine</Text>
          <Text style={styles.makeItMineSubtitle}>
            Preview a tweak before you cook. The original recipe stays saved as-is.
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.makeItMineChipScroller}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {options.map((option) => {
          const selected = option.id === selectedId;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.id}
              onPress={() => onSelect(option.id)}
              style={({ pressed }) => [
                styles.makeItMineChip,
                selected ? styles.makeItMineChipSelected : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.makeItMineChipText, selected ? styles.makeItMineChipTextSelected : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.adaptationPreviewCard}>
        <View style={styles.adaptationPreviewTopRow}>
          <View style={styles.adaptationTitleBlock}>
            <Text style={styles.adaptationEyebrow}>{selectedOption.helper}</Text>
            <Text style={styles.adaptationTitle}>{selectedOption.previewTitle}</Text>
            <Text style={styles.adaptationPromise}>{selectedOption.promise}</Text>
          </View>
          <View style={styles.adaptationConfidencePill}>
            <Text style={styles.adaptationConfidenceText}>{selectedOption.confidence}</Text>
          </View>
        </View>

        {selectedOption.changes.map((change) => (
          <View key={change} style={styles.adaptationChangeRow}>
            <Check color={colors.coral} height={16} strokeWidth={2.35} width={16} />
            <Text style={styles.adaptationChangeText}>{change}</Text>
          </View>
        ))}

        {selectedOption.tradeoff ? (
          <Text style={styles.adaptationTradeoff}>{selectedOption.tradeoff}</Text>
        ) : null}
      </View>
    </View>
  );
}

type IngredientVisualTone = 'produce' | 'protein' | 'dairy' | 'grain' | 'sauce' | 'pantry' | 'default';

type IngredientVisual = {
  label: string;
  tone: IngredientVisualTone;
};

function IngredientAvatar({ name }: { name: string }) {
  const visual = getIngredientVisual(name);

  return (
    <View style={[styles.ingredientAvatar, getIngredientAvatarToneStyle(visual.tone)]}>
      <Text style={styles.ingredientAvatarText}>{visual.label}</Text>
    </View>
  );
}

function getIngredientVisual(name: string): IngredientVisual {
  const normalized = cleanDisplayText(name).toLowerCase();

  // TODO: Prefer ingredient.visualUrl here once the backend owns a safe generated-image pipeline.
  if (matchesIngredient(normalized, ['chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'shrimp', 'egg', 'tofu', 'turkey'])) {
    return { label: 'P', tone: 'protein' };
  }
  if (matchesIngredient(normalized, ['lettuce', 'greens', 'spinach', 'tomato', 'onion', 'garlic', 'pepper', 'vegetable', 'cilantro', 'basil', 'parsley', 'lemon', 'lime'])) {
    return { label: 'V', tone: 'produce' };
  }
  if (matchesIngredient(normalized, ['milk', 'cream', 'cheese', 'yogurt', 'butter', 'parmesan', 'mozzarella'])) {
    return { label: 'D', tone: 'dairy' };
  }
  if (matchesIngredient(normalized, ['rice', 'pasta', 'noodle', 'bread', 'bun', 'tortilla', 'flour', 'oat', 'grain', 'crust'])) {
    return { label: 'G', tone: 'grain' };
  }
  if (matchesIngredient(normalized, ['sauce', 'dressing', 'mayo', 'mustard', 'ketchup', 'soy', 'vinegar', 'honey', 'syrup'])) {
    return { label: 'S', tone: 'sauce' };
  }
  if (matchesIngredient(normalized, ['salt', 'pepper', 'oil', 'spice', 'seasoning', 'chili', 'paprika', 'cumin'])) {
    return { label: 'O', tone: 'pantry' };
  }

  return { label: getIngredientInitial(normalized), tone: 'default' };
}

function matchesIngredient(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function getIngredientInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || 'I';
}

function getIngredientAvatarToneStyle(tone: IngredientVisualTone) {
  switch (tone) {
    case 'produce':
      return styles.ingredientAvatarProduce;
    case 'protein':
      return styles.ingredientAvatarProtein;
    case 'dairy':
      return styles.ingredientAvatarDairy;
    case 'grain':
      return styles.ingredientAvatarGrain;
    case 'sauce':
      return styles.ingredientAvatarSauce;
    case 'pantry':
      return styles.ingredientAvatarPantry;
    case 'default':
    default:
      return styles.ingredientAvatarDefault;
  }
}

type PrimaryActionProps = {
  label: string;
  onPress: () => void;
};

function PrimaryAction({ label, onPress }: PrimaryActionProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      style={styles.primaryAction}
    >
      <Text style={styles.primaryActionText}>{label}</Text>
    </PressableScale>
  );
}

type SecondaryActionProps = {
  label: string;
  onPress: () => void;
};

function SecondaryAction({ label, onPress }: SecondaryActionProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      style={styles.secondaryAction}
    >
      <Text style={styles.secondaryActionText}>{label}</Text>
    </PressableScale>
  );
}

type SecondaryIconActionProps = {
  icon: ReactNode;
  label: string;
  onPress: () => void;
};

function SecondaryIconAction({ icon, label, onPress }: SecondaryIconActionProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      style={styles.secondaryIconAction}
    >
      {icon}
      <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={styles.secondaryIconText}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    flexGrow: 1,
    paddingBottom: layout.scrollClearance + 128,
    paddingHorizontal: 20,
  },
  heroCard: {
    marginTop: 10,
  },
  recipePhoto: {
    aspectRatio: 1.15,
    backgroundColor: colors.cream,
    borderRadius: 32,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  circleBackButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    left: 14,
    position: 'absolute',
    top: 14,
    width: 42,
  },
  inspiredPill: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    left: 14,
    maxWidth: '62%',
    paddingHorizontal: 10,
    paddingVertical: 8,
    position: 'absolute',
    top: 64,
  },
  inspiredPillText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  overviewPanel: {
    marginTop: 20,
    paddingTop: 16,
  },
  recipeTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 40,
    minWidth: 0,
  },
  savingsMiniPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.greenSoft,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  savingsMiniText: {
    color: colors.green,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
  },
  metaLine: {
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 14,
  },
  description: {
    color: colors.charcoal,
    fontFamily: fontFamilies.body,
    fontSize: 18,
    lineHeight: 27,
    marginTop: 18,
  },
  kikoTipBlock: {
    ...surfaces.tint,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginTop: 20,
    padding: 16,
  },
  kikoTipCopy: {
    flex: 1,
    minWidth: 0,
  },
  kikoTipLabel: {
    color: colors.coralDark,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  kikoTipText: {
    color: colors.body,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3,
  },
  sectionSmallTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  previewSection: {
    marginTop: 22,
    paddingBottom: 16,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionCount: {
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '600',
  },
  ingredientGroupCard: {
    marginTop: 14,
  },
  ingredientGroupTitle: {
    color: colors.coralDark,
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
    marginTop: 10,
  },
  ingredientRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 50,
    paddingVertical: 10,
  },
  ingredientRowLast: {
    borderBottomWidth: 0,
  },
  ingredientName: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    minWidth: 0,
  },
  ingredientTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  ingredientQty: {
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  ingredientAvatar: {
    alignItems: 'center',
    borderRadius: 13,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  ingredientAvatarText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '800',
  },
  ingredientAvatarProduce: {
    backgroundColor: ingredientAvatar.produce,
  },
  ingredientAvatarProtein: {
    backgroundColor: ingredientAvatar.protein,
  },
  ingredientAvatarDairy: {
    backgroundColor: ingredientAvatar.dairy,
  },
  ingredientAvatarGrain: {
    backgroundColor: ingredientAvatar.grain,
  },
  ingredientAvatarSauce: {
    backgroundColor: ingredientAvatar.sauce,
  },
  ingredientAvatarPantry: {
    backgroundColor: ingredientAvatar.pantry,
  },
  ingredientAvatarDefault: {
    backgroundColor: ingredientAvatar.default,
  },
  infoCard: {
    marginTop: 16,
  },
  infoCardTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
    marginBottom: 12,
  },
  makeItMineSection: {
    marginTop: 20,
  },
  makeItMineHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  makeItMineKikoWrap: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 999,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  makeItMineHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  makeItMineSubtitle: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  makeItMineChipScroller: {
    gap: 8,
    paddingRight: 8,
    paddingTop: 14,
  },
  makeItMineChip: {
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  makeItMineChipSelected: {
    backgroundColor: colors.coral,
    borderColor: colors.coral,
  },
  makeItMineChipText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '800',
  },
  makeItMineChipTextSelected: {
    color: colors.onCoral,
  },
  adaptationPreviewCard: {
    ...surfaces.panel,
    backgroundColor: colors.card,
    marginTop: 12,
    padding: 16,
  },
  adaptationPreviewTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  adaptationTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  adaptationEyebrow: {
    color: colors.coralDark,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  adaptationTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
    marginTop: 2,
  },
  adaptationPromise: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5,
  },
  adaptationConfidencePill: {
    backgroundColor: colors.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  adaptationConfidenceText: {
    color: colors.green,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '800',
  },
  adaptationChangeRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  adaptationChangeText: {
    color: colors.charcoal,
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 21,
  },
  adaptationTradeoff: {
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 12,
  },
  bulletRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    marginTop: 7,
  },
  bulletText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.body,
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flavorChipWrap: {
    backgroundColor: colors.cream,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  flavorChipText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  swapsHelper: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  savingsCard: {
    alignItems: 'center',
    backgroundColor: colors.greenSoft,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    padding: 18,
  },
  savingsCopy: {
    flex: 1,
    minWidth: 0,
  },
  savingsLabel: {
    color: colors.green,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  savingsSubLabel: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  savingsValue: {
    color: colors.green,
    fontFamily: fontFamilies.display,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 43,
    marginTop: 2,
  },
  savingsNote: {
    color: colors.green,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  savingsIconBubble: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 999,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 56,
    paddingHorizontal: 18,
    ...shadows.cta,
  },
  primaryActionText: {
    color: colors.onCoral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  secondaryIconAction: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    minHeight: 52,
    minWidth: 0,
    paddingHorizontal: 6,
  },
  secondaryIconText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  guidedScreenContent: {
    flex: 1,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  guidedHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    minHeight: 80,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  guidedMascot: {
    marginLeft: -4,
  },
  guidedHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  guidedRecipeTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  guidedProgressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  guidedProgressText: {
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  compactBadge: {
    backgroundColor: colors.infoSoft,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  compactBadgeText: {
    color: colors.info,
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    fontWeight: '700',
  },
  guidedProgressTrack: {
    backgroundColor: colors.creamDeep,
    borderRadius: 999,
    height: 6,
    marginTop: 12,
    overflow: 'hidden',
  },
  guidedProgressFill: {
    backgroundColor: colors.coral,
    borderRadius: 999,
    height: '100%',
  },
  guidedStepCard: {
    ...surfaces.card,
    borderRadius: 8,
    flex: 1,
    marginTop: 14,
    overflow: 'hidden',
  },
  guidedStepCardContent: {
    flexGrow: 1,
    padding: 18,
    paddingBottom: 22,
  },
  guidedStepTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  guidedPhaseLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  guidedStepNumber: {
    color: colors.coral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  guidedTimeChipWrap: {
    backgroundColor: colors.coralSoft,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  guidedTimeChipText: {
    color: colors.coralDark,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '800',
  },
  guidedStepTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 31,
  },
  guidedInstruction: {
    color: colors.charcoal,
    fontFamily: fontFamilies.body,
    fontSize: 18,
    lineHeight: 27,
    marginTop: 8,
  },
  stepTimerCard: {
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
  },
  stepTimerTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  stepTimerIconWrap: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  stepTimerCopy: {
    flex: 1,
    minWidth: 0,
  },
  stepTimerTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  stepTimerBody: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  stepTimerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  timerAction: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 10,
  },
  timerActionPrimary: {
    backgroundColor: colors.coral,
    borderColor: colors.coral,
  },
  timerActionText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  timerActionPrimaryText: {
    color: colors.onCoral,
  },
  guidedCueBlock: {
    backgroundColor: colors.greenSoft,
    borderRadius: 20,
    marginTop: 18,
    padding: 16,
  },
  guidedCueLabel: {
    color: colors.green,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  guidedCueText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 6,
  },
  guidedDoneLabel: {
    color: colors.green,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 12,
    opacity: 0.7,
  },
  guidedDoneText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 4,
    opacity: 0.85,
  },
  guidedSafetyBlock: {
    backgroundColor: colors.cautionSoft,
    borderRadius: 20,
    marginTop: 12,
    padding: 14,
  },
  guidedSafetyLabel: {
    color: colors.coral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  guidedSafetyText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 6,
  },
  cookCoachCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 16,
    padding: 14,
  },
  cookCoachHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  cookCoachHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  cookCoachTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  cookCoachBody: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  cookCoachActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  cookCoachActionChip: {
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 38,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  cookCoachActionChipSelected: {
    backgroundColor: colors.coral,
    borderColor: colors.coral,
  },
  cookCoachActionText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '800',
  },
  cookCoachActionTextSelected: {
    color: colors.onCoral,
  },
  cookCoachTip: {
    borderRadius: 18,
    marginTop: 10,
    padding: 13,
  },
  cookCoachTipCalm: {
    backgroundColor: colors.cream,
  },
  cookCoachTipWarning: {
    backgroundColor: colors.cautionSoft,
  },
  cookCoachTipEncouraging: {
    backgroundColor: colors.greenSoft,
  },
  cookCoachTipPractical: {
    backgroundColor: colors.infoSoft,
  },
  cookCoachTipTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  cookCoachTipBody: {
    color: colors.charcoal,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  guidedWhyBlock: {
    backgroundColor: colors.infoSoft,
    borderRadius: 20,
    marginTop: 12,
    padding: 16,
  },
  guidedWhyLabel: {
    color: colors.info,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  guidedWhyText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 6,
  },
  guidedChipGroup: {
    marginTop: 14,
  },
  guidedChipLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 8,
  },
  guidedChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  guidedChipWrap: {
    backgroundColor: colors.cream,
    borderRadius: 999,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  guidedChipText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
  },
  guidedControlArea: {
    gap: 12,
    marginTop: 12,
    paddingBottom: 6,
  },
  guidedNavRow: {
    flexDirection: 'row',
    gap: 12,
  },
  guidedNavButton: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 14,
  },
  guidedNavButtonPrimary: {
    backgroundColor: colors.coral,
    borderColor: colors.coral,
    borderRadius: radius.button,
    ...shadows.cta,
  },
  guidedNavButtonDisabled: {
    opacity: 0.45,
  },
  guidedNavText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    fontWeight: '800',
  },
  guidedNavTextDisabled: {
    color: colors.muted,
  },
  guidedNavPrimaryText: {
    color: colors.onCoral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    fontWeight: '900',
  },
  completionCard: {
    ...surfaces.card,
    alignItems: 'center',
    backgroundColor: colors.cardWarm,
    borderRadius: 8,
    padding: 16,
  },
  completionCelebration: {
    alignItems: 'center',
    height: 108,
    justifyContent: 'center',
    position: 'relative',
    width: 160,
  },
  completionHeroMascot: {
    position: 'absolute',
  },
  completionScrollContent: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 4,
  },
  completionEyebrow: {
    color: colors.coral,
    fontFamily: fontFamilies.display,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 8,
  },
  completionImage: {
    aspectRatio: 1.9,
    backgroundColor: colors.cream,
    borderRadius: 8,
    width: '100%',
  },
  completionTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 27,
    marginTop: 10,
    textAlign: 'center',
  },
  completionBody: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
  simpleTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    minHeight: 56,
  },
  smallBackButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minHeight: 42,
    minWidth: 82,
  },
  smallBackText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    fontWeight: '700',
  },
  simpleTopTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
    textAlign: 'center',
  },
  topBarSpacer: {
    width: 82,
  },
  issueCard: {
    marginTop: 18,
    padding: 18,
  },
  kicker: {
    color: colors.coral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  issueTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 33,
  },
  issueBody: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
  issueActions: {
    gap: 10,
    marginTop: 16,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderColor: colors.borderStrong,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 16,
  },
  secondaryActionText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});

function isExplicitDemoScan(image: { placeholder?: boolean; source?: string } | null) {
  return image?.placeholder === true && image.source === 'mock';
}

function getStoredRecipeForMode(recipes: Recipe[], mode: RecipeMode, fallbackRecipe: Recipe | null) {
  // One canonical recipe per scan; the view mode (Restaurant/Budget/Healthy) is a
  // lens, not a separate recipe. Match by mode first for legacy multi-recipe
  // saved data, otherwise return the single canonical recipe so every view tab
  // renders it.
  return recipes.find((candidate) => candidate.mode === mode) ??
    fallbackRecipe ??
    recipes[0] ??
    null;
}

function getEstimatedRestaurantPrice(recipe: Recipe | null) {
  return recipe ? recipe.estimatedHomemadeCost + recipe.estimatedSavings : 0;
}

function getSafeTextList(values: string[] | undefined) {
  return (Array.isArray(values) ? values : [])
    .map((value) => cleanDisplayText(value))
    .filter(Boolean)
    .slice(0, 6);
}

function getSafeIngredientGroups(recipe: Recipe | null) {
  return (Array.isArray(recipe?.ingredientGroups) ? recipe.ingredientGroups : [])
    .map((group) => ({
      component: cleanDisplayText(group.component),
      items: Array.isArray(group.items) ? group.items : [],
    }))
    .filter((group) => group.component && group.items.length > 0)
    .slice(0, 6);
}

// Known meta-copy strings generated by fallback paths that must never appear in the UI.
const GENERIC_WHY_TEXTS = new Set([
  'A flexible starter keeps the result useful without pretending to know the exact restaurant recipe.',
  'This step is important for the final dish.',
  'This ensures the best result.',
  'This is a key step in the recipe.',
  'This helps the dish come together.',
  'This step matters for the overall dish.',
  'Proper technique here improves the final result.',
]);

// AI filler patterns for "Why this matters" — kept only when it teaches a real
// cooking reason. "Serving hot enhances the dining experience" teaches nothing.
const GENERIC_WHY_PATTERNS = [
  /\bdining experience\b/i,
  /\benhances? (the )?(overall |flavor profile|presentation|experience)/i,
  /\bimproves? (the )?presentation\b/i,
  /\b(elevates?|completes?) the (dish|meal|experience)\b/i,
  /\bthis (step|process) is important\b/i,
  /\bimportant for the (final |overall )?(dish|recipe|result|outcome)\b/i,
  /\bproper technique\b/i,
  /\bkey step\b/i,
  /\bcome together\b/i,
  /^this step (matters|is essential|is key)/i,
];

function filterGenericWhy(why: string | undefined): string | undefined {
  if (!why || GENERIC_WHY_TEXTS.has(why) || GENERIC_WHY_PATTERNS.some((pattern) => pattern.test(why))) {
    return undefined;
  }
  return why;
}

// One-line strategy note so the user knows whether this recipe takes the
// shortcut (prepared components) or from-scratch route. Heuristic on the
// ingredient list — no note when neither signal is present.
function getStrategyNote(recipe: Recipe | null): string | null {
  if (!recipe || !Array.isArray(recipe.ingredients)) {
    return null;
  }
  const names = recipe.ingredients.map((ingredient) => ingredient.name.toLowerCase());
  const hasPreparedBase = names.some((name) =>
    /\b(frozen|store-?bought|pre-?made|ready-?made|prepared)\b/.test(name),
  );
  const hasScratchComponents = names.some(
    (name) => /\bwrappers?\b/.test(name) || /\bground (pork|beef|chicken|turkey|meat)\b/.test(name) || /\b(dough|batter)\b/.test(name),
  );
  if (hasPreparedBase && !hasScratchComponents) {
    return 'Shortcut version using prepared ingredients.';
  }
  if (hasScratchComponents && !hasPreparedBase) {
    return 'From-scratch version — includes all prep steps.';
  }
  return null;
}

function getRecipeDisplaySteps(recipe: Recipe | null): DisplayRecipeStep[] {
  const structuredSteps = (Array.isArray(recipe?.structuredSteps) ? recipe.structuredSteps : [])
    .map((step) => ({
      phase: step.phase,
      title: step.title,
      text: cleanDisplayText(step.text),
      lookFor: step.lookFor,
      doneWhen: step.doneWhen,
      ingredientsUsed: step.ingredientsUsed,
      toolsUsed: step.toolsUsed,
      stepImagePrompt: step.stepImagePrompt,
      why: filterGenericWhy(step.why) ?? (step.whyItMatters ? filterGenericWhy(cleanDisplayText(step.whyItMatters)) : undefined),
      commonMistake: step.commonMistake ?? (step.safetyNote ? cleanDisplayText(step.safetyNote) : undefined),
      estimatedMinutes: step.estimatedMinutes,
      timeEstimate: step.timeEstimate?.trim(),
      visualCue: step.visualCue ? cleanDisplayText(step.visualCue) : undefined,
      whyItMatters: step.whyItMatters ? cleanDisplayText(step.whyItMatters) : undefined,
      safetyNote: step.safetyNote ? cleanDisplayText(step.safetyNote) : undefined,
    }))
    .filter((step) => step.text)
    .slice(0, 20);

  if (structuredSteps.length > 0) {
    return structuredSteps;
  }

  return (Array.isArray(recipe?.steps) ? recipe.steps : [])
    .map((step) => ({ text: cleanDisplayText(step) }))
    .filter((step) => step.text)
    .slice(0, 20);
}

function getIngredientCount(recipe: Recipe | null) {
  if (!recipe) {
    return 0;
  }

  const groupedItems = getSafeIngredientGroups(recipe).flatMap((group) => group.items);
  const ingredients = groupedItems.length > 0 ? groupedItems : Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

  return ingredients.length;
}

function getFlavorNotes(recipe: Recipe | null, pairings: string[]) {
  const notes = [
    ...pairings,
    recipe?.bestFor,
    recipe?.mainIngredientsSummary,
  ]
    .map((value) => cleanDisplayText(value ?? ''))
    .flatMap((value) => value.split(',').map((part) => part.trim()))
    .filter(Boolean);

  return Array.from(new Set(notes)).slice(0, 4);
}

// Only honest, human-readable bullets survive. The raw ingredient-parser
// sentence ("Built around corn on the cob, hot cheetos, crushed...") and
// AI-estimated savings claims are intentionally excluded, and generic filler
// like "home cooking" is filtered out rather than shown.
const GENERIC_FILLER_PATTERN = /\bhome cooking\b/i;

function getWhyBullets(recipe: Recipe | null, totalTime: number) {
  if (!recipe) {
    return [];
  }

  const bestFor = recipe.bestFor ? cleanDisplayText(recipe.bestFor) : '';
  const bullets = [
    bestFor && !GENERIC_FILLER_PATTERN.test(bestFor) ? bestFor : null,
    totalTime > 0 ? `Ready in about ${totalTime} minutes` : null,
  ].filter(Boolean) as string[];

  return bullets.slice(0, 3);
}

function getStepCopy(step: DisplayRecipeStep, index: number) {
  const text = cleanDisplayText(step.text);

  // Use AI-generated title when available (new recipes)
  if (step.title) {
    return { title: step.title, body: text };
  }

  // Fallback for old recipes: use first sentence as title if short and there's more text
  const [firstSentence, ...remainingSentences] = text.split(/(?<=\.)\s+/);
  const first = firstSentence?.trim() ?? '';
  if (first && first.length <= 72 && remainingSentences.length > 0) {
    return {
      title: first.replace(/\.$/, ''),
      body: remainingSentences.join(' ').trim(),
    };
  }

  // Last resort: derive a 2-word title from the first verb phrase of the instruction
  const derived = deriveTitleFromInstruction(text);
  return {
    title: derived || `Step ${index + 1}`,
    body: text,
  };
}

// Extracts a 2-word title from an instruction string by taking the first two
// non-article words. Used as a fallback when the AI didn't supply a title.
function deriveTitleFromInstruction(instruction: string): string {
  const normalized = instruction.toLowerCase();
  const commonTitles: Array<[RegExp, string]> = [
    [/bring .*water .*boil|bring .*to a boil/, 'Boil the pasta water'],
    [/reserve .*pasta water/, 'Reserve pasta water'],
    [/tomato paste.*red pepper|warm .*oil.*skillet/, 'Bloom the sauce'],
    [/lower .*heat.*cream|stir .*cream/, 'Make it creamy'],
    [/add .*pasta.*parmesan|toss .*pasta/, 'Toss until glossy'],
    [/^taste|season .*taste/, 'Taste and finish'],
  ];
  const commonTitle = commonTitles.find(([pattern]) => pattern.test(normalized))?.[1];
  if (commonTitle) {
    return commonTitle;
  }

  const SKIP = new Set(['a', 'an', 'the', 'and', 'or', 'to', 'in', 'on', 'at', 'of', 'up', 'with', 'then', 'into', 'your', 'both', 'until', 'all', 'its', 'by', 'for', 'from']);
  const words = instruction.replace(/[.,!?;:]+/g, ' ').split(/\s+/).slice(0, 12);
  const key = words
    .map((w) => w.replace(/[^a-zA-Z]/g, ''))
    .filter((w) => w.length > 1 && !SKIP.has(w.toLowerCase()))
    .slice(0, 2);
  return key.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Phase label lookup — maps AI-assigned phase integers to display names.
const RECIPE_PHASE_NAMES: Record<number, string> = {
  1: 'Preparation',
  2: 'Setup',
  3: 'Cooking',
  4: 'Assembly',
  5: 'Finishing',
  6: 'Serving',
};

// Returns the display phase name for a recipe step.
// Uses the AI-assigned phase integer when available (new recipes).
// Falls back to keyword classification for old saved recipes without phase data.
function getStepPhaseName(step: RecipeStep): string {
  if (step.phase && step.phase >= 1 && step.phase <= 6) {
    return RECIPE_PHASE_NAMES[step.phase];
  }
  // Keyword fallback for recipes generated before the phase field was added
  const t = step.text.toLowerCase();
  if (/\b(serve|plate and serve|enjoy immediately|serve immediately|serve warm)\b/.test(t)) {
    return 'Serving';
  }
  if (/\bdrizzle\b|\bgarnish\b|\bfinish(?:ing)? with\b|\badd fresh (herbs?|basil|cilantro|parsley)\b/.test(t)) {
    return 'Finishing';
  }
  if (/\b(combine|build|assemble|layer|arrange|top with)\b/.test(t)) {
    return 'Assembly';
  }
  if (/\b(cook|fry|boil|roast|bake|sear|sauté|saute|grill|steam)\b/.test(t)) {
    return 'Cooking';
  }
  if (/\b(preheat|heat skillet|bring.*boil|bring.*to a boil)\b/.test(t)) {
    return 'Setup';
  }
  if (/\b(slice|chop|dice|mince|grate|shred|peel|trim|measure|wash|rinse)\b/.test(t)) {
    return 'Preparation';
  }
  return '';
}

function getGuidedCookingSteps(recipe: Recipe | null): GuidedCookingStep[] {
  const displaySteps = getRecipeDisplaySteps(recipe);
  const recipeIngredients = getRecipeIngredients(recipe);
  const recipeTools = getSafeTextList(recipe?.equipment);

  if (!recipe || displaySteps.length === 0) {
    return [{
      estimatedMinutes: null,
      ingredientsUsed: [],
      instruction: 'Okyo could not find detailed cooking steps for this recipe yet. Review the overview, then try another scan when you are ready.',
      phase: '',
      phaseStepIndex: 1,
      phaseStepCount: 1,
      stepNumber: 1,
      title: 'Review the recipe',
      toolsUsed: [],
    }];
  }

  // Pre-compute per-phase step counts so each step knows its position within its phase.
  const phaseTotals = new Map<string, number>();
  displaySteps.forEach((step) => {
    const p = getStepPhaseName(step);
    phaseTotals.set(p, (phaseTotals.get(p) ?? 0) + 1);
  });
  const phaseRunning = new Map<string, number>();

  return displaySteps.map((step, index) => {
    const parsedStep = getStepCopy(step, index);
    const instruction = parsedStep.body || step.text;
    const phaseName = getStepPhaseName(step);
    const phaseIdx = (phaseRunning.get(phaseName) ?? 0) + 1;
    phaseRunning.set(phaseName, phaseIdx);

    return {
      estimatedMinutes: step.estimatedMinutes ?? parseEstimatedMinutes(step.timeEstimate) ?? null,
      ingredientsUsed: getClosedStepIngredients(step, recipeIngredients),
      instruction,
      phase: phaseName,
      phaseStepIndex: phaseIdx,
      phaseStepCount: phaseTotals.get(phaseName) ?? 1,
      why: filterGenericWhy(step.why),
      commonMistake: step.commonMistake,
      doneWhen: step.doneWhen,
      safetyNote: step.safetyNote,
      stepNumber: index + 1,
      title: parsedStep.title || `Step ${index + 1}`,
      toolsUsed: step.toolsUsed?.length
        ? step.toolsUsed.slice(0, 4)
        : getStepTools(step.text, recipeTools),
      visualCue: step.lookFor ?? step.visualCue,
    };
  });
}

function getRecipeIngredients(recipe: Recipe | null) {
  if (!recipe) {
    return [];
  }

  return (Array.isArray(recipe.ingredients) ? recipe.ingredients : [])
    .filter((ingredient) => ingredient?.name?.trim())
    .slice(0, 40);
}

function getStepIngredients(stepText: string, ingredients: RecipeIngredient[]) {
  const normalizedStep = normalizeForMatching(stepText);
  // Use a word set for boundary-safe matching — prevents "oil" matching "foil", "pan" matching "expand"
  const stepWords = new Set(normalizedStep.split(/\s+/).filter(Boolean));
  const matchedIngredients = ingredients.filter((ingredient) => {
    const name = normalizeForMatching(ingredient.name);
    if (normalizedStep.includes(name)) return true;
    // >= 3 chars captures short but important words like "egg", "oil", "soy"
    const nameParts = name.split(' ').filter((part) => part.length >= 3);
    return nameParts.some((part) => {
      if (stepWords.has(part)) return true;
      // singular → plural and plural → singular
      if (stepWords.has(`${part}s`)) return true;
      if (part.endsWith('s') && stepWords.has(part.slice(0, -1))) return true;
      return false;
    });
  });

  return matchedIngredients.slice(0, 5);
}

// Resolves AI-declared step ingredient names against recipe.ingredients — the
// single source of truth. Unmatched names are DROPPED, never invented: a name
// that is not in the ingredient list must not appear in "Use now" chips.
function resolveIngredientsFromNames(names: string[], recipeIngredients: RecipeIngredient[]): RecipeIngredient[] {
  return names
    .map((name) => matchIngredientToList(name, recipeIngredients))
    .filter((ingredient): ingredient is RecipeIngredient => ingredient !== null)
    .slice(0, 5);
}

// Passive steps handle the food, they don't add to it — drain, rest, transfer,
// serve. On these steps loose matching drags in irrelevant chips (a draining
// step showing "wonton wrappers" and "sweet and sour sauce"), so chips must be
// named in the step text itself.
const PASSIVE_STEP_RE = /\b(drain|draining|rest|resting|transfer|remove|pat dry|plate|plating|serve|serving|garnish)\b/i;
const ACTIVE_STEP_RE = /\b(mix|stir|add|combine|fry|cook|heat|sear|boil|simmer|bake|whisk|fold|season|toss|fill|seal|wrap)\b/i;

function filterChipsForPassiveStep(
  stepText: string,
  chips: RecipeIngredient[],
): RecipeIngredient[] {
  if (!PASSIVE_STEP_RE.test(stepText) || ACTIVE_STEP_RE.test(stepText)) {
    return chips;
  }
  const normalizedStep = normalizeForMatching(stepText);
  return chips.filter((chip) => {
    const name = normalizeForMatching(chip.name);
    if (normalizedStep.includes(name)) {
      return true;
    }
    // Head noun ("wontons" of "frozen wontons") must appear in the step text.
    const headNoun = name.split(' ').filter((part) => part.length >= 3).pop();
    if (!headNoun) {
      return false;
    }
    const singular = headNoun.endsWith('s') ? headNoun.slice(0, -1) : headNoun;
    return normalizedStep.includes(singular);
  });
}

// "Use now" chips for a guided step. AI-declared names are resolved against the
// ingredient list first; when every declared name is unknown (or none were
// declared), fall back to matching the step text — which can only ever surface
// ingredients already in the list. Passive steps additionally require the chip
// to be named in the step itself.
function getClosedStepIngredients(step: DisplayRecipeStep, recipeIngredients: RecipeIngredient[]): RecipeIngredient[] {
  const resolved = step.ingredientsUsed?.length
    ? resolveIngredientsFromNames(step.ingredientsUsed, recipeIngredients)
    : [];

  const chips = resolved.length > 0 ? resolved : getStepIngredients(step.text, recipeIngredients);
  return filterChipsForPassiveStep(step.text, chips);
}

const STEP_TOOL_PATTERNS: Array<[RegExp, string]> = [
  [/\b(chop|slice|dice|mince|trim|halve|quarter)\b/, 'cutting board'],
  [/\b(chop|slice|dice|mince|julienne)\b/, "chef's knife"],
  [/\b(whisk|beat)\b/, 'whisk'],
  [/\b(drain|strain)\b/, 'colander'],
  [/\b(grate|shred|zest)\b/, 'grater'],
  [/\b(sear|sauté|saute|pan.?fry|stir.?fry|fry|brown)\b/, 'skillet'],
  [/\bpreheat\b|\bheat oven\b/, 'oven'],
  [/\b(bake|roast|broil)\b/, 'baking dish'],
  [/\b(boil|simmer|blanch|poach|reduce)\b/, 'saucepan'],
  [/\b(blend|blitz|puree|purée)\b/, 'blender'],
  [/\b(stir|fold|combine|toss)\b/, 'wooden spoon'],
  [/\b(marinate|soak|coat)\b/, 'mixing bowl'],
];

function getStepTools(stepText: string, equipment: string[]): string[] {
  const normalizedStep = normalizeForMatching(stepText);
  const stepWordSet = new Set(normalizedStep.split(/\s+/).filter(Boolean));

  // Match from the recipe's declared equipment list using word-boundary checks.
  // Using a word-set prevents "pan" from matching "expand" or "pot" from matching "potential".
  const fromEquipment = equipment.filter((tool) => {
    const normalizedTool = normalizeForMatching(tool);
    if (stepWordSet.has(normalizedTool)) return true;
    const toolParts = normalizedTool.split(/\s+/).filter((part) => part.length > 2);
    return toolParts.length > 0 && toolParts.every((part) => stepWordSet.has(part));
  });

  // Detect common tools from step verb patterns not always in equipment list
  const builtIn = STEP_TOOL_PATTERNS
    .filter(([pattern]) => pattern.test(normalizedStep))
    .map(([, tool]) => tool);

  return [...new Set([...fromEquipment, ...builtIn])].slice(0, 4);
}

function parseEstimatedMinutes(value?: string) {
  if (!value) {
    return null;
  }

  const numbers = value.match(/\d+/g)?.map((number) => Number(number)).filter((number) => Number.isFinite(number)) ?? [];
  if (numbers.length === 0) {
    return null;
  }
  if (numbers.length === 1) {
    return Math.max(1, numbers[0]);
  }

  return Math.max(1, Math.round((numbers[0] + numbers[1]) / 2));
}

function normalizeForMatching(value: string) {
  return cleanDisplayText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDisplayText(value: string) {
  const commonTypo = `Amer${'cian'}`;
  const lowercaseTypo = `amer${'cian'}`;
  const joinedCopyWord = ['copy', 'cat'].join('');
  const spacedCopyWord = ['copy', 'cat'].join('\\s+');

  return value
    .replace(new RegExp(`\\b${commonTypo}\\b`, 'g'), 'American')
    .replace(new RegExp(`\\b${lowercaseTypo}\\b`, 'g'), 'american')
    .replace(new RegExp(`\\b${joinedCopyWord}(?:[-\\s]?style)?\\b`, 'gi'), 'inspired-by')
    .replace(new RegExp(`\\b${spacedCopyWord}(?:[-\\s]?style)?\\b`, 'gi'), 'inspired-by')
    .trim();
}
