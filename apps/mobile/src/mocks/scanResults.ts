import type { ScanResult } from './types';

export const mockScanResults: ScanResult[] = [
  {
    id: '001',
    dishName: 'Spicy Vodka Rigatoni',
    bestGuessDishName: 'Spicy Vodka Rigatoni',
    bestGuessNote: 'Clear food scan.',
    scanState: 'clear_food',
    restaurantStyle: 'Italian-American',
    confidence: 0.84,
    matchScore: 8.4,
    difficulty: 'Easy',
    modes: ['Restaurant Copy', 'Budget', 'Healthy'],
    recipeId: 'recipe-spicy-vodka-rigatoni',
  },
  {
    id: '002',
    dishName: 'Cheddar-style Biscuits',
    bestGuessDishName: 'Cheddar-style Biscuits',
    bestGuessNote: 'Clear food scan.',
    scanState: 'clear_food',
    restaurantStyle: 'Seafood chain inspired',
    confidence: 0.88,
    matchScore: 9.1,
    difficulty: 'Easy',
    modes: ['Restaurant Copy', 'Budget', 'Healthy'],
    recipeId: 'recipe-cheddar-biscuits',
  },
  {
    id: '003',
    dishName: 'Cava-style Grain Bowl',
    bestGuessDishName: 'Cava-style Grain Bowl',
    bestGuessNote: 'Clear food scan.',
    scanState: 'clear_food',
    restaurantStyle: 'Mediterranean',
    confidence: 0.81,
    matchScore: 8.2,
    difficulty: 'Easy',
    modes: ['Restaurant Copy', 'Budget', 'Healthy'],
    recipeId: 'recipe-cava-grain-bowl',
  },
];

export const defaultScanResult = mockScanResults[0];
