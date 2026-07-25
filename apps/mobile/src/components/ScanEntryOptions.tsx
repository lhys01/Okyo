import { CameraSolid, Sparks, Upload } from 'iconoir-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from './OkyoUI';

type ScanEntryOptionsProps = {
  compact?: boolean;
  onTakePhoto: () => void;
  onUpload: () => void;
  onDescribeMeal?: () => void;
};

export function ScanEntryOptions({ compact = false, onTakePhoto, onUpload, onDescribeMeal }: ScanEntryOptionsProps) {
  return (
    <View style={[styles.options, compact ? styles.optionsCompact : null]}>
      <ScanOption
        icon={<CameraSolid color="#fffdf8" height={25} width={25} />}
        label="Take photo"
        onPress={onTakePhoto}
        primary
        compact={compact}
      />
      {onDescribeMeal ? (
        <ScanOption
          icon={<Sparks color={colors.coral} height={21} strokeWidth={2.2} width={21} />}
          label="Describe a meal"
          onPress={onDescribeMeal}
          secondaryFullWidth
        />
      ) : null}
      <ScanOption
        icon={<Upload color={colors.coral} height={24} strokeWidth={2.3} width={24} />}
        label="Upload photo"
        onPress={onUpload}
        compact={compact}
      />
    </View>
  );
}

function ScanOption({ compact = false, icon, label, onPress, primary = false, secondaryFullWidth = false }: { compact?: boolean; icon: ReactNode; label: string; onPress: () => void; primary?: boolean; secondaryFullWidth?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, compact ? styles.buttonCompact : null, secondaryFullWidth ? styles.secondaryFullWidth : null, primary ? styles.primary : styles.secondary, pressed ? styles.pressed : null]}
    >
      <View style={styles.icon}>{icon}</View>
      <Text adjustsFontSizeToFit minimumFontScale={0.84} numberOfLines={1} style={[styles.text, primary ? styles.primaryText : styles.secondaryText]}>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  button: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    minHeight: 58,
    minWidth: 0,
    paddingHorizontal: 20,
  },
  buttonCompact: {
    flex: 1,
    gap: 6,
    minHeight: 48,
    paddingHorizontal: 8,
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
  secondaryFullWidth: {
    flexBasis: '100%',
    marginTop: 2,
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
    fontSize: 16,
    fontWeight: '700',
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
