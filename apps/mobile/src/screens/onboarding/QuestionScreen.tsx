import { StyleSheet, View } from 'react-native';

import {
  AnswerRow, Caption, DirectionCProgress, DirectionCShell, GuidanceBars, QuestionHeadline, Spacer,
} from '../../components/onboarding/DirectionC';

export type QuestionChoice<T> = {
  bars?: number;
  detail?: string;
  id: string;
  label: string;
  value: T;
};

type Props<T> = {
  choices: QuestionChoice<T>[];
  footnote?: string;
  onBack: () => void;
  onSelect: (value: T) => void;
  percent: number;
  question: string;
  selected?: T;
};

/**
 * One question, one tap. Used for the problem, every follow-up branch and guidance,
 * so the branches cannot drift apart visually.
 */
export function QuestionScreen<T>({
  choices, footnote, onBack, onSelect, percent, question, selected,
}: Props<T>) {
  return (
    <DirectionCShell>
      <DirectionCProgress onBack={onBack} percent={percent} showBack />
      <QuestionHeadline>{question}</QuestionHeadline>
      <View style={styles.list}>
        {choices.map((choice, index) => {
          const isSelected = selected === choice.value;
          return (
            <AnswerRow
              key={choice.id}
              detail={choice.detail}
              index={choice.bars === undefined ? index + 1 : undefined}
              label={choice.label}
              onPress={() => onSelect(choice.value)}
              selected={isSelected}
              trailing={
                choice.bars === undefined
                  ? undefined
                  : <GuidanceBars filled={choice.bars} selected={isSelected} />
              }
            />
          );
        })}
      </View>
      {footnote ? <View style={styles.footnote}><Caption>{footnote}</Caption></View> : null}
      <Spacer />
    </DirectionCShell>
  );
}

const styles = StyleSheet.create({
  footnote: { marginTop: 16 },
  list: { gap: 10, marginTop: 30 },
});
