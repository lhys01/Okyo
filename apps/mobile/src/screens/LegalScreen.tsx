import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavArrowDown, NavArrowLeft, NavArrowRight } from 'iconoir-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MainTabParamList } from '../navigation/types';
import { colors, fontFamilies, radius, spacing } from '../theme/okyoTheme';

type Navigation = NativeStackNavigationProp<MainTabParamList>;
const LAST_UPDATED = 'August 7, 2026';
const DOCUMENTS = [
  ['Privacy Policy', [
    ['Introduction', 'This in-app draft explains the product behavior currently visible in the Okyo codebase. It requires founder and qualified legal review before publication as final policy.'],
    ['Information we collect', 'Okyo stores local profile preferences, generated recipes, scan results, saved and grocery selections, cooking progress, feedback, and app progress.'],
    ['Food photos and scan data', 'Selected food photos are copied into local app storage and sent to the Okyo API for analysis. Delete all data removes the app’s local scan-image folder. External-service retention terms require legal verification.'],
    ['Dietary preferences and allergies', 'Allergies, restrictions, avoidances, and dislikes are stored locally and sent with relevant AI requests. Okyo cannot guarantee allergen detection or allergen-free results.'],
    ['AI and service providers', 'The Okyo API sends relevant image or text inputs to its configured AI service to identify food, generate and revise recipes, and answer recipe questions. Provider retention and training terms are not asserted in this draft.'],
    ['Your choices and deletion', 'Users can edit dietary preferences, control optional notifications, and delete locally stored Okyo data from Settings. Data export and authenticated account deletion are not implemented.'],
    ['Security, retention, and contact', 'Final security statements, retention schedules, regional rights, age requirements, and a verified contact channel require founder/legal review.'],
  ]],
  ['Terms of Service', [
    ['Description of Okyo', 'Okyo identifies prepared food and creates editable copycat-style recipes. Generated recipes are not official restaurant recipes.'],
    ['AI-generated content', 'Recognition, recipes, substitutions, nutrition, cooking times, costs, and savings are estimates and can be wrong. Users must review outputs before relying on them.'],
    ['Food and cooking safety', 'Users should verify ingredient labels, allergy suitability, safe handling, doneness, and internal temperatures. Okyo is assistance, not a guarantee of safety.'],
    ['User responsibilities', 'Do not use Okyo for unlawful content or rely on it as medical, nutrition, allergy, or financial advice.'],
    ['Third-party services and final legal terms', 'Provider terms, intellectual-property language, termination, disclaimers, liability limitations, governing law, and contact details require founder/legal review before these Terms are final.'],
  ]],
  ['AI & recipe disclaimer', [
    ['Recognition and recipes', 'Food recognition and generated recipes can be imperfect. Confirm the dish, ingredients, quantities, and steps.'],
    ['Costs and savings', 'Homemade costs, restaurant prices, and savings are estimates. Prices vary by location, store, portion, and time.'],
    ['Cooking guidance', 'Times are guidance. Use visual cues and a food thermometer where appropriate, especially with meat, seafood, and eggs.'],
  ]],
  ['Nutrition & allergy information', [
    ['Nutrition estimates', 'Nutrition values are estimates across generated recipes, not lab measurements or a record of what a user consumed.'],
    ['Allergy limitations', 'Image analysis cannot reliably detect every ingredient or cross-contact. Always verify ingredients and labels, particularly for allergies.'],
    ['Dietary adaptation', 'Okyo may offer to transform a recipe around saved preferences, but users must verify that the revised result meets their needs.'],
  ]],
] as const;

export function LegalScreen() {
  const navigation = useNavigation<Navigation>();
  const [document, setDocument] = useState<string>('Privacy Policy');
  const [open, setOpen] = useState<string | null>('Introduction');
  const goBack = () => { if (navigation.canGoBack()) navigation.goBack(); };
  const sections = DOCUMENTS.find(([name]) => name === document)?.[1] ?? [];
  return <SafeAreaView style={styles.safeArea}><View style={styles.header}><Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={goBack} style={styles.back}><NavArrowLeft color={colors.ink} height={25} width={25} /></Pressable><Text style={styles.title}>Terms & privacy</Text></View><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><Text style={styles.review}>DRAFT — FOUNDER / LEGAL REVIEW REQUIRED</Text><Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text><View style={styles.documents}>{DOCUMENTS.map(([name]) => <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: name === document }} onPress={() => { setDocument(name); setOpen(null); }} style={[styles.document, name === document && styles.documentSelected]}><Text style={[styles.documentText, name === document && styles.documentTextSelected]}>{name}</Text></Pressable>)}</View><Text style={styles.documentTitle}>{document}</Text><View style={styles.group}>{sections.map(([heading, body], index) => <Pressable key={heading} accessibilityRole="button" accessibilityState={{ expanded: open === heading }} onPress={() => setOpen(open === heading ? null : heading)} style={[styles.row, index < sections.length - 1 && styles.divider]}><View style={styles.rowHeading}><Text style={styles.heading}>{heading}</Text>{open === heading ? <NavArrowDown color={colors.muted} height={18} width={18} /> : <NavArrowRight color={colors.muted} height={18} width={18} />}</View>{open === heading ? <Text style={styles.body}>{body}</Text> : null}</Pressable>)}</View></ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safeArea: { backgroundColor: colors.background, flex: 1 }, header: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: spacing.gutter, paddingVertical: 10 }, back: { alignItems: 'center', height: 44, justifyContent: 'center', marginLeft: -10, width: 44 }, title: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 22 }, content: { paddingBottom: 150, paddingHorizontal: spacing.gutter }, review: { color: colors.danger, fontFamily: fontFamilies.bold, fontSize: 11, letterSpacing: 0.7, marginTop: 8 }, updated: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 12.5, marginTop: 5 }, documents: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 }, document: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }, documentSelected: { backgroundColor: colors.ink, borderColor: colors.ink }, documentText: { color: colors.body, fontFamily: fontFamilies.bold, fontSize: 12 }, documentTextSelected: { color: colors.surface }, documentTitle: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 28, marginBottom: 14, marginTop: 26 }, group: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.panel, borderWidth: 1, overflow: 'hidden' }, row: { padding: 16 }, divider: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }, rowHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, heading: { color: colors.ink, flex: 1, fontFamily: fontFamilies.bold, fontSize: 15 }, body: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 13.5, lineHeight: 20, marginTop: 8 } });
