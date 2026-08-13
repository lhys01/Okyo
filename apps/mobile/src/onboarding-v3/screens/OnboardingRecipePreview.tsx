import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Recipe } from '../../mocks';
import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { formatRecipeDuration, getRecipeTiming } from '../../utils/recipeIntegrity';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { ONBOARDING_BACK_ROW_HEIGHT, ONBOARDING_BACK_ROW_TOP_GAP, ONBOARDING_HORIZONTAL_PADDING } from '../components/onboardingLayout';
import { OnboardingCTA } from '../components/OnboardingCTA';

export function OnboardingRecipePreview({
  recipe,
  photoUri,
  mascotName,
  errorMessage,
  onBack,
  onContinue,
  onCook,
  onEditTitle,
  onRetry,
  onStartOver,
}: {
  recipe: Recipe | null;
  photoUri: string | null;
  mascotName: string;
  errorMessage: string | null;
  onBack: () => void;
  onContinue: () => void;
  onCook: () => void;
  onEditTitle: (title: string) => void;
  onRetry: () => void;
  onStartOver: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(recipe?.title ?? '');
  useEffect(() => {
    if (recipe && !editingTitle) setTitle(recipe.title);
  }, [editingTitle, recipe]);
  if (!recipe) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.header}><OnboardingBackButton onPress={onBack} /></View>
        <View style={styles.loadingContent}>
          <View style={[styles.skeleton, styles.skeletonHero]} />
          <View style={[styles.skeleton, styles.skeletonTitle]} />
          <View style={[styles.skeleton, styles.skeletonLine]} />
          {errorMessage ? (
            <View accessibilityLiveRegion="polite" style={styles.errorCard}>
              <Text style={styles.errorTitle}>{errorMessage}</Text>
              <Text style={styles.errorBody}>Your dish analysis is still available, so retrying won't scan the photo again.</Text>
              <OnboardingCTA label="Try again" onPress={onRetry} />
              <OnboardingCTA label="Start over" onPress={onStartOver} variant="secondary" />
            </View>
          ) : null}
        </View>
        <LoadingOverlay visible={!errorMessage} />
      </SafeAreaView>
    );
  }

  const timing = getRecipeTiming(recipe);
  const imageUri = recipe.imageUri ?? recipe.imageUrl ?? photoUri;
  const ingredients = recipe.ingredientGroups?.length
    ? recipe.ingredientGroups.flatMap((group) => group.items)
    : recipe.ingredients;
  const steps = recipe.structuredSteps?.length
    ? recipe.structuredSteps.map((step) => step.text)
    : recipe.steps;
  const saveTitle = () => {
    const next = title.trim();
    if (next) onEditTitle(next);
    else setTitle(recipe.title);
    setEditingTitle(false);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}><OnboardingBackButton onPress={onBack} /></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {imageUri ? <Image accessibilityLabel={`${recipe.title} photo`} contentFit="cover" source={{ uri: imageUri }} style={styles.hero} /> : null}
        <Text style={styles.eyebrow}>{mascotName}'s personalized recipe</Text>
        <View style={styles.titleRow}>
          {editingTitle ? (
            <TextInput
              accessibilityLabel="Recipe name"
              autoFocus
              onChangeText={setTitle}
              onSubmitEditing={saveTitle}
              returnKeyType="done"
              style={styles.titleInput}
              value={title}
            />
          ) : <Text style={styles.title}>{recipe.title}</Text>}
          <Pressable accessibilityLabel={editingTitle ? 'Save recipe name' : 'Edit recipe name'} accessibilityRole="button" onPress={() => editingTitle ? saveTitle() : setEditingTitle(true)} style={styles.editButton}>
            <Text style={styles.editText}>{editingTitle ? 'Save' : 'Edit'}</Text>
          </Pressable>
        </View>
        <Text style={styles.description}>{recipe.description}</Text>

        <View style={styles.stats}>
          <Stat label="Total" value={formatRecipeDuration(timing.totalMinutes)} />
          {timing.handsOnMinutes > 0 ? <Stat label="Hands-on" value={formatRecipeDuration(timing.handsOnMinutes)} /> : null}
          <Stat label="Serves" value={String(recipe.servings)} />
        </View>

        <RecipeSection title="Ingredients">
          {ingredients.map((ingredient, index) => (
            <View key={`${ingredient.name}-${index}`} style={styles.listRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{ingredient.quantity ? `${ingredient.quantity} ` : ''}{ingredient.name}</Text>
            </View>
          ))}
        </RecipeSection>
        <RecipeSection title="Steps">
          {steps.map((step, index) => (
            <View key={`${index}-${step.slice(0, 20)}`} style={styles.stepRow}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </RecipeSection>
        {recipe.equipment?.length ? (
          <RecipeSection title="Tools">
            <Text style={styles.listText}>{recipe.equipment.join(' · ')}</Text>
          </RecipeSection>
        ) : null}
        {recipe.estimatedHomemadeCost > 0 ? (
          <RecipeSection title="Estimated homemade cost">
            <Text style={styles.estimate}>About ${recipe.estimatedHomemadeCost.toFixed(2)}</Text>
            <Text style={styles.estimateNote}>AI estimate — your ingredients and local prices may differ.</Text>
          </RecipeSection>
        ) : null}
        {isUsableNutrition(recipe.nutritionEstimate) ? (
          <RecipeSection title="Estimated nutrition per serving">
            <View style={styles.nutritionRow}>
              <Stat label="Calories" value={String(Math.round(recipe.nutritionEstimate!.calories))} />
              <Stat label="Protein" value={`${Math.round(recipe.nutritionEstimate!.proteinGrams)}g`} />
              <Stat label="Carbs" value={`${Math.round(recipe.nutritionEstimate!.carbohydratesGrams)}g`} />
            </View>
            <Text style={styles.estimateNote}>Nutrition is an estimate, not medical advice.</Text>
          </RecipeSection>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <OnboardingCTA label="Continue" onPress={onContinue} />
        <OnboardingCTA label="Cook step-by-step" onPress={onCook} variant="secondary" />
      </View>
    </SafeAreaView>
  );
}

function RecipeSection({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function isUsableNutrition(value: Recipe['nutritionEstimate']) {
  return Boolean(value && value.calories > 0 && value.proteinGrams >= 0 && value.carbohydratesGrams >= 0 && value.fatGrams >= 0);
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { minHeight: ONBOARDING_BACK_ROW_HEIGHT, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: ONBOARDING_BACK_ROW_TOP_GAP },
  content: { paddingBottom: 30, paddingHorizontal: 24 },
  hero: { backgroundColor: colors.creamDeep, borderRadius: 28, height: 240, width: '100%' },
  eyebrow: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 12, letterSpacing: 0.4, marginTop: 22, textTransform: 'uppercase' },
  titleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, marginTop: 5 },
  title: { color: colors.charcoal, flex: 1, fontFamily: fontFamilies.extraBold, fontSize: 31, letterSpacing: -0.7, lineHeight: 38 },
  titleInput: { borderBottomColor: colors.coral, borderBottomWidth: 2, color: colors.charcoal, flex: 1, fontFamily: fontFamilies.extraBold, fontSize: 28, paddingVertical: 3 },
  editButton: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  editText: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 14 },
  description: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 23, marginTop: 9 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 20 },
  stat: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 16, flex: 1, minWidth: 0, paddingHorizontal: 8, paddingVertical: 13 },
  statValue: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 15, textAlign: 'center' },
  statLabel: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 11, marginTop: 3, textAlign: 'center' },
  section: { backgroundColor: colors.card, borderRadius: 22, marginTop: 16, padding: 18 },
  sectionTitle: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 19, marginBottom: 12 },
  listRow: { alignItems: 'flex-start', flexDirection: 'row', marginBottom: 8 },
  bullet: { color: colors.coral, fontSize: 19, marginRight: 8, marginTop: -1 },
  listText: { color: colors.body, flex: 1, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21 },
  stepRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 11, marginBottom: 14 },
  stepNumber: { alignItems: 'center', backgroundColor: colors.coralSoft, borderRadius: 999, height: 28, justifyContent: 'center', width: 28 },
  stepNumberText: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 12 },
  stepText: { color: colors.body, flex: 1, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21 },
  estimate: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 24 },
  estimateNote: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 11, lineHeight: 17, marginTop: 7 },
  nutritionRow: { flexDirection: 'row', gap: 7 },
  footer: { backgroundColor: colors.background, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, gap: 8, paddingBottom: 8, paddingHorizontal: 24, paddingTop: 10 },
  loadingContent: { flex: 1, paddingHorizontal: 24, paddingTop: 6 },
  skeleton: { backgroundColor: '#EEE4D6', borderRadius: 14 },
  skeletonHero: { height: 240 },
  skeletonTitle: { height: 36, marginTop: 22, width: '76%' },
  skeletonLine: { height: 18, marginTop: 13, width: '92%' },
  errorCard: { backgroundColor: colors.card, borderRadius: 24, marginTop: 26, padding: 20 },
  errorTitle: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 19, lineHeight: 26 },
  errorBody: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21, marginBottom: 17, marginTop: 7 },
});
