import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { getKikoRecipeArtForStep } from '../assets/kikoRecipeArt';
import { colors, radius } from '../theme/okyoTheme';

type KikoRecipeStepArtProps = {
  stepText: string;
};

type ImageStatus = 'loading' | 'ready' | 'error';

export function KikoRecipeStepArt({ stepText }: KikoRecipeStepArtProps) {
  const art = useMemo(() => getKikoRecipeArtForStep(stepText), [stepText]);
  const [status, setStatus] = useState<ImageStatus>('loading');

  useEffect(() => {
    setStatus('loading');
  }, [art?.fileName]);

  if (!art || status === 'error') {
    return null;
  }

  return (
    <View style={styles.frame}>
      {status === 'loading' ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.coral} size="small" />
        </View>
      ) : null}
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel={art.accessibilityLabel}
        accessibilityRole="image"
        accessible
        fadeDuration={140}
        onError={() => setStatus('error')}
        onLoad={() => setStatus('ready')}
        resizeMode="contain"
        source={art.source}
        style={[styles.image, status === 'ready' ? styles.imageReady : styles.imageLoading]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 16 / 10,
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: radius.panel,
    borderWidth: 1,
    marginTop: 16,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  imageLoading: {
    opacity: 0,
  },
  imageReady: {
    opacity: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
