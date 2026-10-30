import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import { SettleIn } from '../branch-ui/BranchMoments';
import { BranchHeading } from '../branch-ui/BranchControls';
import { branchShadow, branchSurfaces } from '../branch-ui/branchTheme';
import { motionTokens } from '../motion/motionTokens';
import { useReduceMotion } from '../motion/useReduceMotion';

const EXAMPLE_NUTRITION = [
  { id: 'calories', label: 'CAL', value: '~520' },
  { id: 'protein', label: 'PROTEIN', value: '34g' },
  { id: 'carbs', label: 'CARBS', value: '46g' },
  { id: 'fat', label: 'FAT', value: '19g' },
] as const;
const HEALTH_PROGRESS_VIDEO = require('../../../assets/videos/gradient-1-1920x1080.mp4');

/** A clipped, looping use of the provided gradient video rather than a flat fill. */
export function HealthProgress({ question, total = 8 }: { question: number; total?: number }) {
  const reduceMotion = useReduceMotion();
  const current = Math.min(Math.max(question, 1), total);
  const progress = useSharedValue(current / total);
  const player = useVideoPlayer(HEALTH_PROGRESS_VIDEO, (videoPlayer) => {
    videoPlayer.loop = true;
    void videoPlayer.play();
  });
  useEffect(() => {
    progress.value = withTiming(current / total, { duration: reduceMotion ? 0 : motionTokens.pagerDot.durationMs });
  }, [current, progress, reduceMotion, total]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return <View accessibilityRole="progressbar" accessibilityLabel={`Question ${question} of ${total}`}
    accessibilityValue={{ min: 0, max: total, now: current }} style={styles.progress}>
    <View style={styles.progressTrack}><Animated.View style={[styles.progressFill, fillStyle]}>
      <VideoView contentFit="cover" nativeControls={false} player={player} style={StyleSheet.absoluteFill} />
    </Animated.View></View>
    <Text style={styles.progressLabel}>{current}/{total}</Text>
  </View>;
}
export function HealthV3QuestionLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <View style={styles.questionLayout}><BranchHeading subtitle={subtitle} title={title} /><View style={styles.questionChoices}>{children}</View></View>;
}
export function HealthV3MessageScreen({ sticker, title, body, eyebrow, tone = 'intro' }: {
  sticker: number;
  title: string;
  body: string;
  eyebrow?: string;
  tone?: 'intro' | 'insight';
}) {
  return <SettleIn style={[styles.message, tone === 'insight' && styles.insightMessage]}>
    {eyebrow ? <Text maxFontSizeMultiplier={1.2} style={styles.eyebrow}>{eyebrow}</Text> : null}
    <Text accessibilityRole="header" maxFontSizeMultiplier={1.24} style={styles.title}>{title}</Text>
    <View style={[styles.messageCopy, tone === 'insight' && styles.messageCopyInsight]}>
      <Text maxFontSizeMultiplier={1.3} style={styles.body}>{body}</Text>
    </View>
    <View style={[styles.artStage, tone === 'insight' && styles.artStageInsight]}>
      <View pointerEvents="none" style={styles.artBlobOne} />
      <View pointerEvents="none" style={styles.artBlobTwo} />
      <Image accessibilityElementsHidden contentFit="contain" source={sticker} style={[styles.sticker, tone === 'insight' && styles.stickerInsight]} />
    </View>
  </SettleIn>;
}
export function HealthAcknowledgementScreen({ sticker, title, body }: { sticker: number; title: string; body: string }) {
  return <SettleIn style={styles.acknowledgement}>
    <Text accessibilityRole="header" maxFontSizeMultiplier={1.24} style={styles.title}>{title}</Text>
    <Text maxFontSizeMultiplier={1.3} style={styles.body}>{body}</Text>
    <View style={styles.acknowledgementArt}>
      <View pointerEvents="none" style={styles.acknowledgementBlob} />
      <Image accessibilityElementsHidden contentFit="contain" source={sticker} style={styles.acknowledgementSticker} />
    </View>
  </SettleIn>;
}
export function HealthNutritionExample() {
  return <View style={styles.nutritionWrap}>
    <View accessibilityLabel="Example recipe nutrition: approximately 520 calories, 34 grams protein, 46 grams carbohydrates, and 19 grams fat."
      accessibilityRole="summary" style={[styles.nutritionGrid, branchShadow]} testID="health-example-nutrition">
      {EXAMPLE_NUTRITION.map((nutrient) => <View key={nutrient.id} style={styles.nutritionCell}>
        <Text maxFontSizeMultiplier={1.2} style={styles.nutritionValue}>{nutrient.value}</Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.nutritionLabel}>{nutrient.label}</Text>
      </View>)}
    </View>
    <Text maxFontSizeMultiplier={1.25} style={styles.footnote}>Example nutrition — not your personal target.</Text>
  </View>;
}
export type HealthSummaryRow = Readonly<{ id: string; label: string; value: string }>;
export function HealthPlanSummary({ summary, rows }: { summary: string; rows: readonly HealthSummaryRow[] }) {
  const { height } = useWindowDimensions();
  const isCompact = height < 800;
  const byId = (id: string) => rows.find((row) => row.id === id)?.value ?? 'Not yet specified';
  const priorityTail: Record<string, string> = {
    'Quick to make': 'keeping it quick to make',
    'Costs less': 'keeping costs down',
    'Simple ingredients': 'keeping ingredients simple',
  };
  const finalRows = [
    { id: 'goal', label: 'Your goal', value: `${byId('goal')}, while ${priorityTail[byId('priority')] ?? 'fitting your routine'}` },
    { id: 'challenge', label: 'Your main challenge', value: `${byId('problem')}; ${byId('barrier').toLowerCase()}` },
    { id: 'pace', label: 'Starting point', value: byId('pace') },
  ];
  return <SettleIn style={[styles.plan, isCompact && styles.planCompact]}>
    <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={[styles.title, isCompact && styles.planTitleCompact]}>Your plan is ready.</Text>
    <Text maxFontSizeMultiplier={1.3} style={[styles.planIntro, isCompact && styles.planIntroCompact]}>A starting point that works with your real life.</Text>
    <View style={styles.finalPlanRows}>
      {finalRows.map((row, index) => <View accessibilityLabel={`${row.label}: ${row.value}`} key={row.id} style={[styles.finalPlanRow, isCompact && styles.finalPlanRowCompact, branchShadow]}>
        <View style={[styles.finalPlanAccent, styles[`finalPlanAccent${index}` as 'finalPlanAccent0' | 'finalPlanAccent1' | 'finalPlanAccent2']]} />
        <Text maxFontSizeMultiplier={1.2} style={styles.summaryLabel}>{row.label}</Text>
        <Text maxFontSizeMultiplier={1.24} style={styles.summaryValue}>{row.value}</Text>
      </View>)}
    </View>
    <View style={[styles.planClosing, isCompact && styles.planClosingCompact]}>
      <View style={styles.planClosingCopy}>
        <Text maxFontSizeMultiplier={1.2} style={styles.planClosingTitle}>You’re all set!</Text>
        <Text maxFontSizeMultiplier={1.3} style={[styles.planSummary, isCompact && styles.planSummaryCompact]}>{summary}</Text>
      </View>
      <Image accessibilityElementsHidden contentFit="contain" source={onboardingV3Assets.healthPlanHero} style={[styles.planSticker, isCompact && styles.planStickerCompact]} />
    </View>
  </SettleIn>;
}
const styles = StyleSheet.create({
  progress: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12 },
  progressTrack: { flex: 1, height: 6, borderRadius: 99, backgroundColor: colors.canvasSunk, overflow: 'hidden' },
  progressFill: { borderRadius: 99, height: '100%', overflow: 'hidden' },
  progressLabel: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 12 },
  questionLayout: { flexGrow: 1, gap: 8, paddingBottom: 4, width: '100%' },
  questionChoices: { flexGrow: 1, width: '100%' },
  message: { alignItems: 'center', flex: 1, gap: 16, justifyContent: 'center', paddingBottom: 4, paddingTop: 4 },
  insightMessage: { gap: 20, justifyContent: 'center' },
  eyebrow: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 11, letterSpacing: 1.1, textAlign: 'center' },
  title: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 28, letterSpacing: -0.75, lineHeight: 34, textAlign: 'center' },
  body: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  messageCopy: { maxWidth: 350, paddingHorizontal: 8 },
  messageCopyInsight: { backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: 22, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 16, width: '100%', ...branchShadow },
  copyLabel: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 10, letterSpacing: 1, textAlign: 'center' },
  artStage: { alignItems: 'center', height: 250, justifyContent: 'center', overflow: 'hidden', width: '100%' },
  artStageInsight: { height: 164 },
  artBlobOne: { backgroundColor: colors.healthSoft, borderRadius: 999, height: 230, opacity: 0.82, position: 'absolute', transform: [{ rotate: '-12deg' }], width: 330 },
  artBlobTwo: { backgroundColor: colors.coralSoft, borderRadius: 999, bottom: -58, height: 140, opacity: 0.65, position: 'absolute', right: -36, width: 230 },
  sticker: { height: 230, width: 230 },
  stickerInsight: { height: 152, width: 152 },
  acknowledgement: { alignItems: 'center', flex: 1, gap: 18, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  acknowledgementArt: { alignItems: 'center', height: 166, justifyContent: 'center', overflow: 'hidden', width: '100%' },
  acknowledgementBlob: { backgroundColor: colors.healthSoft, borderRadius: 999, height: 150, opacity: 0.8, position: 'absolute', transform: [{ rotate: '-10deg' }], width: 228 },
  acknowledgementSticker: { height: 152, width: 152 },
  nutritionWrap: { alignItems: 'center', gap: 8, width: '100%' },
  nutritionGrid: { backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: 20, borderWidth: 1, flexDirection: 'row', width: '100%' },
  nutritionCell: { alignItems: 'center', flex: 1, gap: 4, justifyContent: 'center', minHeight: 82, paddingVertical: 10 },
  nutritionValue: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 24, letterSpacing: -0.7, lineHeight: 30 },
  nutritionLabel: { color: branchSurfaces.muted, fontFamily: fontFamilies.bold, fontSize: 9 },
  footnote: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  plan: { alignItems: 'center', gap: 10, paddingBottom: 4 },
  planCompact: { gap: 6 },
  planTitleCompact: { fontSize: 26, lineHeight: 32 },
  planIntro: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  planIntroCompact: { fontSize: 14, lineHeight: 19 },
  finalPlanRows: { gap: 10, width: '100%' },
  finalPlanRow: { backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: 21, borderWidth: 1, minHeight: 82, overflow: 'hidden', paddingHorizontal: 18, paddingVertical: 11 },
  finalPlanRowCompact: { minHeight: 70, paddingHorizontal: 15, paddingVertical: 8 },
  finalPlanAccent: { bottom: 0, left: 0, position: 'absolute', top: 0, width: 5 },
  finalPlanAccent0: { backgroundColor: '#FC8BA8' },
  finalPlanAccent1: { backgroundColor: '#F3B34C' },
  finalPlanAccent2: { backgroundColor: '#8B72E7' },
  summaryLabel: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 12 },
  summaryValue: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 20 },
  planClosing: { alignItems: 'center', backgroundColor: colors.healthSoft, borderRadius: 24, flexDirection: 'row', minHeight: 184, overflow: 'hidden', paddingLeft: 18, width: '100%' },
  planClosingCompact: { minHeight: 156, paddingLeft: 16 },
  planClosingCopy: { flex: 1, gap: 8, paddingVertical: 18 },
  planClosingTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 30, letterSpacing: -0.65, lineHeight: 35 },
  planSummary: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 21 },
  planSummaryCompact: { fontSize: 14, lineHeight: 19 },
  planSticker: { height: 170, width: 170 },
  planStickerCompact: { height: 144, width: 144 },
});

// Compatibility layouts still consumed by Macros; preserve their visuals.
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
    <View style={[legacyStyles.questionLayout, density === 'dense' && legacyStyles.questionLayoutDense]}>
      <View style={legacyStyles.questionHeader}>
        <BranchHeading subtitle={subtitle} title={title} />
      </View>
      {sticker ? (
        <View style={[legacyStyles.questionStickerStage, density === 'dense' && legacyStyles.questionStickerStageDense]}>
          <View pointerEvents="none" style={legacyStyles.questionStickerGlow} />
          <Image accessibilityElementsHidden contentFit="contain" source={sticker} style={[legacyStyles.questionSticker, density === 'dense' && legacyStyles.questionStickerDense]} />
        </View>
      ) : null}
      <View style={legacyStyles.questionChoices}>
        <View style={legacyStyles.questionChoiceRule} />
        {children}
      </View>
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
    <SettleIn style={legacyStyles.message}>
      <HealthArtStage source={sticker} />
      {eyebrow ? <Text maxFontSizeMultiplier={1.2} style={legacyStyles.eyebrow}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.24} style={legacyStyles.messageTitle}>{title}</Text>
      {body ? <Text maxFontSizeMultiplier={1.3} style={legacyStyles.messageBody}>{body}</Text> : null}
      {accent ? (
        <Image accessibilityElementsHidden contentFit="contain" source={accentSource(accent)} style={legacyStyles.messageAccent} />
      ) : null}
      {children}
      {footnote ? <Text maxFontSizeMultiplier={1.25} style={legacyStyles.footnote}>{footnote}</Text> : null}
    </SettleIn>
  );
}

function accentSource(accent: 'heart' | 'sparkle' | 'bowl'): number {
  if (accent === 'sparkle') return onboardingV3Assets.healthAccentSparkle;
  if (accent === 'bowl') return onboardingV3Assets.healthAccentBowl;
  return onboardingV3Assets.healthAccentHeart;
}

function HealthArtStage({ source, compact = false }: { source: number; compact?: boolean }) {
  return (
    <View style={[legacyStyles.artStage, compact && legacyStyles.artStageCompact]}>
      <View pointerEvents="none" style={legacyStyles.artStageOrbPrimary} />
      <View pointerEvents="none" style={legacyStyles.artStageOrbSecondary} />
      <Image accessibilityElementsHidden contentFit="contain" source={source} style={[legacyStyles.messageSticker, compact && legacyStyles.messageStickerCompact]} />
    </View>
  );
}


const legacyStyles = StyleSheet.create({
  questionLayout: { flex: 1, gap: 16, justifyContent: 'space-between', paddingBottom: 10 },
  questionLayoutDense: { flex: 0, gap: 10, justifyContent: 'flex-start' },
  questionHeader: { paddingHorizontal: 2 },
  questionChoices: { gap: 10, width: '100%' },
  questionChoiceRule: { alignSelf: 'center', backgroundColor: colors.health, borderRadius: 99, height: 3, opacity: 0.34, width: 38 },
  questionStickerStage: { alignItems: 'center', alignSelf: 'center', height: 118, justifyContent: 'center', marginBottom: 2, marginTop: -2, overflow: 'hidden', width: 142 },
  questionStickerStageDense: { height: 64, marginBottom: 0, width: 84 },
  questionStickerGlow: { backgroundColor: colors.healthSoft, borderRadius: 999, height: 84, opacity: 0.92, position: 'absolute', transform: [{ rotate: '-14deg' }], width: 120 },
  questionSticker: { height: 108, width: 108 },
  questionStickerDense: { height: 58, width: 58 },
  message: { alignItems: 'center', flex: 1, gap: 14, justifyContent: 'center', paddingBottom: 10, paddingTop: 6 },
  artStage: { alignItems: 'center', backgroundColor: colors.healthSoft, borderColor: colors.border, borderRadius: 34, borderWidth: 1, height: 192, justifyContent: 'center', overflow: 'hidden', width: '100%', ...branchShadow },
  artStageCompact: { borderRadius: 28, height: 146 },
  artStageOrbPrimary: { backgroundColor: colors.surface, borderRadius: 999, height: 214, opacity: 0.78, position: 'absolute', right: -62, top: -92, width: 214 },
  artStageOrbSecondary: { backgroundColor: colors.coralSoft, borderRadius: 999, bottom: -76, height: 144, left: -44, opacity: 0.88, position: 'absolute', width: 144 },
  messageSticker: { height: 204, width: 246 },
  messageStickerCompact: { height: 156, width: 190 },
  eyebrow: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 12, letterSpacing: 1, textAlign: 'center', textTransform: 'uppercase' },
  messageTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 28, letterSpacing: -0.75, lineHeight: 34, paddingHorizontal: 8, textAlign: 'center' },
  messageBody: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 24, maxWidth: 336, textAlign: 'center' },
  messageAccent: { height: 32, marginTop: 0, width: 32 },
  footnote: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 18, paddingHorizontal: 12, textAlign: 'center' },
});
