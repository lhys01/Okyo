// Recipe-surface aliases over the core Okyo tokens. Historically this file
// carried its own palette (a second brand orange, a second charcoal); it now
// maps every key onto okyoTheme so recipe screens share the one visual system.
import { colors, shadows } from './okyoTheme';

export const recipeColors = {
  background: colors.background,
  card: colors.card,
  orange: colors.coral,
  orangeDeep: colors.coralDark,
  orangeSoft: colors.coralSoft,
  charcoal: colors.charcoal,
  text: colors.charcoal,
  muted: colors.muted,
  border: colors.border,
  cream: colors.cream,
  creamDeep: colors.creamDeep,
  green: colors.green,
  greenSoft: colors.greenSoft,
  yellowSoft: '#f9efce',
  // Kept for the few info chips that use them; warmed toward the palette so
  // they no longer read as an off-brand blue.
  blue: '#46707c',
  blueSoft: '#e9f1f2',
};

export const recipeShadows = {
  card: shadows.card,
  hero: shadows.hero,
};
