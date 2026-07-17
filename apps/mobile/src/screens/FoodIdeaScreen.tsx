import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavArrowLeft, Spark } from 'iconoir-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createFoodIdeaRecipe } from '../api/client';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { colors, layout, radius, spacing, surfaces, typography } from '../theme/okyoTheme';

type FoodIdeaNavigation = NativeStackNavigationProp<RootStackParamList, 'FoodIdeaScreen'>;

export function FoodIdeaScreen() {
  const navigation = useNavigation<FoodIdeaNavigation>();
  const selectedMode = useOkyoStore((state) => state.selectedMode);
  const writeRecipeContext = useOkyoStore((state) => state.writeSavedRecipeContext);
  const [idea, setIdea] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const requestInFlight = useRef(false);
  const activeRequestId = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => () => {
    mounted.current = false;
    activeRequestId.current = null;
  }, []);

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MainTabs', { screen: 'HomeScreen' });
  };

  const generateRecipe = async () => {
    const trimmedIdea = idea.trim();
    if (requestInFlight.current || trimmedIdea.length < 8) return;
    const requestId = `idea-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    requestInFlight.current = true;
    activeRequestId.current = requestId;
    setStatus('loading');
    try {
      const result = await createFoodIdeaRecipe({ idea: trimmedIdea, mode: selectedMode, requestId });
      if (!mounted.current || activeRequestId.current !== requestId) return;
      if (!result.recipe) throw new Error('Recipe response was incomplete.');
      writeRecipeContext({ recipe: result.recipe, reason: 'open_generated_food_idea', source: 'FoodIdeaScreen' });
      navigation.replace('RecipeDetailScreen', { mode: result.recipe.mode });
    } catch {
      if (mounted.current && activeRequestId.current === requestId) setStatus('error');
    } finally {
      if (activeRequestId.current === requestId) {
        activeRequestId.current = null;
        requestInFlight.current = false;
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="Go back" accessibilityRole="button" style={styles.backButton} onPress={goBack}>
            <NavArrowLeft color={colors.charcoal} height={22} strokeWidth={2.3} width={22} />
          </Pressable>
          <Text style={styles.topTitle}>Food idea</Text>
          <View style={styles.topSpacer} />
        </View>

        <View style={styles.hero}>
          <Spark color={colors.coral} height={28} strokeWidth={2.2} width={28} />
          <Text style={styles.title}>What sounds good?</Text>
          <Text style={styles.body}>Describe the meal, ingredients, or craving. Okyo will generate a real recipe through the same provider-backed recipe system.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Your idea</Text>
          <TextInput
            accessibilityLabel="Describe a food idea"
            editable={status !== 'loading'}
            maxLength={6000}
            multiline
            onChangeText={(value) => { setIdea(value); if (status === 'error') setStatus('idle'); }}
            placeholder="Crispy chicken rice bowl with cucumber and spicy mayo, easy weeknight dinner…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            textAlignVertical="top"
            value={idea}
          />

          {status === 'loading' ? (
            <View accessibilityLiveRegion="polite" style={styles.message}>
              <Text style={styles.messageTitle}>Building your recipe…</Text>
              <Text style={styles.messageBody}>This can take about the same time as a photo scan. You can leave this screen; duplicate requests are blocked.</Text>
            </View>
          ) : status === 'error' ? (
            <View accessibilityLiveRegion="polite" style={styles.errorMessage}>
              <Text style={styles.messageTitle}>That recipe did not finish.</Text>
              <Text style={styles.messageBody}>Check your connection and try again. Okyo will not replace it with a made-up result.</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={idea.trim().length < 8 || status === 'loading'}
            onPress={() => void generateRecipe()}
            style={({ pressed }) => [
              styles.primaryButton,
              idea.trim().length < 8 || status === 'loading' ? styles.primaryButtonDisabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.primaryButtonText}>{status === 'loading' ? 'Generating…' : status === 'error' ? 'Retry recipe' : 'Generate recipe'}</Text>
          </Pressable>
          {idea.trim().length > 0 && idea.trim().length < 8 ? <Text style={styles.hint}>Add a little more detail first.</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { padding: spacing.screen, paddingBottom: layout.scrollClearance },
  topBar: { alignItems: 'center', flexDirection: 'row', minHeight: 52 },
  backButton: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 999, height: 44, justifyContent: 'center', width: 44 },
  topTitle: { color: colors.charcoal, flex: 1, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  topSpacer: { width: 44 },
  hero: { alignItems: 'flex-start', gap: 9, marginTop: 24 },
  title: { ...typography.display, fontSize: 32, lineHeight: 38 },
  body: { ...typography.body },
  form: { ...surfaces.card, marginTop: 22, padding: 18 },
  label: { color: colors.charcoal, fontSize: 16, fontWeight: '800' },
  input: { backgroundColor: colors.cream, borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, color: colors.charcoal, fontSize: 16, lineHeight: 23, marginTop: 10, minHeight: 170, padding: 14 },
  message: { backgroundColor: colors.cream, borderRadius: radius.card, marginTop: 12, padding: 13 },
  errorMessage: { backgroundColor: colors.coralSoft, borderRadius: radius.card, marginTop: 12, padding: 13 },
  messageTitle: { color: colors.charcoal, fontSize: 15, fontWeight: '800' },
  messageBody: { ...typography.caption, marginTop: 4 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.coral, borderRadius: radius.button, justifyContent: 'center', marginTop: 16, minHeight: 54, paddingHorizontal: 18 },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: { color: colors.onCoral, fontSize: 16, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 13, marginTop: 8, textAlign: 'center' },
  pressed: { opacity: 0.8 },
});
