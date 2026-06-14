import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Bookmark,
  Cart,
  Check,
  Clock,
  Cutlery,
  FastArrowLeft,
  FastArrowRight,
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
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analyticsEvents, track } from '../analytics/track';
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
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { attachRealScanImage } from '../utils/savedRecipeImage';
import { uiLog } from '../utils/uiDebug';

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
type RecipeDetailNavigation = NativeStackNavigationProp<RootStackParamList, 'RecipeDetailScreen'>;
type RecipeDetailRoute = RouteProp<RootStackParamList, 'RecipeDetailScreen'>;
type DisplayRecipeStep = {
  text: string;
  timeEstimate?: string;
  visualCue?: string;
  whyItMatters?: string;
  safetyNote?: string;
  flavorBoost?: string;
  cookingTerm?: NonNullable<Recipe['cookingTerms']>[number];
};

export function RecipeDetailScreen() {
  const navigation = useNavigation<RecipeDetailNavigation>();
  const route = useRoute<RecipeDetailRoute>();
  const scrollRef = useRef<ScrollView | null>(null);
  const instructionTop = useRef(0);
  const stepOffsets = useRef<number[]>([]);
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
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const isDemoScan = isExplicitDemoScan(selectedScanImage);
  const storedRecipe = getStoredRecipeForMode(latestScanRecipes, selectedMode, latestScanRecipe);
  const recipe = storedRecipe ?? (isDemoScan ? getSafeRecipeForMode(selectedMode) : null);
  const scanResult = latestScanResult ?? (isDemoScan ? defaultScanResult : null);
  const restaurantPrice = scanResult?.restaurantPrice ?? getEstimatedRestaurantPrice(recipe);
  const canShowSavings = restaurantPrice > 0 && (recipe?.estimatedSavings ?? 0) > 0;
  const availableModes = scanResult?.modes ?? getAvailableModes(latestScanRecipes, latestScanRecipe, isDemoScan);
  const spicePairings = getSafeTextList(recipe?.spicePairings);
  const cookingTerms = getSafeCookingTerms(recipe?.cookingTerms);
  const ingredientGroups = getSafeIngredientGroups(recipe);
  const equipment = getSafeTextList(recipe?.equipment);
  const substitutions = getSafeTextList(recipe?.substitutions);
  const displaySteps = getRecipeDisplaySteps(recipe);
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
    setActiveStepIndex(0);
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

  const scrollToInstructions = () => {
    setActiveStepIndex(0);
    scrollToY(instructionTop.current);
  };

  const goToStep = (index: number) => {
    if (displaySteps.length === 0) {
      return;
    }

    const nextIndex = Math.max(0, Math.min(displaySteps.length - 1, index));
    setActiveStepIndex(nextIndex);
    scrollToY(stepOffsets.current[nextIndex] ?? instructionTop.current);
  };

  const scrollToY = (y: number) => {
    scrollRef.current?.scrollTo({ animated: true, y: Math.max(y - 12, 0) });
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
        ref={scrollRef}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.recipePhoto}>
            {selectedScanImage?.uri ? (
              <Image source={{ uri: selectedScanImage.uri }} resizeMode="cover" style={styles.recipePhotoImage} />
            ) : (
              <View style={styles.recipePhotoFallback}>
                <Cutlery color={colors.coral} height={42} strokeWidth={2.1} width={42} />
                <Text style={styles.recipePhotoFallbackText}>Okyo-style homemade version</Text>
              </View>
            )}
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
          </View>

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

            <PrimaryAction label="Start Cooking" onPress={scrollToInstructions} />
            <View style={styles.secondaryActionsRow}>
              <SecondaryIconAction icon={<Bookmark color={colors.charcoal} height={21} strokeWidth={2.1} width={21} />} label="Save" onPress={saveSelectedRecipe} />
              <SecondaryIconAction icon={<Cart color={colors.charcoal} height={21} strokeWidth={2.1} width={21} />} label="Grocery List" onPress={openGroceryList} />
              <SecondaryIconAction icon={<ShareAndroid color={colors.charcoal} height={21} strokeWidth={2.1} width={21} />} label="Share" onPress={openShareRecipe} />
            </View>
          </View>
        </View>

        <View
          onLayout={(event) => {
            instructionTop.current = event.nativeEvent.layout.y;
          }}
          style={styles.instructionsSection}
        >
          <View style={styles.instructionsHeader}>
            <Text style={styles.instructionsEyebrow}>STEP-BY-STEP</Text>
            <Text style={styles.instructionsTitle}>How to make it</Text>
            {displaySteps.length > 0 ? (
              <>
                <Text style={styles.stepProgressText}>Step {activeStepIndex + 1} of {displaySteps.length}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${((activeStepIndex + 1) / displaySteps.length) * 100}%` }]} />
                </View>
              </>
            ) : null}
          </View>

          {displaySteps.length > 0 ? (
            displaySteps.map((step, index) => {
              const parsedStep = getStepCopy(step, index);
              const tip = getStepTip(step, index, displaySteps.length, cookingTerms, spicePairings);
              const isActive = activeStepIndex === index;

              return (
                <View
                  key={`${recipe.id}-step-${index}-${step.text}`}
                  onLayout={(event) => {
                    stepOffsets.current[index] = event.nativeEvent.layout.y + instructionTop.current;
                  }}
                  style={[styles.stepCard, isActive ? styles.stepCardActive : null]}
                >
                  <View style={styles.stepTopRow}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>{index + 1}</Text>
                    </View>
                    <View style={styles.stepTitleGroup}>
                      <Text style={styles.stepTitle}>{parsedStep.title}</Text>
                      {step.timeEstimate ? <Text style={styles.stepTime}>{step.timeEstimate}</Text> : null}
                    </View>
                  </View>
                  <Text style={styles.stepBody}>{parsedStep.body}</Text>
                  {step.visualCue ? <Text style={styles.visualCue}>Cue: {cleanDisplayText(step.visualCue)}</Text> : null}
                  {tip ? (
                    <View style={styles.stepTipCard}>
                      <Spark color={colors.coral} height={16} strokeWidth={2.2} width={16} />
                      <View style={styles.stepTipCopy}>
                        <Text style={styles.stepTipTitle}>{tip.title}</Text>
                        <Text style={styles.stepTipText}>{tip.body}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <View style={styles.stepCard}>
              <Text style={styles.stepTitle}>Steps are not available yet.</Text>
              <Text style={styles.stepBody}>Try another style or scan again when you are ready.</Text>
            </View>
          )}

          {recipe.avoidMistake || recipe.storageAndReheating || recipe.pantryNote ? (
            <View style={styles.cookingNotesCard}>
              {recipe.avoidMistake ? (
                <View style={styles.noteBlock}>
                  <Text style={styles.noteTitle}>Helpful heads-up</Text>
                  <Text style={styles.noteText}>{cleanDisplayText(recipe.avoidMistake)}</Text>
                </View>
              ) : null}
              {recipe.storageAndReheating ? (
                <View style={styles.noteBlock}>
                  <Text style={styles.noteTitle}>Storage and reheating</Text>
                  <Text style={styles.noteText}>{cleanDisplayText(recipe.storageAndReheating)}</Text>
                </View>
              ) : null}
              {recipe.pantryNote ? (
                <View style={styles.noteBlock}>
                  <Text style={styles.noteTitle}>Pantry note</Text>
                  <Text style={styles.noteText}>{cleanDisplayText(recipe.pantryNote)}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {displaySteps.length > 0 ? (
            <View style={styles.stepNavigationRow}>
              <StepNavButton
                icon={<FastArrowLeft color={colors.charcoal} height={18} strokeWidth={2.25} width={18} />}
                label="Previous"
                onPress={() => goToStep(activeStepIndex - 1)}
                tone="secondary"
              />
              <StepNavButton
                icon={<FastArrowRight color="#fffdf8" height={18} strokeWidth={2.25} width={18} />}
                iconSide="right"
                label={activeStepIndex >= displaySteps.length - 1 ? 'Review Steps' : 'Next Step'}
                onPress={() => goToStep(activeStepIndex >= displaySteps.length - 1 ? 0 : activeStepIndex + 1)}
                tone="primary"
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
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

type StepNavButtonProps = {
  icon: ReactNode;
  iconSide?: 'left' | 'right';
  label: string;
  onPress: () => void;
  tone: 'primary' | 'secondary';
};

function StepNavButton({ icon, iconSide = 'left', label, onPress, tone }: StepNavButtonProps) {
  const isPrimary = tone === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepNavButton,
        isPrimary ? styles.stepNavButtonPrimary : styles.stepNavButtonSecondary,
        pressed ? styles.pressed : null,
      ]}
    >
      {iconSide === 'left' ? icon : null}
      <Text style={[styles.stepNavButtonText, isPrimary ? styles.stepNavButtonTextPrimary : null]}>{label}</Text>
      {iconSide === 'right' ? icon : null}
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
    paddingBottom: 28,
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
  recipePhotoImage: {
    height: '100%',
    width: '100%',
  },
  recipePhotoFallback: {
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    padding: 24,
  },
  recipePhotoFallbackText: {
    color: colors.body,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
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
  instructionsSection: {
    paddingTop: 16,
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
  stepNavigationRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  stepNavButton: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
  },
  stepNavButtonPrimary: {
    backgroundColor: colors.coral,
  },
  stepNavButtonSecondary: {
    backgroundColor: colors.card,
  },
  stepNavButtonText: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '700',
  },
  stepNavButtonTextPrimary: {
    color: '#fffdf8',
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
