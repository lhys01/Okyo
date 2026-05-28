import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { uiLog } from '../utils/uiDebug';
import { colors, sharedStyles } from '../components/OkyoUI';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { defaultScanResult, getSafeRecipeForMode } from '../mocks';

const loadingCopy = [
  'Looking at your food photo...',
  'Finding the closest dish match...',
  'Building your homemade dupe...',
  'Checking if this is a good scan...',
];

export function AnalysisLoadingScreen() {
  const navigation = useNavigation();
  const [copyIndex, setCopyIndex] = useState(0);

  useEffect(() => {
    uiLog('AnalysisLoadingScreen', 'enter');
    const rotation = setInterval(() => {
      setCopyIndex((currentIndex) => (currentIndex + 1) % loadingCopy.length);
    }, 500);
    const finish = setTimeout(() => {
      const recipe = getSafeRecipeForMode(defaultScanResult.modes[0]);
      if (!recipe) {
        track(analyticsEvents.RESULT_ERROR, {
          errorMessage: 'Mock recipe was unavailable after loading.',
          screen: 'AnalysisLoadingScreen',
        });
        navigation.navigate('ScanScreen' as never);
        return;
      }

      track(analyticsEvents.DISH_DETECTED, {
        dishName: defaultScanResult.dishName,
        screen: 'AnalysisLoadingScreen',
      });
      track(analyticsEvents.RECIPE_GENERATED, {
        dishName: defaultScanResult.dishName,
        mode: recipe.mode,
        savings: recipe.estimatedSavings,
        screen: 'AnalysisLoadingScreen',
      });
      uiLog('AnalysisLoadingScreen', 'navigate_result');
      navigation.navigate('ResultSummaryScreen' as never);
    }, 2000);

    return () => {
      clearInterval(rotation);
      clearTimeout(finish);
    };
  }, [navigation]);

  return (
    <ScreenScaffold
      title="Okyo is tasting with its eyes"
      body="This may take a few seconds while Okyo checks the photo and builds your homemade dupe."
    >
      <View style={styles.loadingCard}>
        <Text style={styles.loadingEmoji}>OK</Text>
        <View style={styles.pulse}>
          <ActivityIndicator color={colors.coral} size="large" />
        </View>
        <Text style={styles.loadingText}>{loadingCopy[copyIndex]}</Text>
        <Text style={styles.loadingHint}>Hang tight. Good dupes need a tiny simmer.</Text>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  loadingCard: {
    ...sharedStyles.card,
    alignItems: 'center',
    gap: 14,
    marginTop: 28,
    padding: 24,
  },
  pulse: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  loadingEmoji: {
    color: colors.coral,
    fontSize: 34,
    fontWeight: '900',
  },
  loadingText: {
    color: colors.charcoal,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  loadingHint: {
    color: colors.body,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'center',
  },
});
