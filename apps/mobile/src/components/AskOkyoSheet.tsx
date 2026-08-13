import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { askOkyo } from '../api/client';
import type { Recipe, RecipeStep } from '../mocks';
import { onboardingV3Persistence } from '../onboarding-v3/state/onboardingV3Persistence';
import { foodPreferencesPersistence, toApiFoodPreferences } from '../state/foodPreferences';
import { scaleIngredient } from '../utils/servingScale';
import { colors, fontFamilies } from './OkyoUI';

export function AskOkyoSheet({ currentStep, onApplyFix, onClose, recipe, servings = recipe.servings, visible }: {
  currentStep?: RecipeStep;
  onApplyFix?: (instruction: string) => void;
  onClose: () => void;
  recipe: Recipe;
  servings?: number;
  visible: boolean;
}) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [suggestedCorrection, setSuggestedCorrection] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!visible) { setQuestion(''); setAnswer(''); setSuggestedCorrection(undefined); setError(''); }
  }, [visible]);

  const submit = async () => {
    if (!question.trim() || loading) return;
    setLoading(true); setError(''); setAnswer(''); setSuggestedCorrection(undefined);
    try {
      const [dietary, profile] = await Promise.all([
        foodPreferencesPersistence.read(),
        onboardingV3Persistence.readPersonalizedProfile(),
      ]);
      const contextualRecipe = servings === recipe.servings ? recipe : {
        ...recipe,
        servings,
        ingredients: recipe.ingredients.map((item) => scaleIngredient(item, recipe.servings, servings)),
        ingredientGroups: recipe.ingredientGroups?.map((group) => ({ ...group, items: group.items.map((item) => scaleIngredient(item, recipe.servings, servings)) })),
      };
      const response = await askOkyo(recipe.id, {
        question: question.trim(), recipe: contextualRecipe, currentStep,
        ...toApiFoodPreferences(dietary),
        goalContext: {
          primaryGoal: profile.primaryGoal ?? undefined,
          secondaryGoals: profile.secondaryGoals,
          handsOnTimeMinutes: profile.primaryGoal === 'save_money' ? profile.savings.handsOnTimeMinutes ?? undefined : profile.health.handsOnTimeMinutes ?? undefined,
          defaultServings: profile.savings.householdSize === 'Just me' ? 1 : profile.savings.householdSize === '2 people' ? 2 : profile.savings.householdSize === '3–4 people' ? 4 : profile.savings.householdSize === '5+ people' ? 5 : undefined,
          cookingPriority: profile.savings.cookingPriority ?? undefined,
          orderingFriction: profile.savings.orderingFriction.length
            ? profile.savings.orderingFriction.join(', ')
            : undefined,
          healthPriorities: profile.health.healthGoals.length ? profile.health.healthGoals : undefined,
          trackingPreference: profile.health.trackingPreference ?? undefined,
          nutritionTargets: profile.nutritionTargets ? {
            calories: profile.nutritionTargets.calories,
            proteinGrams: profile.nutritionTargets.proteinGrams,
            carbsGrams: profile.nutritionTargets.carbsGrams,
            fatGrams: profile.nutritionTargets.fatGrams,
          } : undefined,
        },
      });
      setAnswer(response.answer); setSuggestedCorrection(response.suggestedCorrection);
    } catch {
      setError('Okyo couldn’t answer that right now. Try again in a moment.');
    } finally { setLoading(false); }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoiding}>
        <View style={styles.sheet}>
          <View style={styles.header}><Text style={styles.title}>Ask Okyo</Text><Pressable accessibilityLabel="Close Ask Okyo" onPress={onClose}><Text style={styles.close}>Close</Text></Pressable></View>
          <Text style={styles.context}>{currentStep ? `Helping with: ${currentStep.title ?? 'current step'}` : `Helping with: ${recipe.title}`}</Text>
          <TextInput multiline onChangeText={setQuestion} placeholder="What’s happening in your kitchen?" placeholderTextColor={colors.muted} style={styles.input} value={question} />
          <Pressable accessibilityRole="button" disabled={!question.trim() || loading} onPress={() => void submit()} style={[styles.askButton, !question.trim() || loading ? styles.disabled : null]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.askText}>Ask</Text>}
          </Pressable>
          {answer ? <ScrollView keyboardShouldPersistTaps="handled" style={styles.answer}><Text style={styles.answerText}>{answer}</Text></ScrollView> : null}
          {suggestedCorrection && onApplyFix ? <Pressable accessibilityRole="button" onPress={() => onApplyFix(suggestedCorrection)} style={styles.apply}><Text style={styles.applyText}>Apply this fix to recipe</Text></Pressable> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.safety}>Use sight, texture, and a food thermometer for doneness—not timing alone.</Text>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(31,24,20,0.35)', flex: 1, justifyContent: 'flex-end' },
  keyboardAvoiding: { justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 34 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: colors.charcoal, fontFamily: fontFamilies.display, fontSize: 25, fontWeight: '800' },
  close: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 14, fontWeight: '700' },
  context: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 13, marginTop: 5 },
  input: { backgroundColor: '#fff', borderColor: colors.border, borderRadius: 18, borderWidth: 1, color: colors.charcoal, fontFamily: fontFamilies.body, fontSize: 16, marginTop: 16, minHeight: 96, padding: 14, textAlignVertical: 'top' },
  askButton: { alignItems: 'center', backgroundColor: colors.coral, borderRadius: 16, justifyContent: 'center', marginTop: 10, minHeight: 50 },
  disabled: { opacity: 0.45 },
  askText: { color: '#fff', fontFamily: fontFamilies.extraBold, fontSize: 15, fontWeight: '800' },
  answer: { backgroundColor: colors.cream, borderRadius: 18, marginTop: 16, maxHeight: 180, padding: 15 },
  answerText: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 22 },
  apply: { alignItems: 'center', borderColor: colors.coral, borderRadius: 15, borderWidth: 1, marginTop: 10, padding: 12 },
  applyText: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 14, fontWeight: '700' },
  error: { color: '#a43f35', fontFamily: fontFamilies.body, fontSize: 13, marginTop: 12 },
  safety: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 10.5, lineHeight: 15, marginTop: 14 },
});
