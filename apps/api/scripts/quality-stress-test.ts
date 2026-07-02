#!/usr/bin/env tsx
/**
 * Recipe Quality Stress Test
 *
 * Generates 125 recipes across 5 food categories and scores each one
 * for coaching completeness. Reports aggregate metrics to expose
 * systematic gaps before launch.
 *
 * Usage:  cd apps/api && npx tsx scripts/quality-stress-test.ts
 * Flags:  --category chicken   (run one category only)
 *         --limit 5            (cap recipes per category)
 *         --concurrency 3      (parallel requests, default 3)
 */

import { generateRecipeFromDish, foodImageAnalysisSchema } from '../src/services/aiService.js';
import type { FoodImageAnalysis } from '../src/services/aiService.js';
import type { RecipeStep } from '../src/types.js';

// ─── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flagValue = (flag: string) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
};
const FILTER_CATEGORY = flagValue('--category');
const LIMIT = Number(flagValue('--limit') ?? 25);
const CONCURRENCY = Number(flagValue('--concurrency') ?? 3);

// ─── Dish lists ───────────────────────────────────────────────────────────────

const ALL_DISHES: Record<string, string[]> = {
  chicken: [
    'Butter Chicken', 'Chicken Tikka Masala', 'Chicken Parmesan', 'Chicken Alfredo',
    'Chicken Stir Fry', 'Grilled Chicken Sandwich', 'Chicken Tacos', 'Chicken Noodle Soup',
    'Chicken Fried Rice', 'BBQ Chicken', 'Lemon Herb Chicken', 'Chicken Piccata',
    'Chicken Marsala', 'Honey Garlic Chicken', 'Chicken Burrito Bowl', 'Pad Thai with Chicken',
    'Chicken Ramen', 'Chicken Shawarma', 'Nashville Hot Chicken', 'Chicken Gyro',
    'Chicken Caesar Salad', 'Buffalo Chicken Wrap', 'Chicken Enchiladas',
    'Teriyaki Chicken Bowl', 'Chicken Pot Pie',
  ],
  pasta: [
    'Spaghetti Carbonara', 'Pesto Pasta', 'Fettuccine Alfredo', 'Cacio e Pepe',
    'Spaghetti Bolognese', 'Pasta Primavera', 'Mac and Cheese', 'Lasagna',
    'Pasta Arrabbiata', 'Shrimp Scampi Pasta', 'Pasta Fagioli', 'Rigatoni alla Vodka',
    'Orecchiette with Sausage', 'Lemon Butter Pasta', 'Bucatini Amatriciana',
    'Pasta Puttanesca', 'Creamy Mushroom Pasta', 'Pasta e Ceci', 'Pasta Pomodoro',
    'Baked Ziti', 'Stuffed Shells', 'Tortellini Soup', 'Spaghetti Aglio e Olio',
    'Pasta alla Norma', 'Fusilli with Pesto and Burrata',
  ],
  rice: [
    'Chicken Biryani', 'Vegetable Fried Rice', 'Salmon Sushi Rolls', 'Mushroom Risotto',
    'Arroz con Pollo', 'Seafood Paella', 'Rice Congee', 'Tuna Poke Bowl',
    'Mediterranean Grain Bowl', 'Beef Burrito Bowl', 'Thai Basil Fried Rice',
    'Persian Saffron Rice', 'Korean Bibimbap', 'Japanese Chicken Curry Rice',
    'Nasi Goreng', 'Jollof Rice', 'Cajun Dirty Rice', 'Spanish Rice',
    'Coconut Curry with Rice', 'Hawaiian Loco Moco', 'Kedgeree',
    'Mujaddara', 'Herb Rice Pilaf', 'Chinese Clay Pot Rice', 'Mexican Red Rice',
  ],
  vegetarian: [
    'Mushroom Risotto', 'Vegetable Curry', 'Red Lentil Soup', 'Caprese Salad',
    'Margherita Pizza', 'Falafel Wrap', 'Black Bean Veggie Burger', 'Stuffed Bell Peppers',
    'Eggplant Parmesan', 'Tofu Stir Fry', 'Black Bean Tacos', 'Shakshuka',
    'Spinach and Feta Frittata', 'Spinach Ricotta Cannelloni', 'Roasted Vegetable Pasta',
    'Dal Makhani', 'Palak Paneer', 'Ratatouille', 'Vegetable Paella',
    'Miso Soup with Tofu', 'Cauliflower Tikka Masala', 'Smoothie Bowl',
    'Avocado Toast with Eggs', 'Cheese Quesadilla', 'Greek Salad with Halloumi',
  ],
  breakfast: [
    'Eggs Benedict', 'French Toast', 'Avocado Eggs on Toast', 'Breakfast Burrito',
    'Greek Yogurt Parfait', 'Banana Pancakes', 'Acai Smoothie Bowl', 'Shakshuka',
    'Belgian Waffles', 'Bagel with Lox and Cream Cheese', 'Cheese Omelette',
    'Breakfast Hash', 'Crepes with Strawberries', 'Huevos Rancheros',
    'Granola with Berries', 'Overnight Oats', 'Egg and Cheese Breakfast Sandwich',
    'Dutch Baby Pancake', 'Corn Fritters', 'Japanese Tamago Gohan',
    'Ful Medames', 'Breakfast Pita', 'Biscuits and Gravy',
    'Breakfast Quesadilla', 'Bircher Muesli',
  ],
};

// ─── Analysis builder ─────────────────────────────────────────────────────────

const CATEGORY_COMPONENTS: Record<string, Partial<{
  protein: string; sauce: string; baseStarch: string;
  vegetables: string; toppingsGarnish: string; cookingMethod: string;
}>> = {
  chicken:     { protein: 'chicken', cookingMethod: 'varies' },
  pasta:       { baseStarch: 'pasta', cookingMethod: 'boiled and sauced' },
  rice:        { baseStarch: 'rice', cookingMethod: 'steamed or stir fried' },
  vegetarian:  { vegetables: 'mixed vegetables', cookingMethod: 'varies' },
  breakfast:   { cookingMethod: 'breakfast preparation' },
};

function buildAnalysis(dishName: string, category: string): FoodImageAnalysis {
  const c = CATEGORY_COMPONENTS[category] ?? {};
  return foodImageAnalysisSchema.parse({
    candidateScanId: `qst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    aiSource: 'openrouter_ai',
    dishName,
    broadDishCategory: category,
    cuisine: 'International',
    restaurantStyle: 'casual dining',
    scanState: 'clear_food',
    confidence: 0.88,
    confidenceReason: 'Stress test — dish name is the ground truth.',
    isFoodImage: true,
    isRestaurantMeal: true,
    visibleIngredients: [],
    likelyIngredients: [],
    possibleDishNames: [dishName],
    visibleComponents: {
      protein:         c.protein         ?? '',
      sauce:           c.sauce           ?? '',
      baseStarch:      c.baseStarch      ?? '',
      vegetables:      c.vegetables      ?? '',
      toppingsGarnish: c.toppingsGarnish ?? '',
      cookingMethod:   c.cookingMethod   ?? '',
    },
    restaurantPriceEstimate: 18,
    homemadeCostEstimate: 6.5,
    matchScore: 8.5,
    difficulty: 'Medium',
    modes: ['Restaurant Copy', 'Budget', 'Healthy'],
    notes: ['Quality stress test. Dish identity is known.'],
  });
}

// ─── Field presence scoring ───────────────────────────────────────────────────

type FieldName =
  | 'title' | 'why' | 'commonMistake' | 'lookFor' | 'doneWhen'
  | 'chefTip' | 'commonQuestion' | 'ingredientsUsed' | 'toolsUsed'
  | 'stepImagePrompt' | 'decisionPoint';

const FIELDS: FieldName[] = [
  'title', 'why', 'commonMistake', 'lookFor', 'doneWhen',
  'chefTip', 'commonQuestion', 'ingredientsUsed', 'toolsUsed',
  'stepImagePrompt', 'decisionPoint',
];

function scoreStep(step: RecipeStep): Record<FieldName, boolean> {
  return {
    title:          Boolean(step.title?.trim()),
    why:            Boolean(step.why || step.whyItMatters),
    commonMistake:  Boolean(step.commonMistake || step.safetyNote),
    lookFor:        Boolean(step.lookFor),
    doneWhen:       Boolean(step.doneWhen),
    chefTip:        Boolean(step.chefTip),
    commonQuestion: Boolean(step.commonQuestion && step.commonQuestionAnswer),
    ingredientsUsed: Boolean(step.ingredientsUsed?.length),
    toolsUsed:      Boolean(step.toolsUsed?.length),
    stepImagePrompt: Boolean(step.stepImagePrompt),
    decisionPoint:  Boolean(step.decisionPoint && step.ifYes && step.ifNo),
  };
}

function scoreSteps(steps: RecipeStep[]): number {
  if (steps.length === 0) return 0;
  let total = 0;
  for (const step of steps) {
    const s = scoreStep(step);
    const present = Object.values(s).filter(Boolean).length;
    total += (present / FIELDS.length) * 100;
  }
  return Math.round(total / steps.length);
}

function fieldRatesFromSteps(steps: RecipeStep[]): Record<FieldName, number> {
  if (steps.length === 0) {
    return Object.fromEntries(FIELDS.map((f) => [f, 0])) as Record<FieldName, number>;
  }
  const counts = Object.fromEntries(FIELDS.map((f) => [f, 0])) as Record<FieldName, number>;
  for (const step of steps) {
    const s = scoreStep(step);
    for (const f of FIELDS) {
      if (s[f]) counts[f]++;
    }
  }
  return Object.fromEntries(
    FIELDS.map((f) => [f, Math.round((counts[f] / steps.length) * 100)]),
  ) as Record<FieldName, number>;
}

// ─── Log suppression — squelch low-level API provider noise ──────────────────

const origLog = console.log;
console.log = (...logArgs: unknown[]) => {
  const first = String(logArgs[0] ?? '');
  // Keep coaching-repair and quality summary lines; drop provider debug spam
  const isSuppressed = (
    first.startsWith('openrouter_') ||
    first.startsWith('api_openrouter_') ||
    first.startsWith('api_scan_') ||
    first.startsWith('ai_') ||
    first.startsWith('[recipe-quality]')
  );
  if (!isSuppressed) origLog(...logArgs);
};

// ─── Warning capture ──────────────────────────────────────────────────────────

type CapturedWarning = { type: string; dish: string };
const allWarnings: CapturedWarning[] = [];

const origWarn = console.warn;
// Capture [recipe-quality] tags into allWarnings array; suppress from stdout.
console.warn = (...warnArgs: unknown[]) => {
  const first = String(warnArgs[0] ?? '');
  if (first.startsWith('[recipe-quality]')) {
    const warnType = first.replace('[recipe-quality] ', '').split(' ').slice(0, 3).join(' ');
    const ctx = warnArgs[1] as { dish?: string } | undefined;
    allWarnings.push({ type: warnType, dish: ctx?.dish ?? 'unknown' });
    // Do not forward — all quality data surfaces in the final report
    return;
  }
  origWarn(...warnArgs);
};

// ─── Result type ──────────────────────────────────────────────────────────────

type RecipeResult = {
  dish: string;
  category: string;
  score: number;
  stepCount: number;
  isCompact: boolean;
  fieldRates: Record<FieldName, number>;
  error?: string;
};

// ─── Per-recipe runner ────────────────────────────────────────────────────────

async function runOne(dish: string, category: string, idx: number, total: number): Promise<RecipeResult> {
  const tag = `[${idx}/${total}] ${category} — ${dish}`;
  try {
    const analysis = buildAnalysis(dish, category);
    const output = await generateRecipeFromDish({ analysis, mode: 'Restaurant Copy' });
    const steps = output.recipe?.structuredSteps ?? [];
    const score = scoreSteps(steps);
    const rates = fieldRatesFromSteps(steps);
    const isCompact = Boolean(output.recipe?.isCompactRecipe);

    const bar = '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10));
    const compact = isCompact ? ' [COMPACT]' : '';
    process.stdout.write(`  ✓ ${tag}  ${bar} ${score}%${compact}  (${steps.length} steps)\n`);

    return { dish, category, score, stepCount: steps.length, isCompact, fieldRates: rates };
  } catch (err) {
    process.stdout.write(`  ✗ ${tag}  ERROR: ${err instanceof Error ? err.message.slice(0, 80) : err}\n`);
    return {
      dish, category, score: 0, stepCount: 0, isCompact: false,
      fieldRates: Object.fromEntries(FIELDS.map((f) => [f, 0])) as Record<FieldName, number>,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Concurrency runner ───────────────────────────────────────────────────────

async function runBatch<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const taskIdx = i++;
      results[taskIdx] = await tasks[taskIdx]();
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

// ─── Report helpers ───────────────────────────────────────────────────────────

function avg(nums: number[]) {
  return nums.length === 0 ? 0 : Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function pct(n: number, d: number) {
  return d === 0 ? '—' : `${Math.round((n / d) * 100)}%`;
}

function pad(s: string, len: number) {
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startMs = Date.now();

  const categories = FILTER_CATEGORY
    ? (ALL_DISHES[FILTER_CATEGORY] ? [FILTER_CATEGORY] : (() => { throw new Error(`Unknown category: ${FILTER_CATEGORY}`); })())
    : Object.keys(ALL_DISHES);

  const allTasks: Array<{ dish: string; category: string }> = [];
  for (const cat of categories) {
    const dishes = ALL_DISHES[cat].slice(0, LIMIT);
    for (const dish of dishes) {
      allTasks.push({ dish, category: cat });
    }
  }

  const total = allTasks.length;
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  OKYO RECIPE QUALITY STRESS TEST`);
  console.log(`  ${total} recipes  |  ${categories.join(', ')}  |  concurrency ${CONCURRENCY}`);
  console.log(`${'─'.repeat(70)}\n`);

  let done = 0;
  const tasks = allTasks.map(({ dish, category }) => async () => {
    const result = await runOne(dish, category, ++done, total);
    return result;
  });

  const results = await runBatch(tasks, CONCURRENCY);
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

  // ─── Print report ──────────────────────────────────────────────────────────

  const successful = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);
  const compactCount = successful.filter((r) => r.isCompact).length;
  const scores = successful.map((r) => r.score);

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  RECIPE QUALITY REPORT  (${elapsed}s)`);
  console.log(`${'═'.repeat(70)}\n`);

  console.log(`  Recipes generated :  ${successful.length} / ${total}`);
  console.log(`  Failures          :  ${failed.length}`);
  console.log(`  Compact recipes   :  ${compactCount} (${pct(compactCount, successful.length)})`);
  console.log(`  Average score     :  ${avg(scores)}%`);
  console.log(`  Highest score     :  ${Math.max(...scores, 0)}%`);
  console.log(`  Lowest score      :  ${Math.min(...scores, 100)}%`);

  // Per-category breakdown
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  SCORES BY CATEGORY`);
  console.log(`${'─'.repeat(70)}`);
  for (const cat of categories) {
    const catResults = successful.filter((r) => r.category === cat);
    const catScores = catResults.map((r) => r.score);
    const compactInCat = catResults.filter((r) => r.isCompact).length;
    const avgSteps = catResults.length
      ? Math.round(catResults.reduce((a, r) => a + r.stepCount, 0) / catResults.length)
      : 0;
    console.log(
      `  ${pad(cat, 12)}  avg ${pad(String(avg(catScores)) + '%', 5)}` +
      `  min ${pad(String(Math.min(...catScores, 100)) + '%', 5)}` +
      `  max ${pad(String(Math.max(...catScores, 0)) + '%', 5)}` +
      `  steps ~${avgSteps}` +
      (compactInCat ? `  compact ${compactInCat}` : ''),
    );
  }

  // Field presence rates across all successful recipes (averaged over all steps)
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  FIELD PRESENCE RATES  (% of steps that have the field)`);
  console.log(`${'─'.repeat(70)}`);
  for (const field of FIELDS) {
    const rates = successful.map((r) => r.fieldRates[field]);
    const mean = avg(rates);
    const bar = '█'.repeat(Math.round(mean / 10)) + '░'.repeat(10 - Math.round(mean / 10));
    const flag = mean < 50 ? '  ← LOW' : mean < 80 ? '  ← MEDIUM' : '';
    console.log(`  ${pad(field, 16)}  ${bar}  ${pad(String(mean) + '%', 5)}${flag}`);
  }

  // Warning frequency
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  MOST COMMON QUALITY WARNINGS  (${allWarnings.length} total)`);
  console.log(`${'─'.repeat(70)}`);
  const warnCounts: Record<string, number> = {};
  for (const w of allWarnings) {
    warnCounts[w.type] = (warnCounts[w.type] ?? 0) + 1;
  }
  const topWarnings = Object.entries(warnCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  if (topWarnings.length === 0) {
    console.log('  (none)');
  } else {
    for (const [type, count] of topWarnings) {
      console.log(`  ${pad(String(count), 5)}  ${type}`);
    }
  }

  // Bottom 10 recipes
  const bottom10 = [...successful].sort((a, b) => a.score - b.score).slice(0, 10);
  if (bottom10.length > 0) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`  LOWEST SCORING RECIPES`);
    console.log(`${'─'.repeat(70)}`);
    for (const r of bottom10) {
      console.log(`  ${pad(String(r.score) + '%', 6)}  ${r.category}  ${r.dish}`);
    }
  }

  // Failures
  if (failed.length > 0) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`  FAILURES`);
    console.log(`${'─'.repeat(70)}`);
    for (const r of failed) {
      console.log(`  ${r.category}  ${r.dish}`);
      console.log(`    ${r.error?.slice(0, 120)}`);
    }
  }

  console.log(`\n${'═'.repeat(70)}\n`);
}

main().catch((err) => {
  console.error('Stress test failed:', err);
  process.exit(1);
});
