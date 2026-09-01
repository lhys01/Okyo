import { StyleSheet, Text, View } from 'react-native';
import type { ComponentType } from 'react';
import { Image } from 'expo-image';
import { Check, Flash, MenuScale, Repeat } from 'iconoir-react-native';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import { SettleIn } from '../branch-ui/BranchMoments';
import { branchShadow, branchSurfaces } from '../branch-ui/branchTheme';
import { HealthNutritionExample } from './HealthVisuals';
import type { TrackingStyleId } from '../state/macrosBranch';

type IconType = ComponentType<{ color?: string; height?: number; width?: number; strokeWidth?: number }>;

export type MacrosSummaryRow = Readonly<{ id: string; label: string; value: string }>;

/** Personalized approach, built from the user's own answers. */
export function MacrosApproachScreen({ headline, supportText }: { headline: string; supportText: string }) {
  return (
    <SettleIn style={styles.message}>
      <Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.macrosApproach} style={styles.sticker} />
      <Text maxFontSizeMultiplier={1.2} style={styles.eyebrow}>HERE’S THE APPROACH WE’LL TAKE</Text>
      <View style={[styles.approachCard, branchShadow]}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.approachHeadline}>{headline}</Text>
      </View>
      <Text maxFontSizeMultiplier={1.3} style={styles.body}>{supportText}</Text>
    </SettleIn>
  );
}

const BENEFITS: readonly { id: string; label: string; icon: IconType }[] = [
  { id: 'match', label: 'Match recipes to what you’re aiming for', icon: Flash },
  { id: 'level', label: 'Show nutrition at the level you chose', icon: MenuScale },
  { id: 'adjust', label: 'Adjust a meal without recounting everything', icon: Repeat },
];

/** What Okyo handles, with an honest example-nutrition card. */
export function MacrosWhatOkyoScreen() {
  return (
    <SettleIn style={styles.information}>
      <Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.macrosWhatOkyo} style={styles.sticker} />
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.24} style={styles.title}>Okyo keeps the numbers useful.</Text>
      <Text maxFontSizeMultiplier={1.3} style={styles.body}>
        You choose what sounds good. Okyo handles the ingredients, the recipe, and the nutrition estimate.
      </Text>
      <View style={styles.benefitList}>
        {BENEFITS.map((benefit) => (
          <View accessibilityLabel={benefit.label} key={benefit.id} style={styles.benefitRow}>
            <View style={styles.benefitGlyph}>
              <benefit.icon color={colors.coralDark} height={20} strokeWidth={2} width={20} />
            </View>
            <Text maxFontSizeMultiplier={1.24} style={styles.benefitText}>{benefit.label}</Text>
          </View>
        ))}
      </View>
      <HealthNutritionExample />
    </SettleIn>
  );
}

const NUTRITION_COPY: Record<TrackingStyleId, string> = {
  exact_numbers: 'See as much detail as you want—without turning food into a spreadsheet.',
  flexible_ranges: 'Keep nutrition useful without making every gram a chore.',
  simple_suggestions: 'Get simple nutrition guidance that fits real meals.',
  just_show_info: 'Nutrition is there when you want it—not another task.',
};

/** The reassurance beat: a balanced meal photo, no invented numbers. */
export function MacrosNutritionVisual({ trackingStyle }: { trackingStyle?: TrackingStyleId | null }) {
  return (
    <SettleIn style={styles.message}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.title}>Nutrition without the homework.</Text>
      <Text maxFontSizeMultiplier={1.3} style={styles.body}>{trackingStyle ? NUTRITION_COPY[trackingStyle] : NUTRITION_COPY.exact_numbers}</Text>
      <View style={[styles.foodFrame, branchShadow]}>
        <Image accessibilityLabel="Balanced salmon and vegetable meal" accessibilityRole="image" contentFit="cover" source={onboardingV3Assets.macrosNutritionMeal} style={styles.foodImage} testID="macros-nutrition-meal" />
      </View>
    </SettleIn>
  );
}

/** Personalized reveal with the coral "Your starting point" card. */
export function MacrosRevealScreen({ summary, startingPoint, proteinLine }: { summary: string; startingPoint: string; proteinLine: string }) {
  return (
    <SettleIn style={styles.message}>
      <Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.macrosReveal} style={styles.sticker} />
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.24} style={styles.title}>Your macros plan is ready.</Text>
      <Text maxFontSizeMultiplier={1.3} style={styles.body}>{summary}</Text>
      <View accessibilityLabel={`Your starting point: ${startingPoint}. ${proteinLine}.`} style={[styles.commitmentCard, branchShadow]}>
        <Text maxFontSizeMultiplier={1.2} style={styles.commitmentLabel}>Your starting point</Text>
        <Text maxFontSizeMultiplier={1.24} style={styles.commitmentValue}>{startingPoint}</Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.commitmentNote}>{proteinLine} · your preference</Text>
      </View>
    </SettleIn>
  );
}

/** The plan summary: hero pose, commitment card, three answer rows, reassurance strip. */
export function MacrosPlanVisual({ startWith, rows, proteinLine }: { startWith: string; rows: readonly MacrosSummaryRow[]; proteinLine: string }) {
  return (
    <SettleIn style={styles.planSummary}>
      <Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.macrosPlanHero} style={styles.planHero} />
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.title}>Your macros plan is ready.</Text>
      <Text maxFontSizeMultiplier={1.3} style={styles.body}>Built around your preferences—not a generic template.</Text>

      <View accessibilityLabel={`Start with ${startWith}. ${proteinLine}.`} style={[styles.commitmentCard, branchShadow]}>
        <Text maxFontSizeMultiplier={1.2} style={styles.commitmentLabel}>Start with</Text>
        <Text maxFontSizeMultiplier={1.24} style={styles.commitmentValue}>{startWith}</Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.commitmentNote}>{proteinLine} · your preference</Text>
      </View>

      <View style={styles.summaryList}>
        {rows.map((row) => (
          <View accessibilityLabel={`${row.label}: ${row.value}`} key={row.id} style={[styles.summaryRow, branchShadow]}>
            <View style={styles.summaryGlyph}><Check color={colors.surface} height={15} strokeWidth={3} width={15} /></View>
            <View style={styles.summaryText}>
              <Text maxFontSizeMultiplier={1.2} style={styles.summaryLabel}>{row.label}</Text>
              <Text maxFontSizeMultiplier={1.24} style={styles.summaryValue}>{row.value}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.reassuranceStrip, branchShadow]}>
        <Flash color={colors.coral} height={18} width={18} />
        <View style={styles.reassuranceText}>
          <Text maxFontSizeMultiplier={1.2} style={styles.reassuranceTitle}>Keep the food you enjoy.</Text>
          <Text maxFontSizeMultiplier={1.25} style={styles.reassuranceBody}>Okyo handles the numbers.</Text>
        </View>
      </View>
    </SettleIn>
  );
}

/** Small decorative accent for the reassurance-adjacent moments. */
export function MacrosReassuranceAccent() {
  return (
    <View style={styles.accentRow}>
      <Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.macrosAccentMotion} style={styles.accentDot} />
      <Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.macrosAccentSparkle} style={styles.accentDot} />
      <Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.macrosAccentPaw} style={styles.accentDot} />
    </View>
  );
}

const styles = StyleSheet.create({
  message: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', paddingBottom: 8, paddingTop: 8 },
  information: { alignItems: 'center', gap: 10, paddingBottom: 8, paddingTop: 4 },
  sticker: { height: 210, width: 236 },
  eyebrow: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 12, letterSpacing: 0.8, textAlign: 'center', textTransform: 'uppercase' },
  title: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 27, letterSpacing: -0.6, lineHeight: 33, paddingHorizontal: 6, textAlign: 'center' },
  body: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 23, maxWidth: 340, textAlign: 'center' },

  approachCard: { backgroundColor: colors.coralSoft, borderColor: colors.coral, borderRadius: branchSurfaces.cardRadius, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 18, width: '100%' },
  approachHeadline: { color: colors.coralDark, fontFamily: fontFamilies.extraBold, fontSize: 21, letterSpacing: -0.4, lineHeight: 28, textAlign: 'center' },

  benefitList: { gap: 8, width: '100%' },
  benefitRow: { alignItems: 'center', backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: branchSurfaces.tileRadius, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 54, paddingHorizontal: 12, paddingVertical: 9, ...branchShadow },
  benefitGlyph: { alignItems: 'center', backgroundColor: colors.coralSoft, borderRadius: 12, height: 38, justifyContent: 'center', width: 38 },
  benefitText: { color: branchSurfaces.ink, flex: 1, fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 21 },

  foodFrame: { borderColor: colors.border, borderRadius: 24, borderWidth: 1, marginTop: 2, overflow: 'hidden', width: '100%' },
  foodImage: { height: 220, width: '100%' },

  commitmentCard: { backgroundColor: colors.coralSoft, borderColor: colors.coral, borderRadius: branchSurfaces.cardRadius, borderWidth: 1, gap: 5, paddingHorizontal: 20, paddingVertical: 16, width: '100%' },
  commitmentLabel: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  commitmentValue: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 20, letterSpacing: -0.3, lineHeight: 26 },
  commitmentNote: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 12 },

  planSummary: { alignItems: 'center', gap: 10, paddingBottom: 6 },
  planHero: { height: 150, marginBottom: -6, width: 176 },
  summaryList: { gap: 8, width: '100%' },
  summaryRow: { alignItems: 'center', backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: branchSurfaces.tileRadius, borderWidth: 1, flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingVertical: 9 },
  summaryGlyph: { alignItems: 'center', backgroundColor: colors.coral, borderRadius: 999, height: 28, justifyContent: 'center', width: 28 },
  summaryText: { flex: 1, gap: 2 },
  summaryLabel: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 12 },
  summaryValue: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 16, lineHeight: 21 },

  reassuranceStrip: { alignItems: 'center', backgroundColor: colors.coralSoft, borderColor: colors.coral, borderRadius: branchSurfaces.cardRadius, borderWidth: 1, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14, width: '100%' },
  reassuranceText: { flex: 1, gap: 2 },
  reassuranceTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 15, lineHeight: 20 },
  reassuranceBody: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 19 },

  accentRow: { flexDirection: 'row', gap: 14, justifyContent: 'center', marginTop: 2 },
  accentDot: { height: 28, width: 28 },
});
