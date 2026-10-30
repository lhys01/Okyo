import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SunLight, stickerIcons, type StickerIcon } from '../assets/onboardingStickerIcons';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import { SettleIn } from '../branch-ui/BranchMoments';
import { branchShadow, branchSurfaces } from '../branch-ui/branchTheme';
import type { HealthSummaryRow } from './HealthVisuals';
import { GoalTimelineCard } from './OnboardingGoalScreens';

const APPROACH_FEATURES = [
  { title: 'Scan any dish', detail: 'Take a photo or describe it', icon: stickerIcons.meal, color: '#F35F8D', tint: '#FDE9F0' },
  { title: 'Get the recipe', detail: 'Ingredients, steps and more', icon: stickerIcons.bread, color: '#F1A01B', tint: '#FFF4DF' },
  { title: 'Customize it', detail: 'Adjust to your preferences', icon: stickerIcons.portions, color: '#25AE6A', tint: '#E8F8EE' },
  { title: 'Cook the recipe', detail: 'Real meals, real results', icon: stickerIcons.steak, color: '#7B5DE4', tint: '#F0ECFF' },
] as const;
export type OnboardingApproachFeature = Readonly<{ title: string; detail: string; icon: StickerIcon; color: string; tint: string }>;

export function HealthAcknowledgementScreen() {
  const { height } = useWindowDimensions();
  const compact = height < 900;
  return <SettleIn style={[styles.intro, compact && styles.introCompact]}>
    <View style={styles.introCopy}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.15} style={[styles.heroTitle, compact && styles.heroTitleCompact]}>Let’s make eating{`\n`}healthier feel easier.</Text>
      <Text maxFontSizeMultiplier={1.2} style={[styles.heroSupport, compact && styles.heroSupportCompact]}>No strict rules. No perfect meals. Just small{`\n`}changes that fit the way you already eat.</Text>
    </View>
    <View pointerEvents="none" style={[styles.introArt, compact && styles.introArtCompact]}>
      <View style={styles.introBlobOne} />
      <View style={styles.introBlobTwo} />
      <View style={styles.introBlobThree} />
      <Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.cutefox2} style={[styles.introSticker, compact && styles.introStickerCompact]} />
    </View>
  </SettleIn>;
}

export function HealthApproachScreen({
  features = APPROACH_FEATURES,
  art = onboardingV3Assets.cutefox1,
}: { features?: readonly OnboardingApproachFeature[]; art?: number } = {}) {
  const { height } = useWindowDimensions();
  const compact = height < 900;
  return <SettleIn style={[styles.approach, compact && styles.approachCompact]}>
    <View style={styles.approachHeading}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.15} style={[styles.approachTitle, compact && styles.approachTitleCompact]}>Why Okyo’s{`\n`}approach works</Text>
      <Text maxFontSizeMultiplier={1.2} style={[styles.approachSupport, compact && styles.approachSupportCompact]}>Scan a dish, get the details,{`\n`}and make it yours.</Text>
    </View>
    <View accessibilityLabel="How Okyo works" style={[styles.featureList, compact && styles.featureListCompact]}>
      {features.map((feature) => <View key={feature.title} style={[styles.featureCard, compact && styles.featureCardCompact, branchShadow]}>
        <View style={[styles.featureIcon, compact && styles.featureIconCompact, { backgroundColor: feature.tint }]}>
          <feature.icon color={feature.color} height={compact ? 28 : 30} strokeWidth={2.25} width={compact ? 28 : 30} />
        </View>
        <View style={styles.featureCopy}>
          <Text maxFontSizeMultiplier={1.15} style={[styles.featureTitle, compact && styles.featureTitleCompact]}>{feature.title}</Text>
          <Text maxFontSizeMultiplier={1.15} style={[styles.featureDetail, compact && styles.featureDetailCompact]}>{feature.detail}</Text>
        </View>
      </View>)}
    </View>
    <View pointerEvents="none" style={[styles.approachArt, compact && styles.approachArtCompact]}>
      <View style={styles.approachBlobOne} />
      <View style={styles.approachBlobTwo} />
      <Image accessibilityElementsHidden contentFit="contain" source={art} style={[styles.approachSticker, compact && styles.approachStickerCompact]} />
    </View>
  </SettleIn>;
}

export function HealthPlanSummary({ rows, goal }: { rows: readonly HealthSummaryRow[]; goal?: import('../state/onboardingGoal').OnboardingGoal | null }) {
  const { height } = useWindowDimensions();
  const compact = height < 900;
  const byId = (id: string) => rows.find((row) => row.id === id)?.value ?? 'Not yet specified';
  const barrierTail: Record<string, string> = {
    'Not enough time': 'not enough time gets in the way',
    'Costs too much': 'the cost gets in the way',
    'Unsure what to cook': 'being unsure what to cook gets in the way',
    'Healthy food feels boring': 'healthy food feeling boring gets in the way',
    'Hard to stay consistent': 'staying consistent gets in the way',
    'Too hungry or tired': 'feeling hungry or tired gets in the way',
  };
  const pace = byId('pace') === 'Small changes a few days' ? 'Small changes a few days\na week' : byId('pace');
  const finalRows = [
    { id: 'challenge', label: 'Your main challenge', value: `${byId('problem')}; ${barrierTail[byId('barrier')] ?? byId('barrier').toLowerCase()}`, icon: stickerIcons.bars, color: '#F1A01B', tint: '#FFF4DF' },
    { id: 'pace', label: 'Starting point', value: pace, icon: SunLight, color: '#F1A01B', tint: '#FFF4DF' },
  ] as const;
  return <SettleIn style={[styles.finalPlan, compact && styles.finalPlanCompact]}>
    <View style={styles.finalHeading}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.15} style={[styles.finalTitle, compact && styles.finalTitleCompact]}>Your plan is ready.</Text>
      <Text maxFontSizeMultiplier={1.2} style={[styles.finalSupport, compact && styles.finalSupportCompact]}>Here’s a quick summary of what{`\n`}we’ll focus on.</Text>
    </View>
    <GoalTimelineCard compact={compact} emphasis="hero" goal={goal ?? null} />
    <View style={[styles.finalRows, compact && styles.finalRowsCompact]}>
      {finalRows.map((row) => <View accessibilityLabel={`${row.label}: ${row.value}`} key={row.id} style={[styles.finalRow, compact && styles.finalRowCompact, branchShadow]}>
        <View style={[styles.finalIcon, compact && styles.finalIconCompact, { backgroundColor: row.tint }]}><row.icon color={row.color} height={38} strokeWidth={2.15} width={38} /></View>
        <View style={styles.finalRowCopy}>
          <Text maxFontSizeMultiplier={1.15} style={[styles.finalLabel, compact && styles.finalLabelCompact]}>{row.label}</Text>
          <Text maxFontSizeMultiplier={1.15} numberOfLines={2} style={[styles.finalValue, compact && styles.finalValueCompact]}>{row.value}</Text>
        </View>
      </View>)}
    </View>
    <View style={[styles.closingPanel, compact && styles.closingPanelCompact]}>
      <View style={styles.closingCopy}>
        <Text maxFontSizeMultiplier={1.15} style={[styles.closingTitle, compact && styles.closingTitleCompact]}>You’re all set!</Text>
        <Text maxFontSizeMultiplier={1.2} style={[styles.closingBody, compact && styles.closingBodyCompact]}>I’ll help you find simple, delicious recipes that fit your routine.</Text>
      </View>
      <View pointerEvents="none" style={styles.closingArt}>
        <View style={styles.closingBlob} />
        <Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.cutefox3} style={[styles.closingSticker, compact && styles.closingStickerCompact]} />
      </View>
    </View>
  </SettleIn>;
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', flex: 1, justifyContent: 'flex-start', minHeight: 620, paddingTop: 86 },
  introCompact: { minHeight: 520, paddingTop: 42 },
  introCopy: { alignItems: 'center', gap: 20 },
  heroTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 34, letterSpacing: -1.15, lineHeight: 40, textAlign: 'center' },
  heroTitleCompact: { fontSize: 30, lineHeight: 36 },
  heroSupport: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 17, lineHeight: 25, textAlign: 'center' },
  heroSupportCompact: { fontSize: 15, lineHeight: 22 },
  introArt: { alignItems: 'center', height: 360, justifyContent: 'center', marginTop: 46, overflow: 'visible', width: '100%' },
  introArtCompact: { height: 300, marginTop: 38 },
  introBlobOne: { backgroundColor: '#FDEEF2', borderRadius: 999, height: 232, opacity: 0.76, position: 'absolute', top: 54, transform: [{ rotate: '-8deg' }], width: 380 },
  introBlobTwo: { backgroundColor: '#FBE8EF', borderRadius: 999, height: 140, opacity: 0.62, position: 'absolute', right: -4, top: 150, transform: [{ rotate: '14deg' }], width: 230 },
  introBlobThree: { backgroundColor: '#FEF4F6', borderRadius: 999, bottom: 8, height: 84, left: 36, opacity: 0.9, position: 'absolute', width: 220 },
  introSticker: { height: 340, transform: [{ translateY: 12 }], width: 340 },
  introStickerCompact: { height: 290, transform: [{ translateY: 10 }], width: 290 },
  approach: { alignItems: 'center', flex: 1, gap: 16, minHeight: 620, paddingTop: 18 },
  approachCompact: { gap: 10, minHeight: 540, paddingTop: 4 },
  approachHeading: { alignItems: 'center', gap: 8 },
  approachTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 33, letterSpacing: -1, lineHeight: 38, textAlign: 'center' },
  approachTitleCompact: { fontSize: 29, lineHeight: 34 },
  approachSupport: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 17, lineHeight: 24, textAlign: 'center' },
  approachSupportCompact: { fontSize: 15, lineHeight: 21 },
  featureList: { gap: 8, width: '100%' },
  featureListCompact: { gap: 6 },
  featureCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: '#F0E8E2', borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 14, minHeight: 70, paddingHorizontal: 14, paddingVertical: 8 },
  featureCardCompact: { borderRadius: 17, gap: 11, minHeight: 59, paddingHorizontal: 11, paddingVertical: 6 },
  featureIcon: { alignItems: 'center', borderRadius: 999, height: 52, justifyContent: 'center', width: 52 },
  featureIconCompact: { height: 50, width: 50 },
  featureCopy: { flex: 1, gap: 1 },
  featureTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.bold, fontSize: 17, lineHeight: 22 },
  featureTitleCompact: { fontSize: 15, lineHeight: 19 },
  featureDetail: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 19 },
  featureDetailCompact: { fontSize: 12, lineHeight: 16 },
  approachArt: { alignItems: 'center', flex: 1, justifyContent: 'flex-end', minHeight: 155, overflow: 'visible', width: '100%' },
  approachArtCompact: { minHeight: 180 },
  approachBlobOne: { backgroundColor: '#FDEEF2', borderRadius: 999, bottom: 0, height: 122, opacity: 0.7, position: 'absolute', width: 330 },
  approachBlobTwo: { backgroundColor: '#FEF4F6', borderRadius: 999, bottom: 18, height: 76, opacity: 0.8, position: 'absolute', right: 24, width: 165 },
  approachSticker: { height: 196, transform: [{ translateY: 10 }], width: 196 },
  approachStickerCompact: { height: 190, transform: [{ translateY: 9 }], width: 190 },
  finalPlan: { alignItems: 'center', flex: 1, gap: 13, minHeight: 620, paddingTop: 14 },
  finalPlanCompact: { gap: 8, minHeight: 540, paddingTop: 24 },
  finalHeading: { alignItems: 'center', gap: 8 },
  finalTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 33, letterSpacing: -1, lineHeight: 39, textAlign: 'center' },
  finalTitleCompact: { fontSize: 29, lineHeight: 34 },
  finalSupport: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 17, lineHeight: 24, textAlign: 'center' },
  finalSupportCompact: { fontSize: 15, lineHeight: 21 },
  finalRows: { gap: 9, width: '100%' },
  finalRowsCompact: { gap: 6 },
  finalRow: { alignItems: 'center', backgroundColor: colors.surface, borderColor: '#F2E4E4', borderRadius: 22, borderWidth: 1, flexDirection: 'row', gap: 14, minHeight: 90, paddingHorizontal: 14, paddingVertical: 10 },
  finalRowCompact: { borderRadius: 20, gap: 11, minHeight: 70, paddingHorizontal: 12, paddingVertical: 7 },
  finalIcon: { alignItems: 'center', borderRadius: 999, height: 56, justifyContent: 'center', width: 56 },
  finalIconCompact: { height: 56, width: 56 },
  finalRowCopy: { flex: 1, gap: 2 },
  finalLabel: { color: branchSurfaces.ink, fontFamily: fontFamilies.bold, fontSize: 16, lineHeight: 20 },
  finalLabelCompact: { fontSize: 15, lineHeight: 19 },
  finalValue: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 22 },
  finalValueCompact: { fontSize: 15, lineHeight: 21 },
  closingPanel: { alignItems: 'center', backgroundColor: '#FDEBF0', borderRadius: 22, flexDirection: 'row', minHeight: 188, overflow: 'hidden', paddingLeft: 18, width: '100%' },
  closingPanelCompact: { minHeight: 156, paddingLeft: 16 },
  closingCopy: { flex: 1, gap: 8, paddingVertical: 18, zIndex: 2 },
  closingTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 30, letterSpacing: -0.65, lineHeight: 35 },
  closingTitleCompact: { fontSize: 26, lineHeight: 31 },
  closingBody: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 21 },
  closingBodyCompact: { fontSize: 14, lineHeight: 19 },
  closingArt: { alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center', width: '44%' },
  closingBlob: { backgroundColor: '#FADFE8', borderRadius: 999, height: 156, opacity: 0.82, position: 'absolute', width: 190 },
  closingSticker: { height: 174, width: 174 },
  closingStickerCompact: { height: 144, width: 144 },
});
