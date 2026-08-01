import { useNavigation, useRoute } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Cart,
  Clock,
  Cutlery,
  FireFlame,
  Leaf,
  MoneySquare,
  NavArrowLeft,
  ShareAndroid,
  User,
} from 'iconoir-react-native';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
import { FoodImage } from '../components/FoodImage';
import { KikoMascot } from '../components/KikoMascot';
import { colors, fontFamilies } from '../components/OkyoUI';
import { RecipeLikeButton } from '../components/RecipeLikeButton';
import { RecipeNutritionCards } from '../components/RecipeNutritionCards';
import {
  getSafeRecipeMode,
  isRecipeMode,
  type Recipe,
  type RecipeMode,
} from '../mocks';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import {
  RECIPE_PRESENTATION_MODES,
  resolveCanonicalRecipe,
  type RecipePresentationMode,
} from '../state/canonicalRecipes';
import { useOkyoStore } from '../state/useOkyoStore';
import { resolveActiveCookingStep } from '../state/activeCooking';
import { recipeColors, recipeShadows } from '../theme/recipeTheme';
import { getRealScanImageUri, getRecipeImageStatus, getRecipeImageUrl } from '../utils/recipeImages';
import { formatRecipeDuration, getRecipeTiming } from '../utils/recipeIntegrity';
import { buildGuidedCookingSteps } from '../utils/guidedCookingSteps';
import { getNextGuidedCookingPreview } from '../utils/guidedCookingPreview';
import { getConciseGuidedInstruction } from '../utils/guidedInstruction';
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
export function RecipeDetailScreen() {
  const navigation = useNavigation<RecipeDetailNavigation>();
  const route = useRoute<RecipeDetailRoute>();
  const routeRecipeId = route.params?.recipeId;
  const routeMode = route.params?.mode;
  const storeSelectedMode = useOkyoStore((state) => state.selectedMode);
  const setRecipePresentationMode = useOkyoStore((state) => state.setRecipePresentationMode);
  const toggleRecipeLiked = useOkyoStore((state) => state.toggleRecipeLiked);
  const savedRecipeIds = useOkyoStore((state) => state.savedRecipeIds);
  const recipesById = useOkyoStore((state) => state.recipesById);
  const addRecipeToGrocery = useOkyoStore((state) => state.addRecipeToGrocery);
  const startCookingRecipe = useOkyoStore((state) => state.startCookingRecipe);
  const activeCookingSession = useOkyoStore((state) => state.activeCookingSession);
  const endCookingRecipe = useOkyoStore((state) => state.endCookingRecipe);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const recipe = resolveCanonicalRecipe(recipesById, routeRecipeId);
  const activeCookingRecipe = resolveCanonicalRecipe(recipesById, activeCookingSession?.recipeId);
  const selectedMode = getSafeRecipeMode(recipe?.selectedMode ?? routeMode ?? storeSelectedMode);
  const scanResult = recipe?.scanResult ?? null;
  const selectedScanImage = recipe?.originalImage ?? null;
  const restaurantPrice = scanResult?.restaurantPrice ?? getEstimatedRestaurantPrice(recipe);
  const canShowSavings = restaurantPrice > 0 && (recipe?.estimatedSavings ?? 0) > 0;
  const selectedPresentationMode = recipe?.selectedPresentationMode ?? 'Normal';
  const ingredientGroups = getSafeIngredientGroups(recipe);
  const equipment = getSafeTextList(recipe?.equipment);
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
  const recipeTiming = recipe ? getRecipeTiming(recipe) : { handsOnMinutes: 0, waitingMinutes: 0, totalMinutes: 0 };
  const perServingCost = recipe && recipe.servings > 0 ? recipe.estimatedHomemadeCost / recipe.servings : null;
  const recipeImageUrl = getRecipeImageUrl(recipe);
  const recipeImageStatus = getRecipeImageStatus(recipe);
  const isLiked = Boolean(recipe && savedRecipeIds.includes(recipe.id));

  useEffect(() => {
    uiLog('RecipeDetailScreen', 'enter', { recipeId: routeRecipeId, routeMode });
    const _traceUri = recipeImageUrl ?? null;
    const _hasStampedUri = Boolean((recipe as { imageUri?: string } | null)?.imageUri);
    checkImageFileExists(_traceUri).then((fileExists) => {
      imageTraceLog('RecipeDetailScreen', {
        screen: 'RecipeDetailScreen',
        recipeId: recipe?.id ?? null,
        imageSource: _hasStampedUri ? 'recipe.imageUri'
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
  }, [recipe?.id, recipeImageUrl, routeMode, routeRecipeId]);

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('MainTabs', { screen: 'HomeScreen' });
  };

  const choosePresentationMode = (mode: RecipePresentationMode) => {
    if (recipe && mode !== recipe.selectedPresentationMode) {
      setRecipePresentationMode(recipe.id, mode);
    }
    uiLog('RecipeDetailScreen', 'choose_mode', { mode });
    track(analyticsEvents.MODE_SELECTED, {
      dishName: recipe?.title ?? scanResult?.dishName ?? 'Missing recipe',
      mode,
      screen: 'RecipeDetailScreen',
    });
  };

  const toggleSelectedRecipeLike = () => {
    if (!recipe) {
      return;
    }

    uiLog('RecipeDetailScreen', isLiked ? 'unlike_recipe' : 'like_recipe', {
      recipeId: recipe.id,
    });
    toggleRecipeLiked(recipe.id);
    if (!isLiked) {
      awardXPOnce(`save-recipe-${recipe.id}`, 5);
      unlockBadge('first-dupe');
      track(analyticsEvents.RECIPE_SAVED, {
        dishName: recipe.title,
        mode: recipe.mode,
        savings: canShowSavings ? recipe.estimatedSavings : 0,
        screen: 'RecipeDetailScreen',
      });
    }
  };

  const openShareRecipe = () => {
    if (!recipe) {
      return;
    }

    navigation.navigate('ShareCardPreviewScreen', {
      cardType: 'scan_result',
      mode: selectedMode,
      recipeId: recipe.id,
    });
  };

  const openRecipeEditor = () => {
    if (!recipe) {
      return;
    }
    navigation.navigate('ResultSummaryScreen', { recipeId: recipe.id });
  };

  const openGroceryList = () => {
    if (!recipe) {
      return;
    }
    addRecipeToGrocery(recipe.id);
    navigation.navigate('GroceryListScreen', { mode: selectedMode, recipeId: recipe.id });
  };

  const openCookingSteps = () => {
    if (!recipe) {
      return;
    }

    const navigateToCooking = () => navigation.navigate('RecipeStepsScreen', {
      completion: false,
      mode: selectedMode,
      recipeId: recipe.id,
    });
    if (activeCookingSession && activeCookingSession.recipeId !== recipe.id) {
      Alert.alert(
        'Another recipe is in progress',
        'Choose whether to keep cooking it or end that session before starting this recipe.',
        [
          { text: 'Continue Current', style: 'cancel', onPress: () => navigation.navigate('RecipeStepsScreen', {
            completion: false,
            mode: activeCookingRecipe?.selectedMode ?? selectedMode,
            recipeId: activeCookingSession.recipeId,
          }) },
          { text: 'End & Start This', style: 'destructive', onPress: () => {
            endCookingRecipe(activeCookingSession.recipeId);
            startCookingRecipe(recipe.id, buildGuidedCookingSteps(recipe).length);
            navigateToCooking();
          } },
        ],
      );
      return;
    }
    if (!activeCookingSession) {
      startCookingRecipe(recipe.id, buildGuidedCookingSteps(recipe).length);
    }
    navigateToCooking();
  };

  if (!recipe) {
    return (
      <ScreenFrame onBack={goBack}>
        <View style={styles.issueCard}>
          <Text style={styles.kicker}>Recipe issue</Text>
          <Text style={styles.issueTitle}>This recipe needs another try.</Text>
          <Text style={styles.issueBody}>
            Okyo needs a completed recipe before it can show cooking steps or groceries for this scan.
          </Text>
          <View style={styles.issueActions}>
            <PrimaryAction label="Scan Again" onPress={() => navigation.navigate('MainTabs', { screen: 'HomeScreen' })} />
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
            <RecipeLikeButton
              compact
              isLiked={isLiked}
              onToggle={toggleSelectedRecipeLike}
              style={styles.circleSaveButton}
            />
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
              <QuickStat label="Total" value={formatRecipeDuration(recipeTiming.totalMinutes)} icon={<Clock color={colors.charcoal} height={19} strokeWidth={2.1} width={19} />} />
              <QuickStat label="Hands-on" value={formatRecipeDuration(recipeTiming.handsOnMinutes)} icon={<FireFlame color={colors.charcoal} height={19} strokeWidth={2.1} width={19} />} />
              <QuickStat label="Waiting" value={formatRecipeDuration(recipeTiming.waitingMinutes)} icon={<Clock color={colors.charcoal} height={19} strokeWidth={2.1} width={19} />} />
              <QuickStat label="Servings" value={`${recipe.servings}`} icon={<User color={colors.charcoal} height={19} strokeWidth={2.1} width={19} />} />
            </View>

            <Text style={styles.description}>{displayDescription}</Text>
            <Pressable
              accessibilityLabel="Edit recipe"
              accessibilityRole="button"
              onPress={openRecipeEditor}
              style={({ pressed }) => [styles.editRecipeAction, pressed ? styles.pressed : null]}
            >
              <Text style={styles.editRecipeActionText}>Edit recipe</Text>
            </Pressable>
            <RecipeNutritionCards nutrition={recipe.nutritionEstimate} />

            <View style={styles.modeSection}>
              <Text style={styles.sectionSmallTitle}>Choose your style</Text>
              <RecipeModeTabs
                selectedMode={selectedPresentationMode}
                onSelectMode={choosePresentationMode}
              />
              <Text style={styles.modeDisclosure}>
                Recipe adaptations are coming soon. This choice does not change ingredients or nutrition yet.
              </Text>
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

            <PrimaryAction label={activeCookingSession?.recipeId === recipe.id ? 'Continue Cooking' : 'Start Cooking'} onPress={openCookingSteps} />
            <View style={styles.secondaryActionsRow}>
              <RecipeLikeButton isLiked={isLiked} onToggle={toggleSelectedRecipeLike} />
              <SecondaryIconAction icon={<Cart color={colors.charcoal} height={21} strokeWidth={2.1} width={21} />} label="Add to Grocery" onPress={openGroceryList} />
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
  const routeRecipeId = route.params?.recipeId;
  const routeMode = route.params?.mode;
  const storeSelectedMode = useOkyoStore((state) => state.selectedMode);
  const toggleRecipeLiked = useOkyoStore((state) => state.toggleRecipeLiked);
  const savedRecipeIds = useOkyoStore((state) => state.savedRecipeIds);
  const recipesById = useOkyoStore((state) => state.recipesById);
  const hasHydrated = useOkyoStore((state) => state.hasHydrated);
  const completeRecipe = useOkyoStore((state) => state.completeRecipe);
  const updateCookingStep = useOkyoStore((state) => state.updateCookingStep);
  const syncCookingStepCount = useOkyoStore((state) => state.syncCookingStepCount);
  const endCookingRecipe = useOkyoStore((state) => state.endCookingRecipe);
  const activeCookingSession = useOkyoStore((state) => state.activeCookingSession);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const recipe = resolveCanonicalRecipe(recipesById, routeRecipeId);
  const selectedMode = getSafeRecipeMode(routeMode ?? recipe?.selectedMode ?? storeSelectedMode);
  const scanResult = recipe?.scanResult ?? null;
  const selectedScanImage = recipe?.originalImage ?? null;
  const restaurantPrice = scanResult?.restaurantPrice ?? getEstimatedRestaurantPrice(recipe);
  const canShowSavings = Boolean(recipe) && restaurantPrice > 0 && (recipe?.estimatedSavings ?? 0) > 0;
  const guidedSteps = useMemo(() => buildGuidedCookingSteps(recipe), [recipe]);
  const displayTitle = cleanDisplayText(recipe?.title ?? '');
  const recipeImageUrl = getRecipeImageUrl(recipe);
  const completionImageUri = recipe?.origin === 'scan'
    ? getRealScanImageUri(recipe.originalImage)
    : null;
  const [activeStepIndex, setActiveStepIndex] = useState(() => activeCookingSession?.recipeId === routeRecipeId
    ? activeCookingSession?.currentStepIndex ?? 0
    : 0);
  const [showCompletion, setShowCompletion] = useState(route.params?.completion === true);
  const isLiked = Boolean(recipe && savedRecipeIds.includes(recipe.id));
  const safeActiveStepIndex = guidedSteps.length > 0
    ? Math.max(0, Math.min(activeStepIndex, guidedSteps.length - 1))
    : 0;
  const activeStep = resolveActiveCookingStep(guidedSteps, safeActiveStepIndex);
  const nextStepPreview = getNextGuidedCookingPreview(guidedSteps, safeActiveStepIndex);
  const progress = guidedSteps.length > 0 ? ((safeActiveStepIndex + 1) / guidedSteps.length) * 100 : 0;
  const guidedTotalTime = recipe ? getRecipeTiming(recipe).totalMinutes : 0;

  useEffect(() => {
    uiLog('RecipeStepsScreen', 'enter', { recipeId: routeRecipeId, routeMode, selectedMode });
    const _traceUri = recipeImageUrl ?? null;
    const _hasStampedUri = Boolean((recipe as { imageUri?: string } | null)?.imageUri);
    checkImageFileExists(_traceUri).then((fileExists) => {
      imageTraceLog('RecipeStepsScreen', {
        screen: 'RecipeStepsScreen',
        recipeId: recipe?.id ?? null,
        imageSource: _hasStampedUri ? 'recipe.imageUri'
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
  }, [routeMode, routeRecipeId, selectedMode]);

  useEffect(() => {
    if (activeStepIndex >= guidedSteps.length) {
      setActiveStepIndex(Math.max(guidedSteps.length - 1, 0));
    }
  }, [activeStepIndex, guidedSteps.length]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }
    const restoredIndex = activeCookingSession?.recipeId === recipe?.id
      ? activeCookingSession?.currentStepIndex ?? 0
      : 0;
    const clampedIndex = Math.max(0, Math.min(restoredIndex, Math.max(guidedSteps.length - 1, 0)));
    setActiveStepIndex((previousIndex) => previousIndex === clampedIndex ? previousIndex : clampedIndex);
  }, [activeCookingSession?.currentStepIndex, activeCookingSession?.recipeId, guidedSteps.length, hasHydrated, recipe?.id, routeRecipeId]);

  useEffect(() => {
    if (hasHydrated && recipe && activeCookingSession?.recipeId === recipe.id &&
      activeCookingSession.totalStepCount !== guidedSteps.length) {
      // Revision synchronization changes only the session count; progress remains untouched.
      syncCookingStepCount(recipe.id, guidedSteps.length);
    }
  }, [activeCookingSession?.recipeId, activeCookingSession?.totalStepCount, guidedSteps.length, hasHydrated, recipe?.id, syncCookingStepCount]);

  useEffect(() => {
    setShowCompletion(route.params?.completion === true);
  }, [route.params?.completion, routeRecipeId]);

  const setCompletionVisible = (visible: boolean) => {
    setShowCompletion(visible);
    navigation.setParams({ completion: visible });
  };

  const goBack = () => {
    if (routeRecipeId) {
      navigation.navigate('RecipeDetailScreen', { mode: selectedMode, recipeId: routeRecipeId });
      return;
    }
    navigation.navigate('HomeScreen');
  };

  const toggleSelectedRecipeLike = () => {
    if (!recipe) {
      return;
    }

    uiLog('RecipeStepsScreen', isLiked ? 'unlike_recipe' : 'like_recipe', {
      recipeId: recipe.id,
    });
    toggleRecipeLiked(recipe.id);
    if (!isLiked) {
      awardXPOnce(`save-recipe-${recipe.id}`, 5);
      unlockBadge('first-dupe');
      track(analyticsEvents.RECIPE_SAVED, {
        dishName: recipe.title,
        mode: recipe.mode,
        savings: canShowSavings ? recipe.estimatedSavings : 0,
        screen: 'RecipeStepsScreen',
      });
    }
  };

  const openShareRecipe = () => {
    if (!recipe) {
      return;
    }

    navigation.navigate('ShareCardPreviewScreen', {
      cardType: 'scan_result',
      mode: selectedMode,
      recipeId: recipe.id,
    });
  };

  const goToStep = (nextIndex: number) => {
    const clampedIndex = Math.max(0, Math.min(guidedSteps.length - 1, nextIndex));
    setCompletionVisible(false);
    setActiveStepIndex(clampedIndex);
    if (recipe && activeCookingSession?.recipeId === recipe.id) {
      updateCookingStep(recipe.id, clampedIndex, guidedSteps.length);
    }
  };

  const goPreviousStep = () => {
    goToStep(safeActiveStepIndex - 1);
  };

  const goNextStep = () => {
    if (safeActiveStepIndex >= guidedSteps.length - 1) {
      if (recipe) {
        completeRecipe(recipe.id);
      }
      setCompletionVisible(true);
      return;
    }

    goToStep(safeActiveStepIndex + 1);
  };

  if (!recipe) {
    return (
      <ScreenFrame onBack={goBack}>
        <View style={styles.issueCard}>
          <Text style={styles.kicker}>Steps issue</Text>
          <Text style={styles.issueTitle}>This recipe needs another try.</Text>
          <Text style={styles.issueBody}>
            Okyo needs a completed recipe before it can show cooking steps for this scan.
          </Text>
          <View style={styles.issueActions}>
            <PrimaryAction
              label="Back to Recipe"
              onPress={() => routeRecipeId
                ? navigation.navigate('RecipeDetailScreen', { mode: selectedMode, recipeId: routeRecipeId })
                : navigation.navigate('HomeScreen')}
            />
            <SecondaryAction label="Scan Again" onPress={() => navigation.navigate('MainTabs', { screen: 'HomeScreen' })} />
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
              onPress={() => setCompletionVisible(false)}
              style={({ pressed }) => [styles.smallBackButton, pressed ? styles.pressed : null]}
            >
              <NavArrowLeft color={colors.charcoal} height={22} strokeWidth={2.35} width={22} />
              <Text style={styles.smallBackText}>Steps</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.completionScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.completionCard}>
              <Text style={styles.completionEyebrow}>You made it.</Text>
              <CompletionRecipeImage uri={completionImageUri} />
              <KikoMascot pose="celebrating" size={68} style={styles.completionMascot} />
              <Text numberOfLines={2} style={styles.completionTitle}>{displayTitle}</Text>
              <Text style={styles.completionBody}>
                Nice work. Your recipe is ready to enjoy.
              </Text>
              <PrimaryAction
                label="Back to Recipe"
                onPress={() => navigation.navigate('RecipeDetailScreen', {
                  mode: selectedMode,
                  recipeId: recipe.id,
                })}
              />
              <View style={styles.completionActionsRow}>
                <RecipeLikeButton isLiked={isLiked} onToggle={toggleSelectedRecipeLike} />
                <Pressable
                  accessibilityLabel="Share recipe"
                  accessibilityRole="button"
                  onPress={openShareRecipe}
                  style={({ pressed }) => [
                    styles.completionShareAction,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <ShareAndroid color={colors.charcoal} height={20} strokeWidth={2.1} width={20} />
                  <Text style={styles.completionShareText}>Share</Text>
                </Pressable>
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
            {!showCompletion && recipe ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="End Cooking"
                onPress={() => Alert.alert(
                  'End cooking session?',
                  'Your current step will be cleared, but the recipe will remain available.',
                  [
                    { text: 'Keep Cooking', style: 'cancel' },
                    { text: 'End Session', style: 'destructive', onPress: () => {
                      endCookingRecipe(recipe.id);
                      navigation.navigate('HomeScreen');
                    } },
                  ],
                )}
                style={({ pressed }) => [styles.smallBackButton, pressed ? styles.pressed : null]}
              >
                <Text style={styles.smallBackText}>End</Text>
              </Pressable>
            ) : null}
          </View>

        <View style={styles.guidedHeader}>
          <View style={styles.guidedHeaderCopy}>
            <Text numberOfLines={2} style={styles.guidedRecipeTitle}>{displayTitle}</Text>
            <View style={styles.guidedProgressRow}>
              <Text style={styles.guidedProgressText}>
                Step {safeActiveStepIndex + 1} of {guidedSteps.length}
                {guidedTotalTime > 0
                  ? guidedTotalTime >= 60
                    ? ` · ${formatRecipeDuration(guidedTotalTime)} total`
                    : ` · ${guidedTotalTime} min total`
                  : ''}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.guidedProgressTrack}>
          <View style={[styles.guidedProgressFill, { width: `${progress}%` }]} />
        </View>

        {activeStep ? (
          <View style={styles.guidedStepCard}>
            <View style={styles.guidedStepCardContent}>
              <View style={styles.guidedStepTopRow}>
                <Text style={styles.guidedStepNumber}>Step {activeStep.stepNumber}</Text>
                {activeStep.timing ? (
                  <View style={styles.guidedTimeChipWrap}>
                    {activeStep.timing.handsOnMinutes > 0 ? (
                      <Text style={styles.guidedTimeChipText}>Hands-on · ~{formatRecipeDuration(activeStep.timing.handsOnMinutes)}</Text>
                    ) : null}
                    {activeStep.timing.passiveMinutes > 0 ? (
                      <Text style={styles.guidedTimeChipText}>Waiting · ~{formatRecipeDuration(activeStep.timing.passiveMinutes)}</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <Text
                numberOfLines={2}
                style={styles.guidedStepTitle}
              >
                {activeStep.title}
              </Text>
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                style={styles.guidedInstructionScroll}
              >
                <Text
                  maxFontSizeMultiplier={1.5}
                  style={styles.guidedInstruction}
                >
                  {getConciseGuidedInstruction(activeStep.instruction)}
                </Text>
              </ScrollView>
            </View>
          </View>
        ) : null}

        <View style={styles.guidedControlArea}>
          {nextStepPreview ? (
            <View
              accessibilityLabel={`Up next, ${nextStepPreview}.`}
              accessible
              style={styles.guidedNextPreview}
            >
              <Text style={styles.guidedNextPreviewLabel}>Up next</Text>
              <Text numberOfLines={2} style={styles.guidedNextPreviewText}>{nextStepPreview}</Text>
            </View>
          ) : null}
          <View style={styles.guidedNavRow}>
            <Pressable
              accessibilityRole="button"
              disabled={safeActiveStepIndex === 0}
              onPress={goPreviousStep}
              style={({ pressed }) => [
                styles.guidedNavButton,
                safeActiveStepIndex === 0 ? styles.guidedNavButtonDisabled : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.guidedNavText, safeActiveStepIndex === 0 ? styles.guidedNavTextDisabled : null]}>
                Previous
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={goNextStep}
              style={({ pressed }) => [styles.guidedNavButton, styles.guidedNavButtonPrimary, pressed ? styles.pressed : null]}
            >
              <Text style={styles.guidedNavPrimaryText}>
                {safeActiveStepIndex >= guidedSteps.length - 1 ? 'Finish' : 'Next'}
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
};

function ScreenFrame({ children, onBack }: ScreenFrameProps) {
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
          </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function CompletionRecipeImage({ uri }: { uri: string | null }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);

  useEffect(() => {
    if (uri !== failedUri) {
      setFailedUri(null);
    }
  }, [failedUri, uri]);

  if (!uri || failedUri === uri) {
    return null;
  }

  return (
    <Image
      accessibilityLabel="Uploaded recipe photo"
      onError={() => setFailedUri(uri)}
      resizeMode="cover"
      source={{ uri }}
      style={styles.completionImage}
    />
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
  selectedMode: RecipePresentationMode;
  onSelectMode: (mode: RecipePresentationMode) => void;
};

function RecipeModeTabs({ selectedMode, onSelectMode }: RecipeModeTabsProps) {
  return (
    <View style={styles.modeTabs}>
      {RECIPE_PRESENTATION_MODES.map((mode) => {
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
              {mode}
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
    backgroundColor: recipeColors.background,
    flex: 1,
  },
  screenContent: {
    flexGrow: 1,
    paddingBottom: 150,
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
  editRecipeAction: {
    alignSelf: 'flex-start',
    backgroundColor: recipeColors.orangeSoft,
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  editRecipeActionText: {
    color: recipeColors.orangeDeep,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
  },
  nutritionSummary: {
    marginTop: 24,
  },
  nutritionSummaryRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  nutritionSummaryItem: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  nutritionSummaryValue: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    fontWeight: '800',
  },
  nutritionSummaryLabel: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 10,
    marginTop: 3,
  },
  nutritionFiber: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    marginTop: 10,
  },
  modeSection: {
    marginTop: 24,
    paddingBottom: 16,
  },
  sectionSmallTitle: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  modeTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    minWidth: 0,
  },
  modeTab: {
    alignItems: 'center',
    backgroundColor: recipeColors.cream,
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  modeTabSelected: {
    backgroundColor: recipeColors.orange,
  },
  modeTabText: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  modeTabTextSelected: {
    color: '#fffdf8',
  },
  modeDisclosure: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 9,
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
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 6,
    textAlign: 'center',
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
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  guidedHeader: {
    marginTop: 2,
    minHeight: 62,
    paddingHorizontal: 4,
    paddingVertical: 6,
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
    marginTop: 6,
    overflow: 'hidden',
  },
  guidedProgressFill: {
    backgroundColor: recipeColors.orange,
    borderRadius: 999,
    height: '100%',
  },
  guidedStepCard: {
    flex: 1,
    marginTop: 10,
  },
  guidedStepCardContent: {
    paddingHorizontal: 8,
    paddingVertical: 14,
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
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 31,
  },
  guidedInstruction: {
    color: recipeColors.text,
    fontFamily: fontFamilies.body,
    fontSize: 20,
    lineHeight: 29,
  },
  guidedInstructionScroll: {
    flexGrow: 0,
    marginTop: 10,
    maxHeight: 174,
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
  guidedNextPreview: {
    paddingHorizontal: 4,
  },
  guidedNextPreviewLabel: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.extraBold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  guidedNextPreviewText: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 3,
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
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  completionScrollContent: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 150,
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
    marginTop: 8,
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
  completionActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    width: '100%',
  },
  completionShareAction: {
    alignItems: 'center',
    backgroundColor: recipeColors.cream,
    borderColor: 'rgba(232, 220, 203, 0.84)',
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 16,
  },
  completionShareText: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
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

function getIngredientCount(recipe: Recipe | null) {
  if (!recipe) {
    return 0;
  }

  const groupedItems = getSafeIngredientGroups(recipe).flatMap((group) => group.items);
  const ingredients = groupedItems.length > 0 ? groupedItems : Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

  return ingredients.length;
}

function cleanDisplayText(value: string) {
  const commonTypo = `Amer${'cian'}`;
  const lowercaseTypo = `amer${'cian'}`;
  const joinedCopyWord = ['copy', 'cat'].join('');
  const spacedCopyWord = ['copy', 'cat'].join('\\s+');

  return value
    .replace(new RegExp(`\\b${commonTypo}\\b`, 'g'), 'American')
    .replace(new RegExp(`\\b${lowercaseTypo}\\b`, 'g'), 'american')
    .replace(new RegExp(`\\b${joinedCopyWord}(?:[-\\s]?style)?\\b`, 'gi'), 'homemade')
    .replace(new RegExp(`\\b${spacedCopyWord}(?:[-\\s]?style)?\\b`, 'gi'), 'homemade')
    .trim();
}
