import { Spark } from 'iconoir-react-native';
import type { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { foodAssets } from '../../assets/food';
import { colors } from '../theme/okyoTheme';
import { normalizeRecipeImageUri } from '../utils/recipeImageSource';
import { ResilientImage } from './ResilientImage';

type FoodImageProps = {
  children?: ReactNode;
  fallbackLabel?: string;
  disableFallback?: boolean;
  fallbackSource?: ImageSourcePropType;
  imageAccessibilityLabel?: string;
  imageStatus?: string | null;
  imageSource?: ImageSourcePropType;
  imageUrl?: string | null;
  showFallbackLabel?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Recipe-only image surface. It deliberately delegates to the shared resolver
 * with the `food` category so a missing recipe can use food photography while
 * no non-food UI can inherit this fallback.
 */
export function FoodImage({
  children,
  fallbackLabel = 'Recipe photo unavailable',
  disableFallback = false,
  fallbackSource,
  imageAccessibilityLabel,
  imageStatus,
  imageSource,
  imageUrl,
  showFallbackLabel = false,
  style,
}: FoodImageProps) {
  const safeImageUrl = normalizeRecipeImageUri(imageUrl);
  const primarySource = imageSource ?? (safeImageUrl ? { uri: safeImageUrl } : undefined);

  return (
    <View style={[styles.frame, style]}>
      <ResilientImage
        accessibilityLabel={imageAccessibilityLabel ?? fallbackLabel}
        assetKind="food"
        componentName="FoodImage"
        contentFit="cover"
        fallbackLabel={fallbackLabel}
        disableFallback={disableFallback}
        fallbackSource={fallbackSource ?? foodAssets.bowl}
        imageId={safeImageUrl ?? (typeof imageSource === 'number' ? `asset:${imageSource}` : undefined)}
        source={primarySource}
        style={styles.image}
      />
      {showFallbackLabel && !primarySource ? (
        <View pointerEvents="none" style={styles.fallbackContent}>
          <View style={styles.fallbackIcon}>
            <Spark color={colors.coral} height={22} strokeWidth={2.2} width={22} />
          </View>
          <Text numberOfLines={2} style={styles.fallbackText}>
            {imageStatus === 'loading' ? 'Image loading' : fallbackLabel}
          </Text>
        </View>
      ) : null}
      {children}
    </View>
  );
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
