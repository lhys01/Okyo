type RecipeEquipmentSource = {
  equipment?: unknown;
  structuredSteps?: Array<{ toolsUsed?: unknown; tools?: unknown }> | null;
};

/** Combine the recipe equipment list with tools explicitly required by steps. */
export function getRequiredRecipeEquipment(recipe: RecipeEquipmentSource | null | undefined): string[] {
  const equipment = Array.isArray(recipe?.equipment) ? recipe.equipment : [];
  const stepTools = (recipe?.structuredSteps ?? []).flatMap((step) => [
    ...(Array.isArray(step.toolsUsed) ? step.toolsUsed : []),
    ...(Array.isArray(step.tools) ? step.tools : []),
  ]);
  const unique = new Map<string, string>();
  for (const value of [...equipment, ...stepTools]) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const name = value.trim();
    const key = name.toLocaleLowerCase();
    if (!unique.has(key)) unique.set(key, name);
  }
  return [...unique.values()];
}
