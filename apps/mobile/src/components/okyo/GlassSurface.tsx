import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, shadows } from '../../theme/okyoTheme';

export function GlassSurface({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.surface, style]}>
      <BlurView intensity={34} pointerEvents="none" style={StyleSheet.absoluteFill} tint="light" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { backgroundColor: 'rgba(255, 255, 255, 0.62)', borderColor: 'rgba(255, 255, 255, 0.76)', borderRadius: radius.glass, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', ...shadows.float },
});
