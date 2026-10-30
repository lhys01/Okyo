import { Image, type ImageProps } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { getAssetFallback, isFoodAssetKind, isFoodFallbackSource, type AssetKind } from '../utils/imageAssetFallbacks';
import {
  getImageSourceKey,
  imageSourceDescription,
  normalizeImageSource,
  type OkyoImageSource,
} from '../utils/imageSource';

type ResilientImageProps = Omit<ImageProps, 'source' | 'placeholder'> & {
  source?: OkyoImageSource;
  fallbackSource?: OkyoImageSource;
  /** Keep user supplied recipe photos from being replaced by unrelated food art. */
  disableFallback?: boolean;
  /** Visual role used to choose a compatible deterministic fallback. */
  assetKind?: AssetKind;
  /** Stable recipe/asset identifier used by development diagnostics. */
  imageId?: string;
  /** Component or screen name used by development diagnostics. */
  componentName?: string;
  fallbackLabel?: string;
  /** React Native callers can keep their existing resizeMode prop. */
  resizeMode?: ImageProps['contentFit'];
};

/**
 * Shared image surface for app-owned, device, and remote images.
 *
 * It keeps the caller's frame and fit unchanged, shows a deterministic local
 * placeholder while loading, and switches to that placeholder on failure.
 * Callers showing user photos can disable fallback art so a missing upload is
 * never presented as a different dish.
 */
export function ResilientImage({
  assetKind = 'decorative',
  componentName = 'unknown',
  fallbackLabel = 'Image unavailable',
  fallbackSource,
  disableFallback = false,
  imageId,
  onError: callerOnError,
  onLoad: callerOnLoad,
  resizeMode,
  source,
  style,
  contentFit,
  ...rest
}: ResilientImageProps) {
  const safeSource = useMemo(() => normalizeImageSource(source), [source]);
  const safeFallback = useMemo(
    () => disableFallback ? null : normalizeImageSource(fallbackSource) ?? getAssetFallback(assetKind),
    [assetKind, disableFallback, fallbackSource],
  );
  const sourceKey = getImageSourceKey(safeSource);
  const fallbackKey = getImageSourceKey(safeFallback);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  useEffect(() => {
    setFailedKey(null);
    setFallbackFailed(false);
  }, [sourceKey, fallbackKey]);

  const showingFallback = !safeSource || failedKey === sourceKey;
  const effectiveSource = showingFallback ? safeFallback : safeSource;
  const noUsableSource = !effectiveSource || (showingFallback && fallbackFailed);

  useEffect(() => {
    if (!noUsableSource || !safeSource) return;
    reportImageFailure({
      componentName,
      fallback: fallbackKey,
      fallbackKind: assetKind,
      fallbackSource: safeFallback,
      imageId,
      reason: safeSource ? 'fallback_failed' : 'invalid_or_missing_source',
      source: imageSourceDescription(source),
    });
  }, [assetKind, componentName, fallbackKey, imageId, noUsableSource, safeFallback, safeSource, source]);

  useEffect(() => {
    if (isFoodAssetKind(assetKind) || !isFoodFallbackSource(safeFallback)) return;
    reportInvalidFallbackAssignment({ assetKind, componentName, imageId });
  }, [assetKind, componentName, imageId, safeFallback]);

  if (noUsableSource) {
    return (
      <View
        accessibilityLabel={fallbackLabel}
        accessibilityRole="image"
        style={[style as StyleProp<ViewStyle>, styles.unavailable]}
      >
        <Text numberOfLines={2} style={styles.unavailableLabel}>{fallbackLabel}</Text>
      </View>
    );
  }

  return (
    <Image
      {...rest}
      accessibilityLabel={showingFallback && imageId ? `${fallbackLabel} (${imageId})` : rest.accessibilityLabel}
      contentFit={contentFit ?? resizeMode ?? 'cover'}
      onError={(event) => {
        if (!showingFallback && safeSource) {
          setFailedKey(sourceKey);
          reportImageFailure({
            componentName,
            fallback: fallbackKey,
            fallbackKind: assetKind,
            fallbackSource: safeFallback,
            imageId,
            reason: readImageError(event),
            source: imageSourceDescription(safeSource),
          });
        } else {
          setFallbackFailed(true);
          reportImageFailure({
            componentName,
            fallback: fallbackKey,
            fallbackKind: assetKind,
            fallbackSource: safeFallback,
            imageId,
            reason: readImageError(event),
            source: imageSourceDescription(effectiveSource),
          });
        }
        callerOnError?.(event);
      }}
      onLoad={(event) => {
        callerOnLoad?.(event);
      }}
      placeholder={showingFallback ? undefined : safeFallback}
      placeholderContentFit={contentFit ?? resizeMode ?? 'cover'}
      source={effectiveSource}
      style={style}
    />
  );
}

function reportImageFailure(details: {
  componentName: string;
  fallback: string;
  fallbackKind: AssetKind;
  fallbackSource: OkyoImageSource | null;
  imageId?: string;
  reason: string;
  source: string;
}) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  console.warn('[Okyo image]', {
    component: details.componentName,
    environment: 'development',
    fallback: details.fallback,
    fallbackKind: details.fallbackKind,
    imageId: details.imageId ?? null,
    platform: Platform.OS,
    reason: details.reason,
    source: details.source,
  });

}

function reportInvalidFallbackAssignment(details: {
  assetKind: AssetKind;
  componentName: string;
  imageId?: string;
}) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  console.warn('[Okyo image] invalid non-food fallback', {
    assetKind: details.assetKind,
    component: details.componentName,
    imageId: details.imageId ?? null,
    platform: Platform.OS,
  });
}

const styles = StyleSheet.create({
  unavailable: {
    alignItems: 'center',
    backgroundColor: '#F7F4EF',
    justifyContent: 'center',
    padding: 12,
  },
  unavailableLabel: {
    color: '#76717A',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

function readImageError(event: unknown): string {
  if (event && typeof event === 'object' && 'error' in event) {
    const error = (event as { error?: unknown }).error;
    return typeof error === 'string' ? error : 'native_image_error';
  }
  return 'native_image_error';
}
