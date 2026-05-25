import type { GroceryList } from './types';

export const mockGroceryLists: GroceryList[] = [
  {
    id: 'grocery-spicy-vodka-rigatoni',
    recipeId: 'recipe-spicy-vodka-rigatoni',
    title: 'Spicy Vodka Rigatoni Grocery List',
    items: [
      { category: 'Pantry', name: 'rigatoni', quantity: '8 oz' },
      { category: 'Pantry', name: 'tomato paste', quantity: '3 tbsp' },
      { category: 'Dairy', name: 'heavy cream', quantity: '1/2 cup' },
      { category: 'Dairy', name: 'parmesan', quantity: '1/3 cup grated' },
      { category: 'Pantry', name: 'red pepper flakes', quantity: '1 tsp', pantryItem: true },
      { category: 'Pantry', name: 'olive oil', quantity: '2 tbsp', pantryItem: true },
    ],
  },
  {
    id: 'grocery-cheddar-biscuits',
    recipeId: 'recipe-cheddar-biscuits',
    title: 'Cheddar-style Biscuits Grocery List',
    items: [
      { category: 'Pantry', name: 'biscuit mix', quantity: '2 cups' },
      { category: 'Dairy', name: 'shredded cheddar', quantity: '1 cup' },
      { category: 'Dairy', name: 'milk', quantity: '2/3 cup' },
      { category: 'Dairy', name: 'butter', quantity: '4 tbsp' },
      { category: 'Pantry', name: 'garlic powder', quantity: '1/2 tsp', pantryItem: true },
    ],
  },
  {
    id: 'grocery-cava-grain-bowl',
    recipeId: 'recipe-cava-grain-bowl',
    title: 'Cava-style Grain Bowl Grocery List',
    items: [
      { category: 'Pantry', name: 'cooked grains', quantity: '2 cups' },
      { category: 'Protein', name: 'chicken or falafel', quantity: '8 oz' },
      { category: 'Produce', name: 'cucumber', quantity: '1 cup chopped' },
      { category: 'Pantry', name: 'hummus', quantity: '1/2 cup' },
      { category: 'Pantry', name: 'harissa dressing', quantity: '1/4 cup' },
      { category: 'Produce', name: 'greens', quantity: '2 cups' },
    ],
  },
];

export const defaultGroceryList = mockGroceryLists[0];
