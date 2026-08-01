export type RecipeSignatureProfile = {
  key: string;
  matches: RegExp;
  requiredIngredientGroups: string[][];
  forbiddenIngredientGroups?: string[][];
  adaptationNote?: RegExp;
};

export const recipeSignatureProfiles: RecipeSignatureProfile[] = [
  { key: 'shrimp_scampi', matches: /shrimp\s+scampi|scampi/i, requiredIngredientGroups: [['shrimp'], ['garlic'], ['butter', 'olive oil'], ['lemon'], ['parsley', 'basil', 'chives', 'dill']], forbiddenIngredientGroups: [['curry powder'], ['teriyaki']] },
  { key: 'tiramisu', matches: /tiramisu/i, requiredIngredientGroups: [['mascarpone'], ['coffee', 'espresso'], ['cocoa'], ['ladyfinger', 'ladyfingers', 'sponge biscuit', 'explicit adaptation']] },
  { key: 'chicken_tikka_masala', matches: /chicken\s+tikka\s+masala|tikka\s+masala/i, requiredIngredientGroups: [['chicken'], ['tomato'], ['cumin', 'coriander', 'garam masala', 'turmeric'], ['yogurt', 'cream', 'coconut milk']] },
  { key: 'vegan_bowl', matches: /vegan\s+(?:grain\s+)?bowl/i, requiredIngredientGroups: [], forbiddenIngredientGroups: [['chicken', 'beef', 'pork', 'lamb', 'fish', 'shrimp', 'egg', 'dairy', 'cheese', 'butter']] },
];

export function getSignatureProfile(title: string, description = '', signatureKey?: string): RecipeSignatureProfile | undefined {
  if (signatureKey) {
    const byKey = recipeSignatureProfiles.find((profile) => profile.key === signatureKey);
    if (byKey) return byKey;
  }
  const text = `${title} ${description}`;
  return recipeSignatureProfiles.find((profile) => profile.matches.test(text));
}

export function validateRecipeSignature(title: string, description: string, ingredients: string[], steps: string[], signatureKey?: string): string[] {
  const profile = getSignatureProfile(title, description, signatureKey);
  if (!profile) return [];
  const ingredientText = ingredients.join(' ').toLowerCase();
  const stepText = steps.join(' ').toLowerCase();
  const issues: string[] = [];
  for (const group of profile.requiredIngredientGroups) {
    if (!group.some((term) => ingredientText.includes(term))) issues.push(`signature_missing:${group[0]}`);
  }
  for (const group of profile.forbiddenIngredientGroups ?? []) {
    if (group.some((term) => ingredientText.includes(term))) issues.push(`signature_conflict:${group[0]}`);
  }
  if (profile.key === 'chicken_tikka_masala') {
    const spices = ['cumin', 'coriander', 'garam masala', 'turmeric'].filter((term) => ingredientText.includes(term));
    for (const spice of spices) if (!stepText.includes(spice)) issues.push(`signature_unused_spice:${spice}`);
  }
  if (profile.key === 'tiramisu' && /\bbake|cake batter|flour\b/i.test(`${title} ${description} ${stepText}`) && !profile.adaptationNote?.test(description)) issues.push('signature_generic_cake');
  return [...new Set(issues)];
}
