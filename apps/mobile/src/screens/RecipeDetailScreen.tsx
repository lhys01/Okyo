import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenScaffold } from '../components/ScreenScaffold';
import { defaultRecipe, defaultScanResult } from '../mocks';

export function RecipeDetailScreen() {
  const navigation = useNavigation();

  return (
    <ScreenScaffold
      title={defaultRecipe.title}
      body={`${defaultRecipe.difficulty} copycat recipe. ${defaultRecipe.prepTimeMinutes + defaultRecipe.cookTimeMinutes} minutes total.`}
      primaryActionLabel="Open App Tabs"
      onPrimaryAction={() => navigation.navigate('MainTabs' as never)}
      secondaryActionLabel="Grocery List"
      onSecondaryAction={() => navigation.navigate('GroceryListScreen' as never)}
    >
      <ScrollView style={styles.detailCard} contentContainerStyle={styles.detailContent}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Mode</Text>
          <Text style={styles.statValue}>{defaultRecipe.mode}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Match</Text>
          <Text style={styles.statValue}>{defaultScanResult.matchScore.toFixed(1)}/10</Text>
        </View>
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {defaultRecipe.ingredients.map((ingredient) => (
          <Text key={ingredient.name} style={styles.listItem}>
            {ingredient.quantity} {ingredient.name}
          </Text>
        ))}
        <Text style={styles.sectionTitle}>Steps</Text>
        {defaultRecipe.steps.map((step, index) => (
          <Text key={step} style={styles.listItem}>
            {index + 1}. {step}
          </Text>
        ))}
        <Text style={styles.note}>{defaultRecipe.confidenceNote}</Text>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  detailCard: {
    backgroundColor: '#ffffff',
    borderColor: '#eadfce',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 22,
    maxHeight: 330,
  },
  detailContent: {
    padding: 18,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statLabel: {
    color: '#625b50',
    fontSize: 14,
  },
  statValue: {
    color: '#1d1b16',
    fontSize: 14,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#1d1b16',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 14,
    marginBottom: 8,
  },
  listItem: {
    color: '#3d372f',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 6,
  },
  note: {
    color: '#625b50',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
});
