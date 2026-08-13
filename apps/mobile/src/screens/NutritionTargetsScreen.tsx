import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavArrowLeft } from 'iconoir-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MainTabParamList } from '../navigation/types';
import { NUTRITION_CALCULATION_VERSION, type NutritionTargets } from '../onboarding-v3/state/nutritionTargets';
import { onboardingV3Persistence } from '../onboarding-v3/state/onboardingV3Persistence';
import type { PersonalizedOnboardingProfile } from '../onboarding-v3/state/personalizedOnboarding';
import { colors, fontFamilies, radius, spacing } from '../theme/okyoTheme';

type Navigation = NativeStackNavigationProp<MainTabParamList>;
type EditableTarget = keyof Pick<NutritionTargets, 'calories' | 'proteinGrams' | 'carbsGrams' | 'fatGrams'>;
type TargetDraft = Record<EditableTarget, string>;

const targetFields: Array<{ key: EditableTarget; label: string; suffix: string; min: number; max: number }> = [
  { key: 'calories', label: 'Calories', suffix: 'cal / day', min: 1000, max: 5000 },
  { key: 'proteinGrams', label: 'Protein', suffix: 'g / day', min: 20, max: 350 },
  { key: 'carbsGrams', label: 'Carbs', suffix: 'g / day', min: 0, max: 700 },
  { key: 'fatGrams', label: 'Fat', suffix: 'g / day', min: 20, max: 250 },
];

function draftFor(targets: NutritionTargets): TargetDraft {
  return {
    calories: String(targets.calories),
    proteinGrams: String(targets.proteinGrams),
    carbsGrams: String(targets.carbsGrams),
    fatGrams: String(targets.fatGrams),
  };
}

export function NutritionTargetsScreen() {
  const navigation = useNavigation<Navigation>();
  const [profile, setProfile] = useState<PersonalizedOnboardingProfile | null>(null);
  const [draft, setDraft] = useState<TargetDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    void onboardingV3Persistence.readPersonalizedProfile().then((stored) => {
      if (!mounted) return;
      setProfile(stored);
      if (stored.nutritionTargets) setDraft(draftFor(stored.nutritionTargets));
    });
    return () => { mounted = false; };
  }, []);

  const goBack = () => { if (navigation.canGoBack()) navigation.goBack(); };
  const save = async () => {
    if (!profile || !profile.nutritionTargets || !draft || saving) return;
    const values = Object.fromEntries(targetFields.map((field) => [field.key, Number(draft[field.key])])) as Record<EditableTarget, number>;
    const invalid = targetFields.find((field) => !Number.isInteger(values[field.key]) || values[field.key] < field.min || values[field.key] > field.max);
    if (invalid) {
      Alert.alert('Check that target', `${invalid.label} needs to be within a practical range.`);
      return;
    }
    setSaving(true);
    try {
      await onboardingV3Persistence.writePersonalizedProfile({
        ...profile,
        nutritionTargets: {
          ...values,
          source: 'manual',
          calculationVersion: NUTRITION_CALCULATION_VERSION,
          calculatedAt: new Date().toISOString(),
        },
      });
      goBack();
    } catch {
      Alert.alert('Couldn’t save targets', 'Try again in a moment.');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return <View accessibilityLabel="Loading nutrition targets" accessibilityRole="progressbar" style={styles.loading}><ActivityIndicator color={colors.coral} /></View>;
  if (!profile.nutritionTargets || !draft) {
    return <SafeAreaView style={styles.safeArea}><View style={styles.header}><Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={goBack} style={styles.back}><NavArrowLeft color={colors.ink} height={25} width={25} /></Pressable><Text style={styles.title}>Nutrition targets</Text></View><View style={styles.empty}><Text style={styles.emptyTitle}>Set targets during macro onboarding</Text><Text style={styles.emptyBody}>Choose Hit my macros during onboarding to create starting targets you can edit here.</Text></View></SafeAreaView>;
  }

  return <SafeAreaView style={styles.safeArea}><View style={styles.header}><Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={goBack} style={styles.back}><NavArrowLeft color={colors.ink} height={25} width={25} /></Pressable><Text style={styles.title}>Nutrition targets</Text></View><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={styles.intro}>These are starting targets, not medical advice. Adjust them whenever your needs change.</Text>{targetFields.map((field) => <View key={field.key} style={styles.targetCard}><Text style={styles.targetLabel}>{field.label}</Text><View style={styles.inputRow}><TextInput accessibilityLabel={`${field.label} target`} keyboardType="number-pad" maxLength={4} onChangeText={(value) => setDraft((current) => current ? { ...current, [field.key]: value.replace(/[^0-9]/g, '') } : current)} style={styles.input} value={draft[field.key]} /><Text style={styles.suffix}>{field.suffix}</Text></View></View>)}<Pressable accessibilityLabel="Save nutrition targets" accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.save, saving && styles.disabled]}>{saving ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.saveText}>Save targets</Text>}</Pressable></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center' },
  header: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: spacing.gutter, paddingVertical: 10 },
  back: { alignItems: 'center', height: 44, justifyContent: 'center', marginLeft: -10, width: 44 },
  title: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 22 },
  content: { paddingBottom: 44, paddingHorizontal: spacing.gutter },
  intro: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 22, marginBottom: 20, marginTop: 4 },
  targetCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.panel, borderWidth: 1, marginBottom: 12, padding: 16 },
  targetLabel: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 16 },
  inputRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 10 },
  input: { backgroundColor: colors.canvasSunk, borderRadius: 12, color: colors.ink, flex: 1, fontFamily: fontFamilies.extraBold, fontSize: 24, minHeight: 50, paddingHorizontal: 12 },
  suffix: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 14, minWidth: 76 },
  save: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: radius.button, justifyContent: 'center', marginTop: 14, minHeight: 54 },
  saveText: { color: colors.surface, fontFamily: fontFamilies.extraBold, fontSize: 16 },
  empty: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 21, textAlign: 'center' },
  emptyBody: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: 'center' },
  disabled: { opacity: 0.55 },
});
