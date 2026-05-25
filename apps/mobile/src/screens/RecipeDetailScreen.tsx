import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  defaultScanResult,
  getDefaultRecipeForMode,
  type RecipeMode,
} from '../mocks';
import type { RootStackParamList } from '../navigation/types';

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
type RecipeDetailNavigation = NativeStackNavigationProp<RootStackParamList, 'RecipeDetailScreen'>;
type RecipeDetailRoute = RouteProp<RootStackParamList, 'RecipeDetailScreen'>;

export function RecipeDetailScreen() {
  const navigation = useNavigation<RecipeDetailNavigation>();
  const route = useRoute<RecipeDetailRoute>();
  const initialMode = route.params?.mode ?? defaultScanResult.modes[0];
  const [selectedMode, setSelectedMode] = useState<RecipeMode>(initialMode);
  const recipe = getDefaultRecipeForMode(selectedMode);

  useEffect(() => {
    setSelectedMode(initialMode);
  }, [initialMode]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>Recipe</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{selectedMode}</Text>
        </View>
      </View>

      <Text style={styles.title}>{recipe.title}</Text>
      <Text style={styles.description}>{recipe.description}</Text>

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

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Prep</Text>
          <Text style={styles.statValue}>{recipe.prepTimeMinutes} min</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Cook</Text>
          <Text style={styles.statValue}>{recipe.cookTimeMinutes} min</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Difficulty</Text>
          <Text style={styles.statValue}>{recipe.difficulty}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Cost</Text>
          <Text style={styles.statValue}>{formatCurrency(recipe.estimatedHomemadeCost)}</Text>
        </View>
      </View>

      <View style={styles.savingsCard}>
        <Text style={styles.savingsLabel}>Estimated savings</Text>
        <Text style={styles.savingsValue}>{formatCurrency(recipe.estimatedSavings)}</Text>
        <Text style={styles.savingsNote}>
          Compared with a {formatCurrency(defaultScanResult.restaurantPrice)} restaurant estimate.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {recipe.ingredients.map((ingredient) => (
          <Text key={`${recipe.id}-${ingredient.name}`} style={styles.listItem}>
            {ingredient.quantity} {ingredient.name}
            {ingredient.pantryItem ? ' (pantry)' : ''}
          </Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Instructions</Text>
        {recipe.steps.map((step, index) => (
          <View key={`${recipe.id}-step-${step}`} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Substitutions</Text>
        {recipe.substitutions.map((substitution) => (
          <Text key={`${recipe.id}-${substitution}`} style={styles.listItem}>
            {substitution}
          </Text>
        ))}
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Pantry note</Text>
        <Text style={styles.noteText}>{recipe.pantryNote}</Text>
        <Text style={styles.confidenceText}>{recipe.confidenceNote}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('MainTabs')}>
          <Text style={styles.primaryButtonText}>Save Recipe</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('GroceryListScreen')}>
          <Text style={styles.secondaryButtonText}>Grocery List</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('DupeChallengeScreen')}
        >
          <Text style={styles.secondaryButtonText}>Start Dupe Challenge</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('ShareCardPreviewScreen')}
        >
          <Text style={styles.secondaryButtonText}>Share Dupe</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 44,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  kicker: {
    color: '#8d5d23',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  badge: {
    backgroundColor: '#1d1b16',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  badgeText: {
    color: '#fffaf3',
    fontSize: 12,
    fontWeight: '900',
  },
  title: {
    color: '#1d1b16',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 37,
  },
  description: {
    color: '#625b50',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
  },
  modeTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 22,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 20,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderColor: '#eadfce',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 74,
    padding: 14,
    width: '48%',
  },
  statLabel: {
    color: '#625b50',
    fontSize: 13,
    fontWeight: '700',
  },
  statValue: {
    color: '#1d1b16',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 6,
  },
  savingsCard: {
    backgroundColor: '#eef8f1',
    borderRadius: 8,
    marginTop: 12,
    padding: 16,
  },
  savingsLabel: {
    color: '#26583d',
    fontSize: 14,
    fontWeight: '800',
  },
  savingsValue: {
    color: '#167247',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 2,
  },
  savingsNote: {
    color: '#3f6a52',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  section: {
    backgroundColor: '#ffffff',
    borderColor: '#eadfce',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 18,
  },
  sectionTitle: {
    color: '#1d1b16',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  listItem: {
    color: '#3d372f',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  stepNumber: {
    backgroundColor: '#1d1b16',
    borderRadius: 8,
    color: '#fffaf3',
    fontSize: 13,
    fontWeight: '900',
    height: 25,
    lineHeight: 25,
    overflow: 'hidden',
    textAlign: 'center',
    width: 25,
  },
  stepText: {
    color: '#3d372f',
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  noteCard: {
    backgroundColor: '#f7efe2',
    borderRadius: 8,
    marginTop: 14,
    padding: 18,
  },
  noteTitle: {
    color: '#1d1b16',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
  },
  noteText: {
    color: '#3d372f',
    fontSize: 15,
    lineHeight: 22,
  },
  confidenceText: {
    color: '#625b50',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  actions: {
    gap: 10,
    marginTop: 20,
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
