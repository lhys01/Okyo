const explicitPlatterTerms = [
  'platter',
  'sampler',
  'assortment',
  'charcuterie',
  'bento',
  'dim sum',
  'mezze',
  'tapas',
  'thali',
  'mixed grill',
  'combo plate',
  'combination plate',
  'combo meal',
  'combination meal',
  'surf and turf',
  'cheese board',
  'grazing board',
  'snack board',
  'food spread',
];

export function isGenuinePlatterMeal(analysis: {
  dishName: string;
  broadDishCategory: string;
}): boolean {
  if (analysis.broadDishCategory.trim().toLowerCase() === 'mixed platter') {
    return true;
  }
  const text = `${analysis.dishName} ${analysis.broadDishCategory}`.toLowerCase();
  return explicitPlatterTerms.some((term) => text.includes(term));
}
