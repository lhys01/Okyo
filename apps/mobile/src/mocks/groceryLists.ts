import type { GroceryList } from './types';

export const mockGroceryLists: GroceryList[] = [
  {
    id: 'grocery-spicy-vodka-rigatoni',
    recipeId: 'recipe-spicy-vodka-rigatoni',
    title: 'Spicy Vodka Rigatoni Grocery List',
    items: [
      { category: 'Noodles / Grains', name: 'rigatoni', quantity: '8 oz', sourceIngredient: '8 oz rigatoni' },
      { category: 'Pantry', name: 'tomato paste', quantity: '1 small can or tube', sourceIngredient: '3 tbsp tomato paste' },
      { category: 'Dairy', name: 'heavy cream', quantity: '1 small carton', sourceIngredient: '1/2 cup heavy cream' },
      { category: 'Dairy', name: 'parmesan', quantity: '1 small wedge or tub', sourceIngredient: '1/3 cup grated parmesan' },
      { category: 'Spices', name: 'red pepper flakes', quantity: 'pantry check', pantryItem: true, pantryStaple: true, sourceIngredient: '1 tsp red pepper flakes' },
      { category: 'Pantry', name: 'olive oil', quantity: '1 tbsp', pantryItem: true, pantryStaple: true, sourceIngredient: '2 tbsp olive oil' },
    ],
  },
  {
    id: 'grocery-cheddar-biscuits',
    recipeId: 'recipe-cheddar-biscuits',
    title: 'Cheddar-style Biscuits Grocery List',
    items: [
      { category: 'Pantry', name: 'biscuit mix', quantity: '1 box', sourceIngredient: '2 cups biscuit mix' },
      { category: 'Dairy', name: 'shredded cheddar', quantity: '1 small bag', sourceIngredient: '1 cup shredded cheddar' },
      { category: 'Dairy', name: 'milk', quantity: '1 small carton if needed', sourceIngredient: '2/3 cup milk' },
      { category: 'Dairy', name: 'butter', quantity: '1 stick', sourceIngredient: '4 tbsp butter' },
      { category: 'Spices', name: 'garlic powder', quantity: 'pantry check', pantryItem: true, pantryStaple: true, sourceIngredient: '1/2 tsp garlic powder' },
    ],
  },
  {
    id: 'grocery-cava-grain-bowl',
    recipeId: 'recipe-cava-grain-bowl',
    title: 'Cava-style Grain Bowl Grocery List',
    items: [
      { category: 'Noodles / Grains', name: 'rice, quinoa, or grains', quantity: '1 pouch or 1 cup dry', sourceIngredient: '2 cups cooked grains' },
      { category: 'Protein', name: 'chicken or falafel', quantity: '8 oz', sourceIngredient: '8 oz chicken or falafel' },
      { category: 'Produce', name: 'cucumber', quantity: '1', sourceIngredient: '1 cup chopped cucumber' },
      { category: 'Sauces / Condiments', name: 'hummus', quantity: '1 small tub', sourceIngredient: '1/2 cup hummus' },
      { category: 'Sauces / Condiments', name: 'harissa dressing', quantity: '1 small bottle', sourceIngredient: '1/4 cup harissa dressing' },
      { category: 'Produce', name: 'greens', quantity: '1 small bag', sourceIngredient: '2 cups greens' },
    ],
  },
];

export const defaultGroceryList = mockGroceryLists[0];
