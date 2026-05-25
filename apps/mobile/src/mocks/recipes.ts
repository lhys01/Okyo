import type { Recipe } from './types';

export const mockRecipes: Recipe[] = [
  {
    id: 'recipe-spicy-vodka-rigatoni',
    scanResultId: '001',
    title: 'Spicy Vodka Rigatoni',
    mode: 'Restaurant Copy',
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      { name: 'rigatoni', quantity: '8 oz' },
      { name: 'tomato paste', quantity: '3 tbsp' },
      { name: 'heavy cream', quantity: '1/2 cup' },
      { name: 'parmesan', quantity: '1/3 cup grated' },
      { name: 'red pepper flakes', quantity: '1 tsp', pantryItem: true },
      { name: 'olive oil', quantity: '2 tbsp', pantryItem: true },
    ],
    steps: [
      'Boil rigatoni until just shy of al dente.',
      'Bloom tomato paste and red pepper flakes in olive oil.',
      'Stir in cream, parmesan, and pasta water to make a glossy sauce.',
      'Toss pasta in the sauce and adjust seasoning before serving.',
    ],
    confidenceNote: 'Mock recipe based on the visible dish style; ingredients and costs are estimates.',
  },
  {
    id: 'recipe-cheddar-biscuits',
    scanResultId: '002',
    title: 'Cheddar-style Biscuits',
    mode: 'Restaurant Copy',
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    servings: 6,
    difficulty: 'Easy',
    ingredients: [
      { name: 'biscuit mix', quantity: '2 cups' },
      { name: 'shredded cheddar', quantity: '1 cup' },
      { name: 'milk', quantity: '2/3 cup' },
      { name: 'butter', quantity: '4 tbsp' },
      { name: 'garlic powder', quantity: '1/2 tsp', pantryItem: true },
    ],
    steps: [
      'Mix biscuit mix, cheddar, and milk until a soft dough forms.',
      'Scoop onto a baking sheet and bake until golden.',
      'Brush with melted garlic butter before serving.',
    ],
    confidenceNote: 'Mock recipe inspired by seafood-chain cheddar biscuits; values are estimates.',
  },
  {
    id: 'recipe-cava-grain-bowl',
    scanResultId: '003',
    title: 'Cava-style Grain Bowl',
    mode: 'Healthy',
    prepTimeMinutes: 15,
    cookTimeMinutes: 10,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      { name: 'cooked grains', quantity: '2 cups' },
      { name: 'chicken or falafel', quantity: '8 oz' },
      { name: 'cucumber', quantity: '1 cup chopped' },
      { name: 'hummus', quantity: '1/2 cup' },
      { name: 'harissa dressing', quantity: '1/4 cup' },
      { name: 'greens', quantity: '2 cups' },
    ],
    steps: [
      'Layer grains and greens in bowls.',
      'Add protein, cucumber, hummus, and dressing.',
      'Finish with herbs or extra sauce to taste.',
    ],
    confidenceNote: 'Mock bowl composition based on the seed result; nutrition and costs are estimates.',
  },
];

export const defaultRecipe = mockRecipes[0];
