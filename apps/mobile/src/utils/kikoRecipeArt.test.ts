import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  getKikoRecipeArtFileNameForStep,
  KIKO_RECIPE_ART_INVENTORY,
  KIKO_RECIPE_ART_IMAGE_INVENTORY,
  normalizeKikoRecipeStepText,
} from './kikoRecipeArt';

test('the inventory includes every file in kiko-recipe-art exactly once', () => {
  const inventoryFiles = KIKO_RECIPE_ART_INVENTORY.map((entry) => entry.fileName).sort();
  const actualFiles = readdirSync(resolve(process.cwd(), 'assets/kiko-recipe-art')).sort();

  assert.equal(KIKO_RECIPE_ART_IMAGE_INVENTORY.length, 172);
  assert.equal(new Set(inventoryFiles).size, inventoryFiles.length);
  assert.deepEqual(inventoryFiles, actualFiles);
});

test('normalizes punctuation, accents, fractions, spacing, and common plurals', () => {
  assert.equal(
    normalizeKikoRecipeStepText('  Sautéing the TORTILLAS — reserving ½ cup!  '),
    'saute the tortilla reserve half cup',
  );
});

test('matches the requested high-specificity examples without collisions', () => {
  assert.equal(
    getKikoRecipeArtFileNameForStep('Bring the sauce to a gentle simmer.'),
    '737e8367-32c4-4231-a7db-b142afdc66f3.png',
  );
  assert.equal(
    getKikoRecipeArtFileNameForStep('Reserve ½ cup of pasta water before draining.'),
    '5baafde0-e992-4ced-a0c3-da952dbe36fb.png',
  );
  assert.equal(
    getKikoRecipeArtFileNameForStep('Fold the tortilla around the filling.'),
    'ff84f4ac-43ff-4929-a514-17f0185c21ee.png',
  );
});

test('matches preparation actions', () => {
  assert.equal(getKikoRecipeArtFileNameForStep('Mince the garlic until very fine.'), '412145fd-54ea-4662-a535-10e2ba841199.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Grate the carrots.'), '1dba08fc-2537-41d3-96ea-35c00e124e87.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Rinse the vegetables under cool water.'), 'd92d1d12-7e01-412c-b6f2-672633b23cfe.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Pat the salmon dry with paper towel.'), '3381e258-c845-4cb9-9722-d0f251bd2dcd.png');
});

test('matches dough and baking actions', () => {
  assert.equal(getKikoRecipeArtFileNameForStep('Knead the dough until smooth.'), '4b2c4429-04ef-4d7d-a396-d8897f33b295.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Cover the dough and let it rise.'), '1ee819bd-5119-43c8-acac-af85d529eaa5.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Blind bake the tart shell with pie weights.'), '67a91c3a-3414-4973-8c4d-4ef11be6a35e.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Pipe frosting over the cupcakes.'), 'a7291f05-06e0-4478-ab50-ed925509c5dc.png');
});

test('matches boiling and simmering actions', () => {
  assert.equal(getKikoRecipeArtFileNameForStep('Boil the pasta until al dente.'), '01d9ab34-b187-48cf-bb0f-cea201521fa2.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Drain the noodles in a colander.'), '02e7798a-663b-470f-b033-796e3a20df28.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Simmer the chickpeas until tender.'), 'd9066ae1-b6b3-4b07-97f3-e78cb918823e.png');
});

test('matches pan cooking actions', () => {
  assert.equal(getKikoRecipeArtFileNameForStep('Heat the skillet over medium heat.'), '1dc2e0b4-2822-4b49-b0ac-d19cad4e699a.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Sauté the mushrooms until browned.'), 'dcb20fa5-bb8d-4ee4-9281-eada891cb112.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Sear the salmon skin-side down.'), 'ad214418-c7ac-4cf4-9a79-95e498ed1de0.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Brown the ground beef.'), 'af8675da-5620-464c-9d15-68f0978990a8.png');
});

test('matches egg actions', () => {
  assert.equal(getKikoRecipeArtFileNameForStep('Whisk the eggs until combined.'), 'f76167a9-4b55-4b21-8224-1b8e55f03924.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Poach each egg for 3 minutes.'), '10568e1c-08e2-47e5-8717-0573aba98cf8.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Scramble the eggs into soft curds.'), 'cd0ab328-25a3-4ab6-a4d1-80dd43e238ee.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Separate the egg whites from the yolks.'), '44fd30bf-945a-4d48-84cf-670555230bbe.png');
});

test('matches tacos, wraps, and enchiladas', () => {
  assert.equal(getKikoRecipeArtFileNameForStep('Roll each filled tortilla into an enchilada.'), 'e4586aef-6277-438f-8ade-2d1f9a049ec5.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Warm the tortillas in a dry skillet.'), 'f0593657-17d8-4cf9-b0f5-7792bb80cad6.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Assemble the tacos with the filling.'), 'efff858e-dfa3-44ab-ac40-1c53e126935b.png');
});

test('matches finishing and garnishing while leaving uncertain text blank', () => {
  assert.equal(getKikoRecipeArtFileNameForStep('Brush the glaze over the salmon.'), 'dc89a3bb-3524-4aad-b8e6-743cbb48dfdb.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Garnish with chopped parsley.'), '61b7afbf-a4db-4dc9-8c1c-7a36edef00bf.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Tent the steak with foil and rest for 5 minutes.'), '7dd2d0f1-8b68-42f1-b621-810b49f679f3.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Let the flavors settle for a moment.'), null);
});

test('specific rules win over broad cooking words', () => {
  assert.equal(getKikoRecipeArtFileNameForStep('Reserve pasta water, then boil the remaining pasta.'), '5baafde0-e992-4ced-a0c3-da952dbe36fb.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Fold the whipped cream into the batter.'), '6ff9cfc9-dd43-407a-85ef-8b0cdc35f6c4.png');
  assert.equal(getKikoRecipeArtFileNameForStep('Drain the chickpeas, then rinse well.'), '7f3a023d-50d3-457a-b17f-b4f12cd78bc8.png');
});
