import { StyleSheet, Text, View } from 'react-native';

import { ScreenScaffold } from '../components/ScreenScaffold';
import { defaultShareCard } from '../mocks';

export function ShareCardPreviewScreen() {
  return (
    <ScreenScaffold
      title="Share card preview"
      body="Mock preview only. Expo Sharing is not connected yet."
    >
      <View style={styles.card}>
        <Text style={styles.headline}>{defaultShareCard.headline}</Text>
        <Text style={styles.subheadline}>{defaultShareCard.subheadline}</Text>
        {defaultShareCard.matchScore ? (
          <Text style={styles.match}>{defaultShareCard.matchScore.toFixed(1)}/10 match</Text>
        ) : null}
        <Text style={styles.footer}>{defaultShareCard.footer}</Text>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1d1b16',
    borderRadius: 8,
    marginTop: 24,
    padding: 22,
  },
  headline: {
    color: '#fffaf3',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  subheadline: {
    color: '#7ee0a8',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
  },
  match: {
    color: '#fffaf3',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  footer: {
    color: '#d8cab8',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 28,
  },
});
