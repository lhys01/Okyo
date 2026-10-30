import { StyleSheet, Text, View } from 'react-native';

import {
  Caption, Chip, DirectionCProgress, DirectionCShell, GhostButton, GroupLabel, KikoNote, Note,
  PrimaryButton, QuestionHeadline, SecondaryButton, Spacer,
} from '../../components/onboarding/DirectionC';
import { colors, fontFamilies } from '../../theme/okyoTheme';
import { useChosenMascotName } from '../../state/useMascotName';
import { getFoxDisplayName } from '../../state/foxDisplayName';
import { getFoxSubjectName } from '../../state/foxDisplayName';

export type ScanEntryMode = 'guide' | 'cameraDenied' | 'libraryDenied';

type Props = {
  busy?: boolean;
  mode: ScanEntryMode;
  onChoosePhoto: () => void;
  onNotNow: () => void;
  onOpenSettings: () => void;
  onTakePhoto: () => void;
  percent: number;
  onBack: () => void;
};

/**
 * Explains what to photograph before any permission is requested. The OS prompt
 * only fires from onTakePhoto / onChoosePhoto — never on mount.
 */
export function ScanEntryScreen({
  busy = false, mode, onBack, onChoosePhoto, onNotNow, onOpenSettings, onTakePhoto, percent,
}: Props) {
  const chosenMascotName = useChosenMascotName();
  const mascotName = getFoxDisplayName(chosenMascotName);
  const subjectName = getFoxSubjectName(chosenMascotName);
  if (mode !== 'guide') {
    const isCamera = mode === 'cameraDenied';
    return (
      <DirectionCShell footer={<GhostButton label="Not now" onPress={onNotNow} />}>
        <DirectionCProgress onBack={onBack} percent={percent} showBack />
        <QuestionHeadline>{isCamera ? 'Camera access is off' : 'Photo access is off'}</QuestionHeadline>
        <View style={styles.deniedCopy}>
          <Caption>
            {isCamera
              ? 'No problem — you don’t need the camera to use Okyo. Pick a photo you already have, or turn access on in Settings.'
              : 'Okyo needs access to your photos to read one picture. You can turn it on in Settings, or take a new photo instead.'}
          </Caption>
        </View>
        <View style={styles.recovery}>
          {isCamera ? (
            <SecondaryButton label="Choose an existing photo" onPress={onChoosePhoto} />
          ) : (
            <SecondaryButton label="Take a photo instead" onPress={onTakePhoto} />
          )}
          <SecondaryButton label="Open Settings" onPress={onOpenSettings} />
        </View>
        <Spacer />
        <View style={styles.kiko}>
          <KikoNote line="“Either way works — I just need to see the food.”" pose="sittingSide" size={48} />
        </View>
      </DirectionCShell>
    );
  }

  return (
    <DirectionCShell
      footer={
        <View>
          <PrimaryButton label={busy ? 'Opening…' : 'Take a Photo'} onPress={onTakePhoto} />
          <View style={styles.secondGap}>
            <SecondaryButton label="Choose a Photo" onPress={onChoosePhoto} />
          </View>
          <GhostButton label="Not now" onPress={onNotNow} />
        </View>
      }
    >
      <DirectionCProgress onBack={onBack} percent={percent} showBack />
      <QuestionHeadline>Show {mascotName} what you have.</QuestionHeadline>
      <View style={styles.lead}>
        <Caption>
          The recipe is built from what’s actually in your photo — not a generic search. The more{' '}
          {mascotName} can see, the better it gets.
        </Caption>
      </View>

      <View style={styles.group}>
        <GroupLabel>What to photograph</GroupLabel>
        <View style={styles.chipRow}>
          <Chip label="A fridge shelf" />
          <Chip label="Your counter" />
          <Chip label="Leftovers" />
        </View>
      </View>

      <View style={styles.group}>
        <GroupLabel>What makes a good photo</GroupLabel>
        <Tip good text="Shoot straight down so nothing hides behind anything else." />
        <Tip good text="Include everything you might use — even the half onion." />
        <Tip text={`Avoid closed tubs and bags. ${mascotName} can’t read through a lid.`} />
      </View>

      <View style={styles.next}>
        <Note tone="good">
          <GroupLabel>What happens next</GroupLabel>
          <Text style={styles.nextCopy}>
            {subjectName} names what it sees, then writes one recipe around it. You’ll see the ingredient
            list and can correct anything before you cook.
          </Text>
        </Note>
      </View>
      <Spacer />
    </DirectionCShell>
  );
}

function Tip({ good = false, text }: { good?: boolean; text: string }) {
  return (
    <View style={styles.tipRow}>
      <Text style={[styles.tipMark, { color: good ? colors.green : colors.danger }]}>
        {good ? '✓' : '✕'}
      </Text>
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  deniedCopy: { marginTop: 12 },
  group: { gap: 11, marginTop: 22 },
  kiko: { paddingBottom: 12 },
  lead: { marginTop: 11 },
  next: { marginTop: 18 },
  nextCopy: { color: '#1F5B45', fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21, marginTop: 8 },
  recovery: { gap: 9, marginTop: 24 },
  secondGap: { marginTop: 9 },
  tipMark: { fontFamily: fontFamilies.bold, fontSize: 15, width: 16 },
  tipRow: { flexDirection: 'row', gap: 11, paddingVertical: 3 },
  tipText: { color: colors.body, flex: 1, fontFamily: fontFamilies.body, fontSize: 14.5, lineHeight: 21 },
});
