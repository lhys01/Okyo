import { StyleSheet, Text, View } from 'react-native';

import {
  Caption, DirectionCProgress, DirectionCShell, GroupLabel, KikoNote, Note, PrimaryButton,
  QuestionHeadline, Spacer,
} from '../../components/onboarding/DirectionC';
import { ChoicePill } from './ChoicePill';
import { describeDiet, toggleAvoid, togglePattern, type DietSelection } from '../../onboarding/diet';
import { AVOID_OPTIONS } from '../../onboarding/questions';
import { colors, fontFamilies } from '../../theme/okyoTheme';

type Props = {
  onBack: () => void;
  onChange: (selection: DietSelection) => void;
  onContinue: () => void;
  onSkip: () => void;
  percent: number;
  selection: DietSelection;
};

export function DietScreen({ onBack, onChange, onContinue, onSkip, percent, selection }: Props) {
  const summary = describeDiet(selection);
  const nothing = !selection.dietPattern;

  return (
    <DirectionCShell footer={<PrimaryButton label="Continue" onPress={onContinue} />}>
      <DirectionCProgress onBack={onBack} onSkip={onSkip} percent={percent} showBack />
      <QuestionHeadline>Anything to avoid?</QuestionHeadline>

      <View style={styles.group}>
        <GroupLabel>Eating pattern — pick one</GroupLabel>
        <View style={styles.row}>
          <ChoicePill
            label="Nothing"
            onPress={() => onChange(togglePattern(selection, null))}
            selected={nothing}
          />
          <ChoicePill
            label="Vegetarian"
            onPress={() => onChange(togglePattern(selection, 'vegetarian'))}
            selected={selection.dietPattern === 'vegetarian'}
          />
          <ChoicePill
            label="Vegan"
            onPress={() => onChange(togglePattern(selection, 'vegan'))}
            selected={selection.dietPattern === 'vegan'}
          />
        </View>
      </View>

      <View style={styles.group}>
        <GroupLabel>Also avoid — add any</GroupLabel>
        <View style={styles.row}>
          {AVOID_OPTIONS.map((option) => (
            <ChoicePill
              key={option.id}
              label={option.label}
              onPress={() => onChange(toggleAvoid(selection, option.value))}
              selected={selection.avoid.includes(option.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.summary}>
        <Note>
          <GroupLabel>Your recipes will</GroupLabel>
          <Text style={styles.summaryLine}>{summary.line}</Text>
          <Caption>{summary.detail}</Caption>
        </Note>
      </View>

      <Spacer />
      <View style={styles.safety}>
        <KikoNote
          line="Recipes will leave these out. You can change this anytime in Settings. Always check ingredients yourself for serious allergies."
          pose="sittingSide"
          size={34}
        />
      </View>
    </DirectionCShell>
  );
}

const styles = StyleSheet.create({
  group: { gap: 12, marginTop: 26 },
  row: { flexDirection: 'row', gap: 9 },
  safety: { paddingBottom: 12, paddingTop: 18 },
  summary: { marginTop: 26 },
  summaryLine: {
    color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 19, letterSpacing: -0.48,
    lineHeight: 26, marginTop: 10,
  },
});
