import type { GroceryCategory, GroceryListItem, Recipe, RecipeIngredient } from '../mocks';

export type SmartGroceryPriority = 'needToBuy' | 'probablyHave' | 'optional';

export type SmartGroceryItem = {
  id: string;
  name: string;
  quantity?: string | number;
  unit?: string;
  category?: GroceryCategory;
  note?: string;
  priority: SmartGroceryPriority;
  reason: string;
  pantryStaple?: boolean;
  originalItems?: Array<GroceryListItem | RecipeIngredient>;
};

export type SmartGrocerySwap = {
  id: string;
  from: string;
  to: string;
  reason: string;
  kind: 'cheaper' | 'easier' | 'pantry' | 'healthier';
};

export type SmartGrocerySummary = {
  headline: string;
  subheadline: string;
  needToBuy: SmartGroceryItem[];
  probablyHave: SmartGroceryItem[];
  optional: SmartGroceryItem[];
  swaps: SmartGrocerySwap[];
  savingsHint?: string;
};

type RawSmartItem = {
  name: string;
  quantity?: string;
  category?: GroceryCategory;
  note?: string;
  pantryItem?: boolean;
  pantryStaple?: boolean;
  original: GroceryListItem | RecipeIngredient;
  originalItems?: Array<GroceryListItem | RecipeIngredient>;
};

const PANTRY_STAPLES = [
  'salt',
  'pepper',
  'black pepper',
  'olive oil',
  'oil',
  'butter',
  'flour',
  'sugar',
  'brown sugar',
  'garlic powder',
  'onion powder',
  'paprika',
  'chili flakes',
  'red pepper flakes',
  'soy sauce',
  'vinegar',
  'white vinegar',
  'apple cider vinegar',
  'rice vinegar',
  'dried herbs',
  'oregano',
  'basil',
  'thyme',
  'cumin',
  'ketchup',
  'mustard',
  'mayo',
  'mayonnaise',
  'hot sauce',
  'honey',
  'cornstarch',
  'baking powder',
  'baking soda',
];

const OPTIONAL_KEYWORDS = [
  'garnish',
  'optional',
  'cilantro',
  'parsley',
  'chives',
  'sesame',
  'scallion',
  'green onion',
  'lime wedge',
  'lemon wedge',
  'extra sauce',
  'hot sauce',
];

const SWAP_RULES: Array<{
  from: RegExp;
  fromLabel: string;
  to: string;
  reason: string;
  kind: SmartGrocerySwap['kind'];
}> = [
  { from: /\bpine nuts?\b/i, fromLabel: 'pine nuts', to: 'sunflower seeds', reason: 'Cheaper swap: sunflower seeds bring crunch without the premium nut price.', kind: 'cheaper' },
  { from: /\bfresh herbs?\b|\bbasil\b|\bparsley\b|\bcilantro\b/i, fromLabel: 'fresh herbs', to: 'dried herbs', reason: 'Pantry swap: dried herbs work when fresh herbs are not the point of the dish.', kind: 'pantry' },
  { from: /\bheavy cream\b/i, fromLabel: 'heavy cream', to: 'milk + butter', reason: 'Easier swap: milk plus a little butter can loosen a creamy sauce.', kind: 'easier' },
  { from: /\bparmesan\b/i, fromLabel: 'parmesan', to: 'any hard cheese', reason: 'Cheaper swap: another hard cheese can still add salty finish.', kind: 'cheaper' },
  { from: /\bfresh garlic\b|\bgarlic cloves?\b/i, fromLabel: 'fresh garlic', to: 'garlic powder', reason: 'Pantry swap: garlic powder works if you do not have fresh garlic.', kind: 'pantry' },
  { from: /\bfresh lemon\b|\blemon\b/i, fromLabel: 'fresh lemon', to: 'vinegar', reason: 'Pantry swap: a splash of vinegar can add the same bright lift.', kind: 'pantry' },
  { from: /\bchicken thighs?\b/i, fromLabel: 'chicken thighs', to: 'chicken breast', reason: 'Easier swap: use chicken breast if that is what you already have.', kind: 'easier' },
  { from: /\bspecialty noodles?\b|\budon\b|\bramen noodles?\b/i, fromLabel: 'specialty noodles', to: 'pasta', reason: 'Cheaper swap: regular pasta can carry the same sauce in a pinch.', kind: 'cheaper' },
  { from: /\bshallots?\b/i, fromLabel: 'shallot', to: 'onion', reason: 'Cheaper swap: use onion instead of shallot.', kind: 'cheaper' },
  { from: /\bfresh chil+i\b|\bjalapeno\b|\bserrano\b/i, fromLabel: 'fresh chili', to: 'chili flakes', reason: 'Pantry swap: chili flakes add heat without a special produce run.', kind: 'pantry' },
  { from: /\bgreek yogurt\b/i, fromLabel: 'Greek yogurt', to: 'sour cream or plain yogurt', reason: 'Easier swap: another tangy dairy can work in most sauces.', kind: 'easier' },
];

export function normalizeGroceryName(name: string) {
  return name
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(chopped|sliced|diced|minced|crushed|grated|shredded|small|large|medium)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPantryStaple(name: string) {
  const normalized = normalizeGroceryName(name);
  return PANTRY_STAPLES.some((staple) => normalized === staple || normalized.includes(staple));
}

export function buildSmartGrocerySummary(recipe: Recipe | null | undefined): SmartGrocerySummary {
  if (!recipe) {
    return createEmptySummary();
  }

  const rawItems = getRawItems(recipe);
  const mergedItems = mergeExactDuplicates(rawItems);
  const needToBuy: SmartGroceryItem[] = [];
  const probablyHave: SmartGroceryItem[] = [];
  const optional: SmartGroceryItem[] = [];

  mergedItems.forEach((item) => {
    const priority = getPriority(item);
    const smartItem = toSmartItem(recipe.id, item, priority);
    if (priority === 'probablyHave') {
      probablyHave.push(smartItem);
      return;
    }
    if (priority === 'optional') {
      optional.push(smartItem);
      return;
    }
    needToBuy.push(smartItem);
  });

  const swaps = buildSmartSwaps(recipe, mergedItems);
  const savingsHint = swaps.find((swap) => swap.kind === 'cheaper')?.reason ??
    (probablyHave.length > 0 ? 'Make this cheaper by checking pantry basics before buying duplicates.' : undefined);

  return {
    headline: 'Okyo sorted your list',
    subheadline: 'Pantry basics are separated from what you probably need to buy.',
    needToBuy,
    probablyHave,
    optional,
    swaps,
    savingsHint,
  };
}

export function formatSmartGroceryItem(item: SmartGroceryItem) {
  const quantity = typeof item.quantity === 'number' ? String(item.quantity) : item.quantity?.trim() ?? '';
  const name = cleanDisplayText(item.name);
  const note = item.note?.trim();
  const mainText = quantity ? `${quantity} ${name}` : name;
  return note ? `${mainText} (${cleanDisplayText(note)})` : mainText;
}

export function buildSmartGroceryListText(recipe: Recipe, summary = buildSmartGrocerySummary(recipe)) {
  const sections = [
    formatSmartSection('Need to buy', summary.needToBuy),
    formatSmartSection('Probably already have', summary.probablyHave),
    formatSmartSection('Optional / nice to have', summary.optional),
  ].filter(Boolean);

  if (summary.swaps.length > 0) {
    sections.push([
      'Smart swaps',
      ...summary.swaps.map((swap) => `- ${swap.reason}`),
    ].join('\n'));
  }

  return [`${cleanDisplayText(recipe.title)} Grocery List`, ...sections].join('\n\n');
}

function getRawItems(recipe: Recipe): RawSmartItem[] {
  const groceryItems = Array.isArray(recipe.groceryItems) ? recipe.groceryItems : [];
  if (groceryItems.length > 0) {
    return groceryItems
      .filter((item) => item?.name?.trim())
      .map((item) => ({
        name: item.name,
        quantity: item.quantity,
        category: normalizeCategory(item.category),
        note: item.shoppingNote,
        pantryItem: item.pantryItem,
        pantryStaple: item.pantryStaple,
        original: item,
      }));
  }

  return (Array.isArray(recipe.ingredients) ? recipe.ingredients : [])
    .filter((ingredient) => ingredient?.name?.trim())
    .map((ingredient) => ({
      name: ingredient.name,
      quantity: ingredient.quantity,
      category: inferCategory(ingredient.name, ingredient.pantryItem),
      pantryItem: ingredient.pantryItem,
      pantryStaple: ingredient.pantryItem,
      original: ingredient,
    }));
}

function mergeExactDuplicates(items: RawSmartItem[]): RawSmartItem[] {
  const itemMap = new Map<string, RawSmartItem & { originalItems: Array<GroceryListItem | RecipeIngredient> }>();

  items.forEach((item) => {
    const key = normalizeGroceryName(item.name);
    const existing = itemMap.get(key);
    if (!existing) {
      itemMap.set(key, { ...item, originalItems: [item.original] });
      return;
    }
    itemMap.set(key, {
      ...existing,
      quantity: mergeQuantity(existing.quantity, item.quantity),
      note: mergeNote(existing.note, item.note),
      pantryItem: existing.pantryItem || item.pantryItem,
      pantryStaple: existing.pantryStaple || item.pantryStaple,
      originalItems: [...existing.originalItems, item.original],
    });
  });

  return Array.from(itemMap.values()).map((item) => ({
    ...item,
    original: item.originalItems[0] ?? item.original,
  }));
}

function getPriority(item: RawSmartItem): SmartGroceryPriority {
  if (item.pantryItem || item.pantryStaple || isPantryStaple(item.name) || item.category === 'Spices') {
    return 'probablyHave';
  }
  if (isOptionalItem(item)) {
    return 'optional';
  }
  return 'needToBuy';
}

function toSmartItem(recipeId: string, item: RawSmartItem, priority: SmartGroceryPriority): SmartGroceryItem {
  const pantryStaple = priority === 'probablyHave';
  return {
    id: `${recipeId}-${priority}-${normalizeGroceryName(item.name)}`,
    name: item.name,
    quantity: item.quantity,
    category: item.category,
    note: item.note,
    priority,
    reason: getReason(item, priority),
    pantryStaple,
    originalItems: item.originalItems ?? [item.original],
  };
}

function buildSmartSwaps(recipe: Recipe, items: RawSmartItem[]) {
  const substitutions = Array.isArray(recipe.substitutions) ? recipe.substitutions : [];
  const text = [
    recipe.title,
    recipe.description,
    recipe.pantryNote,
    substitutions.join(' '),
    items.map((item) => item.name).join(' '),
  ].join(' ');
  const swaps: SmartGrocerySwap[] = [];

  SWAP_RULES.forEach((rule) => {
    if (!rule.from.test(text)) {
      return;
    }
    if (swaps.some((swap) => normalizeGroceryName(swap.from) === normalizeGroceryName(rule.fromLabel))) {
      return;
    }
    swaps.push({
      id: `${normalizeGroceryName(rule.fromLabel)}-${normalizeGroceryName(rule.to)}`,
      from: rule.fromLabel,
      to: rule.to,
      reason: rule.reason,
      kind: rule.kind,
    });
  });

  return swaps.slice(0, 4);
}

function formatSmartSection(title: string, items: SmartGroceryItem[]) {
  if (items.length === 0) {
    return '';
  }
  return [title, ...items.map((item) => `- ${formatSmartGroceryItem(item)}`)].join('\n');
}

function isOptionalItem(item: RawSmartItem) {
  const joined = `${item.name} ${item.note ?? ''} ${item.quantity ?? ''}`.toLowerCase();
  return item.category === 'Garnish' || OPTIONAL_KEYWORDS.some((keyword) => joined.includes(keyword));
}

function getReason(item: RawSmartItem, priority: SmartGroceryPriority) {
  if (priority === 'probablyHave') {
    return 'Pantry basic: check before buying duplicates.';
  }
  if (priority === 'optional') {
    return 'Nice to have: skip if you want the simpler shop.';
  }
  if (item.category) {
    return `Main shopping item for ${getCategoryLabel(item.category)}.`;
  }
  return 'Main shopping item for this recipe.';
}

function mergeQuantity(left?: string, right?: string) {
  const safeLeft = left?.trim() ?? '';
  const safeRight = right?.trim() ?? '';
  if (!safeLeft) return safeRight;
  if (!safeRight || safeLeft.toLowerCase() === safeRight.toLowerCase()) return safeLeft;
  return `${safeLeft} + ${safeRight}`;
}

function mergeNote(left?: string, right?: string) {
  const safeLeft = left?.trim() ?? '';
  const safeRight = right?.trim() ?? '';
  if (!safeLeft) return safeRight;
  if (!safeRight || safeLeft.toLowerCase() === safeRight.toLowerCase()) return safeLeft;
  return `${safeLeft}; ${safeRight}`;
}

function inferCategory(name: string, pantryItem?: boolean): GroceryCategory {
  const normalized = name.toLowerCase();
  if (pantryItem || isPantryStaple(name)) return 'Pantry';
  if (matches(normalized, ['lettuce', 'tomato', 'onion', 'pickle', 'spinach', 'kale', 'arugula', 'cucumber', 'greens', 'scallion', 'garlic', 'basil', 'cilantro', 'parsley', 'lemon', 'lime', 'pepper'])) return 'Produce';
  if (matches(normalized, ['beef', 'chicken', 'turkey', 'shrimp', 'tofu', 'pork', 'salmon', 'fish', 'egg'])) return 'Protein';
  if (matches(normalized, ['bun', 'bread', 'roll', 'dough', 'crust', 'flatbread'])) return 'Bakery / Bread';
  if (matches(normalized, ['cream', 'parmesan', 'milk', 'butter', 'yogurt', 'cheddar', 'cheese', 'mozzarella'])) return 'Dairy';
  if (matches(normalized, ['mayo', 'ketchup', 'mustard', 'sauce', 'dressing', 'gochujang', 'soy sauce', 'harissa', 'hummus', 'oil', 'vinegar'])) return 'Sauces / Condiments';
  if (matches(normalized, ['pasta', 'rigatoni', 'spaghetti', 'noodle', 'rice', 'grain', 'quinoa'])) return 'Noodles / Grains';
  if (matches(normalized, ['cilantro', 'parsley', 'sesame', 'lime', 'lemon', 'herb'])) return 'Garnish';
  if (matches(normalized, ['pepper', 'flakes', 'chili', 'garlic powder', 'paprika', 'salt', 'seasoning', 'spice'])) return 'Spices';
  return 'Other';
}

function normalizeCategory(category: GroceryCategory): GroceryCategory {
  if (category === 'Bakery') return 'Bakery / Bread';
  if (category === 'Beverages') return 'Other';
  return category;
}

function getCategoryLabel(category: GroceryCategory) {
  if (category === 'Noodles / Grains') return 'Pasta & grains';
  if (category === 'Sauces / Condiments') return 'sauces and condiments';
  if (category === 'Bakery / Bread') return 'bakery';
  return category.toLowerCase();
}

function matches(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function cleanDisplayText(value: string) {
  return value.trim();
}

function createEmptySummary(): SmartGrocerySummary {
  return {
    headline: 'Okyo could not build a grocery list yet',
    subheadline: 'Save or scan a recipe first, then Okyo can sort what to buy.',
    needToBuy: [],
    probablyHave: [],
    optional: [],
    swaps: [],
  };
}
