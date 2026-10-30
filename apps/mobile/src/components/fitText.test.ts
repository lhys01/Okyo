import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('FitText shrinks only to keep fixed-cell copy on one line', () => {
  const fitText = source('src/components/FitText.tsx');
  assert.match(fitText, /adjustsFontSizeToFit/);
  assert.match(fitText, /numberOfLines = 1/);
  assert.match(fitText, /minimumFontScale = 0\.65/);
  assert.doesNotMatch(fitText, /fontSize\s*:/, 'FitText must not override the caller’s normal font size');
});

test('fixed metric, nutrition, recipe-time, and savings values use fit-to-content text', () => {
  const expectations: Array<[string, RegExp]> = [
    ['src/components/home/MetricCard.tsx', /<FitText[^>]*style=\{\[styles\.value/],
    ['src/components/home/MetricCard.tsx', /<FitText[^>]*style=\{styles\.statValue/],
    ['src/components/RecipeNutritionCards.tsx', /<FitText[^>]*style=\{\[styles\.macroValue/],
    ['src/components/RecipeAssistantOverview.tsx', /<FitText[^>]*style=\{styles\.factValue/],
    ['src/components/RecipeAssistantOverview.tsx', /<FitText[^>]*style=\{styles\.costValue/],
    ['src/components/home/RecentDishCard.tsx', /<FitText[^>]*style=\{styles\.metaText/],
    ['src/screens/RecipeDetailScreen.tsx', /<FitText[^>]*style=\{styles\.guidedHeaderTotal/],
    ['src/screens/SavingsDashboardScreen.tsx', /<FitText[^>]*style=\{styles\.biggestSavings/],
    ['src/screens/StatsProgressScreen.tsx', /<FitText[^>]*style=\{styles\.heroValue/],
    ['src/screens/ProfileScreen.tsx', /<FitText[^>]*style=\{styles\.statValue/],
  ];
  for (const [path, pattern] of expectations) assert.match(source(path), pattern, `${path} should fit its fixed-width value`);
});

test('units and related timing/currency context stay in the same fitted text run', () => {
  const nutrition = source('src/components/RecipeNutritionCards.tsx');
  const facts = source('src/components/RecipeAssistantOverview.tsx');
  const savings = source('src/screens/SavingsDashboardScreen.tsx');
  assert.match(nutrition, /value: `\$\{nutrition\.proteinGrams\} g`/);
  assert.match(facts, /\[formatMinutes\(timing\.totalMinutes\), 'Total'\]/);
  assert.match(savings, /Restaurant \{formatCurrency\(biggestWin\.restaurantCost\)\}[\s\S]*Home \{formatCurrency\(biggestWin\.homeCost\)\}/);
});
