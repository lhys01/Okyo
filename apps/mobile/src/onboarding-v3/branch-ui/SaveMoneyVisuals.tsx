import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Bag, Calendar, Check, CheckCircle, Heart, Leaf, PiggyBank, Sparks, StatsUpSquare, Xmark } from 'iconoir-react-native';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { motionTokens } from '../motion/motionTokens';
import { useReduceMotion } from '../motion/useReduceMotion';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import { branchPalettes, branchShadow, branchSurfaces } from './branchTheme';
import type { BranchIcon, ChoiceOption } from './BranchControls';

const BRANCH = 'save_money' as const;
const palette = branchPalettes[BRANCH];
const mealStickerById: Record<string, number> = {
  breakfast: onboardingV3Assets.saveMoneyFrequency,
  lunch: onboardingV3Assets.saveMoneyMeals,
  dinner: onboardingV3Assets.saveMoneyComplete,
  snacks: onboardingV3Assets.saveMoneyReassurance,
  varies: onboardingV3Assets.saveMoneyCost,
};

/**
 * Intro scene: Kiko with a takeout bag, a couple of floating order details,
 * and soft coral/mint background shapes. Replaces the generic hero-image +
 * paragraph moment with a small illustrated scene sized for one screen.
 */
export function OrderSceneIntro({ headline, support }: { headline: string; support: string }) {
  return (
    <SettleIn style={styles.introWrap}>
      <View style={styles.introSceneFrame}>
        <Image accessibilityIgnoresInvertColors accessibilityLabel="Kiko cooking with a chef hat" contentFit="contain" source={onboardingV3Assets.saveMoneyIntro} style={styles.introKiko} />
      </View>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={styles.introHeadline}>{headline}</Text>
      {support ? <Text maxFontSizeMultiplier={1.3} style={styles.introSupport}>{support}</Text> : null}
    </SettleIn>
  );
}

/** Small, responsive supporting artwork for question screens; controls remain primary. */
export function SaveMoneyStepArt({ source, label }: { source: number; label: string }) {
  return (
    <View accessibilityLabel={label} accessibilityRole="image" style={styles.stepArtWrap}>
      <Image accessibilityIgnoresInvertColors contentFit="contain" source={source} style={styles.stepArt} />
    </View>
  );
}

const WEEK_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/**
 * A seven-cell week row that tints one cell per meal, wrapping onto a second
 * pass past seven so higher counts still read clearly, paired with a large
 * count numeral and copy that adapts by band without shaming any answer.
 */
export function WeekMealRow({ count }: { count: number }) {
  const filledInFirstPass = Math.min(count, 7);
  const overflow = Math.max(0, count - 7);
  return (
    <View style={[styles.weekCard, branchShadow]}>
      <View accessibilityLabel={`${count} meals a week`} accessibilityRole="image" style={styles.weekRow}>
        {WEEK_LABELS.map((label, index) => (
          <View key={`${label}-${index}`} style={styles.weekCell}>
            <View style={[styles.weekDot, index < filledInFirstPass ? styles.weekDotFilled : styles.weekDotEmpty]} />
            <Text maxFontSizeMultiplier={1.2} style={styles.weekLabel}>{label}</Text>
          </View>
        ))}
      </View>
      {overflow > 0 ? (
        <Text maxFontSizeMultiplier={1.3} style={styles.weekOverflow}>Plus {overflow} more that week</Text>
      ) : null}
    </View>
  );
}

export function frequencyAdaptiveCopy(count: number | null): string {
  if (count === null || count === 0) return 'No pressure — even one meal a week is a place to start.';
  if (count <= 2) return 'A light habit. Small swaps still add up.';
  if (count <= 5) return 'A regular rhythm. There’s real room to shift some home.';
  return 'That’s often. Even moving a couple home makes a difference.';
}

/**
 * Cost field styled like a food-order receipt: a torn-edge card, a zigzag
 * footer, and the amount treated as a line-item rather than a bare input.
 */
export function ReceiptCostCard({ children, helper }: { children: React.ReactNode; helper?: string }) {
  return (
    <View style={styles.receiptWrap}>
      <View style={[styles.receiptCard, branchShadow]}>
        {children}
        {helper ? <>
          <View style={styles.receiptDivider} />
          <Text maxFontSizeMultiplier={1.3} style={styles.receiptHelper}>{helper}</Text>
        </> : null}
      </View>
      <ReceiptZigzag />
    </View>
  );
}

function ReceiptZigzag() {
  const teeth = 14;
  const points = Array.from({ length: teeth }, (_, index) => index);
  return (
    <Svg height={10} style={styles.zigzag} viewBox={`0 0 ${teeth * 16} 10`} width="100%">
      <Path
        d={points.map((index) => `${index === 0 ? 'M' : 'L'} ${index * 16} 0 L ${index * 16 + 8} 10 L ${index * 16 + 16} 0`).join(' ')}
        fill={colors.surface}
      />
    </Svg>
  );
}

/**
 * Distinct small scene per friction option: a tinted glyph tile plus a short
 * detail line, replacing the shared plain ChoiceRows treatment while keeping
 * the same FrictionId values and selection behaviour.
 */
export function FrictionSceneRows<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: readonly { id: T; label: string; detail?: string; icon: BranchIcon }[];
  selected: readonly T[];
  onSelect: (id: T) => void;
}) {
  return (
    <View style={styles.frictionList}>
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <Pressable
            accessibilityLabel={option.detail ? `${option.label}. ${option.detail}` : option.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected, selected: isSelected }}
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={[styles.frictionRow, isSelected && styles.frictionRowSelected, branchShadow]}
          >
            <View style={styles.frictionText}>
              <Text maxFontSizeMultiplier={1.3} style={[styles.frictionLabel, isSelected && styles.frictionLabelSelected]}>{option.label}</Text>
              {option.detail ? <Text maxFontSizeMultiplier={1.3} style={styles.frictionDetail}>{option.detail}</Text> : null}
            </View>
            {isSelected ? <Check color={colors.coralDark} height={18} strokeWidth={3} width={18} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Answer-driven before/after: what today looks like (the chosen friction,
 * muted) transitioning to what Okyo starts from (Kiko, accented). Distinct
 * mechanic from BranchMoment — two compact cards and an arrow, not a single
 * centred illustration.
 */
export function FrictionTransition({
  frictionLabel: _frictionLabel,
  frictionIcon: _frictionIcon,
  headline: _headline,
}: {
  frictionLabel: string;
  frictionIcon: BranchIcon;
  headline: string;
}) {
  const { height } = useWindowDimensions();
  const compact = height < 740;

  return (
    <SettleIn style={[styles.encouragementWrap, compact && styles.encouragementWrapCompact]}>
      <View accessibilityLabel="Kiko encouraging home cooking" accessibilityRole="image" style={[styles.encouragementHero, compact && styles.encouragementHeroCompact]}>
        <View style={styles.encouragementBlob} />
        <Image accessibilityIgnoresInvertColors accessible={false} contentFit="contain" source={onboardingV3Assets.saveMoneyEncouragement} style={[styles.encouragementKiko, compact && styles.encouragementKikoCompact]} />
        <Image accessibilityIgnoresInvertColors accessible={false} contentFit="contain" source={onboardingV3Assets.stickerSparkle} style={styles.encouragementSparkle} />
        <Image accessibilityIgnoresInvertColors accessible={false} contentFit="contain" source={onboardingV3Assets.stickerHeart} style={styles.encouragementHeart} />
      </View>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.encouragementHeadline}>
        Better meals{`\n`}start at <Text style={styles.encouragementHeadlineAccent}>home.</Text>
      </Text>
      <Svg height={12} viewBox="0 0 180 12" width={180}>
        <Path d="M8 6 C58 1 120 1 172 7" fill="none" stroke={colors.coral} strokeLinecap="round" strokeWidth={3} />
      </Svg>
      <View accessibilityLabel="Benefits of cooking at home" style={styles.encouragementBenefits}>
        <Benefit image={onboardingV3Assets.saveMoneyReassuranceBowl} label="Use what you have" />
        <View style={styles.encouragementDivider} />
        <Benefit icon={<Calendar color={colors.savings} height={30} strokeWidth={1.8} width={30} />} label="Save time and money" />
        <View style={styles.encouragementDivider} />
        <Benefit icon={<CheckCircle color={colors.savings} height={30} strokeWidth={1.8} width={30} />} label="Reach your goals" />
      </View>
    </SettleIn>
  );
}

function Benefit({ image, icon, label }: { image?: number; icon?: ReactNode; label: string }) {
  return (
    <View accessibilityLabel={label} accessibilityRole="image" style={styles.encouragementBenefit}>
      <View style={styles.encouragementBenefitIcon}>
        {image ? <Image accessibilityIgnoresInvertColors accessible={false} contentFit="contain" source={image} style={styles.encouragementBowl} /> : icon}
      </View>
      <Text maxFontSizeMultiplier={1.1} style={styles.encouragementBenefitLabel}>{label}</Text>
    </View>
  );
}

/**
 * A physical fill visual for the weekly replacement target: a row of plate
 * tokens up to the eating-out count, filling coral as the target rises. Pure
 * presentation — the CountStepper beneath still owns the value and the
 * max = weeklyEatingOutCount validation.
 */
export function ReplacementPlateRow({ target, max }: { target: number; max: number }) {
  const cappedMax = Math.max(max, 1);
  return (
    <View
      accessibilityLabel={`${target} of ${max} meals moving home`}
      accessibilityRole="image"
      style={styles.plateRow}
    >
      {Array.from({ length: cappedMax }, (_, index) => (
        <View key={index} style={[styles.plateToken, index < target ? styles.plateTokenFilled : styles.plateTokenEmpty]} />
      ))}
    </View>
  );
}

export type RankedOption<T extends string> = Readonly<{ id: T; label: string; detail?: string; icon: BranchIcon }>;

/**
 * Ranked visual cards for recipe priority: each row carries a rank numeral
 * badge plus its existing icon, so the list reads as a ranked stack rather
 * than an unordered ChoiceRows list.
 */
export function RankedPriorityCards<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: readonly RankedOption<T>[];
  selected: readonly T[];
  onSelect: (id: T) => void;
}) {
  return (
    <View style={styles.rankedList}>
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected, selected: isSelected }}
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={[styles.rankedRow, isSelected && styles.rankedRowSelected, branchShadow]}
          >
            <View style={styles.rankedText}>
              <Text maxFontSizeMultiplier={1.3} style={[styles.rankedLabel, isSelected && styles.frictionLabelSelected]}>{option.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Quiet reset beat: one compact card (Kiko + a short line), visually distinct
 * from the two-card encouragement transition — no arrows, no comparison, just
 * a single settled statement.
 */
export function QuietResetCard({ statement }: { statement: string }) {
  return (
    <SettleIn style={styles.quietWrap}>
      <View style={[styles.quietCard, branchShadow]}>
        <Image accessibilityIgnoresInvertColors accessibilityLabel="Kiko holding a bowl" contentFit="contain" source={onboardingV3Assets.saveMoneyReassurance} style={styles.quietArt} />
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={styles.quietStatement}>{statement}</Text>
      </View>
    </SettleIn>
  );
}

/**
 * Save Money's reassurance moment: a small, native visual story about
 * swapping a few takeout meals for cooking at home. The artwork remains
 * separate so it can scale cleanly on smaller phones.
 */
export function SaveMoneyReassurance() {
  const { width } = useWindowDimensions();
  const compact = width < 380;

  return (
    <SettleIn style={styles.reassuranceWrap}>
      <View style={styles.reassuranceHeadlineWrap}>
        <Image
          accessibilityElementsHidden
          accessibilityIgnoresInvertColors
          accessible={false}
          contentFit="contain"
          source={onboardingV3Assets.stickerSparkle}
          style={styles.reassuranceYellowSparkle}
        />
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.reassuranceHeadline}>
          Small changes,{"\n"}
          <Text style={styles.reassuranceHeadlineAccent}>big results.</Text>
        </Text>
        <Svg accessibilityElementsHidden height={15} viewBox="0 0 180 15" width={180}>
          <Path d="M5 8 C53 1 119 1 175 8" fill="none" stroke={colors.coral} strokeLinecap="round" strokeWidth={3} />
        </Svg>
        <Sparks color={colors.coral} height={20} strokeWidth={2.2} style={styles.reassuranceCoralSparkle} width={20} />
      </View>

      <View
        accessibilityLabel="Kiko helps swap a takeout meal for a home-cooked bowl"
        accessibilityRole="image"
        style={[styles.reassuranceStory, compact && styles.reassuranceStoryCompact]}
      >
        <View style={styles.reassuranceStorySide}>
          <View accessibilityLabel="Takeout meal idea crossed out" accessibilityRole="image" style={[styles.reassuranceThoughtBubble, styles.reassuranceTakeoutBubble]}>
            <Bag color={colors.coralDark} height={31} strokeWidth={1.8} width={31} />
            <View style={styles.reassuranceXBadge}>
              <Xmark color={colors.surface} height={22} strokeWidth={2.6} width={22} />
            </View>
          </View>
          <ReassuranceArrow color={colors.coral} direction="right" />
        </View>

        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          contentFit="contain"
          source={onboardingV3Assets.saveMoneyReassuranceKiko}
          style={[styles.reassuranceKiko, compact && styles.reassuranceKikoCompact]}
        />

        <View style={styles.reassuranceStorySide}>
          <View accessibilityLabel="Home-cooked bowl idea" accessibilityRole="image" style={[styles.reassuranceThoughtBubble, styles.reassuranceHomeBubble]}>
            <Image accessibilityIgnoresInvertColors accessible={false} contentFit="contain" source={onboardingV3Assets.saveMoneyReassuranceBowl} style={styles.reassuranceBowl} />
            <View style={styles.reassuranceCheckBadge}>
              <Check color={colors.surface} height={21} strokeWidth={2.8} width={21} />
            </View>
          </View>
          <ReassuranceArrow color={colors.savings} direction="up" />
        </View>
      </View>

      <View accessibilityLabel="Cooking more equals saving more" style={[styles.reassurancePayoffCard, branchShadow]}>
        <View style={styles.reassuranceSavingsIcon}>
          <PiggyBank color={colors.coralDark} height={30} strokeWidth={1.8} width={30} />
        </View>
        <View style={styles.reassurancePayoffText}>
          <Text maxFontSizeMultiplier={1.2} style={styles.reassurancePayoffTitle}>Cooking more = saving more</Text>
        </View>
        <Heart color={colors.coral} height={26} strokeWidth={2} width={26} />
      </View>
    </SettleIn>
  );
}

function ReassuranceArrow({ color, direction }: { color: string; direction: 'right' | 'up' }) {
  const path = direction === 'right'
    ? 'M4 8 C14 27 34 28 52 11 M43 6 L52 11 L43 17'
    : 'M5 27 C25 28 44 18 44 5 M35 9 L44 5 L47 15';

  return (
    <Svg accessibilityElementsHidden height={34} viewBox="0 0 58 34" width={58}>
      <Path d={path} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} />
    </Svg>
  );
}

/**
 * Save Money's meal replacement choices use a deliberate 3+2 grid rather
 * than the shared two-column tiles. Keeping this local prevents other branch
 * answer layouts from changing while making the five choices feel balanced.
 */
export function MealTypeChoiceTiles<T extends string>({
  onSelect,
  options,
  selected,
}: {
  onSelect: (id: T) => void;
  options: readonly ChoiceOption<T>[];
  selected: readonly T[];
}) {
  const { width } = useWindowDimensions();
  const gap = 12;
  const tileWidth = Math.max(84, (width - 40 - gap * 2) / 3);
  const tileHeight = width < 360 ? 118 : 130;
  const rows = [options.slice(0, 3), options.slice(3)];

  return (
    <View accessibilityLabel="Meals to replace. Choose as many as you like." style={styles.mealChoiceGrid}>
      <View style={[styles.mealChoiceRow, { gap }]}>
        {rows[0].map((option) => (
          <MealTypeChoiceTile
            gap={gap}
            isSelected={selected.includes(option.id)}
            key={option.id}
            onPress={() => onSelect(option.id)}
            option={option}
            tileHeight={tileHeight}
            tileWidth={tileWidth}
          />
        ))}
      </View>
      <View style={[styles.mealChoiceRow, styles.mealChoiceRowCentered, { gap }]}>
        {rows[1].map((option) => (
          <MealTypeChoiceTile
            gap={gap}
            isSelected={selected.includes(option.id)}
            key={option.id}
            onPress={() => onSelect(option.id)}
            option={option}
            tileHeight={tileHeight}
            tileWidth={tileWidth}
          />
        ))}
      </View>
    </View>
  );
}

function MealTypeChoiceTile<T extends string>({
  gap,
  isSelected,
  onPress,
  option,
  tileHeight,
  tileWidth,
}: {
  gap: number;
  isSelected: boolean;
  onPress: () => void;
  option: ChoiceOption<T>;
  tileHeight: number;
  tileWidth: number;
}) {
  return (
    <Pressable
      accessibilityLabel={option.label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected, selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.mealChoiceTile,
        {
          backgroundColor: isSelected ? colors.coralSoft : palette.accentSoft,
          borderColor: isSelected ? colors.coral : 'transparent',
          gap,
          height: tileHeight,
          width: tileWidth,
        },
        branchShadow,
        pressed && styles.mealChoiceTilePressed,
      ]}
    >
      <Image
        accessibilityIgnoresInvertColors
        accessible={false}
        contentFit="contain"
        source={mealStickerById[String(option.id)] ?? onboardingV3Assets.saveMoneyMeals}
        style={styles.mealChoiceSticker}
      />
      <Text
        adjustsFontSizeToFit
        maxFontSizeMultiplier={1.2}
        minimumFontScale={0.82}
        numberOfLines={1}
        style={[styles.mealChoiceLabel, isSelected && styles.mealChoiceLabelSelected]}
      >
        {option.label}
      </Text>
    </Pressable>
  );
}

/** Supporting art for the meal-choice question; the interactive tiles remain native. */
export function MealTypeKikoArt() {
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  return (
    <View accessibilityLabel="Kiko holding a carrot" accessibilityRole="image" style={[styles.mealKikoWrap, isCompact && styles.mealKikoWrapCompact]}>
      <Image accessibilityIgnoresInvertColors accessible={false} contentFit="contain" source={onboardingV3Assets.saveMoneyMeals} style={[styles.mealKiko, isCompact && styles.mealKikoCompact]} />
    </View>
  );
}

/** Native, responsive hero for the final savings result. */
export function SavingsRevealHero({
  weeklyDifference,
}: {
  weeklyDifference: string;
}) {
  return (
    <View style={styles.savingsRevealHero}>
      <View style={styles.savingsRevealHeroCopy}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.25} style={styles.savingsRevealHeroLine}>You could keep</Text>
        <Text
          adjustsFontSizeToFit
          allowFontScaling={false}
          minimumFontScale={0.7}
          numberOfLines={1}
          style={styles.savingsRevealHeroAmount}
        >
          {weeklyDifference}
        </Text>
        <Text maxFontSizeMultiplier={1.25} style={styles.savingsRevealHeroLine}>more every week.</Text>
      </View>
      <View accessibilityLabel="Kiko holding a savings checklist" accessibilityRole="image" style={styles.savingsRevealHeroArtWrap}>
        <Image accessibilityIgnoresInvertColors accessible={false} contentFit="contain" source={onboardingV3Assets.saveMoneyReveal} style={styles.savingsRevealHeroArt} />
      </View>
    </View>
  );
}

/** The savings comparison and running estimates are all native, dynamic values. */
export function SavingsRevealReport({
  annualDifference,
  eatingOutWeekly,
  homeWeekly,
  monthlyDifference,
}: {
  annualDifference: string;
  eatingOutWeekly: string;
  homeWeekly: string;
  monthlyDifference: string;
}) {
  const eatingOutAmount = Number(eatingOutWeekly.replace(/[$,]/g, '')) || 0;
  const homeAmount = Number(homeWeekly.replace(/[$,]/g, '')) || 0;
  const maxAmount = Math.max(eatingOutAmount, homeAmount, 1);
  const eatingOutHeight = Math.max(28, Math.round((eatingOutAmount / maxAmount) * 162));
  const homeHeight = Math.max(28, Math.round((homeAmount / maxAmount) * 162));

  return (
    <View style={styles.savingsRevealReportStack}>
      <View
        accessibilityLabel={`Eating out ${eatingOutWeekly} versus making it at home ${homeWeekly}.`}
        accessibilityRole="image"
        style={[styles.savingsReportCard, branchShadow]}
      >
        <Text maxFontSizeMultiplier={1.2} style={styles.savingsReportTitle}>Eating out vs. making it at home</Text>
        <View style={styles.savingsBarChart}>
          {[0, 1].map((line) => <View key={line} style={[styles.savingsGridLine, { top: 26 + line * 64 }]} />)}
          <View style={styles.savingsBarColumns}>
            <SavingsBar color={colors.coral} label="Eating out" targetHeight={eatingOutHeight} value={eatingOutWeekly} />
            <SavingsBar color={colors.savings} label="Make it at home" targetHeight={homeHeight} value={homeWeekly} />
          </View>
        </View>
      </View>

      <Text maxFontSizeMultiplier={1.25} style={styles.savingsAddsHeading}>And that adds up.</Text>
      <View style={styles.savingsSummaryRow}>
        <View accessibilityLabel={`Monthly estimate: ${monthlyDifference}`} style={[styles.savingsSummaryCard, branchShadow]}>
          <Calendar color={colors.savings} height={20} strokeWidth={1.8} width={20} />
          <Text maxFontSizeMultiplier={1.2} style={styles.savingsSummaryLabel}>Monthly</Text>
          <Text adjustsFontSizeToFit allowFontScaling={false} minimumFontScale={0.7} numberOfLines={1} style={styles.savingsSummaryValue}>{monthlyDifference}</Text>
        </View>
        <View accessibilityLabel={`Yearly estimate: ${annualDifference}`} style={[styles.savingsSummaryCard, branchShadow]}>
          <Leaf color={colors.savings} height={20} strokeWidth={1.8} width={20} />
          <Text maxFontSizeMultiplier={1.2} style={styles.savingsSummaryLabel}>Yearly</Text>
          <Text adjustsFontSizeToFit allowFontScaling={false} minimumFontScale={0.7} numberOfLines={1} style={styles.savingsSummaryValue}>{annualDifference}</Text>
        </View>
      </View>
    </View>
  );
}

function SavingsBar({ color, label, targetHeight, value }: { color: string; label: string; targetHeight: number; value: string }) {
  const reduceMotion = useReduceMotion();
  const barHeight = useSharedValue(reduceMotion ? targetHeight : 0);
  const labelProgress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      barHeight.value = targetHeight;
      labelProgress.value = 1;
      return;
    }
    barHeight.value = 0;
    labelProgress.value = 0;
    barHeight.value = withTiming(targetHeight, { duration: reduceMotion ? 0 : 460, easing: Easing.out(Easing.cubic) });
    labelProgress.value = withDelay(reduceMotion ? 0 : 310, withTiming(1, { duration: reduceMotion ? 0 : 180, easing: Easing.out(Easing.quad) }));
  }, [barHeight, labelProgress, reduceMotion, targetHeight]);

  const barStyle = useAnimatedStyle(() => ({ height: barHeight.value }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelProgress.value, transform: [{ translateY: (1 - labelProgress.value) * 6 }] }));

  return (
    <View style={styles.savingsBarColumn}>
      <Animated.View style={labelStyle}><Text allowFontScaling={false} style={styles.savingsBarValue}>{value}</Text></Animated.View>
      <Animated.View style={[styles.savingsBar, { backgroundColor: color }, barStyle]} />
      <Text maxFontSizeMultiplier={1.1} style={styles.savingsBarLabel}>{label}</Text>
    </View>
  );
}

/** The reveal keeps values native and uses this small clipboard scene as a supporting header. */
export function ClipboardKikoArt({ large = false }: { large?: boolean }) {
  return (
    <View accessibilityLabel="Kiko holding a completed checklist" accessibilityRole="image" style={[styles.clipboardWrap, large && styles.clipboardWrapLarge]}>
      <Image accessibilityIgnoresInvertColors accessible={false} contentFit="contain" source={onboardingV3Assets.saveMoneyReveal} style={styles.clipboardKiko} />
    </View>
  );
}

/** Completion art is decorative; the plan summary and CTA stay native. */
export function CelebrateKikoArt() {
  return (
    <View accessibilityLabel="Kiko celebrating the new plan" accessibilityRole="image" style={styles.celebrateWrap}>
      <Image accessibilityIgnoresInvertColors accessible={false} contentFit="contain" source={onboardingV3Assets.saveMoneyComplete} style={styles.celebrateKiko} />
    </View>
  );
}

export type HouseholdOption = Readonly<{ id: string; label: string; icon: BranchIcon }>;

/** Person/plate illustration cards replacing plain ChipGroup text chips. */
export function HouseholdCardGrid({
  options,
  selected,
  onSelect,
}: {
  options: readonly HouseholdOption[];
  selected: readonly string[];
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.householdGrid}>
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected, selected: isSelected }}
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={[styles.householdCard, isSelected && styles.householdCardSelected, branchShadow]}
          >
            <Text maxFontSizeMultiplier={1.2} style={[styles.householdLabel, isSelected && styles.frictionLabelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Payoff banner: the difference figure treated as the visual centrepiece of the reveal. */
export function PotentialDifferenceBanner({ weeklyLabel }: { weeklyLabel: string }) {
  return (
    <View style={[styles.payoffBanner, { backgroundColor: colors.mint }]}>
      <StatsUpSquare color={colors.ink} height={22} strokeWidth={1.8} width={22} />
      <Text maxFontSizeMultiplier={1.2} style={styles.payoffLabel}>Potential difference, weekly</Text>
      <Text allowFontScaling={false} style={styles.payoffValue}>{weeklyLabel}</Text>
    </View>
  );
}

export type AnswerCard = Readonly<{ id: string; label: string; value: string; icon: BranchIcon }>;

/** Completion summary rendered as distinct answer cards instead of a plain list. */
export function AnswerCardStack({ items }: { items: readonly AnswerCard[] }) {
  return (
    <View style={styles.answerStack}>
      {items.map((item) => (
        <View accessibilityLabel={`${item.label}: ${item.value}`} key={item.id} style={[styles.answerCard, branchShadow]}>
          <View style={[styles.answerGlyph, { backgroundColor: palette.accentSoft }]}>
            <item.icon color={palette.accent} height={22} strokeWidth={1.8} width={22} />
          </View>
          <View style={styles.answerText}>
            <Text maxFontSizeMultiplier={1.2} style={styles.answerLabel}>{item.label}</Text>
            <Text maxFontSizeMultiplier={1.3} style={styles.answerValue}>{item.value}</Text>
          </View>
          <CheckCircle color={palette.accent} height={18} strokeWidth={1.8} width={18} />
        </View>
      ))}
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
  introWrap: { alignItems: 'center', flexGrow: 1, gap: 14, justifyContent: 'center', paddingVertical: 12 },
  introSceneFrame: { alignItems: 'center', height: 200, justifyContent: 'center', width: '100%' },
  introKiko: { height: 218, width: '100%' },
  introHeadline: {
    color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 31, letterSpacing: -0.5,
    lineHeight: 37, paddingHorizontal: 8, textAlign: 'center',
  },
  introSupport: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 21, maxWidth: 320, textAlign: 'center' },
  stepArtWrap: { alignItems: 'center', height: 118, justifyContent: 'center', marginBottom: 0, overflow: 'visible', width: '100%' },
  stepArt: { height: 116, maxWidth: 152, width: 152 },

  weekCard: {
    backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: branchSurfaces.cardRadius,
    borderWidth: 1, gap: 10, marginTop: 16, paddingHorizontal: 14, paddingVertical: 18,
  },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekCell: { alignItems: 'center', gap: 8 },
  weekDot: { borderRadius: 999, height: 26, width: 26 },
  weekDotFilled: { backgroundColor: colors.coral },
  weekDotEmpty: { backgroundColor: colors.canvasSunk },
  weekLabel: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 11 },
  weekOverflow: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 12, textAlign: 'center' },

  receiptWrap: { gap: 0 },
  receiptCard: {
    backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: branchSurfaces.cardRadius,
    borderWidth: 1, gap: 0, paddingHorizontal: 20, paddingVertical: 16,
  },
  receiptHeaderRow: { alignItems: 'center' },
  receiptEyebrow: { color: branchSurfaces.muted, fontFamily: fontFamilies.bold, fontSize: 11, letterSpacing: 0.8 },
  receiptDivider: { borderColor: branchSurfaces.cardBorder, borderStyle: 'dashed', borderTopWidth: 1, marginTop: 4 },
  receiptHelper: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 18, paddingBottom: 14, paddingTop: 10 },
  zigzag: { marginTop: -1 },

  frictionList: { gap: 10 },
  frictionRow: {
    alignItems: 'center', backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder,
    borderRadius: branchSurfaces.tileRadius, borderWidth: 1, flexDirection: 'row', minHeight: 62, paddingHorizontal: 18, paddingVertical: 16,
  },
  frictionRowSelected: { backgroundColor: colors.coralSoft, borderColor: colors.coral, borderWidth: 2 },
  frictionScene: { alignItems: 'center', borderRadius: 16, height: 50, justifyContent: 'center', width: 50 },
  frictionText: { flex: 1 },
  frictionLabel: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 17, lineHeight: 22 },
  frictionLabelSelected: { color: colors.coralDark },
  frictionDetail: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 18 },

  encouragementWrap: { alignItems: 'center', flexGrow: 1, justifyContent: 'space-evenly', paddingHorizontal: 12, paddingVertical: 8 },
  encouragementWrapCompact: { justifyContent: 'space-between', paddingVertical: 2 },
  encouragementHero: { alignItems: 'center', height: 238, justifyContent: 'center', position: 'relative', width: '100%' },
  encouragementHeroCompact: { height: 190 },
  encouragementBlob: { backgroundColor: colors.savingsSoft, borderRadius: 140, bottom: 8, height: 152, opacity: 0.6, position: 'absolute', width: 280 },
  encouragementKiko: { height: 230, width: 270, zIndex: 1 },
  encouragementKikoCompact: { height: 184, width: 218 },
  encouragementSparkle: { height: 28, left: '20%', position: 'absolute', top: 34, width: 28 },
  encouragementHeart: { height: 26, position: 'absolute', right: '20%', top: 72, width: 26 },
  encouragementHeadline: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 31, letterSpacing: -0.6, lineHeight: 36, textAlign: 'center' },
  encouragementHeadlineAccent: { color: colors.coral },
  encouragementSupport: { color: branchSurfaces.muted, fontFamily: fontFamilies.medium, fontSize: 16, lineHeight: 23, maxWidth: 350, textAlign: 'center' },
  encouragementBenefits: { alignItems: 'stretch', flexDirection: 'row', justifyContent: 'center', maxWidth: 390, width: '100%' },
  encouragementBenefit: { alignItems: 'center', flex: 1, gap: 8, minWidth: 0, paddingHorizontal: 5 },
  encouragementBenefitIcon: { alignItems: 'center', backgroundColor: colors.savingsSoft, borderRadius: 42, height: 66, justifyContent: 'center', width: 66 },
  encouragementBowl: { height: 42, width: 42 },
  encouragementBenefitLabel: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 14, lineHeight: 18, textAlign: 'center' },
  encouragementDivider: { alignSelf: 'stretch', backgroundColor: colors.border, marginVertical: 4, width: 1 },

  plateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 },
  plateToken: { borderRadius: 999, height: 16, width: 16 },
  plateTokenFilled: { backgroundColor: colors.coral },
  plateTokenEmpty: { backgroundColor: colors.canvasSunk },

  rankedList: { gap: 10 },
  rankedRow: {
    alignItems: 'center', backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder,
    borderRadius: branchSurfaces.tileRadius, borderWidth: 1, flexDirection: 'row', minHeight: 62, paddingHorizontal: 18, paddingVertical: 16,
  },
  rankedRowSelected: { backgroundColor: colors.coralSoft, borderColor: colors.coral, borderWidth: 2 },
  rankBadge: { alignItems: 'center', backgroundColor: colors.canvasSunk, borderRadius: 999, height: 26, justifyContent: 'center', width: 26 },
  rankBadgeSelected: { backgroundColor: colors.coral },
  rankBadgeText: { color: branchSurfaces.body, fontFamily: fontFamilies.extraBold, fontSize: 13 },
  rankBadgeTextSelected: { color: colors.surface },
  rankedGlyph: { alignItems: 'center', borderRadius: 14, height: 40, justifyContent: 'center', width: 40 },
  rankedText: { flex: 1 },
  rankedLabel: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 17, lineHeight: 22 },

  quietWrap: { alignItems: 'center', flexGrow: 1, justifyContent: 'center', paddingVertical: 16 },
  quietCard: {
    alignItems: 'center', backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: branchSurfaces.cardRadius,
    borderWidth: 1, gap: 14, maxWidth: 340, paddingHorizontal: 26, paddingVertical: 28,
  },
  quietArt: { height: 188, width: '100%' },
  quietStatement: {
    color: branchSurfaces.ink, fontFamily: fontFamilies.bold, fontSize: 19, lineHeight: 25, textAlign: 'center',
  },
  reassuranceWrap: { alignItems: 'center', flexGrow: 1, gap: 10, justifyContent: 'center', paddingBottom: 4, paddingTop: 8, width: '100%' },
  reassuranceHeadlineWrap: { alignItems: 'center', position: 'relative', width: '100%' },
  reassuranceHeadline: {
    color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 31, letterSpacing: -0.5,
    lineHeight: 34, textAlign: 'center',
  },
  reassuranceHeadlineAccent: { color: colors.coral },
  reassuranceYellowSparkle: { height: 22, left: 18, position: 'absolute', top: 7, width: 22 },
  reassuranceCoralSparkle: { position: 'absolute', right: 18, top: 26 },
  reassuranceSupport: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 20, maxWidth: 330, textAlign: 'center' },
  reassuranceStory: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, minHeight: 190, width: '100%' },
  reassuranceStoryCompact: { minHeight: 164, marginTop: 0 },
  reassuranceStorySide: { alignItems: 'center', justifyContent: 'center', width: 78 },
  reassuranceThoughtBubble: { alignItems: 'center', borderRadius: 36, borderWidth: 2, height: 86, justifyContent: 'center', position: 'relative', width: 78 },
  reassuranceTakeoutBubble: { backgroundColor: colors.surfaceMuted, borderColor: colors.canvasSunk, opacity: 0.86 },
  reassuranceHomeBubble: { backgroundColor: colors.savingsSoft, borderColor: colors.savings },
  reassuranceBowl: { height: 47, width: 58 },
  reassuranceXBadge: { alignItems: 'center', backgroundColor: colors.coral, borderRadius: 999, bottom: -10, height: 34, justifyContent: 'center', position: 'absolute', right: -7, width: 34 },
  reassuranceCheckBadge: { alignItems: 'center', backgroundColor: colors.savings, borderRadius: 999, bottom: -10, height: 34, justifyContent: 'center', position: 'absolute', right: -7, width: 34 },
  reassuranceKiko: { height: 174, width: 156 },
  reassuranceKikoCompact: { height: 148, width: 134 },
  reassurancePayoffCard: {
    alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.canvasSunk, borderRadius: 24,
    borderWidth: 2, flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 12, width: '100%',
  },
  reassuranceSavingsIcon: { alignItems: 'center', backgroundColor: colors.canvasSunk, borderRadius: 34, height: 64, justifyContent: 'center', width: 64 },
  reassurancePayoffText: { flex: 1, gap: 3, minWidth: 0 },
  reassurancePayoffTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.bold, fontSize: 15, lineHeight: 19 },
  reassurancePayoffBody: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 16 },
  mealChoiceGrid: { alignItems: 'center', gap: 10 },
  mealChoiceRow: { flexDirection: 'row' },
  mealChoiceRowCentered: { justifyContent: 'center' },
  mealChoiceTile: {
    alignItems: 'center', borderRadius: branchSurfaces.tileRadius, borderWidth: 2, justifyContent: 'flex-start',
    paddingHorizontal: 6, paddingTop: 10,
  },
  mealChoiceTilePressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  mealChoiceSticker: { height: 76, width: 86 },
  mealChoiceLabel: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 14, textAlign: 'center' },
  mealChoiceLabelSelected: { color: colors.coralDark },
  mealKikoWrap: { alignItems: 'center', height: 154, justifyContent: 'center', marginBottom: 4, marginTop: 16 },
  mealKikoWrapCompact: { height: 124, marginTop: 12 },
  mealKiko: { height: 145, width: 172 },
  mealKikoCompact: { height: 116, width: 138 },
  savingsRevealHero: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 178 },
  savingsRevealHeroCopy: { flex: 1, gap: 1, minWidth: 0 },
  savingsRevealHeroLine: { color: branchSurfaces.ink, fontFamily: fontFamilies.bold, fontSize: 19, lineHeight: 25 },
  savingsRevealHeroAmount: { color: colors.savings, fontFamily: fontFamilies.extraBold, fontSize: 52, lineHeight: 58 },
  savingsRevealHeroSupport: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 19, marginTop: 8 },
  savingsRevealHeroArtWrap: { alignItems: 'center', height: 180, justifyContent: 'center', width: 132 },
  savingsRevealHeroArt: { height: '100%', width: '100%' },
  savingsRevealReportStack: { gap: 14 },
  savingsReportCard: { backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: branchSurfaces.cardRadius, borderWidth: 1, gap: 12, paddingHorizontal: 16, paddingVertical: 18 },
  savingsReportTitle: { color: branchSurfaces.ink, fontFamily: fontFamilies.bold, fontSize: 17, lineHeight: 22 },
  savingsBarChart: { height: 216, minWidth: 0, position: 'relative' },
  savingsGridLine: { borderTopColor: colors.border, borderTopWidth: 1, borderStyle: 'dashed', left: 14, position: 'absolute', right: 14 },
  savingsBarColumns: { alignItems: 'flex-end', bottom: 0, flexDirection: 'row', height: 202, justifyContent: 'space-around', left: 0, position: 'absolute', right: 0 },
  savingsBarColumn: { alignItems: 'center', flex: 1, height: 202, justifyContent: 'flex-end', minWidth: 0 },
  savingsBarValue: { color: branchSurfaces.ink, fontFamily: fontFamilies.bold, fontSize: 15, lineHeight: 20, marginBottom: 3 },
  savingsBar: { borderTopLeftRadius: 9, borderTopRightRadius: 9, maxWidth: 46, minWidth: 28, width: '62%' },
  savingsBarLabel: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 11, lineHeight: 15, marginTop: 6, textAlign: 'center' },
  savingsAddsHeading: { color: branchSurfaces.ink, fontFamily: fontFamilies.bold, fontSize: 18, lineHeight: 24, marginTop: 2 },
  savingsSummaryRow: { flexDirection: 'row', gap: 10 },
  savingsSummaryCard: { backgroundColor: colors.savingsSoft, borderRadius: branchSurfaces.tileRadius, flex: 1, gap: 5, minWidth: 0, paddingHorizontal: 14, paddingVertical: 13 },
  savingsSummaryLabel: { color: branchSurfaces.body, fontFamily: fontFamilies.semibold, fontSize: 13, lineHeight: 18 },
  savingsSummaryValue: { color: colors.savings, fontFamily: fontFamilies.extraBold, fontSize: 31, lineHeight: 36 },
  savingsEstimateFootnote: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 17, marginTop: 1 },
  clipboardWrap: { alignItems: 'center', height: 136, justifyContent: 'center', marginBottom: -6 },
  clipboardWrapLarge: { height: 206, marginBottom: 0 },
  clipboardKiko: { height: '100%', width: '100%' },
  celebrateWrap: { alignItems: 'center', height: 190, justifyContent: 'center', marginBottom: -8 },
  celebrateKiko: { height: 204, width: '100%' },

  householdGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  householdCard: {
    alignItems: 'center', backgroundColor: branchSurfaces.card, borderColor: 'transparent', borderRadius: branchSurfaces.tileRadius,
    borderWidth: 2, flexBasis: '30%', flexGrow: 1, justifyContent: 'center', minHeight: 78, paddingHorizontal: 8, paddingVertical: 16,
  },
  householdCardSelected: { backgroundColor: palette.accentSoft, borderColor: palette.accent },
  householdGlyph: { alignItems: 'center', borderRadius: 999, height: 48, justifyContent: 'center', width: 48 },
  householdLabel: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 15, textAlign: 'center' },

  payoffBanner: { alignItems: 'center', borderRadius: branchSurfaces.cardRadius, gap: 4, paddingVertical: 20 },
  payoffLabel: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 13 },
  payoffValue: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 34, lineHeight: 38 },

  answerStack: { gap: 10 },
  answerCard: {
    alignItems: 'center', backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder,
    borderRadius: branchSurfaces.tileRadius, borderWidth: 1, flexDirection: 'row', gap: 14, paddingHorizontal: 14, paddingVertical: 14,
  },
  answerGlyph: { alignItems: 'center', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  answerText: { flex: 1, gap: 2 },
  answerLabel: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 12 },
  answerValue: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 16, lineHeight: 21 },
});
