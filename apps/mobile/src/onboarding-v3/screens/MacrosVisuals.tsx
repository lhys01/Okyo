import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import { Apple, FireFlame, ScaleFrameReduce, StatsUpSquare, Target, Timer, Weight } from '../assets/onboardingStickerIcons';
import { SettleIn } from '../branch-ui/BranchMoments';
import { branchShadow, branchSurfaces } from '../branch-ui/branchTheme';
import type { OnboardingGoal } from '../state/onboardingGoal';
import type { MacroBarrierId, MacroRecipePriorityId } from '../state/macrosBranch';
import { MACRO_BARRIER_LABELS } from '../state/macrosBranchCopy';
import { GoalTimelineCard } from './OnboardingGoalScreens';

export type MacrosSummaryRow = Readonly<{ id: string; label: string; value: string }>;


export function MacrosDiagnosisScreen({ title, body }: { title: string; body: string }) {
  return <SettleIn style={styles.diagnosis}>
    <Text style={styles.eyebrow}>YOUR STARTING POINT</Text>
    <Text accessibilityRole="header" style={styles.diagnosisTitle}>{title}</Text>
    <View style={[styles.diagnosisCard, branchShadow]}><Text style={styles.cardEyebrow}>WHAT WE HEARD</Text><Text style={styles.diagnosisBody}>{body}</Text></View>
    <View style={styles.diagnosisArt}><View style={styles.blob} /><Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.macrosMealInsight} style={styles.diagnosisSticker} /></View>
  </SettleIn>;
}

export function MacrosPlanScreen({ goal, rows, targets, message, startingPoint, proteinTarget, calorieTarget, carbTarget, fatTarget, onEditTargets, priorities = [], barrier }: { goal: OnboardingGoal | null; rows: readonly MacrosSummaryRow[]; targets: string | null; message: string; startingPoint: string; proteinTarget?: number | null; calorieTarget?: number | null; carbTarget?: number | null; fatTarget?: number | null; onEditTargets?: () => void; priorities?: readonly MacroRecipePriorityId[]; barrier?: MacroBarrierId | null }) {
  const { height } = useWindowDimensions();
  const compact = height < 900;
  const byId = (id: string) => rows.find((row) => row.id === id)?.value ?? 'Your routine';
  const supportRows = [
    { id: 'startingPoint', label: 'Your starting point', value: startingPoint, detail: null, icon: Target, color: '#F35F8D', tint: '#FDE9F0' },
    { id: 'focus', label: 'Main focus', value: byId('focus'), detail: null, icon: StatsUpSquare, color: '#25A968', tint: '#EAF8EF' },
    { id: 'obstacle', label: 'What makes it harder', value: barrier ? MACRO_BARRIER_LABELS[barrier] : 'Keeping it realistic', detail: null, icon: Timer, color: '#EA9818', tint: '#FFF5E4' },
  ] as const;
  return <SettleIn style={[styles.plan, compact && styles.planCompact]}>
    <View style={styles.planHeading}><Text accessibilityRole="header" style={[styles.planTitle, compact && styles.planTitleCompact]}>Your plan is ready.</Text><Text style={styles.planSupport}>Here’s what we’ll focus on first.</Text></View>
    <GoalTimelineCard compact={compact} detail={null} emphasis="hero" goal={goal} />
    <MacroTargetsSection calorieTarget={calorieTarget} carbTarget={carbTarget} fatTarget={fatTarget} onEdit={onEditTargets} proteinTarget={proteinTarget} />
    <View style={styles.supportRows}>{supportRows.filter((row) => row.id !== 'obstacle' || barrier).map((row) => <View key={row.id} style={[styles.supportRow, { backgroundColor: row.tint }]}><View style={[styles.supportIcon, { backgroundColor: row.tint }]}><row.icon color={row.color} height={42} width={42} /></View><View style={styles.supportCopy}><Text style={styles.rowLabel}>{row.label}</Text><Text numberOfLines={2} style={styles.rowValue}>{row.value}</Text>{row.detail ? <Text style={styles.rowDetail}>{row.detail}</Text> : null}</View></View>)}</View>
    <View style={[styles.closingPanel, compact && styles.closingPanelCompact]}><View style={styles.closingCopy}><Text style={styles.closingTitle}>You’re all set!</Text><Text numberOfLines={2} style={[styles.closingBody, compact && styles.closingBodyCompact]}>{message}</Text></View><Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.macrosPlanHero} style={[styles.closingSticker, compact && styles.closingStickerCompact]} /></View>
  </SettleIn>;
}

function MacroTargetsSection({ calorieTarget, proteinTarget, carbTarget, fatTarget, onEdit }: { calorieTarget?: number | null; proteinTarget?: number | null; carbTarget?: number | null; fatTarget?: number | null; onEdit?: () => void }) {
  const items = [
    { label: 'Daily calories', value: calorieTarget, unit: 'cal', icon: FireFlame },
    { label: 'Protein', value: proteinTarget, unit: 'g', icon: Weight },
    { label: 'Carbohydrates', value: carbTarget, unit: 'g', icon: Apple },
    { label: 'Fat', value: fatTarget, unit: 'g', icon: ScaleFrameReduce },
  ] as const;
  return <View style={styles.targetsSection}>
    <View style={styles.targetsHeader}><View><Text style={styles.targetsTitle}>Your daily targets</Text><Text style={styles.targetsSubtitle}>A clear starting point for each macro.</Text></View>{onEdit ? <Pressable accessibilityLabel="Edit daily targets" accessibilityRole="button" onPress={onEdit} style={styles.editButton}><Text style={styles.editLabel}>Edit</Text></Pressable> : null}</View>
    <View style={styles.targetsGrid}>{items.map((item) => <View accessibilityLabel={`${item.label}: ${item.value === null || item.value === undefined ? 'Not set' : `${item.value.toLocaleString()} ${item.unit}`}`} key={item.label} style={styles.targetItem}><View style={styles.targetIcon}><item.icon color="#F35F8D" height={26} width={26} /></View><View style={styles.targetCopy}><Text style={styles.targetLabel}>{item.label}</Text><Text style={styles.targetValue}>{item.value === null || item.value === undefined ? 'Not set' : `${item.value.toLocaleString()} ${item.unit}`}</Text></View></View>)}</View>
  </View>;
}

const styles = StyleSheet.create({
  diagnosis: { alignItems: 'center', flex: 1, gap: 18, justifyContent: 'center', paddingVertical: 14 },
  eyebrow: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 12, letterSpacing: 1.1 },
  diagnosisTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 30, letterSpacing: -0.8, lineHeight: 36, textAlign: 'center' },
  diagnosisCard: { backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: 24, borderWidth: 1, gap: 10, paddingHorizontal: 20, paddingVertical: 18, width: '100%' },
  cardEyebrow: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 11, letterSpacing: 1, textAlign: 'center' },
  diagnosisBody: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  diagnosisArt: { alignItems: 'center', height: 190, justifyContent: 'center', width: '100%' },
  blob: { backgroundColor: '#FDEEF2', borderRadius: 999, height: 138, opacity: 0.8, position: 'absolute', width: 320 },
  diagnosisSticker: { height: 190, width: 190 },
  rowLabel: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 20 },
  rowValue: { color: branchSurfaces.ink, fontFamily: fontFamilies.bold, fontSize: 19, lineHeight: 25 },
  plan: { alignItems: 'center', gap: 12, paddingBottom: 4 }, planCompact: { gap: 8 },
  planHeading: { alignItems: 'center', gap: 5 },
  planTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 30, lineHeight: 36 }, planTitleCompact: { fontSize: 27, lineHeight: 32 },
  planSupport: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 21 },
  supportRows: { gap: 9, width: '100%' },
  targetsSection: { backgroundColor: '#FFF9FA', borderColor: '#F7C8D6', borderRadius: 22, borderWidth: 1, gap: 12, padding: 14, width: '100%' },
  targetsHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  targetsTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.bold, fontSize: 17, lineHeight: 22 },
  targetsSubtitle: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 17, marginTop: 2 },
  editButton: { backgroundColor: '#FDE9F0', borderRadius: 99, paddingHorizontal: 13, paddingVertical: 7 },
  editLabel: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 13 },
  targetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  targetItem: { alignItems: 'center', backgroundColor: colors.surface, borderColor: '#F7C8D6', borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 62, paddingHorizontal: 9, paddingVertical: 8, width: '48%' },
  targetIcon: { alignItems: 'center', backgroundColor: '#FDE9F0', borderRadius: 99, height: 38, justifyContent: 'center', width: 38 },
  targetCopy: { flex: 1, gap: 1 },
  targetLabel: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 11, lineHeight: 15 },
  targetValue: { color: branchSurfaces.ink, fontFamily: fontFamilies.bold, fontSize: 14, lineHeight: 18 },
  supportRow: { alignItems: 'center', borderRadius: 24, flexDirection: 'row', gap: 16, minHeight: 90, paddingHorizontal: 18, paddingVertical: 13 },
  supportIcon: { alignItems: 'center', borderRadius: 99, height: 60, justifyContent: 'center', width: 60 }, supportCopy: { flex: 1, gap: 3 },
  rowDetail: { color: colors.coralDark, fontFamily: fontFamilies.semibold, fontSize: 12, lineHeight: 17 },
  closingPanel: { alignItems: 'center', backgroundColor: '#FDE9F0', borderRadius: 24, flexDirection: 'row', minHeight: 128, overflow: 'hidden', paddingLeft: 18, width: '100%' },
  closingPanelCompact: { minHeight: 108 },
  closingCopy: { flex: 1, gap: 4, zIndex: 1 }, closingTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 19 },
  closingBody: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 17 },
  closingBodyCompact: { display: 'none' },
  closingSticker: { height: 142, transform: [{ translateX: -10 }], width: 142 },
  closingStickerCompact: { height: 108, transform: [{ translateX: -8 }], width: 108 },
});
