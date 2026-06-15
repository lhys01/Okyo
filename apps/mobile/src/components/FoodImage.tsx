import { Spark } from 'iconoir-react-native';
import type { ReactNode } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '../theme/okyoTheme';

type FoodImageProps = {
  children?: ReactNode;
  fallbackLabel?: string;
  imageStatus?: string | null;
  imageUrl?: string | null;
  showFallbackLabel?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function FoodImage({
  children,
  fallbackLabel = 'Image coming soon',
  imageStatus,
  imageUrl,
  showFallbackLabel = false,
  style,
}: FoodImageProps) {
  const safeImageUrl = typeof imageUrl === 'string' && imageUrl.trim().length > 0
    ? imageUrl.trim()
    : null;

  return (
    <View style={[styles.frame, style]}>
      {safeImageUrl ? (
        <Image source={{ uri: safeImageUrl }} resizeMode="cover" style={styles.image} />
      ) : (
        <View style={styles.fallbackContent}>
          <View style={styles.fallbackIcon}>
            <Spark color={colors.coral} height={22} strokeWidth={2.2} width={22} />
          </View>
          {showFallbackLabel ? (
            <Text numberOfLines={2} style={styles.fallbackText}>
              {getFallbackLabel(fallbackLabel, imageStatus)}
            </Text>
          ) : null}
        </View>
      )}
      {children}
    </View>
  );
}

function getFallbackLabel(fallbackLabel: string, imageStatus?: string | null) {
  return imageStatus === 'loading' ? 'Image loading' : fallbackLabel;
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    backgroundColor: '#fbf4e8',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    bottom: 0,
    height: '100%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
  },
  fallbackContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  fallbackIcon: {
    alignItems: 'center',
    backgroundColor: '#fffdf8',
    borderColor: '#f0e4d4',
    borderRadius: 999,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  fallbackText: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 8,
    textAlign: 'center',
  },
});
