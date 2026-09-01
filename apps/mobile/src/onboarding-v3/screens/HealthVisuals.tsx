import { StyleSheet, Text, View } from 'react-native';
import type { ComponentType, ReactNode } from 'react';
import { Image } from 'expo-image';
import { Check, Heart, LightBulb, MenuScale, Repeat, Sparks } from 'iconoir-react-native';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import { SettleIn } from '../branch-ui/BranchMoments';
import { BranchHeading } from '../branch-ui/BranchControls';
import { branchShadow, branchSurfaces } from '../branch-ui/branchTheme';

const EXAMPLE_NUTRITION = [
  { id: 'calories', label: 'CAL', value: '270' },
  { id: 'protein', label: 'PROTEIN', value: '24g' },
  { id: 'carbs', label: 'CARBS', value: '31g' },
  { id: 'fat', label: 'FAT', value: '8g' },
] as const;

type IconType = ComponentType<{ color?: string; height?: number; width?: number; strokeWidth?: number }>;

/**
 * Shared responsive layout for every Eat Healthier question screen: a compact
 * Sora heading, the selectable cards, and one small Kiko pose beneath them.
 * Balanced on iPhone 17 Pro and smaller devices — no fixed heights, the
 * scaffold's ScrollView handles overflow.
 */
export function HealthQuestionLayout({
  title,
  subtitle,
  sticker,
  density = 'balanced',
  children,
}: {
  title: string;
  subtitle?: string;
  sticker?: number;
  density?: 'balanced' | 'dense';
  children: ReactNode;
}) {
  return (
    <View style={[styles.questionLayout, density === 'dense' && styles.questionLayoutDense]}>
      <BranchHeading subtitle={subtitle} title={title} />
      {sticker ? (
        <Image accessibilityElementsHidden contentFit="contain" source={sticker} style={[styles.questionSticker, density === 'dense' && styles.questionStickerDense]} />
      ) : null}
      <View style={styles.questionChoices}>{children}</View>
    </View>
  );
}

/**
 * The non-question beat: a large Kiko pose, a Sora headline, and one or two
 * supporting lines. Used for the introduction, the personalized insights, the
 * barrier response, and the reassurance screen. No controls, so it reads as a
 * moment rather than another form step.
 */
export function HealthMessageScreen({
  sticker,
  eyebrow,
  title,
  body,
  footnote,
  accent,
  children,
}: {
  sticker: number;
  eyebrow?: string;
  title: string;
  body?: string;
  footnote?: string;
  accent?: 'heart' | 'sparkle' | 'bowl';
  children?: ReactNode;
}) {
  return (
    <SettleIn style={styles.message}>
      <Image accessibilityElementsHidden contentFit="contain" source={sticker} style={styles.messageSticker} />
      {eyebrow ? <Text maxFontSizeMultiplier={1.2} style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.24} style={styles.messageTitle}>{title}</Text>
      {body ? <Text maxFontSizeMultiplier={1.3} style={styles.messageBody}>{body}</Text> : null}
      {accent ? (
        <Image accessibilityElementsHidden contentFit="contain" source={accentSource(accent)} style={styles.messageAccent} />
      ) : null}
      {children}
      {footnote ? <Text maxFontSizeMultiplier={1.25} style={styles.footnote}>{footnote}</Text> : null}
    </SettleIn>
  );
}

function accentSource(accent: 'heart' | 'sparkle' | 'bowl'): number {
  if (accent === 'sparkle') return onboardingV3Assets.healthAccentSparkle;
  if (accent === 'bowl') return onboardingV3Assets.healthAccentBowl;
  return onboardingV3Assets.healthAccentHeart;
}

/** Screen 10 — the personalized approach, built from the user's own answers. */
export function HealthApproachScreen({ headline, supportText }: { headline: string; supportText: string }) {
  return (
    <SettleIn style={styles.messageCompact}>
      <Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.healthApproach} style={styles.messageSticker} />
      <Text maxFontSizeMultiplier={1.2} style={styles.eyebrow}>HERE’S THE APPROACH WE’LL TAKE</Text>
      <View style={[styles.approachCard, branchShadow]}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.approachHeadline}>{headline}</Text>
      </View>
      <Text maxFontSizeMultiplier={1.3} style={styles.messageBody}>{supportText}</Text>
    </SettleIn>
  );
}

const BENEFITS: readonly { id: string; label: string; icon: IconType }[] = [
  { id: 'recipes', label: 'Find better-fitting recipes', icon: Sparks },
  { id: 'nutrition', label: 'See useful nutrition details', icon: MenuScale },
  { id: 'adjust', label: 'Make changes without starting over', icon: Repeat },
];

/** Screen 11 — what Okyo handles, with an honest example-nutrition card. */
export function HealthWhatOkyoScreen() {
  return (
    <SettleIn style={styles.messageInformation}>
      <Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.healthWhatOkyo} style={styles.messageSticker} />
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.24} style={styles.messageTitle}>Okyo handles the planning.</Text>
      <Text maxFontSizeMultiplier={1.3} style={styles.messageBody}>
        You choose what sounds good. Okyo helps with the ingredients, recipe, nutrition details, and next steps.
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

export function HealthNutritionExample() {
  return (
    <View style={styles.nutritionWrap}>
      <View
        accessibilityLabel="Example recipe nutrition: 270 calories, 24 grams protein, 31 grams carbohydrates, and 8 grams fat."
        accessibilityRole="summary"
        style={[styles.nutritionGrid, branchShadow]}
        testID="health-example-nutrition"
      >
        {EXAMPLE_NUTRITION.map((nutrient) => (
          <View key={nutrient.id} style={styles.nutritionCell}>
            <Text maxFontSizeMultiplier={1.2} style={styles.nutritionValue}>{nutrient.value}</Text>
            <Text maxFontSizeMultiplier={1.25} style={styles.nutritionLabel}>{nutrient.label}</Text>
          </View>
        ))}
      </View>
      <Text maxFontSizeMultiplier={1.25} style={styles.footnote}>Example nutrition only.</Text>
    </View>
  );
}

/** Screen 13 — personalized reveal with the coral "Your starting point" card. */
export function HealthRevealScreen({ summary, startingPoint }: { summary: string; startingPoint: string }) {
  return (
    <SettleIn style={styles.message}>
      <Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.healthReveal} style={styles.messageSticker} />
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.24} style={styles.messageTitle}>Your healthier approach is ready.</Text>
      <Text maxFontSizeMultiplier={1.3} style={styles.messageBody}>{summary}</Text>
      <View accessibilityLabel={`Your starting point: ${startingPoint}`} style={[styles.commitmentCard, branchShadow]}>
        <Text maxFontSizeMultiplier={1.2} style={styles.commitmentLabel}>Your starting point</Text>
        <Text maxFontSizeMultiplier={1.24} style={styles.commitmentValue}>{startingPoint}</Text>
      </View>
    </SettleIn>
  );
}

export type HealthSummaryRow = Readonly<{ id: string; label: string; value: string }>;

/** Screen 14 — the shared universal plan-summary layout for Eat Healthier. */
export function HealthPlanSummary({ startWith, rows }: { startWith: string; rows: readonly HealthSummaryRow[] }) {
  return (
    <SettleIn style={styles.planSummary}>
      <Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.healthPlanHero} style={styles.planHero} />
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.messageTitle}>Your healthier food plan is ready.</Text>
      <Text maxFontSizeMultiplier={1.3} style={styles.messageBody}>Built around what matters to you—not someone else’s routine.</Text>

      <View accessibilityLabel={`Start with ${startWith}`} style={[styles.commitmentCard, branchShadow]}>
        <Text maxFontSizeMultiplier={1.2} style={styles.commitmentLabel}>Start with</Text>
        <Text maxFontSizeMultiplier={1.24} style={styles.commitmentValue}>{startWith}</Text>
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
        <Heart color={colors.coral} fill={colors.coral} height={18} width={18} />
        <View style={styles.reassuranceText}>
          <Text maxFontSizeMultiplier={1.2} style={styles.reassuranceTitle}>Keep the food you love.</Text>
          <Text maxFontSizeMultiplier={1.25} style={styles.reassuranceBody}>Okyo helps with the next small change.</Text>
        </View>
      </View>
    </SettleIn>
  );
}

/** Small decorative accent used inside the reassurance screen. */
export function HealthReassuranceAccent() {
  return (
    <View style={styles.accentRow}>
      <Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.healthAccentHeart} style={styles.accentDot} />
      <Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.healthAccentSparkle} style={styles.accentDot} />
      <Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.healthAccentBowl} style={styles.accentDot} />
    </View>
  );
}

// Keeps `LightBulb` available for future insight glyphs without an unused-import churn.
export const HEALTH_INSIGHT_GLYPH: IconType = LightBulb;

const styles = StyleSheet.create({
  questionLayout: { flex: 1, gap: 14, justifyContent: 'space-between', paddingBottom: 8 },
  questionLayoutDense: { flex: 0, gap: 8, justifyContent: 'flex-start' },
  questionChoices: { width: '100%' },
  questionSticker: { alignSelf: 'center', height: 108, marginBottom: 2, marginTop: -2, width: 108 },
  questionStickerDense: { height: 58, marginBottom: 0, marginTop: -2, width: 58 },

  message: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', paddingBottom: 8, paddingTop: 8 },
  messageCompact: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', paddingBottom: 8, paddingTop: 8 },
  messageInformation: { alignItems: 'center', gap: 10, paddingBottom: 8, paddingTop: 4 },
  messageSticker: { height: 220, width: 246 },
  eyebrow: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 12, letterSpacing: 0.8, textAlign: 'center', textTransform: 'uppercase' },
  messageTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 27, letterSpacing: -0.6, lineHeight: 33, paddingHorizontal: 6, textAlign: 'center' },
  messageBody: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 23, maxWidth: 340, textAlign: 'center' },
  messageAccent: { height: 34, marginTop: 2, width: 34 },
  footnote: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 13, textAlign: 'center' },

  approachCard: { backgroundColor: colors.coralSoft, borderColor: colors.coral, borderRadius: branchSurfaces.cardRadius, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 18, width: '100%' },
  approachHeadline: { color: colors.coralDark, fontFamily: fontFamilies.extraBold, fontSize: 21, letterSpacing: -0.4, lineHeight: 28, textAlign: 'center' },

  benefitList: { gap: 8, width: '100%' },
  benefitRow: { alignItems: 'center', backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: branchSurfaces.tileRadius, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 54, paddingHorizontal: 12, paddingVertical: 9, ...branchShadow },
  benefitGlyph: { alignItems: 'center', backgroundColor: colors.coralSoft, borderRadius: 12, height: 38, justifyContent: 'center', width: 38 },
  benefitText: { color: branchSurfaces.ink, flex: 1, fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 21 },

  nutritionWrap: { alignItems: 'center', gap: 8, width: '100%' },
  nutritionGrid: { backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: branchSurfaces.cardRadius, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden', width: '100%' },
  nutritionCell: { alignItems: 'center', flexBasis: '50%', gap: 3, justifyContent: 'center', minHeight: 78, padding: 8 },
  nutritionValue: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 32, letterSpacing: -1, lineHeight: 36 },
  nutritionLabel: { color: branchSurfaces.muted, fontFamily: fontFamilies.bold, fontSize: 12, letterSpacing: 0.7 },

  commitmentCard: { backgroundColor: colors.coralSoft, borderColor: colors.coral, borderRadius: branchSurfaces.cardRadius, borderWidth: 1, gap: 6, paddingHorizontal: 20, paddingVertical: 18, width: '100%' },
  commitmentLabel: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  commitmentValue: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 20, letterSpacing: -0.3, lineHeight: 26 },

  planSummary: { alignItems: 'center', gap: 10, paddingBottom: 6 },
  planHero: { height: 150, marginBottom: -6, width: 176 },
  summaryList: { gap: 8, width: '100%' },
  summaryRow: { alignItems: 'center', backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: branchSurfaces.tileRadius, borderWidth: 1, flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingVertical: 9 },
  summaryGlyph: { alignItems: 'center', backgroundColor: colors.health, borderRadius: 999, height: 28, justifyContent: 'center', width: 28 },
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
