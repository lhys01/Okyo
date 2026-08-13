import { useNavigation, useRoute } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Cart,
  CheckCircle,
  Clock,
  FireFlame,
  InfoCircle,
  NavArrowLeft,
  NavArrowRight,
  ShareAndroid,
  User,
} from 'iconoir-react-native';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Alert,
  Keyboard,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';

const FEEDBACK_REASONS = {
  okay: ['A little bland', 'Too rich', 'Took too long', 'Too complicated', 'Too expensive', 'Portions felt off', 'Texture wasn’t great', 'Instructions could be clearer', 'Something else'],
  disliked: ['Didn’t taste good', 'Too spicy', 'Too salty', 'Too sweet', 'Too bland', 'Texture was wrong', 'Too complicated', 'Took too long', 'Too expensive', 'Ingredients were hard to find', 'Recipe didn’t turn out right', 'Something else'],
} as const;

import { analyticsEvents, track } from '../analytics/track';
import { CORRECTION_FAILURE_MESSAGE, correctScanRecipe } from '../api/client';
import { FoodImage } from '../components/FoodImage';
import { colors, fontFamilies } from '../components/OkyoUI';
import { RecipeLikeButton } from '../components/RecipeLikeButton';
import { RecipeNutritionCards } from '../components/RecipeNutritionCards';
import { RecipeCostSummary, RecipeQuickFacts } from '../components/RecipeAssistantOverview';
import { RecipeIngredientsAssistant } from '../components/RecipeIngredientsAssistant';
import { RecipePrimaryActions } from '../components/RecipePrimaryActions';
import { FoodSafetyNotice } from '../components/FoodSafetyNotice';
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
import { findFoodPreferenceConflicts, useFoodPreferences } from '../state/foodPreferences';
import { foodPreferencesPersistence, toApiFoodPreferences } from '../state/foodPreferences';
import { onboardingV3Persistence } from '../onboarding-v3/state/onboardingV3Persistence';
import { buildGoalContext } from '../onboarding-v3/state/goalContext';
import { resolveActiveCookingStep } from '../state/activeCooking';
import { recipeColors, recipeShadows } from '../theme/recipeTheme';
import { guidedCookingTypography } from '../theme/guidedCookingTypography';
import { getRealScanImageUri, getRecipeImageSource, getRecipeImageStatus, getRecipeImageUrl } from '../utils/recipeImages';
import { formatRecipeDuration, getRecipeTiming } from '../utils/recipeIntegrity';
import { buildGuidedCookingSteps, getGuidedIngredientChipLabel } from '../utils/guidedCookingSteps';
import { getNextGuidedCookingPreview } from '../utils/guidedCookingPreview';
import { getConciseGuidedInstruction } from '../utils/guidedInstruction';
import { getGuidedStepDensity } from '../utils/guidedStepDensity';
import { checkImageFileExists, getStorageLocation } from '../utils/imageValidation';
import { imageTraceLog, uiLog } from '../utils/uiDebug';
import { getCompactRecipeDescription, getCookingCtaLabel } from '../utils/recipePresentation';
import { getHomeResetState } from '../utils/scanControllerUtils';
import { buildCorrectionRequest, getRecipeCorrectionSourceId } from '../utils/recipeCorrection';
import { useReduceMotion } from '../hooks/useAccessibilityPreferences';

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
  const correctRecipe = useOkyoStore((state) => state.correctRecipe);
  const scanSessionId = useOkyoStore((state) => state.scanSessionId);
  const toggleRecipeLiked = useOkyoStore((state) => state.toggleRecipeLiked);
  const savedRecipeIds = useOkyoStore((state) => state.savedRecipeIds);
  const recipesById = useOkyoStore((state) => state.recipesById);
  const addRecipeToGrocery = useOkyoStore((state) => state.addRecipeToGrocery);
  const toggleIngredientInGrocery = useOkyoStore((state) => state.toggleIngredientInGrocery);
  const groceryRecipeIds = useOkyoStore((state) => state.groceryRecipeIds);
  const groceryIngredientSelections = useOkyoStore((state) => state.groceryIngredientSelections ?? {});
  const recipeServingOverrides = useOkyoStore((state) => state.recipeServingOverrides ?? {});
  const setRecipeServingOverride = useOkyoStore((state) => state.setRecipeServingOverride);
  const startCookingRecipe = useOkyoStore((state) => state.startCookingRecipe);
  const activeCookingSession = useOkyoStore((state) => state.activeCookingSession);
  const awardXPOnce = useOkyoStore((state) => state.awardXPOnce);
  const unlockBadge = useOkyoStore((state) => state.unlockBadge);
  const endCookingRecipe = useOkyoStore((state) => state.endCookingRecipe);
  const [isUpdatingStyle, setIsUpdatingStyle] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);
  const getRecipePresentationVariant = useOkyoStore((state) => state.getRecipePresentationVariant);
  const cacheRecipePresentationVariant = useOkyoStore((state) => state.cacheRecipePresentationVariant);
  const recipe = resolveCanonicalRecipe(recipesById, routeRecipeId);
  const activeCookingRecipe = resolveCanonicalRecipe(recipesById, activeCookingSession?.recipeId);
  const selectedMode = getSafeRecipeMode(recipe?.selectedMode ?? routeMode ?? storeSelectedMode);
  const scanResult = recipe?.scanResult ?? null;
  const selectedScanImage = recipe?.originalImage ?? null;
  const restaurantPrice = recipe?.restaurantPriceEstimate ?? scanResult?.restaurantPrice ?? getEstimatedRestaurantPrice(recipe);
  const canShowSavings = restaurantPrice > 0 && (recipe?.estimatedSavings ?? 0) > 0;
  const selectedPresentationMode = recipe?.selectedPresentationMode ?? 'Normal';
  const ingredientGroups = getSafeIngredientGroups(recipe);
  const equipment = getSafeTextList(recipe?.equipment);
  const displayTitle = cleanDisplayText(recipe?.title ?? '');
  const displayDescription = getCompactRecipeDescription(cleanDisplayText(recipe?.description ?? ''));
  const ingredientCount = getIngredientCount(recipe);
  const fallbackIngredients = (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
    .filter((ingredient) => ingredient.name.trim());
  const displayIngredientGroups = ingredientGroups.length > 0
    ? ingredientGroups
    : fallbackIngredients.length > 0
      ? [{ component: '', items: fallbackIngredients }]
      : [];
  const recipeTiming = recipe ? getRecipeTiming(recipe) : { handsOnMinutes: 0, waitingMinutes: 0, totalMinutes: 0 };
  const recipeImageUrl = getRecipeImageUrl(recipe);
  const recipeImageStatus = getRecipeImageStatus(recipe);
  const displayServings = recipe ? (recipeServingOverrides[recipe.id] ?? recipe.servings) : 2;
  const selectedIngredientIds = recipe
    ? getSelectedIngredientIds(recipe, groceryRecipeIds, groceryIngredientSelections)
    : [];
  const isLiked = Boolean(recipe && savedRecipeIds.includes(recipe.id));
  const { preferences: foodPreferences } = useFoodPreferences();
  const foodConflicts = useMemo(() => recipe && foodPreferences
    ? findFoodPreferenceConflicts(recipe.ingredients.map((ingredient) => ingredient.name), foodPreferences)
    : [], [foodPreferences, recipe]);
  const seriousFoodConflicts = foodConflicts.filter((item) => item.category === 'allergy' || item.category === 'restriction');

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

  const choosePresentationMode = async (mode: RecipePresentationMode) => {
    if (recipe && mode !== recipe.selectedPresentationMode && !isUpdatingStyle) {
      void Haptics.selectionAsync().catch(() => undefined);
      setStyleError(null);
      const baseRecipe = recipe.baseRecipe ?? recipe;
      const baseScan = recipe.baseScanResult ?? recipe.scanResult;
      if (mode === 'Normal') {
        if (baseScan && correctRecipe(recipe.id, baseRecipe, baseScan)) {
          setRecipePresentationMode(recipe.id, 'Normal');
        } else {
          setStyleError(CORRECTION_FAILURE_MESSAGE);
        }
      } else {
        const cachedVariant = getRecipePresentationVariant(recipe.id, mode);
        setIsUpdatingStyle(true);
        try {
          if (cachedVariant) {
            if (!correctRecipe(recipe.id, cachedVariant.recipe, cachedVariant.scanResult)) throw new Error('style update failed');
          } else {
            const direction = mode === 'Lighter'
              ? 'Create a lighter version of this recipe while preserving the core dish. Reduce calories where practical and update ingredients, quantities, instructions, nutrition, cost, and relevant metadata.'
              : mode === 'More Protein'
                ? 'Create a higher-protein version of this recipe while preserving its cuisine, dietary restrictions, allergies, and existing ingredient logic. Use context-appropriate proteins such as beans, tofu, dairy, eggs, seeds, or more of an existing protein where appropriate; do not blindly add meat. Update ingredients, quantities, instructions, nutrition, cost, and relevant metadata.'
                : 'Create a healthier version of this recipe while preserving the identity of the dish. Update ingredients, quantities, instructions, nutrition, cost, and relevant metadata.';
            // Always adapt from the immutable original, not the currently displayed
            // variant, so switching styles repeatedly never compounds drift.
            const preferences = await foodPreferencesPersistence.read();
            const profile = await onboardingV3Persistence.readPersonalizedProfile();
            const result = await correctScanRecipe(getRecipeCorrectionSourceId(baseRecipe), {
              ...buildCorrectionRequest({ canonicalRecipeId: recipe.id, correctionNote: direction, currentRecipe: baseRecipe, expectedSourceRecipeId: getRecipeCorrectionSourceId(baseRecipe), goalContext: buildGoalContext(profile), mode: selectedMode, scanSessionId }),
              ...toApiFoodPreferences(preferences),
            });
            const updatedRecipe = result.recipe ?? result.recipes?.[0];
            if (!updatedRecipe || !result.scan || !correctRecipe(recipe.id, updatedRecipe, result.scan)) throw new Error('style update failed');
            cacheRecipePresentationVariant(recipe.id, mode, updatedRecipe, result.scan);
          }
          setRecipePresentationMode(recipe.id, mode);
        } catch {
          setStyleError(CORRECTION_FAILURE_MESSAGE);
        } finally {
          setIsUpdatingStyle(false);
        }
      }
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
    navigation.navigate('MainTabs', { screen: 'ResultSummaryScreen', params: { recipeId: recipe.id } });
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

    if (seriousFoodConflicts.length > 0) {
      const conflict = seriousFoodConflicts[0];
      Alert.alert(
        'Before you cook',
        `This recipe still includes ${conflict.ingredient}. You marked ${conflict.preference} as ${conflict.category === 'allergy' ? 'an allergy' : 'a dietary restriction'}.`,
        [
          { text: 'Go back', style: 'cancel' },
          { text: 'Review recipe' },
          { text: 'Make this work for me', onPress: () => navigation.navigate('MainTabs', { screen: 'ResultSummaryScreen', params: { recipeId: recipe.id, customizeInstruction: `Replace every ingredient that conflicts with my ${conflict.preference} ${conflict.category}. Preserve the dish while updating ingredients, steps, nutrition, timing, and cost.` } }) },
        ],
      );
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
            imageSource={getRecipeImageSource(recipe)}
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
            <Pressable accessibilityLabel="Share recipe" accessibilityRole="button" onPress={openShareRecipe} style={({ pressed }) => [styles.circleShareButton, pressed ? styles.pressed : null]}>
              <ShareAndroid color={colors.charcoal} height={21} strokeWidth={2.1} width={21} />
            </Pressable>
          </FoodImage>

          <View style={styles.overviewPanel}>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              numberOfLines={1}
              style={styles.recipeTitle}
            >
              {displayTitle}
            </Text>
            <Text numberOfLines={2} style={styles.description}>{displayDescription}</Text>
            <RecipeQuickFacts recipe={recipe} />
            <FoodSafetyNotice
              conflicts={foodConflicts}
              onAdapt={() => navigation.navigate('MainTabs', { screen: 'ResultSummaryScreen', params: { recipeId: recipe.id, customizeInstruction: 'Replace every ingredient that conflicts with my saved allergies and dietary restrictions while preserving the dish. Update ingredients, steps, nutrition, timing, and cost.' } })}
            />
            <RecipePrimaryActions
              onCook={openCookingSteps}
              onCustomize={openRecipeEditor}
              onGroceries={openGroceryList}
            />
            <RecipeNutritionCards nutrition={recipe.nutritionEstimate} />
            <RecipeCostSummary recipe={recipe} restaurantPrice={restaurantPrice || undefined} servings={displayServings} />

            <View style={styles.modeSection}>
              <Text style={styles.sectionSmallTitle}>Choose your style</Text>
              <RecipeModeTabs
                selectedMode={selectedPresentationMode}
                isUpdating={isUpdatingStyle}
                onSelectMode={(mode) => void choosePresentationMode(mode)}
              />
              {styleError ? (
                <Text accessibilityLiveRegion="polite" style={styles.modeError}>{styleError}</Text>
              ) : null}
            </View>

            <RecipeIngredientsAssistant
              recipe={recipe}
              servings={displayServings}
              selectedIngredientIds={selectedIngredientIds}
              onServingsChange={(servings) => setRecipeServingOverride(recipe.id, servings)}
              onAddIngredient={(ingredient) => {
                toggleIngredientInGrocery(recipe.id, ingredient.name);
              }}
            />

            {equipment.length > 0 ? (
              <InfoCard title="Equipment you'll need">
                <View style={styles.equipmentGrid}>
                  {equipment.map((item) => (
                    <View key={item} style={[styles.equipmentCard, { width: `${100 / equipmentColumns(equipment.length)}%` }]}>
                      <Text numberOfLines={2} style={styles.equipmentText}>{cleanDisplayText(item)}</Text>
                    </View>
                  ))}
                </View>
              </InfoCard>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={openCookingSteps}
              style={({ pressed }) => [styles.bottomCookButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.bottomCookButtonText}>
                {getCookingCtaLabel(recipe, activeCookingSession?.recipeId)}
              </Text>
            </Pressable>

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
  const recipesById = useOkyoStore((state) => state.recipesById);
  const hasHydrated = useOkyoStore((state) => state.hasHydrated);
  const completeRecipe = useOkyoStore((state) => state.completeRecipe);
  const updateCookingStep = useOkyoStore((state) => state.updateCookingStep);
  const syncCookingStepCount = useOkyoStore((state) => state.syncCookingStepCount);
  const endCookingRecipe = useOkyoStore((state) => state.endCookingRecipe);
  const activeCookingSession = useOkyoStore((state) => state.activeCookingSession);
  const recipeFeedbackById = useOkyoStore((state) => state.recipeFeedbackById ?? {});
  const saveRecipeFeedback = useOkyoStore((state) => state.saveRecipeFeedback);
  const recipe = resolveCanonicalRecipe(recipesById, routeRecipeId);
  const selectedMode = getSafeRecipeMode(routeMode ?? recipe?.selectedMode ?? storeSelectedMode);
  const selectedScanImage = recipe?.originalImage ?? null;
  const guidedSteps = useMemo(() => buildGuidedCookingSteps(recipe), [recipe]);
  const displayTitle = cleanDisplayText(recipe?.title ?? '');
  const recipeImageUrl = getRecipeImageUrl(recipe);
  const completionImageUri = recipe?.origin === 'scan'
    ? getRealScanImageUri(recipe.originalImage)
    : recipeImageUrl;
  const [activeStepIndex, setActiveStepIndex] = useState(() => activeCookingSession?.recipeId === routeRecipeId
    ? activeCookingSession?.currentStepIndex ?? 0
    : 0);
  const [showCompletion, setShowCompletion] = useState(route.params?.completion === true);
  const [feedbackRating, setFeedbackRating] = useState<'loved' | 'okay' | 'disliked' | null>(null);
  const [feedbackReasons, setFeedbackReasons] = useState<string[]>([]);
  const [feedbackNote, setFeedbackNote] = useState('');
  const feedbackToastY = useRef(new Animated.Value(-64)).current;
  const feedbackToastRun = useRef(0);
  const [feedbackToastVisible, setFeedbackToastVisible] = useState(false);
  const safeActiveStepIndex = guidedSteps.length > 0
    ? Math.max(0, Math.min(activeStepIndex, guidedSteps.length - 1))
    : 0;
  const activeStep = resolveActiveCookingStep(guidedSteps, safeActiveStepIndex);
  const stepDensity = activeStep ? getGuidedStepDensity(activeStep) : 'medium';
  const nextStepPreview = getNextGuidedCookingPreview(guidedSteps, safeActiveStepIndex);
  const progress = guidedSteps.length > 0 ? ((safeActiveStepIndex + 1) / guidedSteps.length) * 100 : 0;
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

  useEffect(() => {
    const savedFeedback = recipe ? recipeFeedbackById[recipe.id] : undefined;
    setFeedbackRating(savedFeedback?.rating ?? null);
    setFeedbackReasons(savedFeedback?.reasons ?? []);
    setFeedbackNote(savedFeedback?.note ?? '');
  }, [recipe?.id, recipeFeedbackById]);

  const showFeedbackToast = useCallback(() => {
    const run = ++feedbackToastRun.current;
    setFeedbackToastVisible(true);
    feedbackToastY.stopAnimation();
    feedbackToastY.setValue(-64);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(feedbackToastY, { duration: 220, toValue: 0, useNativeDriver: true }),
      ]),
      Animated.delay(1200),
      Animated.timing(feedbackToastY, { duration: 220, toValue: -64, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished && feedbackToastRun.current === run) setFeedbackToastVisible(false);
    });
  }, [feedbackToastY]);

  const persistFeedback = useCallback((rating: 'loved' | 'okay' | 'disliked', reasons: string[], note: string) => {
    if (!recipe) return;
    saveRecipeFeedback(recipe.id, { rating, reasons, note: note.trim() || undefined });
  }, [recipe, saveRecipeFeedback]);

  const selectFeedbackRating = (rating: 'loved' | 'okay' | 'disliked') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const allowedReasons = rating === 'loved' ? [] : FEEDBACK_REASONS[rating];
    const nextReasons = feedbackReasons.filter((reason) =>
      allowedReasons.some((allowedReason) => allowedReason === reason),
    );
    const nextNote = rating === 'loved' ? '' : feedbackNote;
    setFeedbackRating(rating);
    setFeedbackReasons(nextReasons);
    setFeedbackNote(nextNote);
    persistFeedback(rating, nextReasons, nextNote);
    if (rating === 'loved') showFeedbackToast();
  };

  const toggleFeedbackReason = (reason: string) => {
    const rating = feedbackRating ?? (recipe ? recipeFeedbackById[recipe.id]?.rating : undefined);
    if (!rating || rating === 'loved') return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const nextReasons = feedbackReasons.includes(reason)
      ? feedbackReasons.filter((item) => item !== reason)
      : [...feedbackReasons, reason];
    const nextNote = reason === 'Something else' && feedbackReasons.includes(reason) ? '' : feedbackNote;
    setFeedbackReasons(nextReasons);
    setFeedbackNote(nextNote);
    persistFeedback(rating, nextReasons, nextNote);
  };

  const saveCustomFeedback = () => {
    const rating = feedbackRating ?? (recipe ? recipeFeedbackById[recipe.id]?.rating : undefined);
    if (!rating || rating === 'loved' || !feedbackNote.trim()) return;
    Keyboard.dismiss();
    persistFeedback(rating, feedbackReasons, feedbackNote);
    showFeedbackToast();
  };

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

  const resetToHome = () => {
    const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNavigation) {
      rootNavigation.reset(getHomeResetState());
      return;
    }

    navigation.navigate('HomeScreen');
  };

  const goHomeFromCompletion = () => {
    setCompletionVisible(false);
    resetToHome();
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
    const selectedFeedbackRating = feedbackRating ?? recipeFeedbackById[recipe.id]?.rating ?? null;
    const visibleReasons = selectedFeedbackRating === 'okay' || selectedFeedbackRating === 'disliked'
      ? FEEDBACK_REASONS[selectedFeedbackRating]
      : [];
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.guidedScreenContent}>
          {feedbackToastVisible ? (
            <Animated.View pointerEvents="none" style={[styles.feedbackToast, { opacity: feedbackToastY.interpolate({ inputRange: [-64, 0], outputRange: [0, 1] }), transform: [{ translateY: feedbackToastY }] }]}>
              <Text style={styles.feedbackToastText}>Saved!</Text>
            </Animated.View>
          ) : null}
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
              <CompletionRecipeImage uri={completionImageUri} />
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel="Kiko enjoying a bowl of pasta"
                resizeMode="contain"
                source={require('../../assets/kiko-static/completion/kiko-pasta-celebration.png')}
                style={styles.completionMascotArt}
              />
              <Text style={styles.completionEyebrow}>You made it!</Text>
              <Text numberOfLines={2} style={styles.completionTitle}>{displayTitle}</Text>
              <Text style={styles.completionBody}>Nice work — time to enjoy it.</Text>
              <Text style={styles.feedbackTitle}>How was it?</Text>
              <View style={styles.feedbackRow}>
                {([['loved', 'Loved it'], ['okay', 'It was okay'], ['disliked', "Didn't like it"]] as const).map(([value, label]) => (
                  <Pressable key={value} accessibilityRole="button" onPress={() => selectFeedbackRating(value)} style={[styles.feedbackChoice, selectedFeedbackRating === value ? styles.feedbackChoiceSelected : null]}>
                    <Text style={styles.feedbackChoiceText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              {visibleReasons.length > 0 ? (
                <View style={styles.feedbackReasons}>
                  {visibleReasons.map((reason) => (
                    <Pressable key={reason} accessibilityRole="button" onPress={() => toggleFeedbackReason(reason)} style={[styles.feedbackReason, feedbackReasons.includes(reason) ? styles.feedbackReasonSelected : null]}>
                      <Text style={styles.feedbackReasonText}>{reason}</Text>
                    </Pressable>
                  ))}
                  {feedbackReasons.includes('Something else') ? (
                    <View style={styles.feedbackNoteRow}>
                      <TextInput
                        accessibilityLabel="Custom feedback"
                        onChangeText={setFeedbackNote}
                        onSubmitEditing={saveCustomFeedback}
                        placeholder="Tell us what happened…"
                        placeholderTextColor={recipeColors.muted}
                        returnKeyType="done"
                        style={styles.feedbackNoteInput}
                        value={feedbackNote}
                      />
                      <Pressable accessibilityRole="button" disabled={!feedbackNote.trim()} onPress={saveCustomFeedback} style={({ pressed }) => [styles.feedbackNoteSave, !feedbackNote.trim() ? styles.feedbackNoteSaveDisabled : null, pressed ? styles.pressed : null]}>
                        <Text style={styles.feedbackNoteSaveText}>Save</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.completionActionsRow}>
                <Pressable
                  accessibilityLabel="Share recipe"
                  accessibilityRole="button"
                  onPress={openShareRecipe}
                  style={({ pressed }) => [
                    styles.completionShareAction,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <ShareAndroid color={colors.charcoal} height={18} strokeWidth={2.1} width={18} />
                  <Text style={styles.completionShareText}>Share</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Go home"
                  accessibilityRole="button"
                  onPress={goHomeFromCompletion}
                  style={({ pressed }) => [styles.completionHomeAction, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.completionHomeText}>Home</Text>
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
      <ActiveCookingKeepAwake />
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
                      resetToHome();
                    } },
                  ],
                )}
                style={({ pressed }) => [styles.smallBackButton, pressed ? styles.pressed : null]}
              >
                <Text style={styles.smallBackText}>End</Text>
              </Pressable>
            ) : null}
          </View>

        <View style={styles.guidedProgressRow}>
          <View style={styles.guidedProgressTrack}>
            <View style={[styles.guidedProgressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.guidedProgressText}>{safeActiveStepIndex + 1} of {guidedSteps.length}</Text>
        </View>

        {activeStep ? (
          <View style={[styles.guidedStepCard, stepDensity === 'short' ? styles.guidedStepCardShort : null]}>
            <View style={[styles.guidedStepCardContent, stepDensity === 'short' ? styles.guidedStepCardContentShort : null]}>
              <Text
                numberOfLines={2}
                style={styles.guidedStepTitle}
              >
                {activeStep.title}
              </Text>
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                contentContainerStyle={stepDensity === 'short' ? styles.guidedInstructionContentShort : undefined}
                style={[styles.guidedInstructionScroll, stepDensity === 'long' ? styles.guidedInstructionScrollLong : null]}
              >
                <Text
                  maxFontSizeMultiplier={1.5}
                  style={styles.guidedInstruction}
                >
                  {getConciseGuidedInstruction(activeStep.instruction)}
                </Text>
                {activeStep.visualCue || activeStep.doneWhen ? (
                  <GuidanceBlock
                    label="Done when"
                    text={activeStep.doneWhen ?? activeStep.visualCue ?? ''}
                    tone="success"
                  />
                ) : null}
                {activeStep.commonMistake || (activeStep.safetyNote && !isDuplicateSafetyCue(activeStep.doneWhen ?? activeStep.visualCue, activeStep.safetyNote)) || activeStep.chefTip ? (
                  <GuidanceBlock
                    label="Watch out"
                    text={(activeStep.safetyNote && !isDuplicateSafetyCue(activeStep.doneWhen ?? activeStep.visualCue, activeStep.safetyNote)) ? activeStep.safetyNote : activeStep.commonMistake ?? activeStep.chefTip ?? ''}
                    tone="warning"
                  />
                ) : null}
                {activeStep.cookingTerm ? (
                  <GuidanceBlock label={activeStep.cookingTerm.term} text={activeStep.cookingTerm.meaning} />
                ) : activeStep.tip ? (
                  <GuidanceBlock label={activeStep.tip.title} text={activeStep.tip.body} />
                ) : null}
                {activeStep.ingredientsUsed.length > 0 ? (
                  <StepChips label="Ingredients" values={activeStep.ingredientsUsed.map(getGuidedIngredientChipLabel)} />
                ) : null}
                {activeStep.toolsUsed.length > 0 ? <StepChips label="Equipment" values={activeStep.toolsUsed} /> : null}
              </ScrollView>
            </View>
          </View>
        ) : null}

        {nextStepPreview ? (
          <View accessibilityLabel={`Up next, ${nextStepPreview}.`} accessible style={styles.guidedNextPreview}>
            <Text style={styles.guidedNextPreviewLabel}>UP NEXT</Text>
            <Text numberOfLines={1} style={styles.guidedNextPreviewText}>{nextStepPreview}</Text>
            <NavArrowRight color={recipeColors.muted} height={16} strokeWidth={2.2} width={16} />
          </View>
        ) : null}
        <View style={styles.guidedControlArea}>
          <View style={styles.guidedNavRow}>
            <Pressable
              accessibilityLabel="Previous cooking step"
              accessibilityRole="button"
              accessibilityState={{ disabled: safeActiveStepIndex === 0 }}
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
              accessibilityLabel={safeActiveStepIndex >= guidedSteps.length - 1 ? 'Finish cooking' : 'Next cooking step'}
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

function ActiveCookingKeepAwake() {
  useKeepAwake('okyo-guided-cooking');
  return null;
}

function GuidanceBlock({ label, text, tone = 'info' }: { label: string; text: string; tone?: 'info' | 'success' | 'warning' }) {
  const isSuccess = tone === 'success';
  const isWarning = tone === 'warning';

  return (
    <View style={[styles.guidanceBlock, tone === 'success' ? styles.guidanceSuccess : tone === 'warning' ? styles.guidanceWarning : null]}>
      <View style={styles.guidanceHeading}>
        {isSuccess
          ? <CheckCircle color={recipeColors.green} height={16} strokeWidth={2.25} width={16} />
          : <InfoCircle color={isWarning ? colors.coralDark : recipeColors.blue} height={16} strokeWidth={2.25} width={16} />}
        <Text style={styles.guidanceLabel}>{label}</Text>
      </View>
      <Text style={styles.guidanceText}>{shortenGuidanceText(text)}</Text>
    </View>
  );
}

function StepChips({ label, values }: { label: string; values: string[] }) {
  return (
    <View style={styles.guidedChipGroup}>
      <Text style={styles.guidedChipLabel}>{label}</Text>
      <View style={styles.guidedChipRow}>
        {values.map((value, index) => (
          <View key={`${value}-${index}`} style={styles.guidedChipWrap}>
            <Text style={styles.guidedChipText}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function shortenGuidanceText(text: string) {
  return text
    .replace(/^(The )/i, '')
    .replace(/ should look /i, ' ')
    .replace(/ and cling to the food\.?$/i, ' and thick enough to cling.')
    .replace(/, not gray or pale spots\.?$/i, ', with no pale spots.')
    .trim();
}

function isDuplicateSafetyCue(doneWhen: string | undefined, safetyNote: string | undefined) {
  if (!doneWhen || !safetyNote) return false;
  const temperatures = doneWhen.match(/\d{2,3}\s*°?\s*[fc]/gi) ?? [];
  const normalizedSafety = safetyNote.replace(/\s+/g, '').toLowerCase();
  return temperatures.some((temperature) => normalizedSafety.includes(temperature.replace(/\s+/g, '').toLowerCase()));
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
  isUpdating?: boolean;
  selectedMode: RecipePresentationMode;
  onSelectMode: (mode: RecipePresentationMode) => void;
};

function RecipeModeTabs({ isUpdating = false, selectedMode, onSelectMode }: RecipeModeTabsProps) {
  const reduceMotion = useReduceMotion();
  const [pendingMode, setPendingMode] = useState<RecipePresentationMode | null>(null);
  const selectionOpacity = useRef(new Animated.Value(1)).current;
  const hasMounted = useRef(false);
  const pendingUpdateStarted = useRef(false);

  useEffect(() => {
    if (isUpdating) {
      pendingUpdateStarted.current = true;
      return;
    }

    if (pendingUpdateStarted.current) {
      pendingUpdateStarted.current = false;
      setPendingMode(null);
    }
  }, [isUpdating]);

  useEffect(() => {
    if (pendingMode === selectedMode && !isUpdating) {
      setPendingMode(null);
    }
  }, [isUpdating, pendingMode, selectedMode]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    selectionOpacity.stopAnimation();

    if (reduceMotion) {
      selectionOpacity.setValue(1);
      return;
    }

    selectionOpacity.setValue(0.84);
    Animated.timing(selectionOpacity, {
      duration: 140,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, selectedMode, selectionOpacity]);

  return (
    <Animated.View style={[styles.modeTabs, { opacity: selectionOpacity }]}>
      {RECIPE_PRESENTATION_MODES.map((mode) => {
        const isSelected = pendingMode ? pendingMode === mode : selectedMode === mode;
        const isSelectedUpdating = isUpdating && pendingMode === mode;

        return (
          <Pressable
            key={mode}
            accessibilityLabel={isSelectedUpdating ? `${mode}, updating recipe` : mode}
            accessibilityRole="button"
            accessibilityState={{ disabled: isUpdating, selected: isSelected }}
            disabled={isUpdating}
            onPress={() => {
              setPendingMode(mode);
              onSelectMode(mode);
            }}
            style={({ pressed }) => [
              styles.modeTab,
              isSelected ? styles.modeTabSelected : null,
              pressed ? styles.pressed : null,
            ]}
          >
            {isSelectedUpdating ? (
              <View accessibilityLabel="Updating recipe" accessibilityRole="progressbar">
                <ActivityIndicator color={colors.coralDark} size="small" />
              </View>
            ) : (
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                numberOfLines={1}
                style={[styles.modeTabText, isSelected ? styles.modeTabTextSelected : null]}
              >
                {mode}
              </Text>
            )}
          </Pressable>
        );
      })}
    </Animated.View>
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
    paddingBottom: 132,
    paddingHorizontal: 20,
  },
  heroCard: {
    marginTop: 2,
  },
  recipePhoto: {
    aspectRatio: 0.98,
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
  circleShareButton: {
    alignItems: 'center', backgroundColor: colors.card, borderRadius: 999, height: 42,
    justifyContent: 'center', position: 'absolute', right: 64, top: 14, width: 42,
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
    marginTop: 12,
    paddingTop: 0,
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
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
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
    marginTop: 20,
    paddingBottom: 8,
  },
  sectionSmallTitle: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  modeTabs: {
    backgroundColor: '#FCF5F0',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 2,
    marginTop: 8,
    minWidth: 0,
    padding: 3,
  },
  modeTab: {
    alignItems: 'center',
    borderRadius: 11,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 0,
    paddingHorizontal: 2,
  },
  modeTabSelected: {
    backgroundColor: colors.coralSoft,
    elevation: 2,
    shadowColor: colors.coralDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  modeTabText: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 10.25,
    fontWeight: '700',
    textAlign: 'center',
  },
  modeTabTextSelected: {
    color: colors.coralDark,
  },
  modeError: {
    color: colors.coralDark,
    fontFamily: fontFamilies.body,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
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
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    minWidth: 0,
  },
  equipmentCard: {
    alignItems: 'flex-start',
    backgroundColor: recipeColors.cream,
    borderRadius: 10,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  equipmentText: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
    textAlign: 'left',
  },
  bottomCookButton: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 22,
    justifyContent: 'center',
    marginHorizontal: 0,
    marginTop: 20,
    minHeight: 58,
    paddingHorizontal: 18,
  },
  bottomCookButtonText: {
    color: '#fffdf8',
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
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
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
  guidedHeader: {
    marginTop: 0,
    minHeight: 0,
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 4,
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
    gap: 7,
    marginTop: 2,
  },
  guidedProgressText: {
    color: recipeColors.muted,
    ...guidedCookingTypography.progress,
  },
  guidedProgressTrack: {
    backgroundColor: recipeColors.creamDeep,
    borderRadius: 999,
    height: 6,
    flex: 1,
    overflow: 'hidden',
  },
  guidedProgressFill: {
    backgroundColor: colors.coral,
    borderRadius: 999,
    height: '100%',
  },
  guidedStepCard: {
    marginTop: 8,
  },
  guidedStepCardShort: {
    minHeight: 340,
  },
  guidedStepCardContent: {
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
  guidedStepCardContentShort: {
    flex: 1,
  },
  guidedStepTitle: {
    color: recipeColors.charcoal,
    ...guidedCookingTypography.title,
    letterSpacing: 0,
    maxWidth: '96%',
  },
  guidedInstruction: {
    color: recipeColors.text,
    ...guidedCookingTypography.instruction,
    maxWidth: 370,
  },
  guidedInstructionScroll: {
    flexGrow: 0,
    marginTop: 6,
    maxHeight: 320,
  },
  guidedInstructionScrollLong: { maxHeight: 270 },
  guidedInstructionContentShort: {
    gap: 10,
    justifyContent: 'space-evenly',
    minHeight: 272,
    paddingBottom: 6,
  },
  guidanceBlock: { backgroundColor: colors.macrosSoft, borderRadius: 13, marginTop: 7, paddingHorizontal: 10, paddingVertical: 7 },
  guidanceSuccess: { backgroundColor: recipeColors.greenSoft },
  guidanceWarning: { backgroundColor: colors.coralSoft },
  guidanceHeading: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  guidanceLabel: { color: recipeColors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 12, fontWeight: '900' },
  guidanceText: { color: recipeColors.text, fontFamily: fontFamilies.body, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  feedbackTitle: { color: recipeColors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 16, fontWeight: '800', marginTop: 13 },
  feedbackRow: { flexDirection: 'row', gap: 6, marginTop: 7, width: '100%' },
  feedbackChoice: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, flex: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: 3 },
  feedbackChoiceSelected: { backgroundColor: colors.coralSoft, borderColor: colors.coral },
  feedbackChoiceText: { color: recipeColors.charcoal, fontFamily: fontFamilies.bold, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  feedbackReasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center', marginTop: 7 },
  feedbackReason: { borderColor: colors.border, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 9, paddingVertical: 5 },
  feedbackReasonSelected: { backgroundColor: recipeColors.yellowSoft, borderColor: colors.coral },
  feedbackReasonText: { color: recipeColors.text, fontFamily: fontFamilies.body, fontSize: 11 },
  feedbackNoteRow: { flexDirection: 'row', gap: 6, marginTop: 5, width: '100%' },
  feedbackNoteInput: { backgroundColor: recipeColors.cream, borderColor: colors.border, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, color: recipeColors.charcoal, flex: 1, fontFamily: fontFamilies.body, fontSize: 12, minHeight: 38, paddingHorizontal: 10, paddingVertical: 7 },
  feedbackNoteSave: { alignItems: 'center', backgroundColor: colors.coral, borderRadius: 10, justifyContent: 'center', minWidth: 54, paddingHorizontal: 10 },
  feedbackNoteSaveDisabled: { opacity: 0.45 },
  feedbackNoteSaveText: { color: '#FFFFFF', fontFamily: fontFamilies.extraBold, fontSize: 12, fontWeight: '800' },
  feedbackToast: { alignItems: 'center', backgroundColor: colors.charcoal, borderRadius: 999, elevation: 4, left: 24, paddingHorizontal: 18, paddingVertical: 8, position: 'absolute', right: 24, top: 8, zIndex: 20 },
  feedbackToastText: { color: '#FFFFFF', fontFamily: fontFamilies.extraBold, fontSize: 13, fontWeight: '800' },
  guidedChipGroup: {
    marginTop: 9,
  },
  guidedChipLabel: {
    color: recipeColors.muted,
    ...guidedCookingTypography.sectionLabel,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  guidedChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  guidedChipWrap: {
    backgroundColor: recipeColors.cream,
    borderColor: colors.coralSoft,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  guidedChipText: {
    color: recipeColors.charcoal,
    ...guidedCookingTypography.chip,
  },
  guidedControlArea: {
    backgroundColor: recipeColors.background,
    marginHorizontal: -20,
    marginTop: 'auto',
    paddingHorizontal: 20,
    paddingBottom: 4,
    paddingTop: 12,
    borderTopColor: 'rgba(238, 228, 214, 0.75)',
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: recipeColors.charcoal,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  guidedNextPreview: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 7,
    marginTop: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  guidedNextPreviewLabel: {
    color: colors.coralDark,
    ...guidedCookingTypography.sectionLabel,
    textTransform: 'uppercase',
  },
  guidedNextPreviewText: {
    color: recipeColors.charcoal,
    flex: 1,
    flexShrink: 1,
    ...guidedCookingTypography.upNext,
  },
  guidedNavRow: {
    flexDirection: 'row',
    gap: 8,
  },
  guidedNavButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: 'rgba(232, 220, 203, 0.8)',
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  guidedNavButtonPrimary: {
    backgroundColor: colors.coral,
    borderColor: colors.coral,
    shadowColor: colors.coralDark,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 2,
  },
  guidedNavButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    opacity: 1,
  },
  guidedNavText: {
    color: recipeColors.charcoal,
    ...guidedCookingTypography.button,
  },
  guidedNavTextDisabled: {
    color: recipeColors.muted,
  },
  guidedNavPrimaryText: {
    color: '#fffdf8',
    ...guidedCookingTypography.primaryButton,
  },
  completionCard: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  completionScrollContent: {
    flexGrow: 1,
    paddingTop: 2,
    paddingBottom: 104,
  },
  completionEyebrow: {
    color: colors.coralDark,
    fontFamily: fontFamilies.extraBold,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 29,
    marginTop: -8,
  },
  completionImage: {
    aspectRatio: 2.05,
    backgroundColor: recipeColors.cream,
    borderRadius: 22,
    width: '100%',
  },
  completionMascotArt: {
    height: 190,
    marginBottom: 0,
    marginTop: 4,
    width: '100%',
  },
  completionTitle: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 27,
    marginTop: 1,
    textAlign: 'center',
  },
  completionBody: {
    color: recipeColors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    textAlign: 'center',
  },
  completionActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    width: '100%',
  },
  completionShareAction: {
    alignItems: 'center',
    backgroundColor: recipeColors.cream,
    borderColor: 'rgba(232, 220, 203, 0.84)',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  completionShareText: {
    color: recipeColors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    fontWeight: '800',
  },
  completionHomeAction: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  completionHomeText: {
    color: '#fffdf8',
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
    ...guidedCookingTypography.nav,
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
  if (!recipe || recipe.estimatedSavings <= 0) return 0;
  return recipe.estimatedHomemadeCost + recipe.estimatedSavings;
}

function getSelectedIngredientIds(recipe: Recipe, groceryRecipeIds: string[], selections: Record<string, string[]>): string[] {
  const selected = selections[recipe.id] ?? [];
  if (selected.length > 0) return selected;
  return groceryRecipeIds.includes(recipe.id)
    ? recipe.ingredients.map((ingredient) => ingredient.name.trim().toLowerCase()).filter(Boolean)
    : [];
}

function getSafeTextList(values: string[] | undefined) {
  return (Array.isArray(values) ? values : [])
    .map((value) => cleanDisplayText(value))
    .filter(Boolean)
    .slice(0, 6);
}

function equipmentColumns(count: number): number {
  if (count <= 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  if (count === 4) return 4;
  if (count <= 6) return 3;
  return 4;
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
