import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ScreenScaffold } from '../components/ScreenScaffold';

const loadingCopy = [
  'Identifying the dish…',
  'Estimating ingredients…',
  'Building your homemade dupe…',
  'Calculating savings…',
];

export function AnalysisLoadingScreen() {
  const navigation = useNavigation();
  const [copyIndex, setCopyIndex] = useState(0);

  useEffect(() => {
    const rotation = setInterval(() => {
      setCopyIndex((currentIndex) => (currentIndex + 1) % loadingCopy.length);
    }, 500);
    const finish = setTimeout(() => {
      navigation.navigate('ResultSummaryScreen' as never);
    }, 2000);

    return () => {
      clearInterval(rotation);
      clearTimeout(finish);
    };
  }, [navigation]);

  return (
    <ScreenScaffold
      title="Building your homemade dupe"
      body="Using mock data for this first scan."
    >
      <View style={styles.loadingCard}>
        <ActivityIndicator color="#1d1b16" size="large" />
        <Text style={styles.loadingText}>{loadingCopy[copyIndex]}</Text>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  loadingCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#eadfce',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    marginTop: 28,
    padding: 24,
  },
  loadingText: {
    color: '#1d1b16',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
});
