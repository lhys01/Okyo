// Single source for how a recipe mode is shown as a categorical chip across
// recipe surfaces. The color is driven by the mode itself, not decoration.
import { colors } from '../theme/okyoTheme';
import type { RecipeMode } from '../mocks';

export function getModeLabel(mode: RecipeMode): string {
  switch (mode) {
    case 'Budget':
      return 'Budget';
    case 'Healthy':
      return 'Lighter';
    case 'Restaurant Copy':
    default:
      return 'Restaurant Style';
  }
}

export type ModeChipPalette = { bg: string; text: string };

export function getModeChipPalette(mode: RecipeMode): ModeChipPalette {
  switch (mode) {
    case 'Budget':
      return { bg: '#fff1df', text: '#9a5a17' };
    case 'Healthy':
      return { bg: colors.greenSoft, text: colors.green };
    case 'Restaurant Copy':
    default:
      return { bg: colors.coralSoft, text: colors.coralDark };
  }
}
