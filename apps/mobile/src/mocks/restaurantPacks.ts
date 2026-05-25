import type { RestaurantPack } from './types';

export const mockRestaurantPacks: RestaurantPack[] = [
  {
    id: 'red-lobster-inspired',
    name: 'Red Lobster-inspired',
    dishes: [
      { id: 'red-lobster-cheddar-biscuits', dishName: 'Cheddar-style biscuits', restaurantPrice: 12, homemadeCost: 2.5, estimatedSavings: 9.5, difficulty: 'Easy' },
      { id: 'red-lobster-shrimp-alfredo', dishName: 'Shrimp alfredo', restaurantPrice: 24, homemadeCost: 7.25, estimatedSavings: 16.75, difficulty: 'Medium' },
      { id: 'red-lobster-coconut-shrimp', dishName: 'Coconut shrimp', restaurantPrice: 18, homemadeCost: 7.2, estimatedSavings: 10.8, difficulty: 'Medium' },
    ],
  },
  {
    id: 'starbucks-inspired',
    name: 'Starbucks-inspired',
    dishes: [
      { id: 'starbucks-pink-drink', dishName: 'Pink drink style beverage', restaurantPrice: 7, homemadeCost: 1.8, estimatedSavings: 5.2, difficulty: 'Easy' },
      { id: 'starbucks-cold-brew', dishName: 'Vanilla sweet cream cold brew', restaurantPrice: 6.75, homemadeCost: 1.6, estimatedSavings: 5.15, difficulty: 'Easy' },
      { id: 'starbucks-egg-bites', dishName: 'Egg bites', restaurantPrice: 6.25, homemadeCost: 2.15, estimatedSavings: 4.1, difficulty: 'Medium' },
    ],
  },
  {
    id: 'cava-inspired',
    name: 'Cava-inspired',
    dishes: [
      { id: 'cava-harissa-chicken-bowl', dishName: 'Harissa chicken bowl', restaurantPrice: 17, homemadeCost: 5.9, estimatedSavings: 11.1, difficulty: 'Easy' },
      { id: 'cava-greek-chicken-pita', dishName: 'Greek chicken pita', restaurantPrice: 14, homemadeCost: 4.85, estimatedSavings: 9.15, difficulty: 'Easy' },
    ],
  },
  {
    id: 'sweetgreen-inspired',
    name: 'Sweetgreen-inspired',
    dishes: [
      { id: 'sweetgreen-harvest-bowl', dishName: 'Harvest bowl', restaurantPrice: 18, homemadeCost: 6.2, estimatedSavings: 11.8, difficulty: 'Easy' },
      { id: 'sweetgreen-kale-caesar', dishName: 'Kale caesar with chicken', restaurantPrice: 19, homemadeCost: 6.25, estimatedSavings: 12.75, difficulty: 'Easy' },
    ],
  },
  {
    id: 'cheesecake-factory-inspired',
    name: 'Cheesecake Factory-inspired',
    dishes: [
      { id: 'cheesecake-factory-spicy-vodka-pasta', dishName: 'Spicy vodka-style pasta', restaurantPrice: 38, homemadeCost: 6.4, estimatedSavings: 31.6, difficulty: 'Easy' },
      { id: 'cheesecake-factory-avocado-egg-rolls', dishName: 'Avocado egg rolls', restaurantPrice: 17, homemadeCost: 5.75, estimatedSavings: 11.25, difficulty: 'Medium' },
    ],
  },
  {
    id: 'chipotle-inspired',
    name: 'Chipotle-inspired',
    dishes: [
      { id: 'chipotle-chicken-burrito-bowl', dishName: 'Chicken burrito bowl', restaurantPrice: 14, homemadeCost: 4.8, estimatedSavings: 9.2, difficulty: 'Easy' },
      { id: 'chipotle-guacamole', dishName: 'Guacamole', restaurantPrice: 4, homemadeCost: 1.4, estimatedSavings: 2.6, difficulty: 'Easy' },
    ],
  },
  {
    id: 'erewhon-inspired',
    name: 'Erewhon-inspired',
    dishes: [
      { id: 'erewhon-celebrity-smoothie', dishName: 'Celebrity-style smoothie', restaurantPrice: 19, homemadeCost: 5.5, estimatedSavings: 13.5, difficulty: 'Easy' },
      { id: 'erewhon-wellness-bowl', dishName: 'Wellness bowl', restaurantPrice: 24, homemadeCost: 8.9, estimatedSavings: 15.1, difficulty: 'Easy' },
    ],
  },
];

export const defaultRestaurantPack = mockRestaurantPacks[4];
