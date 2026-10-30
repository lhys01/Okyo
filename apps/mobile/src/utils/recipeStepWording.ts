import type { RecipeIngredient } from '../mocks';

type IngredientName = Pick<RecipeIngredient, 'name'>;
type IngredientMention = { name: string; start: number; end: number; text: string };

const MEASUREMENT_UNIT = String.raw`(?:oz\.?|ounces?|lbs?\.?|pounds?|g\.?|grams?|kgs?\.?|kilograms?|ml\.?|millilit(?:er|re)s?|l\.?|lit(?:er|re)s?|tsp\.?|teaspoons?|tbsp\.?|tablespoons?|cups?|each|items?|pieces?|slices?|cans?|jars?|packages?|pkgs?\.?|bags?|bunch(?:es)?|heads?|cartons?)`;
const NUMBER_OR_COUNT = String.raw`(?:\d+(?:\s+\d+\/\d+|\/\d+)?|\d+\s*[–-]\s*\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)`;
const MEASUREMENT_WORD = new RegExp(String.raw`\b${MEASUREMENT_UNIT}\b`, 'i');

/** Normalizes step copy at presentation time so every recipe source uses the same local rule. */
export function normalizeRecipeStepWording(
  text: string,
  ingredients: readonly IngredientName[],
): string {
  const safeText = typeof text === 'string' ? text.trim() : '';
  if (!safeText) return '';

  const mentions = getIngredientMentions(safeText, ingredients);
  let normalized = safeText;
  for (const mention of mentions.slice().sort((a, b) => b.start - a.start)) {
    const escaped = escapeRegExp(mention.text);
    const measuredIngredient = new RegExp(
      String.raw`\b${NUMBER_OR_COUNT}\s*(?:${MEASUREMENT_UNIT}\s*)?(?:of\s+)?(${escaped})\b`,
      'gi',
    );
    normalized = normalized.replace(measuredIngredient, `the ${mention.name.toLowerCase()}`);
  }

  normalized = normalized
    .replace(/\b(pour)\s+the\b([^.!?]*)/gi, (_match, verb: string, remainder: string) =>
      /\b(into|onto|in|over)\b/i.test(remainder) ? `${verb} the${remainder}` : `${verb} in the${remainder}`)
    .replace(/\b(mix)\s+the\b/gi, mentions.length === 1 ? '$1 in the' : '$1 the')
    .replace(/\s+([.,;!?])/g, '$1')
    .replace(/\bthe\s+the\b/gi, 'the')
    .replace(/\s{2,}/g, ' ');

  if (containsUnitOnlyAction(safeText) && mentions.length === 0) {
    return fallbackInstruction(safeText);
  }
  return normalized;
}

/** Keeps title verbs, but replaces a measurement-derived object with a recipe ingredient. */
export function normalizeRecipeStepTitle(
  title: string,
  instruction: string,
  ingredients: readonly IngredientName[],
): string {
  const safeTitle = typeof title === 'string' ? title.trim() : '';
  const mentions = getIngredientMentions(instruction, ingredients);
  if (safeTitle && !MEASUREMENT_WORD.test(safeTitle)) return safeTitle;

  const verb = (safeTitle || instruction).match(/^\s*([a-z]+)/i)?.[1]?.toLowerCase();
  if (mentions.length > 0 && verb && isActionVerb(verb)) {
    return `${capitalize(verb)} ${toTitleCase(mentions[0].name)}`;
  }
  if (safeTitle) return safeFallbackTitle(verb);
  return safeFallbackTitle(instruction.match(/^\s*([a-z]+)/i)?.[1]?.toLowerCase());
}

export function getSafeRecipeIngredientName(name: unknown): string {
  return cleanIngredientName(name) || 'Ingredients';
}

function getIngredientMentions(text: string, ingredients: readonly IngredientName[]): IngredientMention[] {
  const candidates = ingredients
    .map((ingredient) => cleanIngredientName(ingredient?.name))
    .filter(Boolean)
    .map((name) => ({ name, escaped: escapeRegExp(name) }))
    .sort((a, b) => b.name.length - a.name.length);
  const found: IngredientMention[] = [];

  for (const candidate of candidates) {
    const pattern = new RegExp(String.raw`\b${candidate.escaped}\b`, 'gi');
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? -1;
      if (start < 0 || found.some((item) => start < item.end && start + match[0].length > item.start)) continue;
      found.push({ name: candidate.name, start, end: start + match[0].length, text: match[0] });
    }
  }

  // A step may say “beef” while the structured name is “ground beef (80/20)”.
  for (const candidate of candidates) {
    const words = candidate.name.split(/\s+/).filter((word) => word.length >= 3);
    const suffix = words.at(-1);
    if (!suffix || found.some((item) => item.name === candidate.name)) continue;
    const pattern = new RegExp(String.raw`\b${escapeRegExp(suffix)}s?\b`, 'gi');
    const match = pattern.exec(text);
    const beforeMention = match ? text.slice(0, match.index) : '';
    if (match && match.index > 0 && new RegExp(String.raw`\b${NUMBER_OR_COUNT}\s*${MEASUREMENT_UNIT}\s*$`, 'i').test(beforeMention)) {
      found.push({ name: candidate.name, start: match.index, end: match.index + match[0].length, text: match[0] });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

function cleanIngredientName(name: unknown): string {
  if (typeof name !== 'string') return '';
  const cleaned = name
    .replace(/\([^)]*\)/g, '')
    .replace(new RegExp(String.raw`^\s*${NUMBER_OR_COUNT}\s+`), '')
    .replace(new RegExp(String.raw`^\s*${MEASUREMENT_UNIT}\s+(?:of\s+)?`, 'i'), '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned && !MEASUREMENT_WORD.test(cleaned) ? cleaned : '';
}

function containsUnitOnlyAction(text: string): boolean {
  return new RegExp(String.raw`^\s*(?:add|mix|pour|divide|place|season|stir|combine|whisk|sprinkle|measure)\b[^.!?]*\b${NUMBER_OR_COUNT}\s*${MEASUREMENT_UNIT}\b`, 'i').test(text);
}

function fallbackInstruction(text: string): string {
  const verb = text.match(/^\s*([a-z]+)/i)?.[1]?.toLowerCase();
  if (verb === 'mix' || verb === 'stir' || verb === 'whisk' || verb === 'combine') return 'Continue mixing the ingredients.';
  if (verb === 'pour') return 'Pour in the liquid.';
  if (verb === 'divide') return 'Divide the ingredients.';
  if (verb === 'place') return 'Place the ingredients.';
  if (verb === 'season' || verb === 'sprinkle') return 'Season the ingredients to taste.';
  return 'Add ingredients.';
}

function safeFallbackTitle(verb?: string): string {
  if (verb === 'mix' || verb === 'stir' || verb === 'whisk' || verb === 'combine') return 'Continue Mixing';
  if (verb === 'pour') return 'Pour Liquid';
  if (verb === 'divide') return 'Divide Ingredients';
  if (verb === 'place') return 'Place Ingredients';
  if (verb === 'season') return 'Season Ingredients';
  return 'Add Ingredients';
}

function isActionVerb(value: string): boolean {
  return /^(add|mix|pour|divide|place|season|stir|combine|whisk|sprinkle|measure|cook|heat|bake|roast|slice|chop|dice|mince|fold|serve|spread|arrange|drizzle|brush|press|shape|roll|break|crack|drain|rinse|wash|pat|toast|flip|turn)$/.test(value);
}

function toTitleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
