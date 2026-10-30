import type { RefObject } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { colors, shadows, typography } from '../theme/okyoTheme';
import {
  COACH_DOCK_BOTTOM_OFFSET,
  COACH_DOCK_HORIZONTAL_INSET,
  COACH_DOCK_MAX_WIDTH,
  COACH_DOCK_RIGHT_INSET,
  KIKO_OVERLAP,
  KIKO_SIZE,
} from './coachDockGeometry';

export { COACH_DOCK_BOTTOM_OFFSET, COACH_DOCK_ESTIMATED_HEIGHT, COACH_DOCK_HORIZONTAL_INSET, COACH_DOCK_MAX_WIDTH, COACH_DOCK_RIGHT_INSET, KIKO_SIZE } from './coachDockGeometry';

/**
 * One approved, neutral, sitting Kiko pose for the entire tour — including
 * the completion step. Never swapped per step: a stable mascot is the whole
 * point of a persistent shell. This asset already has a baked-in sticker
 * outline, unlike the older cooking pose, so no code-generated outline layer
 * is drawn behind it.
 */
const KIKO_ASSET = require('../../assets/onboarding-v3/stickers/fox-sleeping.png');

interface CoachDockProps {
  mascotName: string;
  fullBody: string;
  isLastStep: boolean;
  controlsEnabled: boolean;
  onNext: () => void;
  onDone: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  rootRef?: RefObject<View | null>;
}

/**
 * The persistent coach dock: Kiko + the coachmark card. Mounted once for the
 * whole tour and never remounted or repositioned between steps — only the
 * text inside updates. This is the single fixed visual anchor the spec
 * requires; every other tour element (spotlight, progress dots) may change
 * around it, but this component's own geometry is constant.
 */
export function CoachDock({ controlsEnabled, fullBody, isLastStep, mascotName, onDone, onLayout, onNext, rootRef }: CoachDockProps) {
  return (
    <View pointerEvents="box-none" ref={rootRef} onLayout={onLayout} style={styles.root}>
      <View pointerEvents="none" style={styles.kikoShadowWrap}>
        <Image accessibilityIgnoresInvertColors accessible accessibilityLabel={`${mascotName} the fox, guiding you through the app`} resizeMode="contain" source={KIKO_ASSET} style={styles.kikoArt} />
      </View>

      <View style={styles.card}>
        <Text accessibilityRole="text" style={styles.textArea}>{fullBody}</Text>

        <Pressable
          accessibilityLabel={isLastStep ? 'Finish guided tour' : 'Next tour step'}
          accessibilityRole="button"
          disabled={!controlsEnabled}
          hitSlop={10}
          onPress={isLastStep ? onDone : onNext}
          style={styles.actionRow}
        >
          <Text style={styles.actionText}>{isLastStep ? 'Done' : 'Next →'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: { alignItems: 'center', alignSelf: 'flex-end', justifyContent: 'center', marginTop: 8, minHeight: 36, paddingHorizontal: 0 },
  actionText: { ...typography.button, color: colors.coral },
  card: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(214, 188, 156, 0.30)',
    borderRadius: 20,
    borderWidth: 1,
    flexShrink: 1,
    paddingBottom: 8,
    paddingHorizontal: 16,
    ...shadows.card,
  },
  kikoArt: { height: KIKO_SIZE, width: KIKO_SIZE },
  kikoShadowWrap: {
    height: KIKO_SIZE,
    left: 0,
    // Sits above the card's own top-left corner, its bottom edge overlapping
    // KIKO_OVERLAP px down into the card — a stable mascot standing beside
    // the message, not floating disconnected from it.
    position: 'absolute',
    shadowColor: colors.charcoal,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    top: -(KIKO_SIZE - KIKO_OVERLAP),
    width: KIKO_SIZE,
    zIndex: 1,
  },
  root: {
    bottom: COACH_DOCK_BOTTOM_OFFSET,
    left: COACH_DOCK_HORIZONTAL_INSET,
    maxWidth: COACH_DOCK_MAX_WIDTH,
    position: 'absolute',
    right: COACH_DOCK_RIGHT_INSET,
  },
  textArea: { ...typography.body, color: colors.charcoal, paddingTop: 24 },
});
