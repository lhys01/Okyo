import { z } from 'zod';

const maxRecipeJsonChars = 250_000;
const maxRecipeTitleChars = 300;
const maxRecipeItems = 250;

/**
 * Recipe Check and Make It Mine accept flexible recipe shapes from the mobile
 * client, but the flexibility must not turn the 16 MB scan upload allowance
 * into an unbounded recipe-processing surface.
 */
export const recipeCheckRecipeSchema = z.object({}).passthrough().superRefine((recipe, ctx) => {
  const title = typeof recipe.title === 'string' && recipe.title.trim().length > 0;
  const ingredients = Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0;
  const steps = Array.isArray(recipe.steps) && recipe.steps.length > 0;
  const structuredSteps = Array.isArray(recipe.structuredSteps) && recipe.structuredSteps.length > 0;

  if (!title && !ingredients && !steps && !structuredSteps) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Recipe needs a title, ingredients, or steps.',
    });
  }

  if (typeof recipe.title === 'string' && recipe.title.length > maxRecipeTitleChars) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['title'],
      message: 'Recipe title is too long.',
    });
  }

  for (const key of ['ingredients', 'steps', 'structuredSteps'] as const) {
    const value = recipe[key];
    if (Array.isArray(value) && value.length > maxRecipeItems) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `Recipe ${key} exceeds the ${maxRecipeItems}-item limit.`,
      });
    }
  }

  if (JSON.stringify(recipe).length > maxRecipeJsonChars) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Recipe payload is too large.',
    });
  }
});
