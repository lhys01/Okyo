import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Minus, Plus } from 'iconoir-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, onboardingFontFamilies as fontFamilies, onboardingTitleFont } from '../../theme/okyoTheme';
import { motionTokens } from '../motion/motionTokens';
import { useReduceMotion } from '../motion/useReduceMotion';
import { branchPalettes, branchShadow, branchSurfaces, type BranchId } from './branchTheme';

/** Any iconoir icon. Sized and tinted by the control that renders it. */
export type BranchIcon = ComponentType<{ color?: string; height?: number; width?: number; strokeWidth?: number }>;

export type ChoiceOption<T extends string> = Readonly<{
  id: T;
  label: string;
  badge?: string;
  /** Short supporting line so no two rows read alike. */
  detail?: string;
  /** Decorative icon; the label carries meaning. */
  icon: BranchIcon;
  imageSource?: number;
}>;

/** Compact screen heading. The visual does the explaining, so copy stays short. */
export function BranchHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.heading}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={styles.title}>{title}</Text>
      {subtitle ? <Text maxFontSizeMultiplier={1.4} style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** The single compact option-row pattern shared by onboarding questions. */
export function ChoiceRows<T extends string>({
  branch,
  options,
  selected,
  multi = false,
  compact = false,
  iconSize = 32,
  iconSlotSize = 42,
  textGap = 12,
  illustrated = false,
  onSelect,
}: {
  branch: BranchId;
  options: readonly ChoiceOption<T>[];
  selected: readonly T[];
  multi?: boolean;
  /** Opt-in dense rows for long in-app questionnaire lists. */
  compact?: boolean;
  /** Optional branch-specific optical sizing for sticker artwork. */
  iconSize?: number;
  /** Fixed invisible slot keeps every label on one shared vertical axis. */
  iconSlotSize?: number;
  /** Space between the icon footprint and its label. */
  textGap?: number;
  illustrated?: boolean;
  onSelect: (id: T) => void;
}) {
  const palette = branchPalettes[branch];
  const dense = compact || options.length >= 4;
  const veryDense = options.length >= 6;
  return (
    <View style={[styles.rows, dense && styles.rowsCompact, veryDense && styles.rowsVeryCompact]}>
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <SelectablePressable
            accessibilityLabel={option.detail ? `${option.label}. ${option.detail}` : option.label}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            isSelected={isSelected}
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={[styles.row, dense && styles.rowCompact, veryDense && styles.rowVeryCompact, illustrated && !veryDense && styles.illustratedRow, isSelected && styles.rowSelected]}
          >
            <View style={[styles.rowIcon, { height: iconSlotSize, width: iconSlotSize }, option.imageSource ? styles.illustratedIconSlot : null]}>
              {option.imageSource ? <Image contentFit="contain" source={option.imageSource} style={styles.illustratedIcon} /> : <option.icon color={isSelected ? colors.coralDark : palette.accent} height={iconSize} strokeWidth={2} width={iconSize} />}
            </View>
            <View style={[styles.rowText, { marginLeft: textGap - 12 }]}>
              <View style={styles.rowLabelLine}>
                <Text maxFontSizeMultiplier={1.3} style={[styles.rowLabel, dense && styles.rowLabelCompact, isSelected && styles.rowLabelSelected]}>{option.label}</Text>
                {option.badge ? <Text maxFontSizeMultiplier={1.2} style={styles.rowBadge}>{option.badge}</Text> : null}
              </View>
              {option.detail ? <Text maxFontSizeMultiplier={1.3} style={styles.rowDetail}>{option.detail}</Text> : null}
            </View>
          </SelectablePressable>
        );
      })}
    </View>
  );
}

/** Large plus/minus stepper for counts. Precise, thumb-friendly, no keyboard. */
export function CountStepper({
  branch,
  value,
  min,
  max,
  unitLabel,
  caption,
  onChange,
}: {
  branch: BranchId;
  value: number | null;
  min: number;
  max: number;
  /** Spoken unit, e.g. "meals a week". */
  unitLabel: string;
  caption?: string;
  onChange: (next: number) => void;
}) {
  const palette = branchPalettes[branch];
  const current = value ?? min;
  const canDecrease = current > min;
  const canIncrease = current < max;
  return (
    <View style={[styles.stepper, branchShadow]}>
      <StepperButton
        accessibilityLabel={`Decrease ${unitLabel}`}
        disabled={!canDecrease}
        icon={Minus}
        onPress={() => onChange(current - 1)}
        tint={palette.accent}
      />
      <View style={styles.stepperReadout}>
        <Text
          accessibilityLabel={`${value === null ? min : value} ${unitLabel}`}
          allowFontScaling={false}
          style={[styles.stepperValue, value === null && styles.stepperValuePlaceholder]}
        >
          {value === null ? min : value}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.stepperUnit}>{unitLabel}</Text>
      </View>
      <StepperButton
        accessibilityLabel={`Increase ${unitLabel}`}
        disabled={!canIncrease}
        icon={Plus}
        onPress={() => onChange(current + 1)}
        tint={palette.accent}
      />
      {caption ? <Text style={styles.stepperCaption}>{caption}</Text> : null}
    </View>
  );
}

function StepperButton({
  accessibilityLabel,
  disabled,
  icon: Icon,
  onPress,
  tint,
}: {
  accessibilityLabel: string;
  disabled: boolean;
  icon: BranchIcon;
  onPress: () => void;
  tint: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.stepperButton, { borderColor: tint }, pressed && styles.pressed, disabled && styles.stepperButtonDisabled]}
    >
      <Icon color={tint} height={24} strokeWidth={2.4} width={24} />
    </Pressable>
  );
}

/** Currency field with a live result slot rendered directly beneath it. */
export function MoneyField({
  value,
  onChangeText,
  accessibilityLabel,
  helper,
  placeholder = '20',
}: {
  value: string;
  onChangeText: (next: string) => void;
  accessibilityLabel: string;
  helper?: string;
  placeholder?: string;
}) {
  return (
    <View style={styles.moneyWrap}>
      <View style={[styles.moneyField, branchShadow]}>
        <Text allowFontScaling={false} style={styles.moneySymbol}>$</Text>
        <TextInput
          accessibilityLabel={accessibilityLabel}
          keyboardType="decimal-pad"
          maxFontSizeMultiplier={1.2}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          style={styles.moneyInput}
          value={value}
        />
      </View>
      {helper ? <Text maxFontSizeMultiplier={1.3} style={styles.moneyHelper}>{helper}</Text> : null}
    </View>
  );
}

/**
 * Shared press behaviour for every selectable control: a short scale settle
 * that collapses to an instant state change under Reduce Motion.
 */
function SelectablePressable({
  accessibilityLabel,
  accessibilityRole,
  isSelected,
  onPress,
  style,
  children,
}: {
  accessibilityLabel: string;
  accessibilityRole: 'radio' | 'checkbox';
  isSelected: boolean;
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue<number>(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const settle = (next: number) => {
    scale.value = withTiming(reduceMotion ? 1 : next, { duration: reduceMotion ? 0 : motionTokens.press.inMs });
  };
  return (
    <Animated.View style={[styles.rowWrapper, animatedStyle]}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        accessibilityState={{ checked: isSelected, selected: isSelected }}
        onPress={onPress}
        onPressIn={() => settle(motionTokens.press.pressedScale)}
        onPressOut={() => settle(1)}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 7 },
  title: { ...onboardingTitleFont, color: branchSurfaces.ink, fontSize: 24, letterSpacing: -0.5, lineHeight: 30 },
  subtitle: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 21 },

  rows: { flexGrow: 1, gap: 8, width: '100%' },
  rowsCompact: { gap: 7 },
  rowsVeryCompact: { gap: 6 },
  rowWrapper: { flexGrow: 1, width: '100%' },
  row: {
    alignItems: 'center', backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder,
    borderRadius: branchSurfaces.tileRadius, borderWidth: 1, flexDirection: 'row', flexGrow: 1, gap: 12, minHeight: 70, paddingHorizontal: 18, paddingVertical: 11, width: '100%', ...branchShadow,
  },
  rowSelected: { backgroundColor: colors.coralSoft, borderColor: colors.coral, borderWidth: 2 },
  rowCompact: { minHeight: 62, paddingVertical: 8 },
  rowVeryCompact: { minHeight: 54, paddingVertical: 5 },
  illustratedRow: { minHeight: 96, paddingVertical: 14 },
  rowText: { flex: 1, gap: 2 },
  rowLabelLine: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  rowLabel: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 17, lineHeight: 23 },
  rowLabelCompact: { fontSize: 16, lineHeight: 21 },
  rowLabelSelected: { color: colors.coralDark },
  rowBadge: { backgroundColor: colors.coralSoft, borderRadius: 999, color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 10, lineHeight: 15, paddingHorizontal: 7, paddingVertical: 1 },
  rowDetail: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 18 },
  rowIcon: { alignItems: 'center', justifyContent: 'center', width: 24 },
  illustratedIconSlot: { width: 64 },
  illustratedIcon: { height: 64, width: 64 },

  stepper: {
    alignItems: 'center', backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder,
    borderRadius: branchSurfaces.cardRadius, borderWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 20,
  },
  stepperButton: { alignItems: 'center', borderRadius: 999, borderWidth: 2, height: 52, justifyContent: 'center', width: 52 },
  stepperButtonDisabled: { opacity: 0.3 },
  stepperReadout: { alignItems: 'center', flex: 1, gap: 2 },
  stepperValue: { color: branchSurfaces.ink, fontFamily: fontFamilies.extraBold, fontSize: 52, lineHeight: 56 },
  stepperValuePlaceholder: { color: colors.muted },
  stepperUnit: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 13, textAlign: 'center' },
  stepperCaption: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 13, textAlign: 'center', width: '100%' },

  moneyWrap: { gap: 10 },
  moneyField: {
    alignItems: 'center', backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder,
    borderRadius: branchSurfaces.cardRadius, borderWidth: 1, flexDirection: 'row', gap: 4, minHeight: 84, paddingHorizontal: 22,
  },
  moneySymbol: { color: branchSurfaces.muted, fontFamily: fontFamilies.extraBold, fontSize: 30, lineHeight: 36 },
  moneyInput: { color: branchSurfaces.ink, flex: 1, fontFamily: fontFamilies.extraBold, fontSize: 40, lineHeight: 48, paddingVertical: 12 },
  moneyHelper: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 18 },

  pressed: { opacity: 0.7 },
});
