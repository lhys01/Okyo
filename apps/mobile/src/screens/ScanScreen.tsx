import { useNavigation } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { PrimaryButton, SecondaryButton, colors } from '../components/OkyoUI';
import { ScreenScaffold } from '../components/ScreenScaffold';

export function ScanScreen() {
  const navigation = useNavigation();
  const useMockScan = (source: 'camera' | 'photos') => {
    track(analyticsEvents.SCAN_STARTED, { screen: 'ScanScreen', source });
    track(analyticsEvents.PHOTO_UPLOADED, { screen: 'ScanScreen', source });
    navigation.navigate('AnalysisLoadingScreen' as never);
  };

  return (
    <ScreenScaffold
      title="Scan a meal"
      body="Take a photo or choose one from your library. Okyo will estimate the homemade dupe and savings."
    >
      <View style={styles.cameraCard}>
        <Text style={styles.cameraIcon}>OK</Text>
        <Text style={styles.cameraText}>Mock scan ready</Text>
      </View>
      <View style={styles.actions}>
        <PrimaryButton onPress={() => useMockScan('camera')}>Take Photo</PrimaryButton>
        <SecondaryButton onPress={() => useMockScan('photos')}>Upload From Photos</SecondaryButton>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    marginTop: 20,
  },
  cameraCard: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 18,
    height: 150,
    justifyContent: 'center',
    marginTop: 20,
  },
  cameraIcon: {
    color: colors.coral,
    fontSize: 44,
    fontWeight: '900',
  },
  cameraText: {
    color: colors.body,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 6,
    textTransform: 'uppercase',
  },
});
