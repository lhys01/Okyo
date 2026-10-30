import { useVideoPlayer, VideoView } from 'expo-video';
import { Camera, Plus, Sparks, Upload } from 'iconoir-react-native';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTour } from '../../tour/TourContext';
import { colors, radius, shadows, spacing, typography } from '../../theme/okyoTheme';
import { clearScanAction, createScanSheetActions, getScanSheetMaxHeight, queueScanAction, shouldDismissScanSheet, takeScanAction } from './scanActionSheetModel';

const scanFabVideo = require('../../../assets/backgrounds/button-background/gradient-1920x1080.mp4');
const scanActionIcons = {
  describe: <Sparks color={colors.body} height={34} strokeWidth={2.1} width={34} />,
  takePhoto: <Camera color={colors.coral} height={34} strokeWidth={2.1} width={34} />,
  upload: <Upload color={colors.coral} height={34} strokeWidth={2.1} width={34} />,
};

export function ScanFab({ bottom, fabRef, onOpenSheet, right = 16, sheetVisible, tourActionId }: { bottom: number; fabRef?: RefObject<View | null>; onOpenSheet: () => void; right?: number; sheetVisible: boolean; tourActionId?: string }) {
  const { active: tourActive, highlightedAnchorId, registerAction, setExternallyPaused, unregisterAction } = useTour();
  // The tour overlay lives outside React Navigation's own tab-bar layer, so
  // dimming this button via overlay z-order proved unreliable — it reads the
  // tour's own highlighted-target flag and dims ITSELF instead. Bright
  // whenever the tour isn't running, or when THIS button is the actual
  // target (Step 4).
  // The navigation tab-bar is in a separate native stacking layer, so the
  // SVG scrim cannot reliably dim the FAB. Mirror the tour state here: it is
  // bright only after its own live measurement has committed on the + step.
  const tourTargetMeasured = highlightedAnchorId !== null;
  const highlightedByTour = Boolean(tourActionId && tourActive && highlightedAnchorId === tourActionId);
  const dimmedByTour = Boolean(tourActionId && tourActive && tourTargetMeasured && !highlightedByTour);
  const player = useVideoPlayer(scanFabVideo, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.play();
  });
  // Lets the tour's completion screen trigger this SAME real button instead
  // of reimplementing the scan flow.
  useEffect(() => {
    if (!tourActionId) return;
    registerAction(tourActionId, onOpenSheet);
    return () => unregisterAction(tourActionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourActionId, registerAction, unregisterAction, onOpenSheet]);
  // While this sheet is genuinely open over the highlighted `+` button, the
  // tour must hide (not just visually — it must stop measuring/scrolling)
  // and resume at the same step once the sheet closes.
  useEffect(() => {
    if (!tourActionId) return;
    setExternallyPaused(sheetVisible);
  }, [tourActionId, sheetVisible, setExternallyPaused]);
  return (
    <>
      <Pressable ref={fabRef} accessibilityLabel="Scan a dish" accessibilityRole="button" onPress={onOpenSheet} style={({ pressed }) => [styles.fab, { bottom, right }, pressed ? styles.pressed : null]}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <VideoView contentFit="cover" nativeControls={false} player={player} style={StyleSheet.absoluteFill} surfaceType="textureView" />
        </View>
        <Plus color={colors.surface} height={34} strokeWidth={2.4} width={34} />
        {highlightedByTour ? <View pointerEvents="none" style={styles.tourHighlight} /> : null}
        {dimmedByTour ? <View pointerEvents="none" style={styles.tourDim} /> : null}
      </Pressable>
    </>
  );
}

export function ScanActionSheet({ onClose, onDescribeMeal, onTakePhoto, onUpload, visible }: { onClose: () => void; onDescribeMeal: () => void; onTakePhoto: () => void; onUpload: () => void; visible: boolean }) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const actions = createScanSheetActions({ onDescribeMeal, onTakePhoto, onUpload });
  const pendingAction = useRef<(() => void) | null>(null);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushPendingAction = () => {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    fallbackTimer.current = null;
    const action = takeScanAction(pendingAction);
    action?.();
  };
  useEffect(() => () => {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
  }, []);
  useEffect(() => {
    if (!visible) return;
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    fallbackTimer.current = null;
    clearScanAction(pendingAction);
  }, [visible]);
  const choose = (action: () => void) => {
    queueScanAction(pendingAction, action);
    onClose();
    // iOS fires onDismiss after its native modal transition. Keep a fallback
    // for platforms where Modal does not emit onDismiss.
    fallbackTimer.current = setTimeout(flushPendingAction, 360);
  };
  const dismissResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 8 && Math.abs(gesture.dx) < 16,
    onPanResponderRelease: (_event, gesture) => {
      if (shouldDismissScanSheet(gesture.dy, gesture.vy)) onClose();
    },
  })).current;

  return (
    <Modal animationType="fade" onDismiss={flushPendingAction} onRequestClose={onClose} transparent visible={visible}>
      <View accessibilityViewIsModal style={styles.modal}>
        <Pressable accessibilityLabel="Close scan options" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.sheet, { maxHeight: getScanSheetMaxHeight(windowHeight), paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm }]}>
          <View accessibilityLabel="Swipe down to close" {...dismissResponder.panHandlers} style={styles.grabberHitTarget}>
            <View style={styles.grabber} />
          </View>
          <Text maxFontSizeMultiplier={1.2} style={styles.title}>Add a dish</Text>
          <ScrollView bounces={false} contentContainerStyle={styles.options} showsVerticalScrollIndicator={false} style={styles.optionsViewport}>
            {actions.map((action) => (
              <ScanAction key={action.key} icon={scanActionIcons[action.key]} label={action.label} caption={action.caption} onPress={() => choose(action.onSelect)} />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ScanAction({ caption, icon, label, onPress }: { caption: string; icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={`${label}. ${caption}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.option, pressed ? styles.optionPressed : null]}>
      <View style={[styles.icon, label === 'Take photo' ? styles.iconPrimary : null]}>
        {icon}
      </View>
      <View style={styles.copy}>
        <Text maxFontSizeMultiplier={1.5} style={styles.optionLabel}>{label}</Text>
        <Text maxFontSizeMultiplier={1.5} style={styles.caption}>{caption}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  caption: { ...typography.caption, color: colors.body, marginTop: 2 },
  copy: { flex: 1 },
  tourDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20, 18, 20, 0.58)', borderRadius: 32 },
  tourHighlight: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255, 255, 255, 0.28)', borderColor: colors.surface, borderRadius: 32, borderWidth: 3, shadowColor: colors.surface, shadowOpacity: 0.9, shadowRadius: 10 },
  fab: { alignItems: 'center', backgroundColor: colors.canvas, borderRadius: 32, height: 64, justifyContent: 'center', overflow: 'hidden', position: 'absolute', right: 16, width: 64, zIndex: 20, ...shadows.float },
  grabber: { alignSelf: 'center', backgroundColor: colors.border, borderRadius: 2, height: 4, width: 42 },
  grabberHitTarget: { alignItems: 'center', height: 24, justifyContent: 'center', marginTop: -8 },
  icon: { alignItems: 'center', backgroundColor: 'transparent', height: 54, justifyContent: 'center', width: 54 },
  iconPrimary: { backgroundColor: 'transparent' },
  modal: { backgroundColor: 'rgba(43, 43, 48, 0.32)', flex: 1, justifyContent: 'flex-end' },
  option: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 14, minHeight: 72, paddingVertical: 10 },
  optionLabel: { ...typography.body, color: colors.ink, fontFamily: typography.section.fontFamily },
  optionPressed: { opacity: 0.72 },
  options: { paddingTop: spacing.md },
  optionsViewport: { flexShrink: 1 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  sheet: { backgroundColor: colors.canvas, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, overflow: 'hidden', paddingHorizontal: spacing.gutter, paddingTop: spacing.md },
  title: { ...typography.title, marginTop: spacing.md },
});
