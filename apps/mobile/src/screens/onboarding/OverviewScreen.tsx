import { StyleSheet, Text, View } from 'react-native';

import {
  DirectionCProgress, DirectionCShell, Note, PrimaryButton, QuestionHeadline, Rule, Spacer,
} from '../../components/onboarding/DirectionC';
import { OVERVIEW_STEPS } from '../../onboarding/questions';
import { colors, fontFamilies } from '../../theme/okyoTheme';

type Props = { onBack: () => void; onContinue: () => void; percent: number };

const ACCENTS = [colors.sunsetPink, colors.sunnyYellow, colors.mintGreen, colors.skyBlue];

export function OverviewScreen({ onBack, onContinue, percent }: Props) {
  return (
    <DirectionCShell footer={<PrimaryButton label="Continue" onPress={onContinue} />}>
      <DirectionCProgress onBack={onBack} percent={percent} showBack />
      <QuestionHeadline>Four steps. That’s the whole app.</QuestionHeadline>
      <View style={styles.list}>
        {OVERVIEW_STEPS.map((step, index) => (
          <View key={step}>
            {index > 0 ? <Rule /> : null}
            <View style={styles.row}>
              <Text style={[styles.number, { color: ACCENTS[index] }]}>{index + 1}</Text>
              <Text style={styles.label}>{step}</Text>
            </View>
          </View>
        ))}
      </View>
      <Spacer />
      <Note>
        <Text style={styles.money}>
          That last one is the point — cook what’s already in your kitchen before buying or
          ordering more.
        </Text>
      </Note>
    </DirectionCShell>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.charcoal, flex: 1, fontFamily: fontFamilies.bold, fontSize: 20,
    letterSpacing: -0.5,
  },
  list: { marginTop: 30 },
  money: {
    color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 17, letterSpacing: -0.34,
    lineHeight: 24,
  },
  number: {
    fontFamily: fontFamilies.extraBold, fontSize: 28, letterSpacing: -0.84, width: 38,
  },
  row: { alignItems: 'center', flexDirection: 'row', gap: 18, paddingVertical: 20 },
});
