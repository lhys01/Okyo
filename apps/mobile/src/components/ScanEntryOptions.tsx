import { CameraSolid, Sparks, Upload } from 'iconoir-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from './OkyoUI';

type ScanEntryOptionsProps = {
  compact?: boolean;
  appearance?: 'default' | 'onboarding';
  describeLabel?: string;
  labelFontFamily?: string;
  onTakePhoto: () => void;
  onUpload: () => void;
  onDescribeMeal?: () => void;
};

export function ScanEntryOptions({
  compact = false,
  appearance = 'default',
  describeLabel = 'Describe a meal',
  labelFontFamily,
  onTakePhoto,
  onUpload,
  onDescribeMeal,
}: ScanEntryOptionsProps) {
  const onboarding = appearance === 'onboarding';
  return (
    <View style={[styles.options, compact ? styles.optionsCompact : null, onboarding && styles.onboardingGroup]}>
      <View style={styles.firstRow}>
        <ScanOption
          icon={<CameraSolid color="#fffdf8" height={24} width={24} />}
          label="Take photo"
          onPress={onTakePhoto}
          primary
          compact={compact}
          inRow
          onboarding={onboarding}
          labelFontFamily={labelFontFamily}
        />
        <ScanOption
          icon={<Upload color={colors.coral} height={24} strokeWidth={2.3} width={24} />}
          label="Upload photo"
          onPress={onUpload}
          compact={compact}
          inRow
          onboarding={onboarding}
          labelFontFamily={labelFontFamily}
        />
      </View>
      {onDescribeMeal ? (
        <ScanOption
          icon={<Sparks color={colors.coral} height={24} strokeWidth={2.2} width={24} />}
          label={describeLabel}
          onPress={onDescribeMeal}
          compact={compact}
          onboarding={onboarding}
          labelFontFamily={labelFontFamily}
        />
      ) : null}
    </View>
  );
}

function ScanOption({ compact = false, icon, inRow = false, label, labelFontFamily, onboarding = false, onPress, primary = false }: { compact?: boolean; icon: ReactNode; inRow?: boolean; label: string; labelFontFamily?: string; onboarding?: boolean; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        inRow ? styles.rowButton : null,
        compact ? styles.buttonCompact : null,
        onboarding ? styles.onboardingButton : null,
        primary ? styles.primary : styles.secondary,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.icon}>{icon}</View>
      <Text maxFontSizeMultiplier={1.5} numberOfLines={2} style={[styles.text, labelFontFamily ? { fontFamily: labelFontFamily } : null, primary ? styles.primaryText : styles.secondaryText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: 10,
    marginTop: 16,
  },
  optionsCompact: {
    gap: 8,
    marginTop: 14,
  },
  onboardingGroup: {
    backgroundColor: '#FFFCF8',
    borderColor: '#E9DCCE',
    borderRadius: 26,
    borderWidth: 1,
    padding: 8,
    shadowColor: '#72513C',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
  },
  firstRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 58,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowButton: {
    flex: 1,
  },
  buttonCompact: {
    minHeight: 54,
    paddingHorizontal: 10,
  },
  onboardingButton: {
    borderColor: '#F0E2D5',
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 60,
  },
  primary: {
    backgroundColor: colors.coral,
    elevation: 3,
    shadowColor: colors.coralDark,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  secondary: {
    backgroundColor: colors.cream,
  },
  pressed: {
    opacity: 0.82,
  },
  icon: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    width: 28,
  },
  text: {
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    minWidth: 0,
    textAlign: 'center',
  },
  primaryText: {
    color: '#fffdf8',
  },
  secondaryText: {
    color: colors.coralDark,
  },
});
