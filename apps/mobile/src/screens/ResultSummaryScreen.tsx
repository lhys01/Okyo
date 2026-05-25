import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { defaultScanResult, getDefaultRecipeForMode, type RecipeMode } from '../mocks';
import type { RootStackParamList } from '../navigation/types';

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
type ResultSummaryNavigation = NativeStackNavigationProp<RootStackParamList, 'ResultSummaryScreen'>;

export function ResultSummaryScreen() {
  const navigation = useNavigation<ResultSummaryNavigation>();
  const [selectedMode, setSelectedMode] = useState<RecipeMode>(defaultScanResult.modes[0]);
  const selectedRecipe = getDefaultRecipeForMode(selectedMode);
  const confidencePercent = Math.round(defaultScanResult.confidence * 100);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.kicker}>Mock result</Text>
      <Text style={styles.title}>{defaultScanResult.dishName}</Text>
      <Text style={styles.subtitle}>
        {defaultScanResult.restaurantStyle} copycat estimate
      </Text>

      <View style={styles.summaryCard}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Confidence</Text>
          <Text style={styles.metricValue}>{confidencePercent}%</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Restaurant price</Text>
          <Text style={styles.metricValue}>{formatCurrency(defaultScanResult.restaurantPrice)}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Homemade cost</Text>
          <Text style={styles.metricValue}>{formatCurrency(selectedRecipe.estimatedHomemadeCost)}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Difficulty</Text>
          <Text style={styles.metricValue}>{selectedRecipe.difficulty}</Text>
        </View>
        <View style={styles.savingsRow}>
          <Text style={styles.savingsLabel}>Estimated savings</Text>
          <Text style={styles.savingsValue}>{formatCurrency(selectedRecipe.estimatedSavings)}</Text>
        </View>
      </View>

      <View style={styles.modeTabs}>
        {defaultScanResult.modes.map((mode) => {
          const selected = selectedMode === mode;
          return (
            <Pressable
              key={mode}
              style={[styles.modeTab, selected ? styles.modeTabSelected : null]}
              onPress={() => setSelectedMode(mode)}
            >
              <Text style={[styles.modeText, selected ? styles.modeTextSelected : null]}>{mode}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.matchCard}>
        <Text style={styles.matchLabel}>Match score</Text>
        <Text style={styles.matchValue}>{defaultScanResult.matchScore.toFixed(1)}/10</Text>
        <Text style={styles.matchNote}>
          {selectedRecipe.title}: {selectedRecipe.description}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate('RecipeDetailScreen', { mode: selectedMode })}
        >
          <Text style={styles.primaryButtonText}>View Recipe</Text>
        </Pressable>
        <View style={styles.secondaryGrid}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('ShareCardPreviewScreen' as never)}
          >
            <Text style={styles.secondaryButtonText}>Share Dupe</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('MainTabs' as never)}>
            <Text style={styles.secondaryButtonText}>Save Recipe</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('GroceryListScreen' as never)}
          >
            <Text style={styles.secondaryButtonText}>Grocery List</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 40,
  },
  kicker: {
    color: '#8d5d23',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#1d1b16',
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 39,
  },
  subtitle: {
    color: '#625b50',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderColor: '#eadfce',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 22,
    padding: 18,
  },
  metricRow: {
    borderBottomColor: '#f0e7da',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  metricLabel: {
    color: '#625b50',
    fontSize: 15,
  },
  metricValue: {
    color: '#1d1b16',
    fontSize: 16,
    fontWeight: '800',
  },
  savingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
  },
  savingsLabel: {
    color: '#1d1b16',
    fontSize: 16,
    fontWeight: '800',
  },
  savingsValue: {
    color: '#167247',
    fontSize: 20,
    fontWeight: '900',
  },
  modeTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  modeTab: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d8cab8',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modeTabSelected: {
    backgroundColor: '#1d1b16',
    borderColor: '#1d1b16',
  },
  modeText: {
    color: '#1d1b16',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  modeTextSelected: {
    color: '#fffaf3',
  },
  matchCard: {
    backgroundColor: '#f7efe2',
    borderRadius: 8,
    marginTop: 18,
    padding: 18,
  },
  matchLabel: {
    color: '#625b50',
    fontSize: 14,
    fontWeight: '700',
  },
  matchValue: {
    color: '#1d1b16',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 2,
  },
  matchNote: {
    color: '#625b50',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  actions: {
    gap: 12,
    marginTop: 22,
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
  secondaryGrid: {
    gap: 10,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d3c4ae',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: '#1d1b16',
    fontSize: 15,
    fontWeight: '800',
  },
});
