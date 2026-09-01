import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { Check, Minus, Plus } from 'iconoir-react-native';
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
  /** Short supporting line so no two rows read alike. */
  detail?: string;
  /** Icon rendered inside the tinted tile. Decorative; the label carries meaning. */
  icon: BranchIcon;
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

/** Illustrated single- or multi-select rows: glyph tile, label, optional detail. */
export function ChoiceRows<T extends string>({
  branch,
  options,
  selected,
  multi = false,
  compact = false,
  onSelect,
}: {
  branch: BranchId;
  options: readonly ChoiceOption<T>[];
  selected: readonly T[];
  multi?: boolean;
  /** Opt-in dense rows for long in-app questionnaire lists. */
  compact?: boolean;
  onSelect: (id: T) => void;
}) {
  const palette = branchPalettes[branch];
  return (
    <View style={[styles.rows, compact && styles.rowsCompact]}>
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <SelectablePressable
            accessibilityLabel={option.detail ? `${option.label}. ${option.detail}` : option.label}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            isSelected={isSelected}
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={[styles.row, compact && styles.rowCompact, isSelected && styles.rowSelected]}
          >
            <View style={[styles.glyphTile, compact && styles.glyphTileCompact, { backgroundColor: isSelected ? colors.coralSoft : palette.accentSoft }]}>
              <option.icon color={isSelected ? colors.coralDark : palette.accent} height={22} strokeWidth={2} width={22} />
            </View>
            <View style={styles.rowText}>
              <Text maxFontSizeMultiplier={1.3} style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}>{option.label}</Text>
              {option.detail ? <Text maxFontSizeMultiplier={1.3} style={styles.rowDetail}>{option.detail}</Text> : null}
            </View>
            <View style={[styles.marker, isSelected && styles.markerSelected]}>
              {isSelected ? <Check color={colors.surface} height={14} strokeWidth={3} width={14} /> : null}
            </View>
          </SelectablePressable>
        );
      })}
    </View>
  );
}

/** Two-column picture tiles for food categories and other visual choices. */
export function ChoiceTiles<T extends string>({
  branch,
  options,
  selected,
  compact = false,
  onSelect,
}: {
  branch: BranchId;
  options: readonly ChoiceOption<T>[];
  selected: readonly T[];
  /** Opt-in denser tiles for multi-select questionnaire screens. */
  compact?: boolean;
  onSelect: (id: T) => void;
}) {
  const palette = branchPalettes[branch];
  return (
    <View style={styles.tiles}>
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <SelectablePressable
            accessibilityLabel={option.label}
            accessibilityRole="checkbox"
            isSelected={isSelected}
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={[styles.tile, compact && styles.tileCompact, { backgroundColor: isSelected ? colors.coralSoft : palette.accentSoft }, isSelected && styles.tileSelected]}
          >
            <option.icon color={isSelected ? colors.coralDark : palette.accent} height={30} strokeWidth={1.8} width={30} />
            <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={[styles.tileLabel, isSelected && styles.rowLabelSelected]}>{option.label}</Text>
          </SelectablePressable>
        );
      })}
    </View>
  );
}

/** Horizontal chip group for short, mutually exclusive answers. */
export function ChipGroup<T extends string>({
  branch,
  options,
  selected,
  onSelect,
}: {
  branch: BranchId;
  options: readonly ChoiceOption<T>[];
  selected: readonly T[];
  onSelect: (id: T) => void;
}) {
  const palette = branchPalettes[branch];
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <SelectablePressable
            accessibilityLabel={option.label}
            accessibilityRole="radio"
            isSelected={isSelected}
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={[styles.chip, isSelected && styles.chipSelected]}
          >
            <option.icon color={isSelected ? colors.coralDark : palette.accent} height={18} strokeWidth={2} width={18} />
            <Text maxFontSizeMultiplier={1.2} style={[styles.chipLabel, isSelected && styles.rowLabelSelected]}>{option.label}</Text>
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
    <Animated.View style={animatedStyle}>
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
  heading: { gap: 8, marginBottom: 18 },
  title: { ...onboardingTitleFont, color: branchSurfaces.ink, fontSize: 26, letterSpacing: -0.5, lineHeight: 32 },
  subtitle: { color: branchSurfaces.body, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 21 },

  rows: { gap: 10 },
  rowsCompact: { gap: 7 },
  row: {
    alignItems: 'center', backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder,
    borderRadius: branchSurfaces.tileRadius, borderWidth: 1, flexDirection: 'row', gap: 14, minHeight: 68, paddingHorizontal: 14, paddingVertical: 12, ...branchShadow,
  },
  rowSelected: { backgroundColor: colors.coralSoft, borderColor: colors.coral, borderWidth: 2 },
  rowCompact: { minHeight: 56, paddingVertical: 8 },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 16, lineHeight: 21 },
  rowLabelSelected: { color: colors.coralDark },
  rowDetail: { color: branchSurfaces.muted, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 18 },
  glyphTile: { alignItems: 'center', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  glyphTileCompact: { borderRadius: 12, height: 38, width: 38 },
  marker: { alignItems: 'center', borderColor: colors.border, borderRadius: 999, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  markerSelected: { backgroundColor: colors.coral, borderColor: colors.coral },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    alignItems: 'center', borderColor: 'transparent', borderRadius: branchSurfaces.tileRadius, borderWidth: 2,
    flexGrow: 1, flexBasis: '46%', gap: 8, justifyContent: 'center', minHeight: 104, paddingHorizontal: 10, paddingVertical: 14, ...branchShadow,
  },
  tileSelected: { borderColor: colors.coral },
  tileCompact: { gap: 6, minHeight: 88, paddingVertical: 10 },
  tileLabel: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 14, textAlign: 'center' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    alignItems: 'center', flexDirection: 'row', gap: 8,
    backgroundColor: branchSurfaces.card, borderColor: branchSurfaces.cardBorder, borderRadius: 999, borderWidth: 1,
    minHeight: 48, justifyContent: 'center', paddingHorizontal: 18, ...branchShadow,
  },
  chipSelected: { backgroundColor: colors.coralSoft, borderColor: colors.coral, borderWidth: 2 },
  chipLabel: { color: branchSurfaces.ink, fontFamily: fontFamilies.semibold, fontSize: 15 },

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
