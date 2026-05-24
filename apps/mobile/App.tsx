import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Okyo</Text>
      <Text style={styles.headline}>Turn restaurant meals into homemade dupes.</Text>
      <Text style={styles.body}>
        Scan a dish, get the recipe, and see what it costs to make at home.
      </Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffaf3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logo: {
    color: '#1d1b16',
    fontSize: 44,
    fontWeight: '800',
    marginBottom: 16,
  },
  headline: {
    color: '#1d1b16',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 31,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    color: '#5f5a51',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
});
