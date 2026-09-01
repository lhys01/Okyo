import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { motionTokens } from '../motion/motionTokens';
import { useReduceMotion } from '../motion/useReduceMotion';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import { ArrowDown, Check, Leaf, Sparks } from 'iconoir-react-native';
import { branchPalettes, branchShadow, branchSurfaces, type BranchId } from './branchTheme';
import type { BranchIcon } from './BranchControls';

/**
 * The emotional interstitial: a tinted ground, Kiko as the subject, and a very
 * short headline. Deliberately not a question screen — it has no controls, so
 * it reads as a beat rather than another form step.
 */
export function BranchMoment({
  branch,
  headline,
  support,
  art = 'hero',
  badge,
}: {
  branch: BranchId;
  headline: string;
  /** One short supporting line at most. The visual carries the meaning. */
  support?: string;
  /**
   * Only artwork that reads correctly when centred. The peek pose is excluded
   * on purpose: it has a device edge baked into the source image.
   */
  art?: 'hero' | 'bowl';
  /** Small pill above the headline, e.g. the answer being acknowledged. */
  badge?: string;
}) {
  const palette = branchPalettes[branch];
  const source = art === 'bowl' ? onboardingV3Assets.valuePastaBowl : onboardingV3Assets.meetKikoHeroUpdated;
  return (
    <SettleIn style={styles.moment}>
      <View style={styles.momentArtWrap}>
        <View style={styles.momentHalo} />
        <Image accessibilityIgnoresInvertColors contentFit="contain" source={source} style={styles.momentArt} />
        <Image accessibilityIgnoresInvertColors contentFit="contain" source={onboardingV3Assets.doodleSparkle} style={styles.momentSparkle} />
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: palette.accentSoft }]}>
          <Text maxFontSizeMultiplier={1.2} style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={styles.momentHeadline}>{headline}</Text>
      {support ? <Text maxFontSizeMultiplier={1.3} style={styles.momentSupport}>{support}</Text> : null}
    </SettleIn>
  );
}

/** A titled card used for personalised insight and reveal compositions. */
export function InsightCard({
  branch,
  eyebrow,
  title,
  children,
}: {
  branch: BranchId;
  eyebrow?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const palette = branchPalettes[branch];
  return (
    <View style={[styles.insight, branchShadow]}>
      {eyebrow ? <Text maxFontSizeMultiplier={1.2} style={[styles.eyebrow, { color: palette.accent }]}>{eyebrow}</Text> : null}
      {title ? <Text maxFontSizeMultiplier={1.3} style={styles.insightTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export type SwapTag = Readonly<{ id: string; label: string; icon: BranchIcon }>;

export type DishSwapOption = Readonly<{ id: string; label: string; result: string }>;

/** A local reveal from the selected friction to a supportive starting point. */
export function SupportPathPreview({ barrier, support }: { barrier: string; support: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={[styles.supportPath, branchShadow]} testID="health-support-path-preview">
      <View style={styles.supportPathRow}>
        <View style={[styles.supportPathCard, styles.supportPathMuted]}>
          <Text maxFontSizeMultiplier={1.2} style={styles.supportPathLabel}>WHAT FEELS HARD</Text>
          <Text maxFontSizeMultiplier={1.3} style={styles.supportPathValue}>{barrier}</Text>
        </View>
        <ArrowDown color={colors.coral} height={22} strokeWidth={2.4} width={22} />
        <View style={[styles.supportPathCard, revealed ? styles.supportPathRevealed : styles.supportPathWaiting]}>
          <Text maxFontSizeMultiplier={1.2} style={styles.supportPathLabel}>OKYO STARTS WITH</Text>
          <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.3} style={styles.supportPathValue}>
            {revealed ? support : 'Tap to reveal'}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityLabel={revealed ? 'Hide Okyo support preview' : 'Reveal Okyo support preview'}
        accessibilityRole="button"
        accessibilityState={{ expanded: revealed, selected: revealed }}
        onPress={() => setRevealed((current) => !current)}
        style={({ pressed }) => [styles.supportPathButton, pressed && styles.dishOptionPressed]}
        testID="health-support-path-toggle"
      >
        <Text style={styles.supportPathButtonText}>{revealed ? 'Show the barrier again' : 'See how Okyo helps'}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Local-only dish preview used on Health interstitials. Taps change only the
 * illustration and its caption; no reducer event, persistence write, or meal
 * record is created.
 */
export function DishSwapPreview({
  title,
  options,
  initialOptionId,
}: {
  title: string;
  options: readonly DishSwapOption[];
  initialOptionId?: string;
}) {
  const [activeId, setActiveId] = useState(initialOptionId ?? options[0]?.id ?? '');
  const active = options.find((option) => option.id === activeId) ?? options[0];

  return (
    <View style={[styles.dishPreview, branchShadow]} testID="health-dish-swap-preview">
      <View style={styles.dishHeader}>
        <View style={styles.dishGlyph}>
          <Leaf color={colors.coralDark} height={22} strokeWidth={2} width={22} />
        </View>
        <View style={styles.dishHeaderText}>
          <Text maxFontSizeMultiplier={1.2} style={styles.dishEyebrow}>YOUR FOOD, SMALL ADJUSTMENT</Text>
          <Text maxFontSizeMultiplier={1.3} style={styles.dishTitle}>{title}</Text>
        </View>
      </View>
      <View accessibilityLabel={`Dish preview: ${active?.result ?? title}`} accessibilityRole="image" style={styles.dishScene}>
        <View style={styles.dishPlate}>
          <View style={styles.dishCenter} />
          <View style={[styles.dishIngredient, styles.dishIngredientOne]} />
          <View style={[styles.dishIngredient, styles.dishIngredientTwo]} />
          <View style={[styles.dishIngredient, styles.dishIngredientThree]} />
        </View>
        <Sparks color={colors.coral} height={24} strokeWidth={2} width={24} />
      </View>
      <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.3} style={styles.dishResult}>{active?.result}</Text>
      <View accessibilityLabel="Preview a small food adjustment" accessibilityRole="radiogroup" style={styles.dishOptions}>
        {options.map((option) => {
          const selected = option.id === active?.id;
          return (
            <Pressable
              accessibilityLabel={`Preview ${option.label}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, selected }}
              key={option.id}
              onPress={() => setActiveId(option.id)}
              style={({ pressed }) => [styles.dishOption, selected && styles.dishOptionSelected, pressed && styles.dishOptionPressed]}
              testID={`health-swap-${option.id}`}
            >
              {selected ? <Check color={colors.coralDark} height={16} strokeWidth={3} width={16} /> : null}
              <Text maxFontSizeMultiplier={1.2} style={[styles.dishOptionText, selected && styles.dishOptionTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text maxFontSizeMultiplier={1.2} style={styles.previewDisclaimer}>Preview only — no nutrition result or recipe is created.</Text>
    </View>
  );
}

/**
 * "Small swaps, still your food": what a barrier usually makes cooking feel
 * like, stacked against what Okyo starts from instead. Every tag is a short
 * label the user's own answers produced — no calories, no macros, no invented
 * targets, just a before/after in plain language.
 */
export function SwapReveal({
  branch,
  fromLabel,
  fromTags,
  toLabel,
  toTags,
  footnote,
}: {
  branch: BranchId;
  fromLabel: string;
  fromTags: readonly SwapTag[];
  toLabel: string;
  toTags: readonly SwapTag[];
  footnote?: string;
}) {
  const palette = branchPalettes[branch];
  return (
    <View style={styles.swap}>
      <SwapCard label={fromLabel} muted tags={fromTags} tint={branchSurfaces.muted} />
      <View accessibilityElementsHidden style={[styles.swapArrow, { backgroundColor: palette.accentSoft }]}>
        <ArrowDown color={palette.accent} height={20} strokeWidth={2.4} width={20} />
      </View>
      <SwapCard label={toLabel} tags={toTags} tint={palette.accent} />
      {footnote ? <Text maxFontSizeMultiplier={1.3} style={styles.caption}>{footnote}</Text> : null}
    </View>
  );
}

function SwapCard({
  label,
  tags,
  tint,
  muted = false,
}: {
  label: string;
  tags: readonly SwapTag[];
  tint: string;
  muted?: boolean;
}) {
  return (
    <View style={[styles.swapCard, muted ? styles.swapCardMuted : styles.swapCardAccent, branchShadow]}>
      <Text maxFontSizeMultiplier={1.2} style={[styles.swapCardLabel, { color: tint }]}>{label}</Text>
      <View style={styles.swapTags}>
        {tags.map((tag) => (
          <View accessibilityLabel={tag.label} key={tag.id} style={styles.swapTag}>
            <tag.icon color={tint} height={16} strokeWidth={2} width={16} />
            <Text maxFontSizeMultiplier={1.2} style={styles.swapTagText}>{tag.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export type SummaryItem = Readonly<{ id: string; label: string; value: string; icon: BranchIcon }>;

/** Visual recap of what the user actually chose, used on completion screens. */
export function SummaryList({ branch, items }: { branch: BranchId; items: readonly SummaryItem[] }) {
  const palette = branchPalettes[branch];
  return (
    <View style={styles.summary}>
      {items.map((item) => (
        <View accessibilityLabel={`${item.label}: ${item.value}`} key={item.id} style={[styles.summaryRow, branchShadow]}>
          <View style={[styles.summaryGlyphTile, { backgroundColor: palette.accentSoft }]}>
            <item.icon color={palette.accent} height={20} strokeWidth={2} width={20} />
          </View>
          <View style={styles.summaryText}>
            <Text maxFontSizeMultiplier={1.2} style={styles.summaryLabel}>{item.label}</Text>
            <Text maxFontSizeMultiplier={1.3} style={styles.summaryValue}>{item.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Short entrance settle, skipped entirely under Reduce Motion. */
export function SettleIn({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue<number>(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: reduceMotion ? 0 : motionTokens.settle.pageMs });
  }, [progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: motionTokens.settle.pageInitialOpacity + progress.value * (1 - motionTokens.settle.pageInitialOpacity),
    transform: [{ translateY: (1 - progress.value) * motionTokens.settle.pageTranslateY }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  moment: { alignItems: 'center', flexGrow: 1, gap: 14, justifyContent: 'center', paddingVertical: 16 },
  momentArtWrap: { alignItems: 'center', height: 210, justifyContent: 'center', width: '100%' },
  momentHalo: { backgroundColor: colors.surface, borderRadius: 999, height: 190, opacity: 0.62, position: 'absolute', width: 190 },
  momentArt: { height: 190, width: 230 },
  momentSparkle: { height: 30, position: 'absolute', right: '18%', top: 8, width: 30 },
  badge: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  badgeText: { color: branchSurfaces.ink, fontFamily: fontFamilies.bold, fontSize: 13 },
  momentHeadline: {
    color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 28, letterSpacing: -0.5,
    lineHeight: 34, paddingHorizontal: 8, textAlign: 'center',
  },
  momentSupport: {
    color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 21,
    maxWidth: 320, textAlign: 'center',
  },

  insight: {
    backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: branchSurfaces.cardRadius,
    borderWidth: 1, gap: 12, paddingHorizontal: 18, paddingVertical: 18,
  },
  eyebrow: { fontFamily: fontFamilies.bold, fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase' },
  insightTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 20, lineHeight: 26 },

  swap: { gap: 10 },
  swapArrow: { alignItems: 'center', alignSelf: 'center', borderRadius: 999, height: 36, justifyContent: 'center', width: 36 },
  swapCard: { borderRadius: branchSurfaces.cardRadius, gap: 10, paddingHorizontal: 16, paddingVertical: 16 },
  swapCardMuted: { backgroundColor: colors.canvasSunk },
  swapCardAccent: { backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderWidth: 1 },
  swapCardLabel: { fontFamily: fontFamilies.bold, fontSize: 13, letterSpacing: 0.4, textTransform: 'uppercase' },
  swapTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swapTag: {
    alignItems: 'center', backgroundColor: colors.surface, borderColor: branchSurfaces.cardBorder, borderRadius: 999,
    borderWidth: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 7,
  },
  swapTagText: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 13 },
  caption: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 18 },

  dishPreview: {
    backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: branchSurfaces.cardRadius,
    borderWidth: 1, gap: 12, padding: 16,
  },
  dishHeader: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  dishGlyph: { alignItems: 'center', backgroundColor: colors.coralSoft, borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  dishHeaderText: { flex: 1, gap: 2 },
  dishEyebrow: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 10, letterSpacing: 0.6 },
  dishTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 18, lineHeight: 23 },
  dishScene: {
    alignItems: 'center', backgroundColor: colors.canvasSunk, borderRadius: 18, flexDirection: 'row',
    gap: 14, justifyContent: 'center', minHeight: 118, paddingVertical: 10,
  },
  dishPlate: {
    alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 999,
    borderWidth: 2, height: 96, justifyContent: 'center', width: 96,
  },
  dishCenter: { backgroundColor: colors.coralSoft, borderRadius: 999, height: 40, width: 40 },
  dishIngredient: { borderRadius: 999, height: 18, position: 'absolute', width: 30 },
  dishIngredientOne: { backgroundColor: colors.mint, left: 12, top: 18, transform: [{ rotate: '-18deg' }] },
  dishIngredientTwo: { backgroundColor: colors.skyBlue, right: 10, top: 24, transform: [{ rotate: '20deg' }] },
  dishIngredientThree: { backgroundColor: colors.lavender, bottom: 12, height: 16, width: 38 },
  dishResult: { color: branchSurfaces.body, fontFamily: fontFamilies.semibold, fontSize: 14, lineHeight: 19, textAlign: 'center' },
  dishOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dishOption: {
    alignItems: 'center', backgroundColor: colors.surface, borderColor: branchSurfaces.cardBorder, borderRadius: 999,
    borderWidth: 1, flexDirection: 'row', gap: 5, minHeight: 44, paddingHorizontal: 13, paddingVertical: 9,
  },
  dishOptionSelected: { backgroundColor: colors.coralSoft, borderColor: colors.coral },
  dishOptionPressed: { opacity: 0.72 },
  dishOptionText: { color: branchSurfaces.body, fontFamily: fontFamilies.semibold, fontSize: 13 },
  dishOptionTextSelected: { color: colors.coralDark },
  previewDisclaimer: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 11, lineHeight: 16 },
  supportPath: {
    backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: branchSurfaces.cardRadius,
    borderWidth: 1, gap: 12, padding: 16,
  },
  supportPathRow: { alignItems: 'center', gap: 8 },
  supportPathCard: { borderRadius: 16, gap: 4, minHeight: 76, paddingHorizontal: 14, paddingVertical: 12, width: '100%' },
  supportPathMuted: { backgroundColor: colors.canvasSunk },
  supportPathWaiting: { backgroundColor: colors.surface, borderColor: colors.coralSoft, borderStyle: 'dashed', borderWidth: 2 },
  supportPathRevealed: { backgroundColor: colors.coralSoft, borderColor: colors.coral, borderWidth: 1 },
  supportPathLabel: { color: branchSurfaces.muted, fontFamily: fontFamilies.bold, fontSize: 10, letterSpacing: 0.6 },
  supportPathValue: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 20 },
  supportPathButton: {
    alignItems: 'center', backgroundColor: colors.coral, borderRadius: 999, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16,
  },
  supportPathButtonText: { color: colors.surface, fontFamily: fontFamilies.bold, fontSize: 14 },

  summary: { gap: 10 },
  summaryRow: {
    alignItems: 'center', backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder,
    borderRadius: branchSurfaces.tileRadius, borderWidth: 1, flexDirection: 'row', gap: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  summaryGlyphTile: { alignItems: 'center', borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  summaryText: { flex: 1, gap: 2 },
  summaryLabel: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 12 },
  summaryValue: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 16, lineHeight: 21 },
});
