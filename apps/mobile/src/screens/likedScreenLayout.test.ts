import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(process.cwd(), 'src/screens/LibraryScreen.tsx'), 'utf8');

test('liked filters stay content-sized and cards follow directly beneath them in the vertical scroller', () => {
  const searchIndex = source.indexOf('<View style={styles.searchRow}>');
  const filtersIndex = source.indexOf('<ScrollView horizontal');
  const cardsIndex = source.indexOf('<View style={styles.recipeList}>');
  assert.ok(searchIndex >= 0 && filtersIndex > searchIndex && cardsIndex > filtersIndex);
  assert.match(source, /<ScrollView horizontal[^>]*style=\{styles\.filterScroll\}/);
  assert.match(source, /filterScroll: \{\s*flexGrow: 0,\s*flexShrink: 0,\s*height: 40/);
  assert.match(source, /<ScrollView ref=\{scrollRef\} contentContainerStyle=\{styles\.screenContent\}/);
  assert.doesNotMatch(source, /emptyArtTour|tourActive && \{ paddingBottom:/);
  assert.doesNotMatch(source, /screenContent:[\s\S]{0,180}justifyContent: 'space-between'/);
});

test('liked recipe cards keep their image, title, metadata, price, and both actions compact and aligned', () => {
  assert.match(source, /<RecipeThumb recipe=\{recipe\} \/>/);
  assert.match(source, /<Text numberOfLines=\{2\} style=\{styles\.recipeTitle\}>/);
  assert.match(source, /getTotalTime\(recipe\)\} min[\s\S]*protein/);
  assert.match(source, /Home est\.[\s\S]*formatCurrency/);
  assert.match(source, />Cook again</);
  assert.match(source, />Groceries</);
  assert.match(source, /recipeImage:[\s\S]{0,120}height: 84,\s*width: 84/);
  assert.match(source, /recipeTitle:[\s\S]{0,180}fontSize: 16/);
  assert.match(source, /cookButton:[\s\S]{0,220}minHeight: 38/);
});

test('liked screen retains distinct empty-library and filtered-no-match states', () => {
  assert.match(source, /if \(safeSavedRecipes\.length === 0\)/);
  assert.match(source, /No liked recipes yet/);
  assert.match(source, /filteredRecipes\.length > 0/);
  assert.match(source, /No recipes match that yet\./);
});
