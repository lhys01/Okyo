import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavArrowLeft, Search, WarningTriangle } from 'iconoir-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MainTabParamList } from '../navigation/types';
import { saveAuthoritativeDietaryPreferences } from '../state/dietaryPreferencesAuthority';
import { EMPTY_FOOD_PREFERENCES, foodPreferencesPersistence, type FoodPreferences } from '../state/foodPreferences';
import { colors, fontFamilies, radius, spacing } from '../theme/okyoTheme';
import { uiLog } from '../utils/uiDebug';

type Navigation = NativeStackNavigationProp<MainTabParamList>;
type PreferenceKey = keyof FoodPreferences;

const ALLERGIES = ['Peanuts', 'Tree nuts', 'Milk / dairy', 'Eggs', 'Wheat', 'Gluten', 'Soy', 'Fish', 'Shellfish', 'Sesame'];
const RESTRICTIONS = ['Vegetarian', 'Vegan', 'Pescatarian', 'Gluten-free', 'Dairy-free', 'Halal', 'Kosher', 'Low-carb', 'Keto'];
const AVOIDANCES = ['Pork', 'Beef', 'Red meat', 'Seafood', 'Mushrooms', 'Spicy food', 'Alcohol in recipes', 'Added sugar'];
const DISLIKES = ['Olives', 'Cilantro', 'Mushrooms'];

export function DietaryPreferencesScreen() {
  const navigation = useNavigation<Navigation>();
  const [preferences, setPreferences] = useState<FoodPreferences | null>(null);
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<'allergies' | 'avoidances' | 'dislikes', string>>({ allergies: '', avoidances: '', dislikes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    void foodPreferencesPersistence.read().then((stored) => { if (mounted) setPreferences(stored); }).catch(() => { if (mounted) setPreferences({ ...EMPTY_FOOD_PREFERENCES }); });
    return () => { mounted = false; };
  }, []);

  const goBack = () => { if (navigation.canGoBack()) navigation.goBack(); };
  const toggle = (key: PreferenceKey, value: string) => setPreferences((current) => current ? ({
    ...current,
    [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
  }) : current);
  const addCustom = (key: 'allergies' | 'avoidances' | 'dislikes') => {
    const value = drafts[key].trim();
    if (!value || !preferences) return;
    setPreferences({ ...preferences, [key]: [...new Set([...preferences[key], value])] });
    setDrafts((current) => ({ ...current, [key]: '' }));
  };
  const save = async () => {
    if (!preferences || saving) return;
    setSaving(true);
    try {
      await saveAuthoritativeDietaryPreferences(preferences);
      uiLog('DietaryPreferencesScreen', 'save', Object.fromEntries(Object.entries(preferences).map(([key, values]) => [key, values.length])));
      goBack();
    } catch {
      Alert.alert('Couldn’t save preferences', 'Try again in a moment.');
    } finally { setSaving(false); }
  };

  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => ({
    allergies: ALLERGIES.filter((item) => item.toLowerCase().includes(query)),
    restrictions: RESTRICTIONS.filter((item) => item.toLowerCase().includes(query)),
    avoidances: AVOIDANCES.filter((item) => item.toLowerCase().includes(query)),
    dislikes: DISLIKES.filter((item) => item.toLowerCase().includes(query)),
  }), [query]);

  if (!preferences) return <View accessibilityLabel="Loading dietary preferences" accessibilityRole="progressbar" style={styles.loading}><ActivityIndicator color={colors.coral} /></View>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={12} onPress={goBack} style={styles.back}><NavArrowLeft color={colors.ink} height={25} width={25} /></Pressable>
          <Text style={styles.title}>Dietary preferences</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>Okyo uses these preferences when analyzing food and creating recipes.</Text>
          <View style={styles.search}>
            <Search color={colors.muted} height={19} width={19} />
            <TextInput accessibilityLabel="Search dietary preferences" onChangeText={setSearch} placeholder="Search preferences" placeholderTextColor={colors.muted} style={styles.searchInput} value={search} />
          </View>

          <PreferenceSection danger description="Allergies receive prominent warnings. Okyo cannot guarantee allergen detection—always verify ingredients and labels." label="ALLERGIES" options={filtered.allergies} selected={preferences.allergies} onToggle={(value) => toggle('allergies', value)} />
          <CustomEntry danger label="Other allergy" value={drafts.allergies} onChange={(value) => setDrafts((current) => ({ ...current, allergies: value }))} onAdd={() => addCustom('allergies')} />

          <PreferenceSection description="Hard recipe-generation preferences Okyo will try to preserve." label="DIETARY RESTRICTIONS" options={filtered.restrictions} selected={preferences.restrictions} onToggle={(value) => toggle('restrictions', value)} />

          <PreferenceSection description="Ingredients you prefer recipes to avoid. These are not treated as allergies." label="THINGS I AVOID" options={filtered.avoidances} selected={preferences.avoidances} onToggle={(value) => toggle('avoidances', value)} />
          <CustomEntry label="Add something I avoid" value={drafts.avoidances} onChange={(value) => setDrafts((current) => ({ ...current, avoidances: value }))} onAdd={() => addCustom('avoidances')} />

          <PreferenceSection description="Foods you simply don’t enjoy. Dislikes never trigger an allergy warning." label="DISLIKES" options={filtered.dislikes} selected={preferences.dislikes} onToggle={(value) => toggle('dislikes', value)} />
          <CustomEntry label="Add a disliked food" value={drafts.dislikes} onChange={(value) => setDrafts((current) => ({ ...current, dislikes: value }))} onAdd={() => addCustom('dislikes')} />
        </ScrollView>
        <View style={styles.footer}><Pressable accessibilityLabel="Save dietary preferences" accessibilityRole="button" disabled={saving} onPress={() => void save()} style={({ pressed }) => [styles.save, pressed && styles.pressed]}>{saving ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.saveText}>Save preferences</Text>}</Pressable></View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PreferenceSection({ danger, description, label, onToggle, options, selected }: { danger?: boolean; description: string; label: string; onToggle: (value: string) => void; options: string[]; selected: string[] }) {
  return <View style={styles.section}>
    <View style={styles.sectionHeading}>{danger ? <WarningTriangle color={colors.danger} height={18} width={18} /> : null}<Text style={[styles.sectionLabel, danger && styles.dangerLabel]}>{label}</Text></View>
    <Text style={styles.description}>{description}</Text>
    <View style={styles.chips}>{options.map((option) => <Pressable key={option} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(option) }} onPress={() => onToggle(option)} style={[styles.chip, selected.includes(option) && (danger ? styles.dangerChipSelected : styles.chipSelected)]}><Text style={[styles.chipText, selected.includes(option) && (danger ? styles.dangerChipText : styles.chipTextSelected)]}>{option}</Text></Pressable>)}</View>
    {selected.filter((item) => !options.includes(item)).map((item) => <Pressable key={item} accessibilityRole="checkbox" accessibilityState={{ checked: true }} onPress={() => onToggle(item)} style={[styles.chip, danger ? styles.dangerChipSelected : styles.chipSelected]}><Text style={danger ? styles.dangerChipText : styles.chipTextSelected}>{item} ×</Text></Pressable>)}
  </View>;
}

function CustomEntry({ danger, label, onAdd, onChange, value }: { danger?: boolean; label: string; onAdd: () => void; onChange: (value: string) => void; value: string }) {
  return <View style={styles.customRow}><TextInput accessibilityLabel={label} maxLength={60} onChangeText={onChange} onSubmitEditing={onAdd} placeholder={label} placeholderTextColor={colors.muted} returnKeyType="done" style={[styles.customInput, danger && styles.dangerInput]} value={value} /><Pressable accessibilityLabel={`Add ${label}`} accessibilityRole="button" disabled={!value.trim()} onPress={onAdd} style={[styles.add, danger && styles.addDanger, !value.trim() && styles.disabled]}><Text style={[styles.addText, danger && styles.addDangerText]}>Add</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { backgroundColor: colors.background, flex: 1 }, loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center' },
  header: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: spacing.gutter, paddingVertical: 10 }, back: { alignItems: 'center', height: 44, justifyContent: 'center', marginLeft: -10, width: 44 }, title: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 22 },
  content: { paddingBottom: 32, paddingHorizontal: spacing.gutter }, intro: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 22, marginBottom: 16 },
  search: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 9, paddingHorizontal: 13 }, searchInput: { color: colors.ink, flex: 1, fontFamily: fontFamilies.body, fontSize: 15, minHeight: 46 },
  section: { marginTop: 26 }, sectionHeading: { alignItems: 'center', flexDirection: 'row', gap: 7 }, sectionLabel: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 12, letterSpacing: 0.8 }, dangerLabel: { color: colors.danger }, description: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 12 }, chip: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, minHeight: 38, paddingHorizontal: 14, paddingVertical: 9 }, chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink }, dangerChipSelected: { backgroundColor: '#fff0ee', borderColor: colors.danger }, chipText: { color: colors.body, fontFamily: fontFamilies.semibold, fontSize: 13 }, chipTextSelected: { color: colors.surface }, dangerChipText: { color: colors.danger, fontFamily: fontFamilies.bold, fontSize: 13 },
  customRow: { flexDirection: 'row', gap: 9, marginTop: 10 }, customInput: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.ink, flex: 1, fontFamily: fontFamilies.body, fontSize: 14, minHeight: 44, paddingHorizontal: 13 }, dangerInput: { borderColor: '#e9aaa4' }, add: { alignItems: 'center', borderColor: colors.ink, borderRadius: 14, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 16 }, addDanger: { borderColor: colors.danger }, addText: { color: colors.ink, fontFamily: fontFamilies.bold }, addDangerText: { color: colors.danger }, disabled: { opacity: 0.4 },
  footer: { backgroundColor: colors.background, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 10, paddingHorizontal: spacing.gutter, paddingTop: 10 }, save: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: radius.button, justifyContent: 'center', minHeight: 52 }, saveText: { color: colors.surface, fontFamily: fontFamilies.extraBold, fontSize: 16 }, pressed: { opacity: 0.72 },
});
