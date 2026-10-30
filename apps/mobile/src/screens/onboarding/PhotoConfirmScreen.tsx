import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import {
  DirectionCProgress, DirectionCShell, Note, PrimaryButton, QuestionHeadline, SecondaryButton,
  Spacer,
} from '../../components/onboarding/DirectionC';
import { colors, fontFamilies } from '../../theme/okyoTheme';
import { useMascotName } from '../../state/useMascotName';
import { getScanPhotoPreviewHeight } from '../../utils/responsiveLayout';

type Props = {
  onBack: () => void;
  onRetake: () => void;
  onUse: () => void;
  percent: number;
  uri?: string;
};

/** Last chance to swap the photo before the real scan runs. */
export function PhotoConfirmScreen({ onBack, onRetake, onUse, percent, uri }: Props) {
  const mascotName = useMascotName();
  const { height: windowHeight } = useWindowDimensions();
  return (
    <DirectionCShell
      footer={
        <View>
          <PrimaryButton label="Use this photo" onPress={onUse} />
          <View style={styles.gap}><SecondaryButton label="Take another" onPress={onRetake} /></View>
        </View>
      }
    >
      <DirectionCProgress onBack={onBack} percent={percent} showBack />
      <QuestionHeadline>Use this photo?</QuestionHeadline>
      <View style={[styles.frame, { height: getScanPhotoPreviewHeight(windowHeight) }]}>
        {uri ? (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel="The photo you selected"
            resizeMode="contain"
            source={{ uri }}
            style={styles.photo}
          />
        ) : (
          <View style={styles.empty}><Text style={styles.emptyLabel}>No photo selected</Text></View>
        )}
      </View>
      <Note>
        <Text style={styles.hint}>
          Check that nothing important is hidden behind a lid or another item. You can correct what{' '}
          {mascotName} finds after the scan.
        </Text>
      </Note>
      <Spacer />
    </DirectionCShell>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  emptyLabel: { color: colors.muted, fontFamily: fontFamilies.semibold, fontSize: 13 },
  frame: {
    alignItems: 'center', backgroundColor: '#EDE4D6', borderRadius: 18, justifyContent: 'center', marginBottom: 18, marginTop: 18,
    overflow: 'hidden', width: '100%',
  },
  gap: { marginTop: 9 },
  hint: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 14.5, lineHeight: 21 },
  photo: { height: '100%', width: '100%' },
});
