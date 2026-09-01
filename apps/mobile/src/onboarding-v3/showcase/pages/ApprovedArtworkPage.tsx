import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';

// All three supplied showcase screens share this extracted screen canvas.
// The source PNGs include a phone mockup; derived assets contain only its app screen.
const ARTWORK = { height: 1608, width: 852 } as const;

export function ApprovedArtworkPage({ artwork, onBack, onNext }: { artwork: number; onBack: () => void; onNext: () => void }) {
  // This page renders below the persistent onboarding header, so fit against
  // its own measured box rather than the full device window — falling back to
  // the window on the first frame, before layout has measured anything.
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (event: LayoutChangeEvent) => setMeasured(event.nativeEvent.layout);
  const windowWidth = measured?.width ?? window.width;
  const windowHeight = measured?.height ?? window.height;
  // Fill from the real screen origin. The artwork is a complete screen canvas;
  // vertically centering it leaves a legacy header-sized void above the content.
  const scale = Math.max(windowWidth / ARTWORK.width, windowHeight / ARTWORK.height);
  const artworkFrame = {
    height: ARTWORK.height * scale,
    left: (windowWidth - ARTWORK.width * scale) / 2,
    top: 0,
    width: ARTWORK.width * scale,
  };

  return (
    <View onLayout={onLayout} style={styles.screen}>
      <StatusBar animated={false} hidden={false} style="dark" />
      <Image accessible={false} contentFit="cover" pointerEvents="none" source={artwork} style={[styles.artwork, artworkFrame]} />
      <View pointerEvents="box-none" style={[styles.hitTargets, artworkFrame]}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={10} onPress={onBack} style={styles.backHitTarget} />
        <Pressable accessibilityLabel="Next" accessibilityRole="button" onPress={onNext} style={styles.nextHitTarget} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#FFFFFF', flex: 1, overflow: 'hidden' },
  artwork: { position: 'absolute' },
  hitTargets: { position: 'absolute' },
  backHitTarget: { height: '7%', left: '5%', position: 'absolute', top: '7%', width: '13%' },
  nextHitTarget: { height: '10%', left: '10%', position: 'absolute', top: '86%', width: '80%' },
});
