import { StyleSheet, View } from 'react-native';

import {
  Caption, Chip, DirectionCShell, GhostButton, GroupLabel, KikoImage, Note, PrimaryButton,
  QuestionHeadline, Spacer,
} from '../../components/onboarding/DirectionC';
import { buildPromises } from '../../onboarding/personalization';
import type { OnboardingAnswers } from '../../onboarding/types';

type Props = {
  answers: OnboardingAnswers;
  nextLabel: string;
  onContinue: () => void;
  onStartOver: () => void;
};

/** Shown when a previous run was interrupted. Answers are already restored. */
export function ResumeScreen({ answers, nextLabel, onContinue, onStartOver }: Props) {
  const saved = buildPromises(answers);

  return (
    <DirectionCShell
      footer={
        <View>
          <PrimaryButton label="Continue setup" onPress={onContinue} />
          <GhostButton label="Start over" onPress={onStartOver} />
        </View>
      }
    >
      <Spacer flex={0.5} />
      <KikoImage pose="sittingSide" size={96} />
      <View style={styles.head}>
        <QuestionHeadline>Welcome back.</QuestionHeadline>
        <Caption>
          You were part-way through setting up. Your answers are saved — pick up where you left off.
        </Caption>
      </View>
      {saved.length ? (
        <Note>
          <GroupLabel>Saved so far</GroupLabel>
          <View style={styles.chips}>
            {saved.map((item) => <Chip key={item} label={item} selected />)}
          </View>
          <Caption>{`Next up: ${nextLabel}.`}</Caption>
        </Note>
      ) : null}
      <Spacer />
    </DirectionCShell>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, marginTop: 11 },
  head: { gap: 12, marginTop: 16 },
});
