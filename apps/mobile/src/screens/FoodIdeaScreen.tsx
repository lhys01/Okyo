import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import {
  Cart,
  CheckCircle,
  NavArrowLeft,
  OpenBook,
  PasteClipboard,
  Spark,
  Upload,
} from 'iconoir-react-native';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecipeQualityCard } from '../components/RecipeQualityCard';
import { analyticsEvents, track } from '../analytics/track';
import { checkRecipeQualityWithBackend } from '../api/recipeCheckClient';
import type { FoodIdeaSourceType, SavedFoodIdea } from '../mocks';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { colors, fontFamilies, layout, radius, shadows, spacing, typography } from '../theme/okyoTheme';
import { createSavedFoodIdea } from '../utils/recipeQuality';
import { uiLog } from '../utils/uiDebug';

type FoodIdeaNavigation = NativeStackNavigationProp<RootStackParamList, 'FoodIdeaScreen'>;

const sourceOptions: Array<{ id: FoodIdeaSourceType; label: string; helper: string }> = [
  {
    id: 'text',
    label: 'Pasted text',
    helper: 'Paste visible recipe text, a caption, or messy notes.',
  },
  {
    id: 'link',
    label: 'Link',
    helper: 'Save the URL and paste any visible recipe text below. Okyo will not scrape it.',
  },
  {
    id: 'manual_note',
    label: 'Manual note',
    helper: 'Write the idea in your own words. Rough is fine.',
  },
];

export function FoodIdeaScreen() {
  const navigation = useNavigation<FoodIdeaNavigation>();
  const saveFoodIdea = useOkyoStore((state) => state.saveFoodIdea);
  const saveRecipe = useOkyoStore((state) => state.saveRecipe);
  const writeSavedRecipeContext = useOkyoStore((state) => state.writeSavedRecipeContext);
  const setSelectedMode = useOkyoStore((state) => state.setSelectedMode);
  const [sourceType, setSourceType] = useState<FoodIdeaSourceType>('text');
  const [rawText, setRawText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [checkedIdea, setCheckedIdea] = useState<SavedFoodIdea | null>(null);
  const checkRequestId = useRef(0);
  const trimmedText = rawText.trim();
  const trimmedUrl = sourceUrl.trim();
  const activeSource = sourceOptions.find((option) => option.id === sourceType) ?? sourceOptions[0];
  const canCheck = sourceType === 'link'
    ? trimmedUrl.length > 0 || trimmedText.length > 0
    : trimmedText.length >= 8;
  const savedIdeaCount = useOkyoStore((state) => (
    Array.isArray(state.savedFoodIdeas) ? state.savedFoodIdeas.length : 0
  ));
  const inputPlaceholder = useMemo(() => getPlaceholder(sourceType), [sourceType]);

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('MainTabs', { screen: 'HomeScreen' });
  };

  const pasteFromClipboard = async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync();
      if (!clipboardText.trim()) {
        Alert.alert('Nothing to paste', 'Copy a food idea, caption, or link first.');
        return;
      }
      if (looksLikeUrl(clipboardText.trim())) {
        setSourceType('link');
        setSourceUrl(clipboardText.trim());
      } else {
        setRawText(clipboardText);
      }
      setCheckedIdea(null);
      uiLog('FoodIdeaScreen', 'paste_clipboard');
    } catch {
      Alert.alert('Paste unavailable', 'Okyo could not read the clipboard on this device.');
    }
  };

  const runCheck = () => {
    if (!canCheck) {
      Alert.alert('Add a little more detail', 'Paste a link, caption, recipe text, or short note so Okyo has something to check.');
      return;
    }

    const idea = createSavedFoodIdea({
      rawText: trimmedText || trimmedUrl,
      sourceType,
      sourceUrl: sourceType === 'link' && trimmedUrl ? trimmedUrl : undefined,
    });
    setCheckedIdea(idea);
    uiLog('FoodIdeaScreen', 'recipe_check_created', { sourceType });

    const requestId = checkRequestId.current + 1;
    checkRequestId.current = requestId;
    checkRecipeQualityWithBackend(idea.extractedRecipe!, {
      source: 'foodIdea',
      skillLevel: idea.extractedRecipe?.difficulty,
    })
      .then((qualityReport) => {
        if (checkRequestId.current !== requestId) {
          return;
        }
        setCheckedIdea((current) => (
          current?.id === idea.id ? { ...current, qualityReport } : current
        ));
      })
      .catch(() => {
        // Local Recipe Check is already visible; backend is an enhancement only.
      });
  };

  const saveAndOpen = (target: 'recipe' | 'grocery' | 'cook') => {
    if (!checkedIdea?.extractedRecipe) {
      return;
    }

    saveFoodIdea(checkedIdea);
    saveRecipe(checkedIdea.extractedRecipe);
    writeSavedRecipeContext({
      recipe: checkedIdea.extractedRecipe,
      reason: 'open_food_idea_recipe',
      source: 'FoodIdeaScreen.saveAndOpen',
    });
    setSelectedMode(checkedIdea.extractedRecipe.mode);
    track(analyticsEvents.RECIPE_SAVED, {
      dishName: checkedIdea.extractedRecipe.title,
      mode: checkedIdea.extractedRecipe.mode,
      screen: 'FoodIdeaScreen',
      source: checkedIdea.sourceType,
    });
    uiLog('FoodIdeaScreen', 'save_food_idea', { target, sourceType: checkedIdea.sourceType });

    if (target === 'grocery') {
      navigation.navigate('MainTabs', { screen: 'GroceryListScreen', params: { mode: checkedIdea.extractedRecipe.mode } });
      return;
    }
    if (target === 'cook') {
      navigation.navigate('MainTabs', { screen: 'RecipeStepsScreen', params: { mode: checkedIdea.extractedRecipe.mode } });
      return;
    }
    navigation.navigate('MainTabs', { screen: 'RecipeDetailScreen', params: { mode: checkedIdea.extractedRecipe.mode } });
  };

  const openPhotoScan = () => {
    navigation.navigate('MainTabs', { screen: 'HomeScreen' });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={goBack}
            style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
          >
            <NavArrowLeft color={colors.charcoal} height={22} strokeWidth={2.35} width={22} />
          </Pressable>
          <Text numberOfLines={1} style={styles.topTitle}>Food idea</Text>
          <View style={styles.topSpacer} />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Spark color={colors.coral} height={24} strokeWidth={2.35} width={24} />
          </View>
          <Text style={styles.heroTitle}>Save any food chaos.</Text>
          <Text style={styles.heroBody}>
            Paste a recipe, caption, link, or rough note. Okyo will check if it is actually cookable before it becomes dinner.
          </Text>
          <Text style={styles.savedCount}>{savedIdeaCount} saved food {savedIdeaCount === 1 ? 'idea' : 'ideas'} on this device</Text>
        </View>

        <View style={styles.sourceCard}>
          <Text style={styles.sectionTitle}>What are you saving?</Text>
          <View style={styles.sourceRow}>
            {sourceOptions.map((option) => {
              const selected = option.id === sourceType;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={option.id}
                  onPress={() => {
                    setSourceType(option.id);
                    setCheckedIdea(null);
                  }}
                  style={({ pressed }) => [
                    styles.sourceChip,
                    selected ? styles.sourceChipSelected : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text style={[styles.sourceChipText, selected ? styles.sourceChipTextSelected : null]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.helperText}>{activeSource.helper}</Text>

          {sourceType === 'link' ? (
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onChangeText={(value) => {
                setSourceUrl(value);
                setCheckedIdea(null);
              }}
              placeholder="https://..."
              placeholderTextColor={colors.muted}
              style={styles.urlInput}
              value={sourceUrl}
            />
          ) : null}

          <TextInput
            multiline
            maxLength={6000}
            onChangeText={(value) => {
              setRawText(value);
              setCheckedIdea(null);
            }}
            placeholder={inputPlaceholder}
            placeholderTextColor={colors.muted}
            style={styles.ideaInput}
            textAlignVertical="top"
            value={rawText}
          />

          {sourceType === 'link' ? (
            <View style={styles.linkNote}>
              <CheckCircle color={colors.green} height={18} strokeWidth={2.25} width={18} />
              <Text style={styles.linkNoteText}>
                Okyo saves the link as context, but does not scrape social or recipe sites yet. Paste visible text for a better check.
              </Text>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              onPress={pasteFromClipboard}
              style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}
            >
              <PasteClipboard color={colors.charcoal} height={19} strokeWidth={2.2} width={19} />
              <Text style={styles.secondaryButtonText}>Paste</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={runCheck}
              style={({ pressed }) => [
                styles.primaryButton,
                !canCheck ? styles.primaryButtonDisabled : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.primaryButtonText}>Check recipe</Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={openPhotoScan}
          style={({ pressed }) => [styles.photoRouteCard, pressed ? styles.pressed : null]}
        >
          <View style={styles.photoRouteIcon}>
            <Upload color={colors.coral} height={20} strokeWidth={2.2} width={20} />
          </View>
          <View style={styles.photoRouteCopy}>
            <Text style={styles.photoRouteTitle}>Have a screenshot or food photo?</Text>
            <Text style={styles.photoRouteBody}>Use the existing photo scan for now. Cookbook/social screenshot extraction comes later.</Text>
          </View>
        </Pressable>

        {checkedIdea?.qualityReport && checkedIdea.extractedRecipe ? (
          <View style={styles.previewSection}>
            <Text style={styles.sectionTitle}>Recipe Check preview</Text>
            <RecipeQualityCard report={checkedIdea.qualityReport} />

            <View style={styles.recipePreviewCard}>
              <Text style={styles.recipePreviewLabel}>Draft recipe</Text>
              <Text numberOfLines={2} style={styles.recipePreviewTitle}>{checkedIdea.extractedRecipe.title}</Text>
              <Text style={styles.recipePreviewMeta}>
                {checkedIdea.extractedRecipe.totalTimeMinutes} min · {checkedIdea.extractedRecipe.ingredients.length} ingredients · local preview
              </Text>
            </View>

            <View style={styles.previewActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => saveAndOpen('recipe')}
                style={({ pressed }) => [styles.fullPrimaryButton, pressed ? styles.pressed : null]}
              >
                <OpenBook color={colors.onCoral} height={20} strokeWidth={2.15} width={20} />
                <Text style={styles.fullPrimaryButtonText}>Save and open recipe</Text>
              </Pressable>
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => saveAndOpen('grocery')}
                  style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}
                >
                  <Cart color={colors.charcoal} height={19} strokeWidth={2.2} width={19} />
                  <Text style={styles.secondaryButtonText}>Groceries</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => saveAndOpen('cook')}
                  style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}
                >
                  <CheckCircle color={colors.charcoal} height={19} strokeWidth={2.2} width={19} />
                  <Text style={styles.secondaryButtonText}>Cook tonight</Text>
                </Pressable>
              </View>
              <View style={styles.adaptRow}>
                {['Make cheaper', 'Make it faster', 'Less spicy', 'Beginner-friendly'].map((label) => (
                  <View key={label} style={styles.adaptChip}>
                    <Text style={styles.adaptChipText}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function getPlaceholder(sourceType: FoodIdeaSourceType) {
  if (sourceType === 'manual_note') {
    return 'Example: crispy chicken rice bowl, spicy mayo, cucumber, 25 min, easy weeknight dinner...';
  }
  if (sourceType === 'link') {
    return 'Paste the caption, visible recipe text, or your notes from the link here...';
  }
  return 'Paste ingredients, steps, a caption, or a messy recipe note here...';
}

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value) || /^www\./i.test(value);
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    gap: spacing.lg,
    paddingBottom: layout.scrollClearance,
    paddingHorizontal: spacing.screen,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 62,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
    ...shadows.soft,
  },
  topTitle: {
    color: colors.charcoal,
    flex: 1,
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  topSpacer: {
    width: 42,
  },
  heroCard: {
    backgroundColor: colors.cardWarm,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.card,
    ...shadows.card,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: colors.coralSoft,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  heroTitle: {
    ...typography.title,
  },
  heroBody: {
    ...typography.body,
  },
  savedCount: {
    color: colors.muted,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  sourceCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.card,
    ...shadows.soft,
  },
  sectionTitle: {
    ...typography.heading,
  },
  sourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sourceChip: {
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: radius.chip,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  sourceChipSelected: {
    backgroundColor: colors.coralSoft,
    borderColor: colors.coral,
  },
  sourceChipText: {
    color: colors.body,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  sourceChipTextSelected: {
    color: colors.coralDark,
  },
  helperText: {
    color: colors.body,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
  },
  urlInput: {
    backgroundColor: colors.cardWarm,
    borderColor: colors.border,
    borderRadius: radius.panel,
    borderWidth: 1,
    color: colors.charcoal,
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  ideaInput: {
    backgroundColor: colors.cardWarm,
    borderColor: colors.border,
    borderRadius: radius.panel,
    borderWidth: 1,
    color: colors.charcoal,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    lineHeight: 23,
    minHeight: 148,
    padding: 14,
  },
  linkNote: {
    alignItems: 'flex-start',
    backgroundColor: colors.greenSoft,
    borderRadius: radius.panel,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  linkNoteText: {
    color: colors.charcoal,
    flex: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: radius.button,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: radius.button,
    flex: 1.2,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
    ...shadows.cta,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.mutedSoft,
    shadowOpacity: 0,
  },
  primaryButtonText: {
    color: colors.onCoral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    fontWeight: '800',
  },
  photoRouteCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.panel,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.soft,
  },
  photoRouteIcon: {
    alignItems: 'center',
    backgroundColor: colors.coralSoft,
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  photoRouteCopy: {
    flex: 1,
  },
  photoRouteTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  photoRouteBody: {
    color: colors.body,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
  },
  previewSection: {
    gap: spacing.md,
  },
  recipePreviewCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.panel,
    borderWidth: 1,
    gap: 4,
    padding: spacing.md,
  },
  recipePreviewLabel: {
    ...typography.label,
    color: colors.coralDark,
  },
  recipePreviewTitle: {
    color: colors.charcoal,
    fontFamily: fontFamilies.extraBold,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 25,
  },
  recipePreviewMeta: {
    color: colors.body,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  previewActions: {
    gap: spacing.sm,
  },
  fullPrimaryButton: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: radius.button,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
    ...shadows.cta,
  },
  fullPrimaryButtonText: {
    color: colors.onCoral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    fontWeight: '800',
  },
  adaptRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  adaptChip: {
    backgroundColor: colors.greenSoft,
    borderRadius: radius.chip,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  adaptChipText: {
    color: colors.green,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
