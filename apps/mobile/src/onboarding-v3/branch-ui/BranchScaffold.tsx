import { useEffect, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { motionTokens } from '../motion/motionTokens';
import { useReduceMotion } from '../motion/useReduceMotion';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { OnboardingScreenTransition } from '../components/OnboardingScreenTransition';
import { branchPalettes, branchSurfaces, type BranchId } from './branchTheme';

export type BranchProgress = Readonly<{ answered: number; total: number }>;

/**
 * The single shell every branch screen renders inside: safe-area top and
 * bottom, a persistent Back control, a question-count progress bar, a
 * scrollable body, and a CTA anchored near the bottom.
 */
export function BranchScaffold({
  branch,
  onBack,
  hideBack = false,
  progress = null,
  ground,
  children,
  footer,
  contentStyle,
  progressVariant = 'segmented',
  transitionOrder,
  transitionStep,
}: {
  branch: BranchId;
  onBack: () => void;
  hideBack?: boolean;
  progress?: BranchProgress | null;
  /** Set on interstitial moments that use a full-bleed tinted ground. */
  ground?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Optional branch-specific density treatment for a compact questionnaire. */
  contentStyle?: StyleProp<ViewStyle>;
  progressVariant?: 'segmented' | 'continuous';
  transitionOrder?: readonly string[];
  transitionStep?: string;
}) {
  const body = transitionStep ? (
    <OnboardingScreenTransition step={transitionStep} stepOrder={transitionOrder} style={contentStyle}>
      {children}
    </OnboardingScreenTransition>
  ) : <View style={contentStyle}>{children}</View>;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safe, ground ? { backgroundColor: ground } : null]}>
      <View style={styles.header}>
        <OnboardingBackButton hidden={hideBack} onPress={onBack} />
        {progress ? <BranchProgressBar branch={branch} progress={progress} variant={progressVariant} /> : <View style={styles.progressSpacer} />}
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle ? styles.contentFill : null]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {body}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

/**
 * Segmented progress across the branch's *questions*, not its screens, so the
 * indicator never implies progress the user has not actually made.
 */
export function BranchProgressBar({ branch, progress, variant = 'segmented' }: { branch: BranchId; progress: BranchProgress; variant?: 'segmented' | 'continuous' }) {
  const palette = branchPalettes[branch];
  const total = Math.max(progress.total, 1);
  const answered = Math.min(Math.max(progress.answered, 0), total);
  return (
    <View
      accessibilityLabel={`Question ${Math.min(answered + 1, total)} of ${total}`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: answered }}
      style={styles.progress}
    >
      {variant === 'continuous' ? <ContinuousProgress answered={answered} tint={palette.accent} total={total} /> : <View style={styles.progressTrack}>
        {Array.from({ length: total }, (_, index) => <ProgressSegment key={index} filled={index < answered} tint={palette.accent} />)}
      </View>}
      <Text allowFontScaling={false} style={styles.progressLabel}>
        {Math.min(answered + 1, total)}/{total}
      </Text>
    </View>
  );
}

function ContinuousProgress({ answered, tint, total }: { answered: number; tint: string; total: number }) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(answered / total);
  useEffect(() => {
    progress.value = withTiming(answered / total, { duration: reduceMotion ? 0 : motionTokens.pagerDot.durationMs });
  }, [answered, progress, reduceMotion, total]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return <View style={styles.continuousTrack}><Animated.View style={[styles.continuousFill, { backgroundColor: tint }, fillStyle]} /></View>;
}

function ProgressSegment({ filled, tint }: { filled: boolean; tint: string }) {
  const reduceMotion = useReduceMotion();
  const fill = useSharedValue<number>(filled ? 1 : 0);

  useEffect(() => {
    fill.value = withTiming(filled ? 1 : 0, { duration: reduceMotion ? 0 : motionTokens.pagerDot.durationMs });
  }, [fill, filled, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: 0.18 + fill.value * 0.82 }));
  return <Animated.View style={[styles.progressSegment, { backgroundColor: tint }, animatedStyle]} />;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.canvas, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 48, paddingHorizontal: 20, paddingTop: 6 },
  progressSpacer: { flex: 1 },
  progress: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10 },
  progressTrack: { flex: 1, flexDirection: 'row', gap: 4 },
  continuousTrack: { backgroundColor: colors.canvasSunk, borderRadius: 999, flex: 1, height: 6, overflow: 'hidden' },
  continuousFill: { borderRadius: 999, height: '100%' },
  progressSegment: { borderRadius: 999, flex: 1, height: 5 },
  progressLabel: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 12 },
  content: { paddingBottom: 28, paddingHorizontal: 20, paddingTop: 12 },
  // Only branches that opt into a content style use the full available height.
  // This lets their own layouts intentionally distribute visual weight without
  // altering the established spacing of the other onboarding branches.
  contentFill: { flexGrow: 1 },
  footer: { paddingBottom: 12, paddingHorizontal: 20, paddingTop: 8 },
});
