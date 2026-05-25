import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenScaffold } from '../components/ScreenScaffold';

export function ScanScreen() {
  const navigation = useNavigation();
  const useMockScan = () => navigation.navigate('AnalysisLoadingScreen' as never);

  return (
    <ScreenScaffold
      title="Scan a meal"
      body="Take a photo or choose one from your library. For now, both use the same mock result."
    >
      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={useMockScan}>
          <Text style={styles.primaryButtonText}>Take Photo</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={useMockScan}>
          <Text style={styles.secondaryButtonText}>Upload From Photos</Text>
        </Pressable>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    marginTop: 28,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#1d1b16',
    borderRadius: 8,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#fffaf3',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d3c4ae',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: '#1d1b16',
    fontSize: 16,
    fontWeight: '800',
  },
});
