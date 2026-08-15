import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Camera, Plus, Sparks, Upload } from 'iconoir-react-native';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadows, spacing, typography } from '../../theme/okyoTheme';

const scanFabVideo = require('../../../assets/backgrounds/button-background/gradient-1920x1080.mp4');
const scanActionIcons = {
  describe: <Sparks color={colors.body} height={34} strokeWidth={2.1} width={34} />,
  takePhoto: <Camera color={colors.coral} height={34} strokeWidth={2.1} width={34} />,
  upload: <Upload color={colors.coral} height={34} strokeWidth={2.1} width={34} />,
};

export function ScanFab({ bottom, onDescribeMeal, onTakePhoto, onUpload, right = 16 }: { bottom: number; onDescribeMeal: () => void; onTakePhoto: () => void; onUpload: () => void; right?: number }) {
  const [visible, setVisible] = useState(false);
  const player = useVideoPlayer(scanFabVideo, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.play();
  });
  const open = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setVisible(true);
  };
  return (
    <>
      <Pressable accessibilityLabel="Scan a dish" accessibilityRole="button" onPress={open} style={({ pressed }) => [styles.fab, { bottom, right }, pressed ? styles.pressed : null]}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <VideoView contentFit="cover" nativeControls={false} player={player} style={StyleSheet.absoluteFill} surfaceType="textureView" />
        </View>
        <Plus color={colors.surface} height={34} strokeWidth={2.4} width={34} />
      </Pressable>
      <ScanActionSheet onClose={() => setVisible(false)} onDescribeMeal={onDescribeMeal} onTakePhoto={onTakePhoto} onUpload={onUpload} visible={visible} />
    </>
  );
}

export function ScanActionSheet({ onClose, onDescribeMeal, onTakePhoto, onUpload, visible }: { onClose: () => void; onDescribeMeal: () => void; onTakePhoto: () => void; onUpload: () => void; visible: boolean }) {
  const insets = useSafeAreaInsets();
  const choose = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View accessibilityViewIsModal style={styles.modal}>
        <Pressable accessibilityLabel="Close scan options" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm }]}>
          <View style={styles.grabber} />
          <Text maxFontSizeMultiplier={1.2} style={styles.title}>Add a dish</Text>
          <View style={styles.options}>
            <ScanAction icon={scanActionIcons.takePhoto} label="Take photo" caption="Photograph a prepared dish." onPress={() => choose(onTakePhoto)} />
            <ScanAction icon={scanActionIcons.upload} label="Upload photo" caption="Choose one from your library." onPress={() => choose(onUpload)} />
            <ScanAction icon={scanActionIcons.describe} label="Describe a dish" caption="Tell Okyo what you want." onPress={() => choose(onDescribeMeal)} />
          </View>
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
  fab: { alignItems: 'center', backgroundColor: colors.canvas, borderRadius: 32, height: 64, justifyContent: 'center', overflow: 'hidden', position: 'absolute', right: 16, width: 64, zIndex: 20, ...shadows.float },
  grabber: { alignSelf: 'center', backgroundColor: colors.border, borderRadius: 2, height: 4, width: 42 },
  icon: { alignItems: 'center', backgroundColor: 'transparent', height: 54, justifyContent: 'center', width: 54 },
  iconPrimary: { backgroundColor: 'transparent' },
  modal: { backgroundColor: 'rgba(43, 43, 48, 0.32)', flex: 1, justifyContent: 'flex-end' },
  option: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 14, minHeight: 72, paddingVertical: 10 },
  optionLabel: { ...typography.body, color: colors.ink, fontFamily: typography.section.fontFamily },
  optionPressed: { opacity: 0.72 },
  options: { marginTop: spacing.md },
  pressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  sheet: { backgroundColor: colors.canvas, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, paddingHorizontal: spacing.gutter, paddingTop: spacing.md },
  title: { ...typography.title, marginTop: spacing.md },
});
