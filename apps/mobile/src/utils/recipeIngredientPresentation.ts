import type { Recipe } from '../mocks';

/**
 * Keep useful multi-item recipe components as headings, but present one-item
 * components together as a single ingredient list instead of isolated sections.
 * Ingredient objects and their order/quantities are left untouched.
 */
export function getRecipeIngredientDisplayGroups(
  recipe: Pick<Recipe, 'ingredients' | 'ingredientGroups'>,
) {
  const sourceGroups = recipe.ingredientGroups?.length
    ? recipe.ingredientGroups
    : [{ component: '', items: recipe.ingredients }];
  const displayGroups: Array<{ component: string; items: Recipe['ingredients'] }> = [];
  let unsectionedItems: Recipe['ingredients'] = [];

  const flushUnsectioned = () => {
    if (unsectionedItems.length === 0) return;
    displayGroups.push({ component: '', items: unsectionedItems });
    unsectionedItems = [];
  };

  for (const group of sourceGroups) {
    if (group.items.length === 0) continue;
    const title = group.component.trim();
    if (title && group.items.length > 1 && !isGenericGroupTitle(title)) {
      flushUnsectioned();
      displayGroups.push({ component: title, items: group.items });
    } else {
      unsectionedItems.push(...group.items);
    }
  }

  flushUnsectioned();
  return displayGroups;
}

function isGenericGroupTitle(value: string) {
  return /^(main|ingredients?|finishing|for serving|to serve|serving|garnish|optional garnish)$/i.test(value.trim());
}
