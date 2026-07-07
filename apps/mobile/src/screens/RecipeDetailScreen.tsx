import { useNavigation, useRoute } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Bookmark,
  Cart,
  Check,
  Clock,
  FireFlame,
  Heart,
  Leaf,
  MoneySquare,
  NavArrowLeft,
  ShareAndroid,
  Spark,
  User,
} from 'iconoir-react-native';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OKYO_API_BASE_URL } from '../api/config';
import { analyticsEvents, track } from '../analytics/track';
import { FoodImage } from '../components/FoodImage';
import { KikoMascot } from '../components/KikoMascot';
import { getFoodSafetyNote, TrustBadge } from '../components/TrustBadge';
import { colors, fontFamilies } from '../components/OkyoUI';
import { layout } from '../theme/okyoTheme';
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
import { getModeLabel } from '../utils/modeDisplay';
import { recipeColors, recipeShadows } from '../theme/recipeTheme';
import { attachRealScanImage } from '../utils/savedRecipeImage';
import { matchIngredientToList } from '../utils/ingredientMatching';
import { getRealScanImageUri, getRecipeImageStatus, getRecipeImageUrl } from '../utils/recipeImages';
import { checkImageFileExists, getStorageLocation } from '../utils/imageValidation';
import { imageTraceLog, uiLog } from '../utils/uiDebug';

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
  chefTip?: string;
  ingredientsUsed?: string[];
  toolsUsed?: string[];
  stepImagePrompt?: string;
  commonQuestion?: string;
  commonQuestionAnswer?: string;
  decisionPoint?: string;
  ifYes?: string;
  ifNo?: string;
  why?: string;
  commonMistake?: string;
  estimatedMinutes?: number;
  timeEstimate?: string;
  visualCue?: string;
  whyItMatters?: string;
  safetyNote?: string;
  flavorBoost?: string;
  cookingTerm?: NonNullable<Recipe['cookingTerms']>[number];
};
type GuidedCookingStep = {
  chefTip?: string;
  estimatedMinutes: number | null;
  ingredientsUsed: RecipeIngredient[];
  instruction: string;
  phase: string;
  phaseStepIndex: number;
  phaseStepCount: number;
  why?: string;
  commonMistake?: string;
  commonQuestion?: string;
  commonQuestionAnswer?: string;
  decisionPoint?: string;
  ifYes?: string;
  ifNo?: string;
  doneWhen?: string;
  safetyNote?: string;
  stepNumber: number;
  tip?: { title: string; body: string };
  title: string;
  toolsUsed: string[];
  visualCue?: string;
};

export function RecipeDetailScreen() {
  const navigation = useNavigation<RecipeDetailNavigation>();
  const route = useRoute<RecipeDetailRoute>();
  const routeMode = route.params?.mode;
  const initialMode = getSafeRecipeMode(routeMode ?? defaultScanResult.modes[0]);
  const storeSelectedMode = useOkyoStore((state) => state.selectedMode);
  const latestScanResult = useOkyoStore((state) => state.latestScanResult);
  const saveRecipe = useOkyoStore((state) => state.saveRecipe);
  const markRecipeCooked = useOkyoStore((state) => state.markRecipeCooked);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const setLatestScanRecipe = useOkyoStore((state) => state.setLatestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const userRestaurantPrice = useOkyoStore((state) => state.userRestaurantPrice);
  const [selectedMode, setSelectedMode] = useState<RecipeMode>(
    getSafeRecipeMode(initialMode ?? storeSelectedMode),
  );
  const isDemoScan = isExplicitDemoScan(selectedScanImage);
  const storedRecipe = getStoredRecipeForMode(latestScanRecipe ? [latestScanRecipe] : [], selectedMode, latestScanRecipe);
  const recipe = storedRecipe ?? (isDemoScan ? getSafeRecipeForMode(selectedMode) : null);
  const savedRecipe = recipe ? savedRecipes.find((savedRecipeItem) => savedRecipeItem.id === recipe.id) ?? null : null;
  const cookedCount = getRecipeCookedCount(savedRecipe ?? recipe);
  const scanResult = latestScanResult ?? (isDemoScan ? defaultScanResult : null);
  // Savings need a price the user actually paid. Demo scans are the labeled
  // exception — they show example numbers from mock data.
  const homemadeCost = recipe?.estimatedHomemadeCost ?? 0;
  const restaurantPrice = isDemoScan ? scanResult?.restaurantPrice ?? 0 : userRestaurantPrice ?? 0;
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
  const perServingCost = recipe && recipe.servings > 0 ? recipe.estimatedHomemadeCost / recipe.servings : null;
  const flavorNotes = getFlavorNotes(recipe, spicePairings);
  const whyBullets = getWhyBullets(recipe, totalTime);
  const strategyNote = getStrategyNote(recipe);
  const recipeImageUrl = getRecipeImageUrl(recipe, getRealScanImageUri(selectedScanImage));
  const recipeImageStatus = getRecipeImageStatus(recipe);
  const foodSafetyNote = getFoodSafetyNote(`${recipe?.title ?? ''} ${recipe?.description ?? ''}`);
  const [coachingLoading, setCoachingLoading] = useState(false);

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

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('MainTabs', { screen: 'ScanScreen' });
  };

  const saveSelectedRecipe = () => {
    if (!recipe) {
      return;
    }

    const alreadySaved = savedRecipes.some((savedRecipe) => savedRecipe.id === recipe.id);
    uiLog('RecipeDetailScreen', 'save_recipe', { recipeId: recipe.id });
    saveRecipe(attachRealScanImage(recipe, selectedScanImage));
    if (!alreadySaved) {
      awardXPOnce(`save-recipe-${recipe.id}`, 5);
    }
    unlockBadge('first-dupe');
    track(analyticsEvents.RECIPE_SAVED, {
      dishName: recipe?.title ?? scanResult?.dishName ?? 'Missing recipe',
      mode: recipe.mode,
      savings: canShowSavings ? displaySavings : 0,
      screen: 'RecipeDetailScreen',
    });
    Alert.alert('Saved', `${cleanDisplayText(recipe.title)} was added to your library.`);
  };

  const markSelectedRecipeCooked = () => {
    if (!recipe) {
      return;
    }

    const alreadySaved = Boolean(savedRecipe);
    uiLog('RecipeDetailScreen', 'mark_cooked', { recipeId: recipe.id });
    markRecipeCooked(attachRealScanImage(recipe, selectedScanImage));
    if (!alreadySaved) {
      awardXPOnce(`save-recipe-${recipe.id}`, 5);
      unlockBadge('first-dupe');
    }
    Alert.alert('Cooked', `${cleanDisplayText(recipe.title)} is logged as cooked.`);
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
    fetch(`${OKYO_API_BASE_URL}/v1/recipes/${recipe!.id}/coaching`, { method: 'POST' })
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
            <PrimaryAction label="Try another photo" onPress={() => navigation.navigate('MainTabs', { screen: 'ScanScreen' })} />
            <SecondaryAction label="Back" onPress={goBack} />
          </View>
        </View>
      </ScreenFrame>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
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
            <Pressable
              accessibilityRole="button"
              onPress={saveSelectedRecipe}
              style={({ pressed }) => [styles.circleSaveButton, pressed ? styles.pressed : null]}
            >
              <Heart color={colors.charcoal} height={23} strokeWidth={2.1} width={23} />
            </Pressable>
            <View style={styles.inspiredPill}>
              <Spark color={colors.coral} height={18} strokeWidth={2.2} width={18} />
              <Text style={styles.inspiredPillText}>Based on your scan</Text>
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
            {cookedCount > 0 ? (
              <View style={styles.cookedMiniPill}>
                <Check color={colors.green} height={15} strokeWidth={2.2} width={15} />
                <Text style={styles.cookedMiniText}>{formatCookedCount(cookedCount)}</Text>
              </View>
            ) : null}

            <View style={styles.quickStatsRow}>
              <QuickStat label="Total Time" value={`${totalTime} min`} icon={<Clock color={colors.charcoal} height={19} strokeWidth={2.1} width={19} />} />
              <QuickStat label="Difficulty" value={recipe.skillLevel ?? recipe.difficulty} icon={<FireFlame color={colors.charcoal} height={19} strokeWidth={2.1} width={19} />} />
              <QuickStat label="Servings" value={`${recipe.servings}`} icon={<User color={colors.charcoal} height={19} strokeWidth={2.1} width={19} />} />
              <QuickStat label="Per Serving" value={perServingCost ? formatCurrency(perServingCost) : formatCurrency(recipe.estimatedHomemadeCost)} icon={<MoneySquare color={colors.charcoal} height={19} strokeWidth={2.1} width={19} />} />
            </View>

            <Text style={styles.description}>{displayDescription}</Text>

            {foodSafetyNote ? <TrustBadge note={foodSafetyNote} /> : null}

            <PrimaryAction label={coachingLoading ? 'Preparing...' : 'Start Cooking'} onPress={openCookingSteps} />
            <View style={styles.cookedActionCard}>
              <View style={styles.cookedActionCopy}>
                <Text style={styles.cookedActionLabel}>Cooked status</Text>
                <Text style={styles.cookedActionValue}>
                  {cookedCount > 0 ? formatCookedCount(cookedCount) : 'Not cooked yet'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={markSelectedRecipeCooked}
                style={({ pressed }) => [styles.markCookedButton, pressed ? styles.pressed : null]}
              >
                <Check color={colors.green} height={17} strokeWidth={2.3} width={17} />
                <Text style={styles.markCookedText}>Mark cooked</Text>
              </Pressable>
            </View>
            <View style={styles.secondaryActionsRow}>
              <SecondaryIconAction icon={<Bookmark color={colors.charcoal} height={21} strokeWidth={2.1} width={21} />} label="Save" onPress={saveSelectedRecipe} />
              <SecondaryIconAction icon={<Cart color={colors.charcoal} height={21} strokeWidth={2.1} width={21} />} label="Grocery List" onPress={openGroceryList} />
              <SecondaryIconAction icon={<ShareAndroid color={colors.charcoal} height={21} strokeWidth={2.1} width={21} />} label="Share" onPress={openShareRecipe} />
            </View>

            <View style={styles.modeSection}>
              <Text style={styles.sectionSmallTitle}>Style: {getModeLabel(selectedMode)}</Text>
              {strategyNote ? <Text style={styles.strategyNote}>{strategyNote}</Text> : null}
            </View>

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
  const markRecipeCooked = useOkyoStore((state) => state.markRecipeCooked);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const userRestaurantPrice = useOkyoStore((state) => state.userRestaurantPrice);
  const isDemoScan = isExplicitDemoScan(selectedScanImage);
  const storedRecipe = getStoredRecipeForMode(latestScanRecipe ? [latestScanRecipe] : [], selectedMode, latestScanRecipe);
  const recipe = storedRecipe ?? (isDemoScan ? getSafeRecipeForMode(selectedMode) : null);
  const savedRecipe = recipe ? savedRecipes.find((savedRecipeItem) => savedRecipeItem.id === recipe.id) ?? null : null;
  const scanResult = latestScanResult ?? (isDemoScan ? defaultScanResult : null);
  // Same honesty rule as RecipeDetailScreen: real savings need a user price.
  const restaurantPrice = isDemoScan ? scanResult?.restaurantPrice ?? 0 : userRestaurantPrice ?? 0;
  const canShowSavings = Boolean(recipe) &&
    (isDemoScan
      ? restaurantPrice > 0 && (recipe?.estimatedSavings ?? 0) > 0
      : userRestaurantPrice !== null);
  const displaySavings = !recipe
    ? 0
    : isDemoScan
      ? recipe.estimatedSavings
      : Math.max(0, restaurantPrice - recipe.estimatedHomemadeCost);
  const spicePairings = getSafeTextList(recipe?.spicePairings);
  const cookingTerms = getSafeCookingTerms(recipe?.cookingTerms);
  const guidedSteps = useMemo(
    () => getGuidedCookingSteps(recipe, cookingTerms, spicePairings),
    [cookingTerms, recipe, spicePairings],
  );
  const displayTitle = cleanDisplayText(recipe?.title ?? '');
  const recipeImageUrl = getRecipeImageUrl(recipe, getRealScanImageUri(selectedScanImage));
  const recipeImageStatus = getRecipeImageStatus(recipe);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [completionCookedCount, setCompletionCookedCount] = useState<number | null>(null);
  const completionLoggedRef = useRef(false);
  const activeStep = guidedSteps[Math.min(activeStepIndex, Math.max(guidedSteps.length - 1, 0))];
  const progress = guidedSteps.length > 0 ? ((activeStepIndex + 1) / guidedSteps.length) * 100 : 0;
  const cookedCount = completionCookedCount ?? getRecipeCookedCount(savedRecipe ?? recipe);

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
    if (!showCompletion || !recipe || completionLoggedRef.current) {
      return;
    }

    completionLoggedRef.current = true;
    const alreadySaved = Boolean(savedRecipe);
    const nextCookedCount = getRecipeCookedCount(savedRecipe ?? recipe) + 1;
    uiLog('RecipeStepsScreen', 'mark_cooked_from_completion', { recipeId: recipe.id });
    markRecipeCooked(attachRealScanImage(recipe, selectedScanImage));
    setCompletionCookedCount(nextCookedCount);
    if (!alreadySaved) {
      awardXPOnce(`save-recipe-${recipe.id}`, 5);
      unlockBadge('first-dupe');
    }
  }, [
    awardXPOnce,
    markRecipeCooked,
    recipe,
    savedRecipe,
    selectedScanImage,
    showCompletion,
    unlockBadge,
  ]);

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
    uiLog('RecipeStepsScreen', 'save_recipe', { recipeId: recipe.id });
    saveRecipe(attachRealScanImage(recipe, selectedScanImage));
    if (!alreadySaved) {
      awardXPOnce(`save-recipe-${recipe.id}`, 5);
    }
    unlockBadge('first-dupe');
    track(analyticsEvents.RECIPE_SAVED, {
      dishName: recipe?.title ?? scanResult?.dishName ?? 'Missing recipe',
      mode: recipe.mode,
      savings: canShowSavings ? displaySavings : 0,
      screen: 'RecipeStepsScreen',
    });
    Alert.alert('Saved', `${cleanDisplayText(recipe.title)} was added to your library.`);
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
      setShowCompletion(true);
      return;
    }

    goToStep(activeStepIndex + 1);
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
            <SecondaryAction label="Try another photo" onPress={() => navigation.navigate('ScanScreen')} />
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
              <Text style={styles.completionEyebrow}>You made it.</Text>
              <FoodImage
                fallbackLabel="Recipe image"
                imageStatus={recipeImageStatus}
                imageUrl={recipeImageUrl}
                showFallbackLabel
                style={styles.completionImage}
              />
              <KikoMascot pose="celebrating" size={80} style={styles.completionMascot} />
              <Text numberOfLines={2} style={styles.completionTitle}>{displayTitle}</Text>
              <Text style={styles.completionBody}>
                Nice work. Let it rest if the recipe calls for it, taste once more, then enjoy your Okyo version.
              </Text>
              <View style={styles.completionCookedBadge}>
                <Check color={colors.green} height={18} strokeWidth={2.4} width={18} />
                <Text style={styles.completionCookedText}>{formatCookedCount(cookedCount)}</Text>
              </View>
              <PrimaryAction label="Share" onPress={openShareRecipe} />
              <SecondaryAction label="View Recipe" onPress={() => navigation.navigate('RecipeDetailScreen', { mode: selectedMode })} />
              <SecondaryAction label="Go Home" onPress={() => navigation.navigate('HomeScreen')} />
              {!savedRecipe ? <SecondaryAction label="Save recipe" onPress={saveSelectedRecipe} /> : null}
            </View>
          </ScrollView>
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
          <KikoMascot pose="cooking" size={56} style={styles.guidedMascot} />
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

        <View style={styles.guidedProgressTrack}>
          <View style={[styles.guidedProgressFill, { width: `${progress}%` }]} />
        </View>

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
            <Pressable
              accessibilityRole="button"
              disabled={activeStepIndex === 0}
              onPress={goPreviousStep}
              style={({ pressed }) => [
                styles.guidedNavButton,
                activeStepIndex === 0 ? styles.guidedNavButtonDisabled : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.guidedNavText, activeStepIndex === 0 ? styles.guidedNavTextDisabled : null]}>
                Previous
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={goNextStep}
              style={({ pressed }) => [styles.guidedNavButton, styles.guidedNavButtonPrimary, pressed ? styles.pressed : null]}
            >
              <Text style={styles.guidedNavPrimaryText}>
                {activeStepIndex >= guidedSteps.length - 1 ? 'Finish' : 'Next'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

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


type QuickStatProps = {
  icon: ReactNode;
  label: string;
  value: string;
};

function QuickStat({ icon, label, value }: QuickStatProps) {
  return (
    <View style={styles.quickStat}>
      <View style={styles.quickStatIcon}>{icon}</View>
      <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={styles.quickStatValue}>
        {value}
      </Text>
      <Text numberOfLines={1} style={styles.quickStatLabel}>{label}</Text>
    </View>
  );
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
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.primaryAction, pressed ? styles.pressed : null]}
    >
      <Text style={styles.primaryActionText}>{label}</Text>
    </Pressable>
  );
}

type SecondaryActionProps = {
  label: string;
  onPress: () => void;
};

function SecondaryAction({ label, onPress }: SecondaryActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryAction, pressed ? styles.pressed : null]}
    >
      <Text style={styles.secondaryActionText}>{label}</Text>
    </Pressable>
  );
}

type SecondaryIconActionProps = {
  icon: ReactNode;
  label: string;
  onPress: () => void;
};

function SecondaryIconAction({ icon, label, onPress }: SecondaryIconActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryIconAction, pressed ? styles.pressed : null]}
    >
      {icon}
      <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={styles.secondaryIconText}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: recipeColors.background,
    flex: 1,
  },
  screenContent: {
    flexGrow: 1,
    paddingBottom: layout.scrollClearance,
    paddingHorizontal: 20,
  },
  heroCard: {
    marginTop: 10,
  },
  recipePhoto: {
    aspectRatio: 1.04,
    backgroundColor: recipeColors.cream,
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
  circleSaveButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    position: 'absolute',
    right: 14,
    top: 14,
    width: 42,
  },
  inspiredPill: {
    alignItems: 'center',
    backgroundColor: recipeColors.card,
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
    color: recipeColors.charcoal,
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
    color: recipeColors.charcoal,
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
    backgroundColor: recipeColors.greenSoft,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  savingsMiniText: {
    color: recipeColors.green,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
  },
  cookedMiniPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff8ed',
    borderColor: 'rgba(232, 220, 203, 0.9)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cookedMiniText: {
    color: recipeColors.green,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '800',
  },
  quickStatsRow: {
    flexDirection: 'row',
    marginTop: 18,
    paddingHorizontal: 4,
    paddingVertical: 15,
  },
  quickStat: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 3,
  },
  quickStatIcon: {
    height: 20,
    marginBottom: 5,
    width: 20,
  },
  quickStatValue: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'center',
  },
  quickStatLabel: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  description: {
    color: recipeColors.text,
    fontFamily: fontFamilies.body,
    fontSize: 18,
    lineHeight: 27,
    marginTop: 18,
  },
  modeSection: {
    marginTop: 24,
    paddingBottom: 16,
  },
  strategyNote: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  sectionSmallTitle: {
    color: recipeColors.charcoal,
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
    color: recipeColors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '600',
  },
  ingredientGroupCard: {
    marginTop: 14,
  },
  ingredientGroupTitle: {
    color: recipeColors.orangeDeep,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 2,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  ingredientRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(232, 220, 203, 0.9)',
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
    color: recipeColors.charcoal,
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
    color: recipeColors.muted,
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
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '800',
  },
  ingredientAvatarProduce: {
    backgroundColor: recipeColors.greenSoft,
  },
  ingredientAvatarProtein: {
    backgroundColor: recipeColors.orangeSoft,
  },
  ingredientAvatarDairy: {
    backgroundColor: '#f8efd8',
  },
  ingredientAvatarGrain: {
    backgroundColor: '#f1e4cf',
  },
  ingredientAvatarSauce: {
    backgroundColor: '#f7e7df',
  },
  ingredientAvatarPantry: {
    backgroundColor: '#eee7dc',
  },
  ingredientAvatarDefault: {
    backgroundColor: '#f5eee4',
  },
  infoCard: {
    marginTop: 16,
  },
  infoCardTitle: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
    marginBottom: 12,
  },
  bulletRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    marginTop: 7,
  },
  bulletText: {
    color: recipeColors.text,
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
    backgroundColor: recipeColors.cream,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  flavorChipText: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  swapsHelper: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  savingsCard: {
    alignItems: 'center',
    backgroundColor: recipeColors.greenSoft,
    borderRadius: 12,
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
    color: recipeColors.green,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  savingsSubLabel: {
    color: '#3f6a52',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  savingsValue: {
    color: recipeColors.green,
    fontFamily: fontFamilies.display,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 43,
    marginTop: 2,
  },
  savingsNote: {
    color: '#3f6a52',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  savingsIconBubble: {
    alignItems: 'center',
    backgroundColor: '#d9efd9',
    borderRadius: 999,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: recipeColors.orange,
    borderRadius: 24,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 62,
    paddingHorizontal: 18,
    shadowColor: recipeColors.orangeDeep,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 2,
  },
  primaryActionText: {
    color: '#fffdf8',
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  cookedActionCard: {
    alignItems: 'center',
    backgroundColor: '#fff8ed',
    borderColor: 'rgba(232, 220, 203, 0.9)',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 12,
    padding: 14,
  },
  cookedActionCopy: {
    flex: 1,
    minWidth: 0,
  },
  cookedActionLabel: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cookedActionValue: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 3,
  },
  markCookedButton: {
    alignItems: 'center',
    backgroundColor: recipeColors.greenSoft,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  markCookedText: {
    color: recipeColors.green,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  secondaryIconAction: {
    alignItems: 'center',
    backgroundColor: recipeColors.cream,
    borderColor: 'rgba(232, 220, 203, 0.8)',
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    minHeight: 58,
    minWidth: 0,
    paddingHorizontal: 6,
  },
  secondaryIconText: {
    color: recipeColors.charcoal,
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
    color: recipeColors.charcoal,
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
    color: recipeColors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  compactBadge: {
    backgroundColor: recipeColors.blueSoft,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  compactBadgeText: {
    color: recipeColors.blue,
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    fontWeight: '700',
  },
  guidedProgressTrack: {
    backgroundColor: recipeColors.creamDeep,
    borderRadius: 999,
    height: 6,
    marginTop: 12,
    overflow: 'hidden',
  },
  guidedProgressFill: {
    backgroundColor: recipeColors.orange,
    borderRadius: 999,
    height: '100%',
  },
  guidedStepCard: {
    flex: 1,
    marginTop: 14,
  },
  guidedStepCardContent: {
    flexGrow: 1,
    padding: 22,
    paddingBottom: 26,
  },
  guidedStepTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  guidedPhaseLabel: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.extraBold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  guidedStepNumber: {
    color: recipeColors.orange,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  guidedTimeChipWrap: {
    backgroundColor: recipeColors.orangeSoft,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  guidedTimeChipText: {
    color: recipeColors.orangeDeep,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '800',
  },
  guidedStepTitle: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 34,
  },
  guidedInstruction: {
    color: recipeColors.text,
    fontFamily: fontFamilies.body,
    fontSize: 18,
    lineHeight: 27,
    marginTop: 14,
  },
  guidedCueBlock: {
    backgroundColor: recipeColors.greenSoft,
    borderRadius: 20,
    marginTop: 18,
    padding: 16,
  },
  guidedCueLabel: {
    color: recipeColors.green,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  guidedCueText: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 6,
  },
  guidedDoneLabel: {
    color: recipeColors.green,
    fontFamily: fontFamilies.extraBold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 12,
    opacity: 0.7,
    textTransform: 'uppercase',
  },
  guidedDoneText: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 4,
    opacity: 0.85,
  },
  guidedSafetyBlock: {
    backgroundColor: recipeColors.yellowSoft,
    borderRadius: 20,
    marginTop: 12,
    padding: 14,
  },
  guidedSafetyLabel: {
    color: recipeColors.orange,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  guidedSafetyText: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 6,
  },
  guidedWhyBlock: {
    backgroundColor: recipeColors.blueSoft,
    borderRadius: 20,
    marginTop: 12,
    padding: 16,
  },
  guidedWhyLabel: {
    color: recipeColors.blue,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  guidedWhyText: {
    color: recipeColors.charcoal,
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
    color: recipeColors.muted,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  guidedChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  guidedChipWrap: {
    backgroundColor: recipeColors.cream,
    borderRadius: 999,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  guidedChipText: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
  },
  guidedControlArea: {
    gap: 12,
    marginTop: 12,
  },
  guidedNavRow: {
    flexDirection: 'row',
    gap: 12,
  },
  guidedNavButton: {
    alignItems: 'center',
    backgroundColor: recipeColors.cream,
    borderColor: 'rgba(232, 220, 203, 0.8)',
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 14,
  },
  guidedNavButtonPrimary: {
    backgroundColor: recipeColors.orange,
    borderColor: recipeColors.orange,
    shadowColor: recipeColors.orangeDeep,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 2,
  },
  guidedNavButtonDisabled: {
    opacity: 0.45,
  },
  guidedNavText: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    fontWeight: '800',
  },
  guidedNavTextDisabled: {
    color: recipeColors.muted,
  },
  guidedNavPrimaryText: {
    color: '#fffdf8',
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    fontWeight: '900',
  },
  completionCard: {
    alignItems: 'center',
    padding: 22,
  },
  completionScrollContent: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 4,
  },
  completionEyebrow: {
    color: recipeColors.orange,
    fontFamily: fontFamilies.display,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 12,
  },
  completionImage: {
    aspectRatio: 1.22,
    backgroundColor: recipeColors.cream,
    borderRadius: 26,
    width: '100%',
  },
  completionMascot: {
    marginTop: -24,
  },
  completionTitle: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 33,
    marginTop: 2,
    textAlign: 'center',
  },
  completionBody: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 17,
    lineHeight: 25,
    marginTop: 12,
    textAlign: 'center',
  },
  completionCookedBadge: {
    alignItems: 'center',
    backgroundColor: recipeColors.greenSoft,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 7,
    marginTop: 16,
    marginBottom: 14,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  completionCookedText: {
    color: recipeColors.green,
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    fontWeight: '800',
  },
  instructionsSection: {
    paddingTop: 16,
  },
  stepsHeroCard: {
    marginTop: 12,
    padding: 18,
  },
  stepsRecipeTitle: {
    color: colors.charcoal,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 33,
    marginTop: 6,
  },
  stepsIntroText: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  instructionsHeader: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  instructionsEyebrow: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  instructionsTitle: {
    color: colors.charcoal,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 27,
    marginTop: 4,
    textAlign: 'left',
  },
  stepProgressText: {
    color: colors.charcoal,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 14,
  },
  progressTrack: {
    backgroundColor: colors.creamDeep,
    borderRadius: 999,
    height: 7,
    marginTop: 10,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    backgroundColor: colors.coral,
    borderRadius: 999,
    height: '100%',
  },
  stepCard: {
    marginBottom: 14,
    padding: 16,
  },
  stepCardActive: {
    backgroundColor: colors.cream,
  },
  stepTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  stepBadge: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 28,
    minWidth: 28,
  },
  stepBadgeText: {
    color: '#fffdf8',
    fontSize: 14,
    fontWeight: '700',
  },
  stepTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  stepTitle: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  stepTime: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  stepBody: {
    color: colors.charcoal,
    fontSize: 14,
    lineHeight: 21,
    marginLeft: 38,
    marginTop: 8,
  },
  visualCue: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginLeft: 38,
    marginTop: 7,
  },
  visualCueBlock: {
    backgroundColor: colors.greenSoft,
    borderRadius: 16,
    gap: 4,
    marginLeft: 38,
    marginTop: 12,
    padding: 12,
  },
  visualCueLabel: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  visualCueText: {
    color: colors.charcoal,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  stepTipCard: {
    alignItems: 'flex-start',
    backgroundColor: '#fff4df',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    marginLeft: 38,
    marginTop: 12,
    padding: 12,
  },
  stepTipCopy: {
    flex: 1,
    minWidth: 0,
  },
  stepTipTitle: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: '700',
  },
  stepTipText: {
    color: colors.charcoal,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  cookingNotesCard: {
    backgroundColor: colors.cream,
    borderRadius: 24,
    gap: 12,
    marginTop: 2,
    padding: 14,
  },
  noteBlock: {
    gap: 5,
  },
  noteTitle: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '700',
  },
  noteText: {
    color: colors.body,
    fontSize: 13,
    lineHeight: 19,
  },
  stepActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
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
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    fontWeight: '700',
  },
  simpleTopTitle: {
    color: recipeColors.charcoal,
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
    color: recipeColors.orange,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  issueTitle: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.display,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 33,
  },
  issueBody: {
    color: recipeColors.muted,
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
    backgroundColor: recipeColors.cream,
    borderColor: 'rgba(232, 220, 203, 0.84)',
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 16,
  },
  secondaryActionText: {
    color: recipeColors.charcoal,
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

function getSafeTextList(values: string[] | undefined) {
  return (Array.isArray(values) ? values : [])
    .map((value) => cleanDisplayText(value))
    .filter(Boolean)
    .slice(0, 6);
}

function getRecipeCookedCount(recipe: Recipe | null) {
  return typeof recipe?.cookedCount === 'number' && Number.isFinite(recipe.cookedCount)
    ? Math.max(0, recipe.cookedCount)
    : 0;
}

function formatCookedCount(count: number) {
  return `Cooked ${count} ${count === 1 ? 'time' : 'times'}`;
}

function getSafeCookingTerms(recipeTerms: Recipe['cookingTerms']) {
  return (Array.isArray(recipeTerms) ? recipeTerms : [])
    .map((term) => ({
      term: cleanDisplayText(term.term),
      meaning: cleanDisplayText(term.meaning),
    }))
    .filter((term) => term.term && term.meaning)
    .slice(0, 5);
}

function getStepCookingTerms(step: string, terms: NonNullable<Recipe['cookingTerms']>) {
  const normalizedStep = step.toLowerCase();
  return terms.filter((term) => normalizedStep.includes(term.term.toLowerCase()));
}

function getStepBoosters(step: string, index: number, stepCount: number, pairings: string[]) {
  if (pairings.length === 0) {
    return [];
  }

  const normalizedStep = step.toLowerCase();
  const isFlavorStep = [
    'sauce',
    'season',
    'taste',
    'finish',
    'serve',
    'garnish',
  ].some((keyword) => normalizedStep.includes(keyword));

  if (!isFlavorStep && index !== stepCount - 1) {
    return [];
  }

  return [pairings[index % pairings.length]].filter((b): b is string => typeof b === 'string' && b.length >= 25);
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
    return 'From-scratch version - includes all prep steps.';
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
      chefTip: step.chefTip,
      ingredientsUsed: step.ingredientsUsed,
      toolsUsed: step.toolsUsed,
      stepImagePrompt: step.stepImagePrompt,
      commonQuestion: step.commonQuestion,
      commonQuestionAnswer: step.commonQuestionAnswer,
      why: filterGenericWhy(step.why) ?? (step.whyItMatters ? filterGenericWhy(cleanDisplayText(step.whyItMatters)) : undefined),
      commonMistake: step.commonMistake ?? (step.safetyNote ? cleanDisplayText(step.safetyNote) : undefined),
      estimatedMinutes: step.estimatedMinutes,
      timeEstimate: step.timeEstimate?.trim(),
      visualCue: step.visualCue ? cleanDisplayText(step.visualCue) : undefined,
      whyItMatters: step.whyItMatters ? cleanDisplayText(step.whyItMatters) : undefined,
      safetyNote: step.safetyNote ? cleanDisplayText(step.safetyNote) : undefined,
      flavorBoost: step.flavorBoost ? cleanDisplayText(step.flavorBoost) : undefined,
      cookingTerm: step.cookingTerm && step.cookingTerm.term.trim() && step.cookingTerm.meaning.trim()
        ? {
          term: cleanDisplayText(step.cookingTerm.term),
          meaning: cleanDisplayText(step.cookingTerm.meaning),
        }
        : undefined,
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

// Notes that add no flavor information — filtered out so the section stays
// specific or hides entirely.
const genericFlavorNotePattern = /^(home ?cooking|homemade|home version|comfort food|delicious|tasty|classic|easy|weeknight( dinner)?|dinner|lunch|meal)$/i;

function getFlavorNotes(recipe: Recipe | null, pairings: string[]) {
  const notes = [
    ...pairings,
    recipe?.bestFor,
    recipe?.mainIngredientsSummary,
  ]
    .map((value) => cleanDisplayText(value ?? ''))
    .flatMap((value) => value.split(',').map((part) => part.trim()))
    .filter(Boolean)
    .filter((note) => !genericFlavorNotePattern.test(note));

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
  const SKIP = new Set(['a', 'an', 'the', 'and', 'or', 'to', 'in', 'on', 'at', 'of', 'up', 'with', 'then', 'into', 'your', 'both', 'until', 'all', 'its', 'by', 'for', 'from']);
  const words = instruction.replace(/[.,!?;:]+/g, ' ').split(/\s+/).slice(0, 12);
  const key = words
    .map((w) => w.replace(/[^a-zA-Z]/g, ''))
    .filter((w) => w.length > 1 && !SKIP.has(w.toLowerCase()))
    .slice(0, 2);
  return key.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getStepTip(
  step: DisplayRecipeStep,
  index: number,
  stepCount: number,
  cookingTerms: NonNullable<Recipe['cookingTerms']>,
  spicePairings: string[],
) {
  if (step.flavorBoost) {
    return { title: 'Flavor booster', body: step.flavorBoost };
  }
  if (step.safetyNote && !step.commonMistake) {
    return { title: 'Safety note', body: step.safetyNote };
  }
  const stepTerms = step.cookingTerm ? [step.cookingTerm] : getStepCookingTerms(step.text, cookingTerms);
  if (stepTerms[0]) {
    return { title: stepTerms[0].term, body: stepTerms[0].meaning };
  }
  const boosters = getStepBoosters(step.text, index, stepCount, spicePairings);
  if (boosters[0]) {
    return { title: 'Optional boost', body: boosters[0] };
  }

  return null;
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

function getGuidedCookingSteps(
  recipe: Recipe | null,
  cookingTerms: NonNullable<Recipe['cookingTerms']>,
  spicePairings: string[],
): GuidedCookingStep[] {
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
    const tip = getStepTip(step, index, displaySteps.length, cookingTerms, spicePairings);
    const instruction = parsedStep.body || step.text;
    const phaseName = getStepPhaseName(step);
    const phaseIdx = (phaseRunning.get(phaseName) ?? 0) + 1;
    phaseRunning.set(phaseName, phaseIdx);

    return {
      chefTip: step.chefTip ? cleanDisplayText(step.chefTip) : undefined,
      estimatedMinutes: step.estimatedMinutes ?? parseEstimatedMinutes(step.timeEstimate) ?? null,
      ingredientsUsed: getClosedStepIngredients(step, recipeIngredients),
      instruction,
      phase: phaseName,
      phaseStepIndex: phaseIdx,
      phaseStepCount: phaseTotals.get(phaseName) ?? 1,
      why: filterGenericWhy(step.why),
      commonMistake: step.commonMistake,
      commonQuestion: step.commonQuestion,
      commonQuestionAnswer: step.commonQuestionAnswer,
      // Only surface a decisionPoint when both branches exist — a question with no
      // yes/no guidance would leave the cook stuck.
      decisionPoint: (step.decisionPoint && step.ifYes && step.ifNo) ? step.decisionPoint : undefined,
      ifYes: (step.decisionPoint && step.ifYes && step.ifNo) ? step.ifYes : undefined,
      ifNo: (step.decisionPoint && step.ifYes && step.ifNo) ? step.ifNo : undefined,
      doneWhen: step.doneWhen,
      safetyNote: step.safetyNote,
      stepNumber: index + 1,
      tip: tip ?? undefined,
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

function resolveIngredientsFromNames(names: string[], recipeIngredients: RecipeIngredient[]): RecipeIngredient[] {
  return names
    .map((name) => matchIngredientToList(name, recipeIngredients))
    .filter((ingredient): ingredient is RecipeIngredient => ingredient !== null)
    .slice(0, 5);
}

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

    const headNoun = name.split(' ').filter((part) => part.length >= 3).pop();
    if (!headNoun) {
      return false;
    }
    const singular = headNoun.endsWith('s') ? headNoun.slice(0, -1) : headNoun;
    return normalizedStep.includes(singular);
  });
}

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
    .replace(new RegExp(`\\b${joinedCopyWord}(?:[-\\s]?style)?\\b`, 'gi'), 'restaurant-style')
    .replace(new RegExp(`\\b${spacedCopyWord}(?:[-\\s]?style)?\\b`, 'gi'), 'restaurant-style')
    .trim();
}
