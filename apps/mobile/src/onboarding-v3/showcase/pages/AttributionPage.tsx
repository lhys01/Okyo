import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppStore, Check, Group, Instagram, Tiktok, UserLove, Youtube } from 'iconoir-react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, homeRecipeCardShadow, onboardingFontFamilies as fontFamilies, onboardingTitleFont } from '../../../theme/okyoTheme';
import { type AttributionSource } from '../../state/attribution';
import { motionTokens } from '../../motion/motionTokens';
import { useReduceMotion } from '../../motion/useReduceMotion';
import { getShowcaseResponsiveLayout } from '../showcaseResponsiveLayout';
import { onboardingShadow } from '../../branch-ui/branchTheme';
import { ShowcasePageShell } from './ShowcasePageShell';
import type { ShowcasePageProps } from './types';

const OPTIONS = [
  { source: 'influencer', label: 'From influencer', testID: 'attribution-option-influencer', Icon: UserLove, color: '#8B62C6' },
  { source: 'instagram', label: 'Instagram', testID: 'attribution-option-instagram', Icon: Instagram, color: '#D45586' },
  { source: 'tiktok', label: 'TikTok', testID: 'attribution-option-tiktok', Icon: Tiktok, color: '#29252A' },
  { source: 'youtube', label: 'YouTube', testID: 'attribution-option-youtube', Icon: Youtube, color: '#E6534D' },
  { source: 'app_store', label: 'App Store search', testID: 'attribution-option-app-store', Icon: AppStore, color: '#4B91E7' },
  { source: 'friends_family', label: 'Friends or family', testID: 'attribution-option-friends-family', Icon: Group, color: '#47A967' },
] as const satisfies readonly { source: AttributionSource; label: string; testID: string; Icon: typeof Instagram; color: string }[];

function AttributionRow({ option, index, selected, settled, onPress }: {
  option: typeof OPTIONS[number];
  index: number;
  selected: boolean;
  settled: boolean;
  onPress: () => void;
}) {
  const Icon = option.Icon;
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(settled ? 1 : 0);
  const checkScale = useSharedValue(selected ? 1 : 0.85);
  useEffect(() => {
    progress.value = reduceMotion
      ? withTiming(settled ? 1 : 0, { duration: motionTokens.settle.reduceMotionMs })
      : withDelay(index * motionTokens.attribution.rowDelayStepMs, withTiming(settled ? 1 : 0, {
          duration: motionTokens.attribution.rowMs,
          easing: Easing.out(Easing.quad),
        }));
  }, [index, progress, reduceMotion, settled]);
  useEffect(() => {
    checkScale.value = selected
      ? reduceMotion ? 1 : withSpring(1, { damping: motionTokens.attribution.springDamping, stiffness: motionTokens.attribution.springStiffness })
      : 0.85;
  }, [checkScale, reduceMotion, selected]);
  const rowStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.value) * motionTokens.stagger.translateY }],
  }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: selected ? 1 : 0, transform: [{ scale: checkScale.value }] }));
  return (
    <Animated.View style={[styles.rowWrap, rowStyle]}>
      <Pressable
        accessible
        accessibilityLabel={option.label}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={[styles.row, selected && styles.rowSelected, onboardingShadow]}
        testID={option.testID}
      >
        <View style={[styles.iconCircle, { backgroundColor: `${option.color}14` }]}><Icon color={option.color} height={21} strokeWidth={2.2} width={21} /></View>
        <Text maxFontSizeMultiplier={2} style={styles.rowLabel}>{option.label}</Text>
        <Animated.View style={[styles.check, checkStyle]}><Check color={colors.coralDark} height={20} strokeWidth={3} width={20} /></Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export function AttributionPage(props: ShowcasePageProps & {
  attribution: AttributionSource | null;
  onSelectAttribution: (source: AttributionSource) => void;
  onSkipAttribution: () => void;
}) {
  const [selected, setSelected] = useState<AttributionSource | null>(props.attribution);
  const { fontScale, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = getShowcaseResponsiveLayout({ windowHeight: height, topInset: insets.top, bottomInset: insets.bottom, fontScale });
  const reduceMotion = useReduceMotion();
  const advance = useSharedValue(0);

  const select = (source: AttributionSource) => {
    setSelected(source);
    props.onSelectAttribution(source);
    if (reduceMotion) {
      props.onNext();
      return;
    }
    advance.value = withTiming(1, {
      duration: motionTokens.attribution.selectMs,
      easing: Easing.out(Easing.quad),
    }, (finished) => {
      if (finished) runOnJS(props.onNext)();
    });
  };

  return (
    <ShowcasePageShell ctaLabel="Next" onBack={props.onBack} onNext={() => { props.onSkipAttribution(); props.onNext(); }} page={props.page}>
      <ScrollView contentContainerStyle={[styles.content, layout.compact ? styles.contentCompact : styles.contentBalanced]} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={2} style={[styles.title, layout.compact && styles.titleCompact, { lineHeight: (layout.compact ? 32 : 35) * layout.fontScale }]}>How did you hear about Okyo?</Text>
        <View accessibilityRole="radiogroup" accessible={false} style={[styles.rows, layout.compact && styles.rowsCompact]}>
          {OPTIONS.map((option, index) => (
            <AttributionRow
              index={index}
              key={option.source}
              onPress={() => select(option.source)}
              option={option}
              selected={selected === option.source}
              settled={props.settled}
            />
          ))}
        </View>
      </ScrollView>
    </ShowcasePageShell>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingBottom: 8, paddingHorizontal: 24, paddingTop: 0 },
  contentBalanced: { flexGrow: 1, justifyContent: 'flex-start', paddingBottom: 18, paddingTop: 8 },
  contentCompact: { paddingBottom: 12, paddingHorizontal: 20, paddingTop: 0 },
  title: { ...onboardingTitleFont, alignSelf: 'center', color: colors.charcoal, fontSize: 30, letterSpacing: -0.6, lineHeight: 35, marginBottom: 24, maxWidth: 340, textAlign: 'center' },
  titleCompact: { fontSize: 28, lineHeight: 32, marginBottom: 16 },
  rows: { gap: 8, maxWidth: 360, width: '100%' },
  rowsCompact: { gap: 7 },
  rowWrap: { borderRadius: 16, ...homeRecipeCardShadow, width: '100%' },
  row: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', minHeight: 64, paddingHorizontal: 16, paddingVertical: 8 },
  rowSelected: { backgroundColor: colors.coralSoft, borderColor: colors.coral },
  iconCircle: { alignItems: 'center', borderRadius: 18, height: 40, justifyContent: 'center', width: 40 },
  rowLabel: { color: colors.charcoal, flex: 1, fontFamily: fontFamilies.semibold, fontSize: 16, fontWeight: '600', marginLeft: 14 },
  check: { alignItems: 'center', height: 24, justifyContent: 'center', width: 24 },
});
