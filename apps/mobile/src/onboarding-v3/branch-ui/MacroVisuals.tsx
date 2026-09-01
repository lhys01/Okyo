import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Check } from 'iconoir-react-native';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { motionTokens } from '../motion/motionTokens';
import { useReduceMotion } from '../motion/useReduceMotion';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import { branchShadow, branchSurfaces } from './branchTheme';
import type { BranchIcon } from './BranchControls';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING_SIZE = 132;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export type FocusRingVariant = 'protein' | 'lighter' | 'balanced' | 'performance' | 'maintain' | 'unsure';

const variantTints: Record<FocusRingVariant, readonly string[]> = {
  protein: [colors.macros],
  lighter: [colors.mint],
  balanced: [colors.macros, colors.skyBlue, colors.mint],
  performance: [colors.skyBlue],
  maintain: [colors.mint, colors.macros],
  unsure: [colors.border],
};

/**
 * Decorative confirmation ring for the chosen macro focus. It carries no
 * numbers and no computed percentage — the segment count and colour are fixed
 * per variant, so nothing here can be mistaken for a personalized statistic.
 */
export function FocusRing({
  variant,
  icon: Icon,
  filled = true,
}: {
  variant: FocusRingVariant;
  icon: BranchIcon;
  /** The "not sure yet" variant renders an empty outline instead of a fill. */
  filled?: boolean;
}) {
  const tints = variantTints[variant];
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue<number>(0);

  useEffect(() => {
    progress.value = withTiming(filled ? 1 : 0, { duration: reduceMotion ? 0 : motionTokens.graphDraw.durationMs });
  }, [filled, progress, reduceMotion]);

  const segmentCount = tints.length;
  const segmentLength = RING_CIRCUMFERENCE / segmentCount;
  const gap = segmentCount > 1 ? 6 : 0;

  return (
    <View style={styles.ringWrap}>
      <Svg height={RING_SIZE} width={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          fill="none"
          r={RING_RADIUS}
          stroke={colors.canvasSunk}
          strokeWidth={RING_STROKE}
        />
        {tints.map((tint, index) => (
          <RingSegment
            gap={gap}
            index={index}
            key={tint + index}
            progress={progress}
            segmentLength={segmentLength}
            tint={tint}
          />
        ))}
      </Svg>
      <View style={styles.ringIcon}>
        <Icon color={filled ? branchSurfaces.ink : branchSurfaces.muted} height={34} strokeWidth={1.8} width={34} />
      </View>
    </View>
  );
}

function RingSegment({
  index,
  segmentLength,
  gap,
  tint,
  progress,
}: {
  index: number;
  segmentLength: number;
  gap: number;
  tint: string;
  progress: ReturnType<typeof useSharedValue<number>>;
}) {
  const offset = -(index * segmentLength);
  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: [Math.max(0, segmentLength - gap) * progress.value, RING_CIRCUMFERENCE],
  }));
  return (
    <AnimatedCircle
      animatedProps={animatedProps}
      cx={RING_SIZE / 2}
      cy={RING_SIZE / 2}
      fill="none"
      r={RING_RADIUS}
      rotation={-90}
      origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
      strokeDashoffset={offset}
      strokeLinecap="round"
      stroke={tint}
      strokeWidth={RING_STROKE}
    />
  );
}

const GRAMS_METER_MIN = 20;
const GRAMS_METER_MAX = 400;

/**
 * Reflects only what the user has typed — never a suggested or computed
 * value. In single mode it's a big number with a proportional fill; in range
 * mode it's the same track with a shaded span between the two typed ends.
 */
export function GramsMeter({
  mode,
  value,
  rangeMin,
  rangeMax,
}: {
  mode: 'single' | 'range';
  value?: number | null;
  rangeMin?: number | null;
  rangeMax?: number | null;
}) {
  const fraction = (grams: number) => Math.max(0, Math.min(1, (grams - GRAMS_METER_MIN) / (GRAMS_METER_MAX - GRAMS_METER_MIN)));
  const hasValue = mode === 'single' ? value !== null && value !== undefined : rangeMin !== null && rangeMin !== undefined && rangeMax !== null && rangeMax !== undefined;

  return (
    <View style={[styles.meterCard, branchShadow]}>
      {mode === 'single' ? (
        <Text
          accessibilityLabel={hasValue ? `${value} grams of protein` : 'No protein amount entered yet'}
          allowFontScaling={false}
          style={styles.meterValue}
        >
          {hasValue ? `${value}g` : '—'}
        </Text>
      ) : (
        <Text
          accessibilityLabel={hasValue ? `${rangeMin} to ${rangeMax} grams of protein` : 'No protein range entered yet'}
          allowFontScaling={false}
          style={styles.meterValue}
        >
          {hasValue ? `${rangeMin}–${rangeMax}g` : '—'}
        </Text>
      )}
      <View style={styles.meterTrack}>
        {mode === 'single' && hasValue ? (
          <View style={[styles.meterFill, { width: `${fraction(value as number) * 100}%` }]} />
        ) : null}
        {mode === 'range' && hasValue ? (
          <View
            style={[
              styles.meterSpan,
              { left: `${fraction(rangeMin as number) * 100}%`, width: `${Math.max(4, (fraction(rangeMax as number) - fraction(rangeMin as number)) * 100)}%` },
            ]}
          />
        ) : null}
      </View>
      <View style={styles.meterScale}>
        <Text style={styles.meterScaleText}>{GRAMS_METER_MIN}g</Text>
        <Text style={styles.meterScaleText}>{GRAMS_METER_MAX}g</Text>
      </View>
    </View>
  );
}

// Shared three-block plate geometry, used by both the intro scene and the
// reveal payoff so the "protein / carbs / fats" motif reads as one visual
// idea across the branch rather than two unrelated drawings.
const PLATE_SIZE = 176;
const PLATE_RADIUS = 80;
const PLATE_CENTER = PLATE_SIZE / 2;
const PLATE_INNER_RADIUS = PLATE_RADIUS * 0.42;

function platePolarPoint(deg: number): { x: number; y: number } {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: PLATE_CENTER + PLATE_RADIUS * Math.cos(rad), y: PLATE_CENTER + PLATE_RADIUS * Math.sin(rad) };
}

function plateWedgePath(startDeg: number, endDeg: number): string {
  const start = platePolarPoint(startDeg);
  const end = platePolarPoint(endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${PLATE_CENTER} ${PLATE_CENTER} L ${start.x} ${start.y} A ${PLATE_RADIUS} ${PLATE_RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

type PlateWedgeId = 'protein' | 'carbs' | 'fats';

const PLATE_WEDGES: readonly { id: PlateWedgeId; tint: string; path: string }[] = [
  { id: 'protein', tint: colors.macroProtein, path: plateWedgePath(0, 120) },
  { id: 'carbs', tint: colors.macroCarbs, path: plateWedgePath(120, 240) },
  { id: 'fats', tint: colors.macroFat, path: plateWedgePath(240, 360) },
];

function LegendDot({ label, tint }: { label: string; tint: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: tint }]} />
      <Text maxFontSizeMultiplier={1.2} style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

/**
 * Intro scene: a three-part plate composition (protein / carbs / fats) with
 * Kiko peeking in as a small supporting character, replacing a generic
 * hero-image-and-paragraph moment with something specific to macros.
 */
export function MacroPlateIntro({ headline, support }: { headline: string; support: string }) {
  return (
    <SettleIn style={styles.introWrap}>
      <View style={styles.introPlateFrame}>
        <Svg height={PLATE_SIZE} viewBox={`0 0 ${PLATE_SIZE} ${PLATE_SIZE}`} width={PLATE_SIZE}>
          <Circle cx={PLATE_CENTER} cy={PLATE_CENTER} fill={colors.surface} r={PLATE_RADIUS} stroke={colors.border} strokeWidth={2} />
          {PLATE_WEDGES.map((wedge) => (
            <Path d={wedge.path} fill={wedge.tint} key={wedge.id} opacity={0.85} />
          ))}
          <Circle cx={PLATE_CENTER} cy={PLATE_CENTER} fill={colors.surface} r={PLATE_INNER_RADIUS} />
        </Svg>
        <Image accessibilityIgnoresInvertColors contentFit="contain" source={onboardingV3Assets.meetKikoHeroUpdated} style={styles.introKikoPeek} />
      </View>
      <View accessibilityElementsHidden style={styles.legendRow}>
        <LegendDot label="Protein" tint={colors.macroProtein} />
        <LegendDot label="Carbs" tint={colors.macroCarbs} />
        <LegendDot label="Fats" tint={colors.macroFat} />
      </View>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={styles.introHeadline}>{headline}</Text>
      <Text maxFontSizeMultiplier={1.3} style={styles.introSupport}>{support}</Text>
    </SettleIn>
  );
}

export type MacroFocusOption<T extends string> = Readonly<{ id: T; label: string; detail?: string; icon: BranchIcon; tint: string }>;

/**
 * Large expressive focus cards. Each option carries its own identity tint
 * (independent of the shared coral selected state), so the choices read as
 * distinct paths rather than one repeated row shape — selection then adds a
 * visible fill/scale change on top, not just a border.
 */
export function MacroFocusCards<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: readonly MacroFocusOption<T>[];
  selected: readonly T[];
  onSelect: (id: T) => void;
}) {
  return (
    <View style={styles.focusList}>
      {options.map((option) => (
        <MacroFocusCard isSelected={selected.includes(option.id)} key={option.id} onSelect={() => onSelect(option.id)} option={option} />
      ))}
    </View>
  );
}

function MacroFocusCard<T extends string>({
  option,
  isSelected,
  onSelect,
}: {
  option: MacroFocusOption<T>;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue<number>(1);

  useEffect(() => {
    scale.value = withTiming(reduceMotion ? 1 : isSelected ? 1.015 : 1, { duration: reduceMotion ? 0 : motionTokens.enter.durationMs });
  }, [isSelected, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityLabel={option.detail ? `${option.label}. ${option.detail}` : option.label}
        accessibilityRole="radio"
        accessibilityState={{ checked: isSelected, selected: isSelected }}
        onPress={onSelect}
        style={[styles.focusCard, isSelected && styles.focusCardSelected, branchShadow]}
      >
        <View style={[styles.focusStripe, { backgroundColor: option.tint }]} />
        <View style={[styles.focusGlyph, { backgroundColor: isSelected ? colors.coralSoft : `${option.tint}26` }]}>
          <option.icon color={isSelected ? colors.coralDark : option.tint} height={26} strokeWidth={1.8} width={26} />
        </View>
        <View style={styles.focusText}>
          <Text maxFontSizeMultiplier={1.3} style={[styles.focusLabel, isSelected && styles.focusLabelSelected]}>{option.label}</Text>
          {option.detail ? <Text maxFontSizeMultiplier={1.3} style={styles.focusDetail}>{option.detail}</Text> : null}
        </View>
        {isSelected ? <Check color={colors.coralDark} height={18} strokeWidth={3} width={18} /> : null}
      </Pressable>
    </Animated.View>
  );
}

export type ScenarioOption<T extends string> = Readonly<{ id: T; label: string; detail?: string; icon: BranchIcon }>;

/**
 * Square scenario tiles for the "what makes this hardest" question: a
 * tinted glyph square plus label/detail per row. Visually distinct from the
 * circular-glyph ChoiceRows and the two-column ChoiceTiles already used
 * elsewhere in this branch, so the obstacle screen reads as its own beat.
 */
export function BarrierScenarioRows<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: readonly ScenarioOption<T>[];
  selected: readonly T[];
  onSelect: (id: T) => void;
}) {
  return (
    <View style={styles.scenarioList}>
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <Pressable
            accessibilityLabel={option.detail ? `${option.label}. ${option.detail}` : option.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected, selected: isSelected }}
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={[styles.scenarioRow, isSelected && styles.scenarioRowSelected, branchShadow]}
          >
            <View style={[styles.scenarioTile, { backgroundColor: isSelected ? colors.coralSoft : colors.canvasSunk }]}>
              <option.icon color={isSelected ? colors.coralDark : colors.coral} height={24} strokeWidth={1.8} width={24} />
            </View>
            <View style={styles.scenarioText}>
              <Text maxFontSizeMultiplier={1.3} style={[styles.scenarioLabel, isSelected && styles.focusLabelSelected]}>{option.label}</Text>
              {option.detail ? <Text maxFontSizeMultiplier={1.3} style={styles.scenarioDetail}>{option.detail}</Text> : null}
            </View>
            {isSelected ? <Check color={colors.coralDark} height={16} strokeWidth={3} width={16} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * "Your real life → Okyo's starting point": the selected obstacle rendered
 * muted, transitioning into an Okyo-accented card. Kiko appears small inside
 * the accent card as a supporting character — the two-card transformation
 * carries the screen, not a centred mascot illustration.
 */
export function BarrierTransition({
  barrierLabel,
  barrierIcon: BarrierIcon,
  headline,
}: {
  barrierLabel: string;
  barrierIcon: BranchIcon;
  headline: string;
}) {
  return (
    <SettleIn style={styles.transitionWrap}>
      <View style={styles.transitionRow}>
        <View style={[styles.transitionCard, styles.transitionCardMuted]}>
          <BarrierIcon color={branchSurfaces.muted} height={24} strokeWidth={1.8} width={24} />
          <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={styles.transitionCardLabel}>{barrierLabel}</Text>
        </View>
        <View style={styles.transitionArrowWrap}>
          <Svg height={20} viewBox="0 0 32 20" width={32}>
            <Path d="M0 10 H26 M18 2 L28 10 L18 18" fill="none" stroke={colors.macros} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} />
          </Svg>
        </View>
        <View style={[styles.transitionCard, styles.transitionCardAccent, branchShadow]}>
          <Image accessibilityIgnoresInvertColors contentFit="contain" source={onboardingV3Assets.meetKikoHeroUpdated} style={styles.transitionKiko} />
          <Text maxFontSizeMultiplier={1.2} style={styles.transitionCardLabelAccent}>Okyo helps</Text>
        </View>
      </View>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={styles.transitionHeadline}>{headline}</Text>
    </SettleIn>
  );
}

export type MacroPlateEmphasis = 'protein' | 'carbs' | 'fats' | 'balanced' | 'none';

const platePreviewOptions: readonly { id: MacroPlateEmphasis; label: string }[] = [
  { id: 'protein', label: 'Protein' },
  { id: 'carbs', label: 'Carbs' },
  { id: 'fats', label: 'Fats' },
  { id: 'balanced', label: 'Balanced' },
];

/** Local-only emphasis preview: it changes plate highlighting, never targets. */
export function MacroPlateExplorer({
  initialEmphasis,
  icon,
  title = 'Tap a part of the plate',
}: {
  initialEmphasis: MacroPlateEmphasis;
  icon: BranchIcon;
  title?: string;
}) {
  const [emphasis, setEmphasis] = useState<MacroPlateEmphasis>(initialEmphasis);
  return (
    <View style={[styles.explorerCard, branchShadow]} testID="macro-plate-explorer">
      <Text maxFontSizeMultiplier={1.3} style={styles.explorerTitle}>{title}</Text>
      <MacroBalancePlate emphasis={emphasis} icon={icon} />
      <View accessibilityLabel="Preview macro emphasis" accessibilityRole="radiogroup" style={styles.explorerOptions}>
        {platePreviewOptions.map((option) => {
          const selected = emphasis === option.id;
          return (
            <Pressable
              accessibilityLabel={`Emphasize ${option.label.toLowerCase()}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, selected }}
              key={option.id}
              onPress={() => setEmphasis(option.id)}
              style={({ pressed }) => [styles.explorerOption, selected && styles.explorerOptionSelected, branchShadow, pressed && styles.explorerOptionPressed]}
              testID={`macro-preview-${option.id}`}
            >
              <Text maxFontSizeMultiplier={1.2} style={[styles.explorerOptionText, selected && styles.explorerOptionTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.2} style={styles.explorerCaption}>
        {emphasis === 'balanced' ? 'A visual balance preview — not a personal ratio.' : `${platePreviewOptions.find((item) => item.id === emphasis)?.label ?? 'No'} emphasis only — no target calculated.`}
      </Text>
    </View>
  );
}

/**
 * The payoff visual: a three-block plate (protein / carbs / fats) that is
 * always decorative and evenly divided — this never computes or displays a
 * personalized ratio. `emphasis` only brightens the wedge(s) that relate to
 * the user's own selected focus; it is categorical, never a fabricated number.
 */
export function MacroBalancePlate({ emphasis, icon: Icon }: { emphasis: MacroPlateEmphasis; icon: BranchIcon }) {
  return (
    <View style={styles.plateWrap}>
      <Svg height={PLATE_SIZE} viewBox={`0 0 ${PLATE_SIZE} ${PLATE_SIZE}`} width={PLATE_SIZE}>
        <Circle cx={PLATE_CENTER} cy={PLATE_CENTER} fill={colors.surface} r={PLATE_RADIUS} stroke={colors.border} strokeWidth={2} />
        {PLATE_WEDGES.map((wedge) => (
          <Path
            d={wedge.path}
            fill={wedge.tint}
            key={wedge.id}
            opacity={emphasis === 'none' || emphasis === 'balanced' || emphasis === wedge.id ? 0.9 : 0.32}
          />
        ))}
        <Circle cx={PLATE_CENTER} cy={PLATE_CENTER} fill={colors.surface} r={PLATE_INNER_RADIUS} />
      </Svg>
      <View style={styles.plateIconWrap}>
        <Icon color={branchSurfaces.ink} height={28} strokeWidth={1.8} width={28} />
      </View>
      <View accessibilityElementsHidden style={styles.legendRow}>
        <LegendDot label="Protein" tint={colors.macroProtein} />
        <LegendDot label="Carbs" tint={colors.macroCarbs} />
        <LegendDot label="Fats" tint={colors.macroFat} />
      </View>
    </View>
  );
}

/** Short entrance settle shared across this file's compositions. */
function SettleIn({ children, style }: { children: React.ReactNode; style?: any }) {
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
  ringWrap: { alignItems: 'center', height: RING_SIZE, justifyContent: 'center', width: RING_SIZE },
  ringIcon: { alignItems: 'center', height: RING_SIZE, justifyContent: 'center', position: 'absolute', width: RING_SIZE },

  introWrap: { alignItems: 'center', flexGrow: 1, gap: 14, justifyContent: 'center', paddingVertical: 12 },
  introPlateFrame: { alignItems: 'center', height: PLATE_SIZE, justifyContent: 'center', width: PLATE_SIZE + 40 },
  introKikoPeek: { bottom: -6, height: 84, position: 'absolute', right: -18, width: 96 },
  legendRow: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  legendDot: { borderRadius: 999, height: 10, width: 10 },
  legendLabel: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 12 },
  introHeadline: {
    color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 27, letterSpacing: -0.5,
    lineHeight: 33, paddingHorizontal: 8, textAlign: 'center',
  },
  introSupport: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 21, maxWidth: 320, textAlign: 'center' },

  focusList: { gap: 10 },
  focusCard: {
    alignItems: 'center', backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder,
    borderRadius: branchSurfaces.tileRadius, borderWidth: 1, flexDirection: 'row', gap: 14,
    minHeight: 72, overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 12,
  },
  focusCardSelected: { backgroundColor: colors.coralSoft, borderColor: colors.coral, borderWidth: 2 },
  focusStripe: { alignSelf: 'stretch', borderRadius: 3, marginLeft: -14, marginVertical: -12, width: 5 },
  focusGlyph: { alignItems: 'center', borderRadius: 999, height: 46, justifyContent: 'center', width: 46 },
  focusText: { flex: 1, gap: 2 },
  focusLabel: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 16, lineHeight: 21 },
  focusLabelSelected: { color: colors.coralDark },
  focusDetail: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 18 },

  scenarioList: { gap: 10 },
  scenarioRow: {
    alignItems: 'center', backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder,
    borderRadius: branchSurfaces.tileRadius, borderWidth: 1, flexDirection: 'row', gap: 14, minHeight: 68, paddingHorizontal: 14, paddingVertical: 12,
  },
  scenarioRowSelected: { backgroundColor: colors.coralSoft, borderColor: colors.coral, borderWidth: 2 },
  scenarioTile: { alignItems: 'center', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  scenarioText: { flex: 1, gap: 2 },
  scenarioLabel: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 20 },
  scenarioDetail: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 18 },

  transitionWrap: { alignItems: 'center', flexGrow: 1, gap: 20, justifyContent: 'center', paddingVertical: 16 },
  transitionRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  transitionCard: {
    alignItems: 'center', borderRadius: branchSurfaces.tileRadius, gap: 8, justifyContent: 'center',
    minHeight: 120, paddingHorizontal: 12, paddingVertical: 16, width: 128,
  },
  transitionCardMuted: { backgroundColor: colors.canvasSunk },
  transitionCardAccent: { backgroundColor: colors.surface, borderColor: branchSurfaces.cardBorder, borderWidth: 1 },
  transitionKiko: { height: 56, width: 72 },
  transitionCardLabel: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 13, textAlign: 'center' },
  transitionCardLabelAccent: { color: colors.coralDark, fontFamily: fontFamilies.semibold, fontSize: 13, textAlign: 'center' },
  transitionArrowWrap: { alignItems: 'center', justifyContent: 'center' },
  transitionHeadline: {
    color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 24, letterSpacing: -0.4,
    lineHeight: 30, paddingHorizontal: 12, textAlign: 'center',
  },

  plateWrap: { alignItems: 'center', gap: 14 },
  plateIconWrap: { alignItems: 'center', height: PLATE_SIZE, justifyContent: 'center', position: 'absolute', width: PLATE_SIZE },
  explorerCard: {
    alignItems: 'center', backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder,
    borderRadius: branchSurfaces.cardRadius, borderWidth: 1, gap: 12, padding: 16,
  },
  explorerTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 18, lineHeight: 23, textAlign: 'center' },
  explorerOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  explorerOption: {
    alignItems: 'center', backgroundColor: colors.surface, borderColor: branchSurfaces.cardBorder, borderRadius: 999,
    borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14, paddingVertical: 9,
  },
  explorerOptionSelected: { backgroundColor: colors.coralSoft, borderColor: colors.coral },
  explorerOptionPressed: { opacity: 0.72 },
  explorerOptionText: { color: branchSurfaces.body, fontFamily: fontFamilies.semibold, fontSize: 13 },
  explorerOptionTextSelected: { color: colors.coralDark },
  explorerCaption: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 17, textAlign: 'center' },

  meterCard: {
    backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: branchSurfaces.cardRadius,
    borderWidth: 1, gap: 12, paddingHorizontal: 20, paddingVertical: 22,
  },
  meterValue: { color: colors.macros, fontFamily: fontFamilies.extraBold, fontSize: 40, lineHeight: 46, textAlign: 'center' },
  meterTrack: { backgroundColor: colors.canvasSunk, borderRadius: 999, height: 10, overflow: 'hidden', width: '100%' },
  meterFill: { backgroundColor: colors.macros, borderRadius: 999, height: '100%' },
  meterSpan: { backgroundColor: colors.macros, borderRadius: 999, height: '100%', position: 'absolute' },
  meterScale: { flexDirection: 'row', justifyContent: 'space-between' },
  meterScaleText: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 11 },
});
