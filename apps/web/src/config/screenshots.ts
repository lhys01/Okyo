import type { ImageMetadata } from 'astro';

import home from '../assets/screens/home.png';
import scan from '../assets/screens/scan.png';
import recipe from '../assets/screens/recipe.png';
import customize from '../assets/screens/customize.png';
import cook from '../assets/screens/cook.png';
import nutrition from '../assets/screens/nutrition.png';

// Actual app captures from the dedicated iPhone 17 Pro simulator.
// See src/assets/screens/README.md for provenance and recapture instructions.

export type ScreenshotSlotName = 'home' | 'scan' | 'recipe' | 'nutrition' | 'customize' | 'cook';

export interface ScreenshotSlotConfig {
  /** Alt text for the real screenshot. */
  alt: string;
  /** What must be captured, shown on the local-review placeholder. */
  capture: string;
  image: ImageMetadata | null;
}

export const SCREENSHOTS: Record<ScreenshotSlotName, ScreenshotSlotConfig> = {
  home: {
    alt: 'Okyo Home screen with daily macros, a first-dish prompt, and meal ideas',
    capture: 'Home screen',
    image: home,
  },
  scan: {
    alt: 'Okyo Add a dish sheet with options to take a photo, upload a photo, or describe a dish',
    capture: 'Add a dish sheet',
    image: scan,
  },
  recipe: {
    alt: 'Okyo recipe result with the dish title, ingredients, and estimated make-at-home cost',
    capture: 'Recipe with cost',
    image: recipe,
  },
  nutrition: {
    alt: 'Okyo recipe nutrition estimates for calories, protein, carbohydrates, and fat',
    capture: 'Nutrition estimates',
    image: nutrition,
  },
  customize: {
    alt: 'Okyo Customize recipe sheet with plain-words input and suggested changes',
    capture: 'Recipe change',
    image: customize,
  },
  cook: {
    alt: 'Okyo Cook Mode showing one recipe step at a time',
    capture: 'Cook Mode',
    image: cook,
  },
};
