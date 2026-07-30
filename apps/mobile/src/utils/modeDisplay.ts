// Single source for how a recipe mode is shown as a categorical chip across
// screens (Savings, Library, Grocery). The chip color is driven by the mode
// itself, not decoration — same idea as right-aligning numbers by place value.
import { colors } from '../components/OkyoUI';
import type { RecipeMode } from '../mocks';

export function getModeLabel(mode: RecipeMode): string {
  switch (mode) {
    case 'Lighter':
      return 'Lighter';
    case 'Healthier':
      return 'Healthier';
    case 'More Protein':
      return 'More Protein';
    case 'Normal':
    default:
      return 'Normal';
  }
}

export type ModeChipPalette = { bg: string; text: string };

export function getModeChipPalette(mode: RecipeMode): ModeChipPalette {
  switch (mode) {
    case 'Lighter':
      return { bg: '#fff1df', text: '#9a5a17' };
    case 'Healthier':
      return { bg: colors.greenSoft, text: colors.green };
    case 'More Protein':
      return { bg: colors.coralSoft, text: colors.coralDark };
    case 'Normal':
    default:
      return { bg: colors.coralSoft, text: colors.coralDark };
  }
}
