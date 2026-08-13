import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavArrowDown, NavArrowLeft, NavArrowRight } from 'iconoir-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import appConfig from '../../app.json';
import type { MainTabParamList } from '../navigation/types';
import { colors, fontFamilies, radius, spacing } from '../theme/okyoTheme';

type Navigation = NativeStackNavigationProp<MainTabParamList>;
const GROUPS = [
  ['GETTING STARTED', [
    ['How does Okyo work?', 'Scan or describe a prepared dish. Okyo uses AI to identify it and create an editable, copycat-style recipe.'],
    ['How do food scans work?', 'A selected food photo is sent through the Okyo API to its configured AI service. Clear photos with the full dish visible work best.'],
    ['How accurate are recipes?', 'Recipes are AI-generated interpretations and can be imperfect. Review ingredients, steps, and doneness before cooking.'],
    ['How does nutrition estimation work?', 'Nutrition values are recipe-level estimates based on generated ingredients and servings. They are not medical or laboratory measurements.'],
    ['How does savings estimation work?', 'Savings compare estimated homemade cost with an estimated restaurant or takeout price. Local prices vary. Only completed meals count toward realized progress in Okyo.'],
  ]],
  ['COOKING', [
    ['How do I edit a recipe?', 'Open a recipe and choose Edit recipe or Customize. Okyo sends the requested change through the existing recipe-correction flow.'],
    ['How do substitutions work?', 'Suggested substitutions aim to preserve the dish, but you should confirm labels, quantities, and suitability for your needs.'],
    ['How does Ask Okyo work?', 'Ask Okyo sends your question, recipe context, and relevant dietary preferences to the Okyo API for an AI-generated answer.'],
    ['How do cooking timers work?', 'Timers are guidance. Always verify doneness with appearance, texture, and a food thermometer where appropriate.'],
    ['How do grocery lists work?', 'Adding a recipe to Grocery creates a local list from its ingredients. You can check items and pantry needs on the device.'],
  ]],
  ['DIETARY & SAFETY', [
    ['How does Okyo use allergies?', 'Stored allergies are sent as hard recipe constraints and are checked against generated ingredient names for prominent warnings. Detection is not guaranteed.'],
    ['What if Okyo identifies an allergen?', 'Review every ingredient and product label. Use Make this work for me to request a revised recipe, but verify the revision yourself.'],
    ['Can Okyo guarantee allergen-free food?', 'No. Food recognition and generated recipes can be wrong, and cross-contact cannot be detected from a photo. Do not rely on Okyo alone for allergy-critical decisions.'],
  ]],
  ['ACCOUNT', [
    ['How do I change preferences?', 'Open Settings, then Dietary preferences. Changes are stored globally for future scans, corrections, and Ask Okyo.'],
    ['How do I delete my data?', 'Open Settings, Privacy & data, then Delete all my data. This removes Okyo data stored locally by this app.'],
    ['How do I delete my account?', 'This build has no sign-in or account backend, so there is no server account to delete. The app reports this honestly instead of faking deletion.'],
  ]],
  ['TROUBLESHOOTING', [
    ['Scan failed', 'Try a brighter, sharper photo with the prepared dish filling the frame, or describe the meal instead.'],
    ['Wrong dish identified', 'Use the correction prompt on the result screen and describe what looks wrong.'],
    ["Recipe doesn’t look right", 'Use Edit recipe or Ask Okyo. If the result remains unreliable, generate it again rather than cooking from uncertain steps.'],
    ['Notification problem', 'Check the Notifications preference center and iOS Settings. Okyo cannot override a denied system permission.'],
    ['Recipe disappeared', 'Saved recipes remain local to this installation. Clearing app data or deleting the app removes local records.'],
  ]],
] as const;

export function HelpSupportScreen() {
  const navigation = useNavigation<Navigation>();
  const [open, setOpen] = useState<string | null>(null);
  const goBack = () => { if (navigation.canGoBack()) navigation.goBack(); };
  return <SafeAreaView style={styles.safeArea}><View style={styles.header}><Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={goBack} style={styles.back}><NavArrowLeft color={colors.ink} height={25} width={25} /></Pressable><Text style={styles.title}>Help & support</Text></View><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><Text style={styles.intro}>Answers about scanning, cooking, safety, and your data.</Text>{GROUPS.map(([label, rows]) => <View key={label} style={styles.section}><Text style={styles.sectionLabel}>{label}</Text><View style={styles.group}>{rows.map(([question, answer], index) => <Pressable key={question} accessibilityRole="button" accessibilityState={{ expanded: open === question }} onPress={() => setOpen(open === question ? null : question)} style={[styles.row, index < rows.length - 1 && styles.divider]}><View style={styles.rowHeading}><Text style={styles.question}>{question}</Text>{open === question ? <NavArrowDown color={colors.muted} height={18} width={18} /> : <NavArrowRight color={colors.muted} height={18} width={18} />}</View>{open === question ? <Text style={styles.answer}>{answer}</Text> : null}</Pressable>)}</View></View>)}<View style={styles.contact}><Text style={styles.question}>Contact support</Text><Text style={styles.answer}>No support email, form, or ticketing destination is configured in this project yet. Founder action is required before this can become a working contact control.</Text></View><Text style={styles.footer}>Okyo v{appConfig.expo.version}</Text></ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safeArea: { backgroundColor: colors.background, flex: 1 }, header: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: spacing.gutter, paddingVertical: 10 }, back: { alignItems: 'center', height: 44, justifyContent: 'center', marginLeft: -10, width: 44 }, title: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 22 }, content: { paddingBottom: 150, paddingHorizontal: spacing.gutter }, intro: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 22 }, section: { marginTop: 25 }, sectionLabel: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 11.5, letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 }, group: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.panel, borderWidth: 1, overflow: 'hidden' }, row: { padding: 15 }, divider: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }, rowHeading: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' }, question: { color: colors.ink, flex: 1, fontFamily: fontFamilies.bold, fontSize: 14.5 }, answer: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19, marginTop: 7 }, contact: { backgroundColor: colors.canvasSunk, borderRadius: radius.panel, marginTop: 26, padding: 16 }, footer: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 12, marginTop: 20, textAlign: 'center' } });
