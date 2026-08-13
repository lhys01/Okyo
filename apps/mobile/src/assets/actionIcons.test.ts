import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('customize and in-content grocery actions use the supplied artwork', () => {
  const recipeActions = read('src/components/RecipePrimaryActions.tsx');
  const ingredients = read('src/components/RecipeIngredientsAssistant.tsx');
  const library = read('src/screens/LibraryScreen.tsx');

  assert.match(recipeActions, /source=\{actionIcons\.customize\}/);
  assert.match(recipeActions, /source=\{actionIcons\.grocery\}/);
  assert.match(ingredients, /source=\{actionIcons\.grocery\}/);
  assert.match(library, /source=\{actionIcons\.grocery\}/);
});

test('the bottom navigation retains its existing grocery tab icon', () => {
  const tabs = read('src/navigation/MainTabs.tsx');
  assert.match(tabs, /case 'GroceryListScreen':[\s\S]*?<Cart /);
});
