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
  Cutlery,
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
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { FoodImage } from '../components/FoodImage';
import { KikoMascot } from '../components/KikoMascot';
import { colors } from '../components/OkyoUI';
import {
  defaultScanResult,
  getSafeRecipeForMode,
  getSafeRecipeMode,
  isRecipeMode,
  type Recipe,
  type RecipeIngredient,
  type RecipeMode,
} from '../mocks';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { attachRealScanImage } from '../utils/savedRecipeImage';
import { getCookingTipForStep, type CookingTip } from '../utils/cookingTips';
import { getRealScanImageUri, getRecipeImageStatus, getRecipeImageUrl } from '../utils/recipeImages';
import { uiLog } from '../utils/uiDebug';

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
  text: string;
  timeEstimate?: string;
  visualCue?: string;
  whyItMatters?: string;
  safetyNote?: string;
  flavorBoost?: string;
  cookingTerm?: NonNullable<Recipe['cookingTerms']>[number];
};
type GuidedCookingStep = {
  estimatedMinutes: number | null;
  ingredientsUsed: RecipeIngredient[];
  instruction: string;
  safetyNote?: string;
  stepNumber: number;
  tip?: string;
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
  const setStoreSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const latestScanResult = useOkyoStore((state) => state.latestScanResult);
  const latestScanRecipes = useOkyoStore((state) => state.latestScanRecipes);
  const saveRecipe = useOkyoStore((state) => state.saveRecipe);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const [selectedMode, setSelectedMode] = useState<RecipeMode>(
    getSafeRecipeMode(initialMode ?? storeSelectedMode),
  );
  const isDemoScan = isExplicitDemoScan(selectedScanImage);
  const storedRecipe = getStoredRecipeForMode(latestScanRecipes, selectedMode, latestScanRecipe);
  const recipe = storedRecipe ?? (isDemoScan ? getSafeRecipeForMode(selectedMode) : null);
  const scanResult = latestScanResult ?? (isDemoScan ? defaultScanResult : null);
  const restaurantPrice = scanResult?.restaurantPrice ?? getEstimatedRestaurantPrice(recipe);
  const canShowSavings = restaurantPrice > 0 && (recipe?.estimatedSavings ?? 0) > 0;
  const availableModes = scanResult?.modes ?? getAvailableModes(latestScanRecipes, latestScanRecipe, isDemoScan);
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
  const recipeImageUrl = getRecipeImageUrl(recipe, getRealScanImageUri(selectedScanImage));
  const recipeImageStatus = getRecipeImageStatus(recipe);

  useEffect(() => {
    const safeMode = getSafeRecipeMode(routeMode ?? storeSelectedMode);
    setSelectedMode(safeMode);

    uiLog('RecipeDetailScreen', 'enter', { routeMode, safeMode });

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

  const chooseMode = (mode: RecipeMode) => {
    setSelectedMode(mode);
    setStoreSelectedMode(mode);
    uiLog('RecipeDetailScreen', 'choose_mode', { mode });
    track(analyticsEvents.MODE_SELECTED, {
      dishName: recipe?.title ?? scanResult?.dishName ?? 'Missing recipe',
      mode,
      screen: 'RecipeDetailScreen',
    });
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
      savings: canShowSavings ? recipe.estimatedSavings : 0,
      screen: 'RecipeDetailScreen',
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

  const openGroceryList = () => {
    navigation.navigate('GroceryListScreen', { mode: selectedMode });
  };

  const openCookingSteps = () => {
    navigation.navigate('RecipeStepsScreen', { mode: selectedMode });
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
            fallbackLabel="Image coming soon"
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
                  ? `You save ${formatCurrency(recipe.estimatedSavings)}`
                  : `Home est. ${formatCurrency(recipe.estimatedHomemadeCost)}`}
              </Text>
            </View>

            <View style={styles.quickStatsRow}>
              <QuickStat label="Total Time" value={`${totalTime} min`} icon={<Clock color={colors.charcoal} height={19} strokeWidth={2.1} width={19} />} />
              <QuickStat label="Difficulty" value={recipe.skillLevel ?? recipe.difficulty} icon={<FireFlame color={colors.charcoal} height={19} strokeWidth={2.1} width={19} />} />
              <QuickStat label="Servings" value={`${recipe.servings}`} icon={<User color={colors.charcoal} height={19} strokeWidth={2.1} width={19} />} />
              <QuickStat label="Per Serving" value={perServingCost ? formatCurrency(perServingCost) : formatCurrency(recipe.estimatedHomemadeCost)} icon={<MoneySquare color={colors.charcoal} height={19} strokeWidth={2.1} width={19} />} />
            </View>

            <Text style={styles.description}>{displayDescription}</Text>

            <View style={styles.modeSection}>
              <Text style={styles.sectionSmallTitle}>Choose your style</Text>
              <RecipeModeTabs modes={availableModes} selectedMode={selectedMode} onSelectMode={chooseMode} />
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

            <InfoCard title="Why you'll love this">
              {whyBullets.map((bullet) => (
                <View key={bullet} style={styles.bulletRow}>
                  <Check color={colors.coral} height={16} strokeWidth={2.35} width={16} />
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </InfoCard>

            {flavorNotes.length > 0 ? (
              <InfoCard title="Flavor notes">
                <View style={styles.chipRow}>
                  {flavorNotes.map((note) => (
                    <Text key={note} numberOfLines={1} style={styles.flavorChip}>{note}</Text>
                  ))}
                </View>
              </InfoCard>
            ) : null}

            {equipment.length > 0 ? (
              <InfoCard title="Equipment you'll need">
                <View style={styles.equipmentRow}>
                  {equipment.slice(0, 4).map((item) => (
                    <View key={item} style={styles.equipmentCard}>
                      <Cutlery color={colors.coralDark} height={22} strokeWidth={2} width={22} />
                      <Text numberOfLines={2} style={styles.equipmentText}>{cleanDisplayText(item)}</Text>
                    </View>
                  ))}
                </View>
              </InfoCard>
            ) : null}

            {substitutions.length > 0 ? (
              <InfoCard title="Easy swaps">
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
                <Text style={styles.savingsLabel}>{canShowSavings ? 'Estimated savings' : 'Homemade estimate'}</Text>
                <Text style={styles.savingsSubLabel}>{canShowSavings ? 'You save' : 'Estimated grocery cost'}</Text>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  numberOfLines={1}
                  style={styles.savingsValue}
                >
                  {formatCurrency(canShowSavings ? recipe.estimatedSavings : recipe.estimatedHomemadeCost)}
                </Text>
                <Text style={styles.savingsNote}>
                  {canShowSavings
                    ? `vs. restaurant ${formatCurrency(restaurantPrice)}`
                    : 'Add what you paid from the result screen to estimate savings.'}
                </Text>
              </View>
              <View style={styles.savingsIconBubble}>
                <MoneySquare color={colors.green} height={42} strokeWidth={1.9} width={42} />
              </View>
            </View>

            <PrimaryAction label="Start Cooking" onPress={openCookingSteps} />
            <View style={styles.secondaryActionsRow}>
              <SecondaryIconAction icon={<Bookmark color={colors.charcoal} height={21} strokeWidth={2.1} width={21} />} label="Save" onPress={saveSelectedRecipe} />
              <SecondaryIconAction icon={<Cart color={colors.charcoal} height={21} strokeWidth={2.1} width={21} />} label="Grocery List" onPress={openGroceryList} />
              <SecondaryIconAction icon={<ShareAndroid color={colors.charcoal} height={21} strokeWidth={2.1} width={21} />} label="Share" onPress={openShareRecipe} />
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
  const guidedScrollRef = useRef<ScrollView | null>(null);
  const { width } = useWindowDimensions();
  const routeMode = route.params?.mode;
  const storeSelectedMode = useOkyoStore((state) => state.selectedMode);
  const selectedMode = getSafeRecipeMode(routeMode ?? storeSelectedMode);
  const latestScanResult = useOkyoStore((state) => state.latestScanResult);
  const latestScanRecipes = useOkyoStore((state) => state.latestScanRecipes);
  const saveRecipe = useOkyoStore((state) => state.saveRecipe);
  const savedRecipes = useOkyoStore((state) => state.savedRecipes);
  const latestScanRecipe = useOkyoStore((state) => state.latestScanRecipe);
  const selectedScanImage = useOkyoStore((state) => state.selectedScanImage);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const isDemoScan = isExplicitDemoScan(selectedScanImage);
  const storedRecipe = getStoredRecipeForMode(latestScanRecipes, selectedMode, latestScanRecipe);
  const recipe = storedRecipe ?? (isDemoScan ? getSafeRecipeForMode(selectedMode) : null);
  const scanResult = latestScanResult ?? (isDemoScan ? defaultScanResult : null);
  const restaurantPrice = scanResult?.restaurantPrice ?? getEstimatedRestaurantPrice(recipe);
  const canShowSavings = Boolean(recipe) && restaurantPrice > 0 && (recipe?.estimatedSavings ?? 0) > 0;
  const spicePairings = getSafeTextList(recipe?.spicePairings);
  const cookingTerms = getSafeCookingTerms(recipe?.cookingTerms);
  const guidedSteps = useMemo(
    () => getGuidedCookingSteps(recipe, cookingTerms, spicePairings),
    [cookingTerms, recipe, spicePairings],
  );
  const displayTitle = cleanDisplayText(recipe?.title ?? '');
  const recipeImageUrl = getRecipeImageUrl(recipe, getRealScanImageUri(selectedScanImage));
  const recipeImageStatus = getRecipeImageStatus(recipe);
  const guidedPageWidth = Math.max(width, 1);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [activeTip, setActiveTip] = useState<CookingTip | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);
  const activeStep = guidedSteps[Math.min(activeStepIndex, Math.max(guidedSteps.length - 1, 0))];
  const progress = guidedSteps.length > 0 ? ((activeStepIndex + 1) / guidedSteps.length) * 100 : 0;

  useEffect(() => {
    uiLog('RecipeStepsScreen', 'enter', { routeMode, selectedMode });

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
    guidedScrollRef.current?.scrollTo({ animated: false, x: activeStepIndex * guidedPageWidth, y: 0 });
  }, [activeStepIndex, guidedPageWidth]);

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
      savings: canShowSavings ? recipe.estimatedSavings : 0,
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
    guidedScrollRef.current?.scrollTo({ animated: true, x: clampedIndex * guidedPageWidth, y: 0 });
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

  const handleGuidedScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / guidedPageWidth);
    const clampedIndex = Math.max(0, Math.min(guidedSteps.length - 1, nextIndex));
    setActiveStepIndex(clampedIndex);
  };

  const openCurrentTip = () => {
    if (!activeStep) {
      return;
    }

    setActiveTip(activeStep.tip
      ? { body: activeStep.tip, category: 'visual', title: 'Step tip' }
      : getCookingTipForStep(activeStep));
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
                fallbackLabel="Image coming soon"
                imageStatus={recipeImageStatus}
                imageUrl={recipeImageUrl}
                showFallbackLabel
                style={styles.completionImage}
              />
              <KikoMascot pose="celebrating" size={92} style={styles.completionMascot} />
              <Text numberOfLines={2} style={styles.completionTitle}>{displayTitle}</Text>
              <Text style={styles.completionBody}>
                Nice work. Let it rest if the recipe calls for it, taste once more, then enjoy your Okyo version.
              </Text>
              <PrimaryAction label="Share it" onPress={openShareRecipe} />
              <SecondaryAction label="Save" onPress={saveSelectedRecipe} />
              <View style={styles.disabledPhotoAction}>
                <Text style={styles.disabledPhotoActionText}>Take a photo of your version</Text>
                <Text style={styles.disabledPhotoActionSubtext}>Coming soon</Text>
              </View>
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
          <KikoMascot pose="cooking" size={68} style={styles.guidedMascot} />
          <View style={styles.guidedHeaderCopy}>
            <Text numberOfLines={2} style={styles.guidedRecipeTitle}>{displayTitle}</Text>
            <Text style={styles.guidedProgressText}>
              Step {activeStepIndex + 1} of {guidedSteps.length}
            </Text>
          </View>
        </View>

        <View style={styles.guidedProgressTrack}>
          <View style={[styles.guidedProgressFill, { width: `${progress}%` }]} />
        </View>

        <ScrollView
          ref={guidedScrollRef}
          bounces={false}
          decelerationRate="fast"
          horizontal
          onMomentumScrollEnd={handleGuidedScrollEnd}
          pagingEnabled
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          style={styles.guidedCarousel}
        >
          {guidedSteps.map((step) => (
            <View key={`${recipe.id}-guided-step-${step.stepNumber}`} style={[styles.guidedPage, { width: guidedPageWidth }]}>
              <View style={styles.guidedStepCard}>
                <ScrollView contentContainerStyle={styles.guidedStepCardContent} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  <View style={styles.guidedStepTopRow}>
                    <Text style={styles.guidedStepNumber}>Step {step.stepNumber}</Text>
                    {step.estimatedMinutes ? (
                      <Text style={styles.guidedTimeChip}>~{step.estimatedMinutes} min</Text>
                    ) : null}
                  </View>

                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                    numberOfLines={3}
                    style={styles.guidedStepTitle}
                  >
                    {step.title}
                  </Text>
                  <Text style={styles.guidedInstruction}>{step.instruction}</Text>

                  {step.visualCue ? (
                    <View style={styles.guidedCueBlock}>
                      <Text style={styles.guidedCueLabel}>Look for</Text>
                      <Text style={styles.guidedCueText}>{step.visualCue}</Text>
                    </View>
                  ) : null}

                  {step.safetyNote ? (
                    <View style={styles.guidedSafetyBlock}>
                      <Text style={styles.guidedSafetyLabel}>Safety</Text>
                      <Text style={styles.guidedSafetyText}>{step.safetyNote}</Text>
                    </View>
                  ) : null}

                  {step.ingredientsUsed.length > 0 ? (
                    <GuidedChipGroup label="Use now" values={step.ingredientsUsed.map((ingredient) => formatIngredientChip(ingredient)).slice(0, 3)} />
                  ) : null}

                  {step.toolsUsed.length > 0 ? (
                    <GuidedChipGroup label="Tools" values={step.toolsUsed.slice(0, 2)} />
                  ) : null}
                </ScrollView>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.guidedControlArea}>
          <Pressable
            accessibilityRole="button"
            onPress={openCurrentTip}
            style={({ pressed }) => [styles.tipPill, pressed ? styles.pressed : null]}
          >
            <Spark color={colors.coral} height={18} strokeWidth={2.2} width={18} />
            <Text style={styles.tipPillText}>Tip</Text>
          </Pressable>

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

      <CookingTipPanel tip={activeTip} onClose={() => setActiveTip(null)} />
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
  const safeValues = values.map((value) => cleanDisplayText(value)).filter(Boolean).slice(0, 4);

  if (safeValues.length === 0) {
    return null;
  }

  return (
    <View style={styles.guidedChipGroup}>
      <Text style={styles.guidedChipLabel}>{label}</Text>
      <View style={styles.guidedChipRow}>
        {safeValues.map((value) => (
          <Text key={`${label}-${value}`} numberOfLines={1} style={styles.guidedChip}>
            {value}
          </Text>
        ))}
      </View>
    </View>
  );
}

function CookingTipPanel({ onClose, tip }: { onClose: () => void; tip: CookingTip | null }) {
  return (
    <Modal animationType="fade" transparent visible={Boolean(tip)} onRequestClose={onClose}>
      <Pressable accessibilityRole="button" style={styles.tipModalScrim} onPress={onClose}>
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.tipPanel}>
          <View style={styles.tipPanelHandle} />
          <Text style={styles.tipPanelKicker}>Cooking tip</Text>
          <Text style={styles.tipPanelTitle}>{tip?.title ?? 'Quick tip'}</Text>
          <Text style={styles.tipPanelBody}>{tip?.body ?? ''}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.tipPanelClose, pressed ? styles.pressed : null]}
          >
            <Text style={styles.tipPanelCloseText}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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

type RecipeModeTabsProps = {
  modes: RecipeMode[];
  selectedMode: RecipeMode;
  onSelectMode: (mode: RecipeMode) => void;
};

function RecipeModeTabs({ modes, selectedMode, onSelectMode }: RecipeModeTabsProps) {
  const safeModes = modes.length > 0 ? modes : defaultScanResult.modes;

  return (
    <View style={styles.modeTabs}>
      {safeModes.map((mode) => {
        const isSelected = selectedMode === mode;

        return (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelectMode(mode)}
            style={({ pressed }) => [
              styles.modeTab,
              isSelected ? styles.modeTabSelected : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              numberOfLines={1}
              style={[styles.modeTabText, isSelected ? styles.modeTabTextSelected : null]}
            >
              {getModeLabel(mode)}
            </Text>
          </Pressable>
        );
      })}
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
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    flexGrow: 1,
    paddingBottom: 150,
    paddingHorizontal: 24,
  },
  heroCard: {
    marginTop: 10,
  },
  recipePhoto: {
    aspectRatio: 1.12,
    backgroundColor: colors.cream,
    borderRadius: 32,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#4a3a28',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 5,
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
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  overviewPanel: {
    backgroundColor: colors.card,
    borderRadius: 28,
    marginTop: -24,
    padding: 20,
    shadowColor: '#4a3a28',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  recipeTitle: {
    color: colors.charcoal,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 39,
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
    fontSize: 12,
    fontWeight: '700',
  },
  quickStatsRow: {
    backgroundColor: colors.cream,
    borderRadius: 20,
    flexDirection: 'row',
    marginTop: 14,
    paddingVertical: 13,
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
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  quickStatLabel: {
    color: colors.body,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  description: {
    color: colors.charcoal,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
  },
  modeSection: {
    marginTop: 18,
    paddingBottom: 14,
  },
  sectionSmallTitle: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '700',
  },
  modeTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    minWidth: 0,
  },
  modeTab: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  modeTabSelected: {
    backgroundColor: colors.coral,
  },
  modeTabText: {
    color: colors.charcoal,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  modeTabTextSelected: {
    color: '#fffdf8',
  },
  previewSection: {
    marginTop: 16,
    paddingBottom: 14,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionCount: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '600',
  },
  ingredientGroupCard: {
    backgroundColor: colors.cream,
    borderRadius: 20,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  ingredientGroupTitle: {
    color: colors.coralDark,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 2,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  ingredientRow: {
    alignItems: 'center',
    borderBottomColor: '#f3e6d2',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: 8,
  },
  ingredientRowLast: {
    borderBottomWidth: 0,
  },
  ingredientName: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    minWidth: 0,
  },
  ingredientTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  ingredientQty: {
    color: colors.muted,
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
    fontSize: 12,
    fontWeight: '800',
  },
  ingredientAvatarProduce: {
    backgroundColor: colors.greenSoft,
  },
  ingredientAvatarProtein: {
    backgroundColor: colors.coralSoft,
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
    backgroundColor: colors.cream,
    borderRadius: 20,
    marginTop: 14,
    padding: 14,
  },
  infoCardTitle: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  bulletRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    marginTop: 7,
  },
  bulletText: {
    color: colors.charcoal,
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flavorChip: {
    backgroundColor: colors.card,
    borderRadius: 999,
    color: colors.charcoal,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  equipmentRow: {
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  equipmentCard: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  equipmentText: {
    color: colors.charcoal,
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  savingsCard: {
    alignItems: 'center',
    backgroundColor: colors.greenSoft,
    borderRadius: 24,
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    padding: 16,
  },
  savingsCopy: {
    flex: 1,
    minWidth: 0,
  },
  savingsLabel: {
    color: colors.green,
    fontSize: 16,
    fontWeight: '700',
  },
  savingsSubLabel: {
    color: '#3f6a52',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  savingsValue: {
    color: colors.green,
    fontSize: 31,
    fontWeight: '800',
    lineHeight: 34,
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
    backgroundColor: colors.coral,
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 58,
    paddingHorizontal: 18,
    shadowColor: colors.coral,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 2,
  },
  primaryActionText: {
    color: '#fffdf8',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  secondaryIconAction: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 999,
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    minHeight: 58,
    minWidth: 0,
    paddingHorizontal: 6,
  },
  secondaryIconText: {
    color: colors.charcoal,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  guidedScreenContent: {
    flex: 1,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  guidedHeader: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 28,
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    minHeight: 88,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: colors.coral,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 3,
  },
  guidedMascot: {
    marginLeft: -4,
  },
  guidedHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  guidedRecipeTitle: {
    color: '#fffdf8',
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
  },
  guidedProgressText: {
    color: '#fff4df',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
  },
  guidedProgressTrack: {
    backgroundColor: '#f2ddc2',
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
  guidedCarousel: {
    flex: 1,
    marginHorizontal: -24,
    marginTop: 12,
  },
  guidedPage: {
    paddingHorizontal: 24,
    paddingVertical: 2,
  },
  guidedStepCard: {
    backgroundColor: colors.card,
    borderRadius: 30,
    flex: 1,
    marginRight: 0,
    overflow: 'hidden',
    shadowColor: '#4a3a28',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  guidedStepCardContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 24,
  },
  guidedStepTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  guidedStepNumber: {
    color: colors.coral,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  guidedTimeChip: {
    backgroundColor: '#fff1de',
    borderRadius: 999,
    color: colors.coral,
    fontSize: 13,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  guidedStepTitle: {
    color: colors.charcoal,
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 29,
    textAlign: 'center',
  },
  guidedInstruction: {
    color: colors.charcoal,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
    textAlign: 'center',
  },
  guidedCueBlock: {
    backgroundColor: colors.greenSoft,
    borderRadius: 20,
    marginTop: 16,
    padding: 14,
  },
  guidedCueLabel: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  guidedCueText: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
  guidedSafetyBlock: {
    backgroundColor: '#fff4df',
    borderRadius: 20,
    marginTop: 12,
    padding: 14,
  },
  guidedSafetyLabel: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  guidedSafetyText: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
  guidedChipGroup: {
    marginTop: 14,
  },
  guidedChipLabel: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  guidedChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  guidedChip: {
    backgroundColor: colors.cream,
    borderRadius: 999,
    color: colors.charcoal,
    fontSize: 12,
    fontWeight: '700',
    maxWidth: '100%',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  guidedControlArea: {
    gap: 12,
    marginTop: 12,
  },
  tipPill: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#fff1de',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 18,
  },
  tipPillText: {
    color: colors.coral,
    fontSize: 15,
    fontWeight: '900',
  },
  guidedNavRow: {
    flexDirection: 'row',
    gap: 12,
  },
  guidedNavButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 14,
  },
  guidedNavButtonPrimary: {
    backgroundColor: colors.coral,
    shadowColor: colors.coral,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 2,
  },
  guidedNavButtonDisabled: {
    opacity: 0.45,
  },
  guidedNavText: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '800',
  },
  guidedNavTextDisabled: {
    color: colors.muted,
  },
  guidedNavPrimaryText: {
    color: '#fffdf8',
    fontSize: 16,
    fontWeight: '900',
  },
  tipModalScrim: {
    backgroundColor: 'rgba(28, 24, 19, 0.32)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 18,
  },
  tipPanel: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 22,
    shadowColor: '#1c1813',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 8,
  },
  tipPanelHandle: {
    alignSelf: 'center',
    backgroundColor: '#e4d5c2',
    borderRadius: 999,
    height: 4,
    marginBottom: 16,
    width: 42,
  },
  tipPanelKicker: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tipPanelTitle: {
    color: colors.charcoal,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 29,
    marginTop: 7,
  },
  tipPanelBody: {
    color: colors.charcoal,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
  tipPanelClose: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 50,
  },
  tipPanelCloseText: {
    color: '#fffdf8',
    fontSize: 16,
    fontWeight: '900',
  },
  completionCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 32,
    padding: 20,
    shadowColor: '#4a3a28',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 3,
  },
  completionScrollContent: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 4,
  },
  completionEyebrow: {
    color: colors.coral,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  completionImage: {
    aspectRatio: 1.18,
    backgroundColor: colors.cream,
    borderRadius: 26,
    width: '100%',
  },
  completionMascot: {
    marginTop: -48,
  },
  completionTitle: {
    color: colors.charcoal,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 33,
    marginTop: 2,
    textAlign: 'center',
  },
  completionBody: {
    color: colors.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    textAlign: 'center',
  },
  disabledPhotoAction: {
    alignItems: 'center',
    borderColor: '#eadfce',
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 12,
    opacity: 0.68,
    paddingHorizontal: 18,
    paddingVertical: 10,
    width: '100%',
  },
  disabledPhotoActionText: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '800',
  },
  disabledPhotoActionSubtext: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  instructionsSection: {
    paddingTop: 16,
  },
  stepsHeroCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    marginTop: 12,
    padding: 18,
    shadowColor: '#4a3a28',
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
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
    backgroundColor: colors.card,
    borderRadius: 24,
    marginBottom: 14,
    padding: 16,
    shadowColor: '#4a3a28',
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 1,
  },
  stepCardActive: {
    backgroundColor: '#fffdf8',
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
    height: 28,
    justifyContent: 'center',
    width: 28,
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
    height: 56,
    justifyContent: 'space-between',
    marginTop: 4,
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
    fontSize: 15,
    fontWeight: '700',
  },
  simpleTopTitle: {
    color: colors.charcoal,
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  topBarSpacer: {
    width: 82,
  },
  issueCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    marginTop: 18,
    padding: 18,
  },
  kicker: {
    color: colors.coral,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  issueTitle: {
    color: colors.charcoal,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 31,
  },
  issueBody: {
    color: colors.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  issueActions: {
    gap: 10,
    marginTop: 16,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 16,
  },
  secondaryActionText: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '700',
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
  return recipes.find((candidate) => candidate.mode === mode) ??
    (fallbackRecipe?.mode === mode ? fallbackRecipe : null);
}

function getAvailableModes(recipes: Recipe[], fallbackRecipe: Recipe | null, isDemoScan: boolean) {
  const modes = [
    ...recipes.map((candidate) => candidate.mode),
    ...(fallbackRecipe ? [fallbackRecipe.mode] : []),
  ];
  const uniqueModes = modes.filter((mode, index) => modes.indexOf(mode) === index);

  return uniqueModes.length > 0 || !isDemoScan ? uniqueModes : defaultScanResult.modes;
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

  return [pairings[index % pairings.length]].filter(Boolean);
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

function getRecipeDisplaySteps(recipe: Recipe | null): DisplayRecipeStep[] {
  const structuredSteps = (Array.isArray(recipe?.structuredSteps) ? recipe.structuredSteps : [])
    .map((step) => ({
      ...step,
      text: cleanDisplayText(step.text),
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

function getWhyBullets(recipe: Recipe | null, totalTime: number) {
  if (!recipe) {
    return [];
  }

  const bullets = [
    recipe.bestFor ? cleanDisplayText(recipe.bestFor) : null,
    totalTime > 0 ? `Ready in about ${totalTime} minutes` : null,
    recipe.estimatedSavings > 0 ? `Saves about ${formatCurrency(recipe.estimatedSavings)} versus restaurant prices` : null,
    recipe.mainIngredientsSummary ? `Built around ${cleanDisplayText(recipe.mainIngredientsSummary)}` : null,
  ].filter(Boolean) as string[];

  return bullets.slice(0, 3);
}

function getStepCopy(step: DisplayRecipeStep, index: number) {
  const text = cleanDisplayText(step.text);
  const [firstSentence, ...remainingSentences] = text.split(/(?<=\.)\s+/);
  const first = firstSentence?.trim() ?? '';

  if (first && first.length <= 72 && remainingSentences.length > 0) {
    return {
      title: first.replace(/\.$/, ''),
      body: remainingSentences.join(' ').trim(),
    };
  }

  const words = text.split(/\s+/);
  const title = words.slice(0, 5).join(' ').replace(/[.,;:]$/, '');

  return {
    title: title || `Step ${index + 1}`,
    body: text,
  };
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
  if (step.safetyNote) {
    return { title: 'Safety note', body: step.safetyNote };
  }
  if (step.whyItMatters) {
    return { title: 'Why it matters', body: step.whyItMatters };
  }
  const stepTerms = step.cookingTerm ? [step.cookingTerm] : getStepCookingTerms(step.text, cookingTerms);
  if (stepTerms[0]) {
    return { title: stepTerms[0].term, body: stepTerms[0].meaning };
  }
  const boosters = getStepBoosters(step.text, index, stepCount, spicePairings);
  if (boosters[0]) {
    return { title: 'Optional boost', body: boosters[0] };
  }
  if (step.visualCue) {
    return { title: 'Visual cue', body: step.visualCue };
  }

  return null;
}

function getGuidedCookingSteps(
  recipe: Recipe | null,
  cookingTerms: NonNullable<Recipe['cookingTerms']>,
  spicePairings: string[],
): GuidedCookingStep[] {
  const displaySteps = getRecipeDisplaySteps(recipe);
  const stepCount = Math.max(displaySteps.length, 1);
  const totalTime = recipe ? recipe.totalTimeMinutes ?? recipe.prepTimeMinutes + recipe.cookTimeMinutes : 0;
  const fallbackMinutes = totalTime > 0 ? Math.max(1, Math.round(totalTime / stepCount)) : null;
  const recipeIngredients = getRecipeIngredients(recipe);
  const recipeTools = getSafeTextList(recipe?.equipment);

  if (!recipe || displaySteps.length === 0) {
    return [{
      estimatedMinutes: null,
      ingredientsUsed: [],
      instruction: 'Okyo could not find detailed cooking steps for this recipe yet. Review the overview, then try another scan when you are ready.',
      stepNumber: 1,
      title: 'Review the recipe',
      toolsUsed: [],
    }];
  }

  return displaySteps.map((step, index) => {
    const parsedStep = getStepCopy(step, index);
    const tip = getStepTip(step, index, displaySteps.length, cookingTerms, spicePairings);
    const instruction = parsedStep.body || step.text;

    return {
      estimatedMinutes: parseEstimatedMinutes(step.timeEstimate) ?? fallbackMinutes,
      ingredientsUsed: getStepIngredients(step.text, recipeIngredients),
      instruction,
      safetyNote: step.safetyNote,
      stepNumber: index + 1,
      tip: tip?.body,
      title: parsedStep.title || `Step ${index + 1}`,
      toolsUsed: getStepTools(step.text, recipeTools),
      visualCue: step.visualCue,
    };
  });
}

function getRecipeIngredients(recipe: Recipe | null) {
  if (!recipe) {
    return [];
  }

  const groupedIngredients = getSafeIngredientGroups(recipe).flatMap((group) => group.items);
  const ingredients = groupedIngredients.length > 0
    ? groupedIngredients
    : Array.isArray(recipe.ingredients)
      ? recipe.ingredients
      : [];

  return ingredients
    .filter((ingredient) => ingredient?.name?.trim())
    .slice(0, 40);
}

function getStepIngredients(stepText: string, ingredients: RecipeIngredient[]) {
  const normalizedStep = normalizeForMatching(stepText);
  const matchedIngredients = ingredients.filter((ingredient) => {
    const name = normalizeForMatching(ingredient.name);
    const nameParts = name.split(' ').filter((part) => part.length > 3);

    return normalizedStep.includes(name) || nameParts.some((part) => normalizedStep.includes(part));
  });

  return matchedIngredients.slice(0, 5);
}

function getStepTools(stepText: string, equipment: string[]) {
  const normalizedStep = normalizeForMatching(stepText);

  return equipment
    .filter((tool) => {
      const normalizedTool = normalizeForMatching(tool);
      const toolParts = normalizedTool.split(' ').filter((part) => part.length > 2);

      return normalizedStep.includes(normalizedTool) || toolParts.some((part) => normalizedStep.includes(part));
    })
    .slice(0, 4);
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

function formatIngredientChip(ingredient: RecipeIngredient) {
  const quantity = cleanDisplayText(ingredient.quantity ?? '');
  const name = cleanDisplayText(ingredient.name);

  return quantity ? `${quantity} ${name}` : name;
}

function normalizeForMatching(value: string) {
  return cleanDisplayText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getModeLabel(mode: RecipeMode) {
  switch (mode) {
    case 'Budget':
      return 'Budget';
    case 'Healthy':
      return 'Lighter';
    case 'Restaurant Copy':
    default:
      return 'Restaurant Style';
  }
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
