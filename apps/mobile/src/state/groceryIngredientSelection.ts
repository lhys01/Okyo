import type { RecipeIngredient } from '../mocks';

type GrocerySelectionState = {
  groceryIngredientSelections: Record<string, string[]>;
  groceryRecipeIds: string[];
};

export function toggleGroceryIngredientSelection(
  state: GrocerySelectionState,
  recipeId: string,
  ingredientId: string,
  ingredients: RecipeIngredient[],
): GrocerySelectionState {
  const normalizedId = ingredientId.trim().toLowerCase();
  const allIngredientIds = [...new Set(ingredients.map((item) => item.name.trim().toLowerCase()).filter(Boolean))];
  const currentSelections = state.groceryIngredientSelections[recipeId] ?? [];
  const recipeIsInGroceries = state.groceryRecipeIds.includes(recipeId);
  const selectedIds = recipeIsInGroceries && currentSelections.length === 0 ? allIngredientIds : currentSelections;
  const isSelected = selectedIds.includes(normalizedId);
  const nextSelections = isSelected
    ? selectedIds.filter((id) => id !== normalizedId)
    : [...new Set([...selectedIds, normalizedId])];

  if (nextSelections.length === 0) {
    const { [recipeId]: _removedSelection, ...remainingSelections } = state.groceryIngredientSelections;
    return {
      groceryRecipeIds: state.groceryRecipeIds.filter((id) => id !== recipeId),
      groceryIngredientSelections: remainingSelections,
    };
  }

  return {
    groceryRecipeIds: recipeIsInGroceries ? state.groceryRecipeIds : [...state.groceryRecipeIds, recipeId],
    groceryIngredientSelections: {
      ...state.groceryIngredientSelections,
      [recipeId]: nextSelections,
    },
  };
}
