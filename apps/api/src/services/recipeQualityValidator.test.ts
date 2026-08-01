import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveDishAnatomy, deriveDishContract, isPlaceholderIngredientName } from './dishAnatomy.js';
import { deriveFlavorPlan } from './flavorPlan.js';
import { getLaminatedCroissantProofDiagnostics, validateRecipeQuality } from './recipeQualityValidator.js';

const analysis = (dishName: string, visibleIngredients: string[] = [], visibleComponents: Record<string, string> = {}) => ({
  dishName, broadDishCategory: 'dessert', cuisine: 'test', confidence: 0.9,
  visibleIngredients, likelyIngredients: visibleIngredients, visibleComponents,
});

const steps = (...values: string[]) => values.map((text) => ({ text }));

test('filled croissant requires leaf filling ingredients and preparation/assembly/baking', () => {
  const input = analysis('Filled Fruit Croissant', ['croissant', 'dark fruit'], { baseStarch: 'croissant', toppingsGarnish: 'fruit filling' });
  const contract = deriveDishContract(input, deriveDishAnatomy(input));
  const incomplete = validateRecipeQuality({ title: 'Plain Croissant', ingredients: ['1 croissant'], steps: steps('Bake croissant', 'Serve croissant') }, input, undefined, contract);
  assert.ok(incomplete.some((issue) => issue.startsWith('missing_component')));
  const complete = validateRecipeQuality({ title: 'Dark Fruit-Filled Croissant', ingredients: ['1 sheet puff pastry', '1/2 cup mixed berries', '2 tbsp sugar', '1 tsp lemon juice'], ingredientGroups: [{ component: 'Filling', items: ['1/2 cup mixed berries', '2 tbsp sugar'] }], steps: steps('Cook mixed berries with sugar and lemon juice', 'Fill pastry with mixed berries', 'Assemble and seal the croissant', 'Bake pastry until golden', 'Serve') }, input, undefined, contract);
  assert.deepEqual(complete.filter((issue) => issue.startsWith('missing_component') || issue === 'non_leaf_component_ingredient'), []);
});

test('plain croissants stay pastry and do not acquire a filling contract', () => {
  const input = analysis('Plain Croissant', ['croissant'], { baseStarch: 'croissant' });
  const anatomy = deriveDishAnatomy(input);
  assert.equal(anatomy.dishFamily, 'pastry');
  assert.equal(anatomy.primaryComponents.some((item) => item.role === 'filling'), false);
  assert.equal(deriveDishContract(input, anatomy).requiredComponents.some((item) => item.role === 'filling'), false);
});

test('negated pastry descriptions override generic filling words without hiding real fillings', () => {
  for (const description of [
    'A plain butter croissant with no filling',
    'Plain unfilled croissant',
    'Croissant without jam or cream',
    'Not stuffed croissant',
    'No custard inside croissant',
    'Regular butter croissant',
  ]) {
    const input = analysis(description);
    const anatomy = deriveDishAnatomy(input);
    assert.equal(anatomy.dishFamily, 'pastry', description);
    assert.equal(anatomy.primaryComponents.some((item) => item.role === 'filling'), false, description);
    assert.equal(deriveDishContract(input, anatomy).requiredComponents.some((item) => item.role === 'filling'), false, description);
    assert.deepEqual(deriveFlavorPlan(input), {
      aromatics: [], coreSeasonings: [], balancingElements: [], finishingElements: [],
    }, description);
  }

  for (const description of [
    'Plum-filled croissant',
    'Croissant with cherry jam inside',
    'Chocolate-stuffed croissant',
    'Visible cream filling croissant',
    'Fruit filling in the center croissant',
    'Croissant cut open with a dark filling',
    'Not cream-filled; it has plum jam inside',
  ]) {
    const anatomy = deriveDishAnatomy(description.startsWith('Not cream-filled')
      ? { ...analysis('Croissant'), mealDescription: description }
      : analysis(description));
    assert.equal(anatomy.dishFamily, 'filled_pastry', description);
    assert.equal(anatomy.primaryComponents.some((item) => item.role === 'filling'), true, description);
  }
});

test('pastry filling evidence is required before classifying a croissant as filled', () => {
  const input = analysis('Fruit-Filled Croissant', ['croissant', 'plum jam'], { baseStarch: 'croissant', sauce: 'plum jam' });
  assert.equal(deriveDishAnatomy(input).dishFamily, 'filled_pastry');
});

test('a Filling group contains real leaf ingredients and never a literal filling ingredient', () => {
  const input = analysis('Filled Fruit Croissant', ['fruit']);
  const contract = deriveDishContract(input, deriveDishAnatomy(input));
  const issues = validateRecipeQuality({ title: 'Fruit-Filled Croissant', ingredients: ['1 croissant', '1 filling'], ingredientGroups: [{ component: 'Filling', items: ['1 filling'] }], steps: steps('Fill pastry', 'Assemble pastry', 'Bake pastry', 'Serve') }, input, undefined, contract);
  assert.ok(issues.includes('non_leaf_component_ingredient'));
});

test('placeholder detection is exact enough to preserve legitimate composite ingredients', () => {
  for (const value of ['croissant dough', 'puff pastry', 'dumpling wrappers', 'plum jam', 'cherry preserves', 'fruit purée']) {
    assert.equal(isPlaceholderIngredientName(value), false, value);
  }
  for (const value of ['filling', 'cooked filling', 'finished filling', 'finished dish', 'prepared dish', 'croissant', 'dumplings']) {
    assert.equal(isPlaceholderIngredientName(value), true, value);
  }
  const input = analysis('Filled Pastry', ['croissant', 'fruit filling']);
  const contract = deriveDishContract(input, deriveDishAnatomy(input));
  for (const ingredient of ['1 cup croissant dough', '1 package dumpling wrappers', '1/2 cup plum jam', '1/2 cup cherry preserves']) {
    const issues = validateRecipeQuality({ title: 'Filled Pastry', ingredients: [ingredient, '1/2 cup plum jam'], steps: steps('Fill pastry', 'Assemble pastry', 'Bake pastry', 'Serve') }, input, undefined, contract);
    assert.equal(issues.includes('non_leaf_component_ingredient'), false, ingredient);
  }
});

test('signature profiles enforce scampi, tiramisu, tikka masala, and vegan bowl identity', () => {
  const scampi = analysis('Shrimp Scampi', ['shrimp', 'garlic', 'butter', 'lemon', 'parsley']);
  assert.deepEqual(validateRecipeQuality({ title: 'Shrimp Scampi', ingredients: ['1 lb shrimp', '3 cloves garlic', '2 tbsp butter', '1 lemon', '2 tbsp parsley'], steps: steps('Cook shrimp', 'Sauté garlic', 'Melt butter', 'Add lemon', 'Finish with parsley') }, scampi), []);
  const conflict = validateRecipeQuality({ title: 'Shrimp Scampi', ingredients: ['1 lb shrimp', '1 tbsp curry powder', '2 tbsp teriyaki'], steps: steps('Cook shrimp', 'Add curry powder', 'Add teriyaki', 'Serve', 'Finish') }, scampi);
  assert.ok(conflict.some((issue) => issue.startsWith('signature_missing') || issue.startsWith('signature_conflict')));
  const tiramisu = analysis('Tiramisu');
  assert.ok(validateRecipeQuality({ title: 'Tiramisu', ingredients: ['8 oz mascarpone', '1 cup espresso', '2 tbsp cocoa powder', '12 ladyfingers'], steps: steps('Brew espresso', 'Dip ladyfingers', 'Whisk mascarpone', 'Layer cream', 'Dust cocoa') }, tiramisu).length === 0);
  const tikka = analysis('Chicken Tikka Masala');
  const tikkaIssues = validateRecipeQuality({ title: 'Chicken Tikka Masala', ingredients: ['1 lb chicken', '1 cup tomato', '1 tsp cumin', '1 tsp coriander', '1 tsp garam masala', '1/2 cup cream'], steps: steps('Cook chicken', 'Bloom cumin', 'Add coriander', 'Simmer tomato', 'Finish with cream') }, tikka);
  assert.ok(tikkaIssues.includes('signature_unused_spice:garam masala'));
  const vegan = analysis('Vegan Bowl');
  assert.ok(validateRecipeQuality({ title: 'Vegan Bowl', ingredients: ['1 cup rice', '1/2 cup chickpeas', '1 tbsp olive oil', '1 lemon'], steps: steps('Cook rice', 'Warm chickpeas', 'Add olive oil', 'Squeeze lemon', 'Serve') }, vegan).length === 0);
});

test('flavor plan stays deliberate, dish-appropriate, and requires every planned flavor element in a step', () => {
  const scampi = analysis('Shrimp Scampi', ['shrimp']);
  const plan = deriveFlavorPlan(scampi);
  const flavorIssues = validateRecipeQuality({ title: 'Shrimp Scampi', ingredients: ['1 lb shrimp', '3 cloves garlic', '1/4 tsp black pepper', '2 tbsp lemon juice', '2 tbsp butter', '2 tbsp parsley'], steps: steps('Sauté garlic', 'Season shrimp with black pepper', 'Cook shrimp', 'Add lemon juice and butter', 'Finish with parsley') }, scampi, plan);
  assert.deepEqual(flavorIssues.filter((issue) => issue.startsWith('flavor_')), []);
  assert.equal(plan.coreSeasonings.some((item) => item.ingredient === 'curry powder'), false);
  const dessertPlan = deriveFlavorPlan(analysis('Chocolate Dessert'));
  assert.equal(dessertPlan.coreSeasonings.some((item) => /curry|teriyaki/i.test(item.ingredient)), false);
});

test('uncertain fruit filling uses a truthful generic anatomy/name path', () => {
  const input = analysis('Fruit Croissant', ['croissant', 'fruit filling'], { baseStarch: 'croissant', toppingsGarnish: 'fruit filling' });
  const anatomy = deriveDishAnatomy({ ...input, confidence: 0.42 });
  assert.ok(anatomy.uncertainComponents.includes('fruit filling identity'));
  assert.match(anatomy.primaryComponents.find((item) => item.role === 'filling')?.description ?? '', /dark fruit|visible pastry filling/);
  const contract = deriveDishContract({ ...input, confidence: 0.42 }, anatomy);
  for (const leaf of ['plum', 'cherry', 'mixed berries', 'fruit purée', 'jam', 'preserves']) {
    const issues = validateRecipeQuality({ title: 'Dark Fruit-Filled Croissant', ingredients: ['1 sheet puff pastry', `1/2 cup ${leaf}`], steps: steps(`Cook ${leaf}`, `Fill pastry with ${leaf}`, `Assemble ${leaf} croissant`, 'Bake pastry', 'Serve') }, input, undefined, contract);
    assert.equal(issues.some((issue) => issue === 'missing_component:filling'), false, leaf);
  }
});

test('signature identity remains enforced when the generated title changes', () => {
  const scampi = analysis('Shrimp Scampi', ['shrimp', 'garlic', 'lemon', 'butter', 'parsley']);
  const anatomy = deriveDishAnatomy(scampi);
  const contract = deriveDishContract(scampi, anatomy);
  const issues = validateRecipeQuality({ title: 'Curry Shrimp', ingredients: ['1 lb shrimp', '1 tbsp curry powder'], steps: steps('Cook shrimp', 'Add curry powder', 'Serve', 'Finish', 'Plate') }, scampi, undefined, contract);
  assert.ok(issues.some((issue) => issue.startsWith('signature_missing:')));

  const tiramisu = analysis('Tiramisu');
  const tiramisuContract = deriveDishContract(tiramisu, deriveDishAnatomy(tiramisu));
  assert.ok(validateRecipeQuality({ title: 'Generic Cake', ingredients: ['1 cup flour'], steps: steps('Mix flour', 'Bake cake', 'Cool cake', 'Slice cake', 'Serve') }, tiramisu, undefined, tiramisuContract).some((issue) => issue.startsWith('signature_missing:')));

  const tikka = analysis('Chicken Tikka Masala');
  const tikkaContract = deriveDishContract(tikka, deriveDishAnatomy(tikka));
  assert.ok(validateRecipeQuality({ title: 'Curry Chicken', ingredients: ['1 lb chicken', '1 cup tomato'], steps: steps('Cook chicken', 'Simmer tomato', 'Serve', 'Finish', 'Plate') }, tikka, undefined, tikkaContract).some((issue) => issue.startsWith('signature_missing:')));

  const vegan = analysis('Vegan Bowl');
  const veganContract = deriveDishContract(vegan, deriveDishAnatomy(vegan));
  assert.ok(validateRecipeQuality({ title: 'Protein Bowl', ingredients: ['1 cup chicken', '1 cup rice'], steps: steps('Cook chicken', 'Cook rice', 'Assemble bowl', 'Finish bowl', 'Serve') }, vegan, undefined, veganContract).some((issue) => issue === 'signature_conflict:chicken'));
});

test('yeast-laminated croissants require a final proof after shaping and before baking', () => {
  const input = analysis('Yeast Laminated Croissant', ['croissant dough', 'yeast', 'butter']);
  const missing = validateRecipeQuality({
    title: 'Butter Croissant',
    ingredients: ['1 cup croissant dough', '1 tsp yeast', '2 tbsp butter'],
    steps: steps('Mix yeast into the dough', 'Shape the croissants', 'Brush with egg wash', 'Bake for 18 minutes'),
  }, input);
  assert.ok(missing.includes('missing_final_proof'));
  assert.deepEqual(getLaminatedCroissantProofDiagnostics([
    'Let the dough rise for 60 minutes.',
    'Shape the croissants.',
    'Brush with egg wash.',
    'Bake for 18 minutes.',
  ]), { shapingIndex: 1, proofIndex: -1, eggWashIndex: 2, bakeIndex: 3 });

  const complete = validateRecipeQuality({
    title: 'Butter Croissant',
    ingredients: ['1 cup croissant dough', '1 tsp yeast', '2 tbsp butter'],
    steps: steps('Mix yeast into the dough', 'Shape the croissants', 'Let the shaped croissants proof for 1 hour until puffy', 'Brush with egg wash', 'Bake for 18 minutes'),
  }, input);
  assert.equal(complete.includes('missing_final_proof'), false);
  assert.equal(complete.includes('invalid_final_proof_duration'), false);

  const puffPastry = validateRecipeQuality({
    title: 'Puff Pastry Croissant',
    ingredients: ['1 sheet puff pastry', '2 tbsp butter'],
    steps: steps('Cut puff pastry into triangles', 'Shape the pastries', 'Brush with egg wash', 'Bake for 18 minutes'),
  }, analysis('Puff Pastry Croissant', ['puff pastry']));
  assert.equal(puffPastry.includes('missing_final_proof'), false);
});

test('recognized final proof wording passes with a realistic duration', () => {
  const input = analysis('Yeast Laminated Croissant', ['croissant dough', 'yeast']);
  const issues = validateRecipeQuality({
    title: 'Butter Croissant',
    ingredients: ['1 cup croissant dough', '1 tsp yeast'],
    steps: steps('Shape the croissants', 'Rest until puffy for 45 minutes', 'Brush with egg wash', 'Bake for 18 minutes'),
  }, input);
  assert.equal(issues.includes('missing_final_proof'), false);
  assert.equal(issues.includes('invalid_final_proof_duration'), false);
});

test('lamination cannot claim repeated chilling without stating a wait duration', () => {
  const input = analysis('Yeast Laminated Croissant', ['croissant dough', 'yeast', 'butter']);
  const issues = validateRecipeQuality({
    title: 'Butter Croissant',
    ingredients: ['1 cup croissant dough', '1 tsp yeast', '2 tbsp butter'],
    steps: steps(
      'Roll out and fold the dough into thirds; repeat this process 3 times, chilling between folds.',
      'Shape the croissants',
      'Rest until puffy for 45 minutes',
      'Brush with egg wash',
      'Bake for 18 minutes',
    ),
  }, input);
  assert.ok(issues.includes('missing_lamination_wait_duration'));
});

test('generic dough formation is not mistaken for final croissant shaping', () => {
  assert.deepEqual(getLaminatedCroissantProofDiagnostics([
    'Form the dough into a ball and let rise for 60 minutes.',
    'Roll into a rectangle and fold into thirds to laminate the dough.',
    'Shape the croissants into crescents.',
    'Rest until puffy for 45 minutes.',
    'Brush with egg wash.',
    'Bake for 18 minutes.',
  ]), { shapingIndex: 2, proofIndex: 3, eggWashIndex: 4, bakeIndex: 5 });
  assert.deepEqual(getLaminatedCroissantProofDiagnostics([
    'Shape the croissant dough into a ball.',
    'Brush with egg wash.',
    'Bake for 18 minutes.',
  ]), { shapingIndex: -1, proofIndex: -1, eggWashIndex: 1, bakeIndex: 2 });
  assert.deepEqual(getLaminatedCroissantProofDiagnostics([
    'Form the dough into a ball.',
    'Roll into a rectangle.',
    'Fold into thirds.',
    'Brush with egg wash.',
    'Bake for 18 minutes.',
  ]), { shapingIndex: -1, proofIndex: -1, eggWashIndex: 3, bakeIndex: 4 });
});
