import { StyleSheet, View } from 'react-native';

import {
  AnswerRow, Caption, Chip, DirectionCProgress, DirectionCShell, GroupLabel, KikoNote,
  PrimaryButton, QuestionHeadline, Spacer,
} from '../../components/onboarding/DirectionC';
import { buildPromises, buildSummaryLine } from '../../onboarding/personalization';
import { RECIPE_PRIORITY_OPTIONS, RECIPE_PRIORITY_QUESTION } from '../../onboarding/questions';
import type { OnboardingAnswers, RecipePriorityAnswer } from '../../onboarding/types';
import { useMascotName } from '../../state/useMascotName';

type Props = {
  answers: OnboardingAnswers;
  onBack: () => void;
  onContinue: () => void;
  onSelectPriority: (value: RecipePriorityAnswer) => void;
  percent: number;
};

/**
 * Rewards the answers with real promises, then asks one more question that
 * actually reaches recipe generation as `recipePriority`.
 */
export function SetupScreen({ answers, onBack, onContinue, onSelectPriority, percent }: Props) {
  const mascotName = useMascotName();
  const promises = buildPromises(answers);

  return (
    <DirectionCShell footer={<PrimaryButton label="Show me an example" onPress={onContinue} />}>
      <DirectionCProgress onBack={onBack} percent={percent} showBack />
      <QuestionHeadline>Okyo is set up.</QuestionHeadline>
      <View style={styles.summary}>
        <Caption>{buildSummaryLine(answers, mascotName)}</Caption>
      </View>
      {promises.length ? (
        <View style={styles.chips}>
          {promises.map((promise) => <Chip key={promise} label={promise} />)}
        </View>
      ) : null}

      <View style={styles.priority}>
        <GroupLabel>{RECIPE_PRIORITY_QUESTION}</GroupLabel>
        <Caption>{mascotName} leads with this when two recipes are equally good.</Caption>
      </View>
      <View style={styles.list}>
        {RECIPE_PRIORITY_OPTIONS.map((option) => (
          <AnswerRow
            key={option.id}
            detail={option.detail}
            label={option.label}
            onPress={() => onSelectPriority(option.value)}
            selected={answers.recipePriority === option.value}
          />
        ))}
      </View>

      <Spacer />
      <View style={styles.kiko}>
        <KikoNote
          line="“Ready when you are — you can change any of this in Settings.”"
          pose="standingReady"
        />
      </View>
    </DirectionCShell>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  kiko: { paddingBottom: 12, paddingTop: 16 },
  list: { gap: 9, marginTop: 14 },
  priority: { gap: 7, marginTop: 26 },
  summary: { marginTop: 11 },
});
