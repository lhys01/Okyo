import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavArrowDown, NavArrowLeft, NavArrowRight } from 'iconoir-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MainTabParamList } from '../navigation/types';
import { onboardingV3Persistence } from '../onboarding-v3/state/onboardingV3Persistence';
import { NOTIFICATION_PREFERENCES_KEY } from '../state/notificationPreferences';
import { useOkyoStore } from '../state/useOkyoStore';
import { foodPreferencesPersistence } from '../state/foodPreferences';
import { colors, fontFamilies, radius, spacing } from '../theme/okyoTheme';

type Navigation = NativeStackNavigationProp<MainTabParamList>;

const DATA_SECTIONS = [
  ['What Okyo stores', 'Okyo stores generated recipes, scan results, saved and grocery selections, cooking progress, recipe feedback, savings estimates, preferences, and app progress locally on this device.'],
  ['Photos & food scans', 'A photo selected for scanning is copied into Okyo’s local app storage and sent to the Okyo API for analysis. The image may be included in a saved recipe record. Delete all data removes Okyo’s local scan-image folder.'],
  ['Recipe and cooking history', 'Scan results, generated recipes, likes, grocery selections, completion state, and active cooking progress are stored locally so the app can restore them.'],
  ['Dietary preferences', 'Allergies, restrictions, avoidances, and dislikes are stored locally and sent with relevant AI requests so recipes can be adapted. Allergen detection is not guaranteed.'],
  ['AI processing', 'Food images, meal descriptions, recipe context, and relevant preferences may be sent to the Okyo API and its configured AI service to identify food, generate recipes, answer questions, or revise a recipe. Retention by external services is not asserted here and requires founder/legal verification.'],
] as const;

export function PrivacyDataScreen() {
  const navigation = useNavigation<Navigation>();
  const clearSavedData = useOkyoStore((state) => state.clearSavedData);
  const [open, setOpen] = useState<string | null>('What Okyo stores');
  const goBack = () => { if (navigation.canGoBack()) navigation.goBack(); };
  const deleteAllData = () => Alert.alert('Delete all Okyo data?', 'This removes local recipes, scan and cooking history, grocery state, preferences, progress, and locally stored scan images. This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete data', style: 'destructive', onPress: () => void (async () => {
      clearSavedData();
      await Promise.all([
        onboardingV3Persistence.reset(),
        foodPreferencesPersistence.clear(),
        AsyncStorage.multiRemove([NOTIFICATION_PREFERENCES_KEY, 'okyo:home-start-date:v1', 'okyo:home-first-seen-at:v1']),
      ]);
      Alert.alert('Local data deleted', 'Okyo’s locally stored recipes, scans, cooking history, preferences, and progress were removed.');
    })().catch(() => Alert.alert('Couldn’t delete all data', 'Try again in a moment.')) },
  ]);
  const explainAccount = () => Alert.alert('Account deletion is unavailable', 'This build has no account or sign-in backend. There is no server account to delete. “Delete all my data” removes the Okyo data stored by this app on this device.');

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}><Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={goBack} style={styles.back}><NavArrowLeft color={colors.ink} height={25} width={25} /></Pressable><Text style={styles.title}>Privacy & data</Text></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.intro}>Control your information and understand how Okyo uses it.</Text>
      <Text style={styles.sectionLabel}>YOUR DATA</Text>
      <View style={styles.group}>{DATA_SECTIONS.map(([title, body], index) => <Pressable key={title} accessibilityRole="button" accessibilityState={{ expanded: open === title }} onPress={() => setOpen(open === title ? null : title)} style={[styles.accordion, index < DATA_SECTIONS.length - 1 && styles.divider]}><View style={styles.accordionHeading}><Text style={styles.rowTitle}>{title}</Text>{open === title ? <NavArrowDown color={colors.muted} height={18} width={18} /> : <NavArrowRight color={colors.muted} height={18} width={18} />}</View>{open === title ? <Text style={styles.body}>{body}</Text> : null}</Pressable>)}</View>

      <Text style={styles.sectionLabel}>CONTROLS</Text>
      <View style={styles.group}><View style={styles.infoRow}><Text style={styles.rowTitle}>Data export</Text><Text style={styles.body}>Not implemented in this build. Okyo will not pretend an export was created.</Text></View><Pressable accessibilityLabel="Delete all my data" accessibilityRole="button" onPress={deleteAllData} style={[styles.actionRow, styles.dangerTop]}><Text style={styles.dangerText}>Delete all my data</Text><NavArrowRight color={colors.danger} height={18} width={18} /></Pressable></View>

      <Text style={styles.sectionLabel}>LEGAL</Text>
      <View style={styles.group}><Pressable accessibilityRole="button" onPress={() => navigation.navigate('LegalScreen')} style={styles.actionRow}><Text style={styles.rowTitle}>Privacy Policy & Terms</Text><NavArrowRight color={colors.muted} height={18} width={18} /></Pressable></View>

      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={styles.group}><Pressable accessibilityRole="button" onPress={explainAccount} style={styles.actionRow}><View style={styles.flex}><Text style={styles.dangerText}>Delete account</Text><Text style={styles.body}>No account is connected in this build.</Text></View><NavArrowRight color={colors.danger} height={18} width={18} /></Pressable></View>
      <Text style={styles.review}>Founder/legal review required: external AI-service retention, legal bases, regional rights, age requirements, and final policy language.</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safeArea: { backgroundColor: colors.background, flex: 1 }, header: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: spacing.gutter, paddingVertical: 10 }, back: { alignItems: 'center', height: 44, justifyContent: 'center', marginLeft: -10, width: 44 }, title: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 22 }, content: { paddingBottom: 150, paddingHorizontal: spacing.gutter }, intro: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 22, marginBottom: 6 }, sectionLabel: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 11.5, letterSpacing: 0.8, marginBottom: 8, marginLeft: 4, marginTop: 26 }, group: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.panel, borderWidth: 1, overflow: 'hidden' }, accordion: { padding: 15 }, accordionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, divider: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }, rowTitle: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 15 }, body: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19, marginTop: 6 }, infoRow: { padding: 15 }, actionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 54, padding: 15 }, dangerTop: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }, dangerText: { color: colors.danger, fontFamily: fontFamilies.bold, fontSize: 15 }, flex: { flex: 1 }, review: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 11.5, lineHeight: 17, marginTop: 24 }, });
