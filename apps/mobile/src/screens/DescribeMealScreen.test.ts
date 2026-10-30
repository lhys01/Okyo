import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const source = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'DescribeMealScreen.tsx'), 'utf8');

test('Describe a meal uses the chosen fox name, a food icon, and centered scrollable content', () => {
  assert.match(source, /useChosenMascotName/);
  assert.match(source, /getFoxDisplayName\(chosenFoxName\)/);
  assert.match(source, /Give \{foxName\} a few details/);
  assert.match(source, /PizzaSlice/);
  assert.doesNotMatch(source, /\bSparks\b/);
  assert.match(source, /mainContent: \{[^}]*alignItems: 'center'/);
  assert.match(source, /title: \{[^}]*textAlign: 'center'/);
  assert.match(source, /subtitle: \{[^}]*textAlign: 'center'/);
  assert.match(source, /counter: \{[^}]*textAlign: 'center'/);
  assert.match(source, /<ScrollView[\s\S]*?contentContainerStyle=\{styles\.mainContent\}/);
});

test('Describe a meal keeps its input limit and recipe generation path', () => {
  assert.match(source, /maxLength=\{MAX_MEAL_DESCRIPTION_LENGTH\}/);
  assert.match(source, /validateMealDescription\(description\)/);
  assert.match(source, /startScan\(/);
  assert.match(source, /navigation\.navigate\('AnalysisLoadingScreen'/);
});
