import { StyleSheet, Text, View } from 'react-native';

import {
  Caption, DirectionCProgress, DirectionCShell, GhostButton, GroupLabel, PrimaryButton, Spacer,
} from '../../components/onboarding/DirectionC';
import { PhotoPlaceholder } from './PhotoPlaceholder';
import { buildExample } from '../../onboarding/example';
import type { OnboardingAnswers } from '../../onboarding/types';
import { colors, fontFamilies } from '../../theme/okyoTheme';

type Props = {
  answers: OnboardingAnswers;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
  percent: number;
};

/** Precomputed and local. Never calls /v1/scans or any AI provider. */
export function ExampleScreen({ answers, onBack, onContinue, onSkip, percent }: Props) {
  const example = buildExample(answers);

  return (
    <DirectionCShell
      footer={
        <View>
          <PrimaryButton label="Try it with my food" onPress={onContinue} />
          <GhostButton label="Not now" onPress={onSkip} />
        </View>
      }
    >
      <DirectionCProgress onBack={onBack} percent={percent} showBack />
      <View style={styles.badgeRow}>
        <View style={styles.badge}><Text style={styles.badgeLabel}>Example</Text></View>
        <Caption>Not your food — yet</Caption>
      </View>
      <Text style={styles.title}>{example.title}</Text>
      <Caption>{example.description}</Caption>

      <View style={styles.transform}>
        <View style={styles.side}>
          <GroupLabel>What you have</GroupLabel>
          <PhotoPlaceholder height={128} label="Ingredients photo" />
        </View>
        <Text style={styles.arrow}>→</Text>
        <View style={styles.side}>
          <GroupLabel>What Okyo makes</GroupLabel>
          <PhotoPlaceholder height={128} label="Finished dish" />
        </View>
      </View>

      <Caption>{example.ingredients.join(' · ')}</Caption>
      {example.emphasis ? (
        <View style={styles.emphasis}><Text style={styles.emphasisText}>{example.emphasis}</Text></View>
      ) : null}

      <View style={styles.metrics}>
        <Metric unit="minutes" value={String(example.totalMinutes)} />
        <Metric unit="steps" value={String(example.steps.length)} />
        <Metric unit={example.pansToWash === 1 ? 'pan to wash' : 'pans'} value={String(example.pansToWash)} />
      </View>

      <View style={styles.steps}>
        {example.steps.map((step, index) => (
          <View key={step} style={styles.stepRow}>
            <Text style={styles.stepNum}>{index + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      <View style={styles.cost}>
        <Text style={styles.costLine}>Estimated homemade cost: {example.estimatedCost}</Text>
        <Text style={styles.costCaveat}>{example.costCaveat}</Text>
      </View>
      <Spacer />
    </DirectionCShell>
  );
}

function Metric({ unit, value }: { unit: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  arrow: { color: colors.muted, fontSize: 18, paddingTop: 26 },
  badge: { backgroundColor: colors.charcoal, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  badgeLabel: {
    color: '#FFFFFF', fontFamily: fontFamilies.extraBold, fontSize: 11, letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  badgeRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 14 },
  cost: { backgroundColor: colors.charcoal, borderRadius: 18, gap: 5, marginTop: 16, padding: 18 },
  costCaveat: { color: 'rgba(255,255,255,0.72)', fontFamily: fontFamilies.body, fontSize: 12.5, lineHeight: 18 },
  costLine: { color: '#FFFFFF', fontFamily: fontFamilies.extraBold, fontSize: 19, letterSpacing: -0.48 },
  emphasis: {
    backgroundColor: colors.greenSoft, borderRadius: 12, marginTop: 12, paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emphasisText: { color: '#1F5B45', fontFamily: fontFamilies.semibold, fontSize: 13.5, lineHeight: 19 },
  metric: {
    alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E9E1D5', borderRadius: 14,
    borderWidth: 2, flex: 1, paddingVertical: 13,
  },
  metricUnit: { color: colors.muted, fontFamily: fontFamilies.semibold, fontSize: 11.5 },
  metricValue: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 20, letterSpacing: -0.5 },
  metrics: { flexDirection: 'row', gap: 9, marginTop: 16 },
  side: { flex: 1, gap: 8 },
  stepNum: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 14, width: 12 },
  stepRow: { flexDirection: 'row', gap: 11 },
  stepText: { color: colors.body, flex: 1, fontFamily: fontFamilies.body, fontSize: 14.5, lineHeight: 21 },
  steps: { gap: 7, marginTop: 16 },
  title: {
    color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 29, letterSpacing: -1.01,
    lineHeight: 33, marginBottom: 8,
  },
  transform: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, marginVertical: 18 },
});
