#!/usr/bin/env tsx
/**
 * Okyo — Gemma Production Validation
 *
 * Runs google/gemma-3-12b-it through the REAL production path
 * (generateRecipeFromDish → compact retry → coaching repair) across 30 dishes
 * spanning 10 categories, and measures whether Gemma is launch-ready.
 *
 * This is NOT the schema diagnostic (direct fetch). It exercises the actual
 * prompt, schema, repair loop, sanitizer, and analytics layer end-to-end.
 *
 * Captures per recipe:
 *   Reliability   — success / compact / repair-triggered / repair-delivered / fallback
 *   Latency       — wall-clock generation time
 *   Coaching      — production coaching score (post-delivery)
 *   Field rates   — why, commonMistake, lookFor, doneWhen, chefTip, commonQuestion,
 *                   decisionPoint, ingredientsUsed, toolsUsed, stepImagePrompt
 *
 * Also dumps every delivered recipe's structured steps to a JSON file so the
 * coaching-usefulness audit can read real examples.
 *
 * Usage:  cd apps/api && npx tsx scripts/gemma-validation.ts
 * Flags:  --limit 10        (dishes to run, default: all 30)
 *         --out  path.json   (recipe dump path, default: data/gemma-validation-recipes.json)
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  generateRecipeFromDish,
  foodImageAnalysisSchema,
  calculateRecipeCoachingScore,
} from '../src/services/aiService.js';
import type { FoodImageAnalysis } from '../src/services/aiService.js';
import type { RecipeStep } from '../src/types.js';

// ─── Config ─────────────────────────────────────────────────────────────────

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(currentDir, '..');

const cliArgs = process.argv.slice(2);
const flagVal = (f: string) => { const i = cliArgs.indexOf(f); return i !== -1 ? cliArgs[i + 1] : undefined; };
const MODEL_ID = flagVal('--model') ?? 'google/gemma-3-12b-it';
const MAX_TOKENS = Number(flagVal('--max-tokens') ?? 8192);
const LIMIT = Number(flagVal('--limit') ?? 30);
// Pause between recipes to stay under OpenRouter's per-minute rate limit (which is
// aggressive when the account balance is low). 0 = no pacing.
const DELAY_MS = Number(flagVal('--delay-ms') ?? 0);
const modelSlug = MODEL_ID.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
const OUT_PATH = flagVal('--out') ?? resolve(apiRoot, `data/validation-recipes-${modelSlug}.json`);

// Force the production AI path onto Gemma for this run.
process.env.AI_ENABLED = 'true';
process.env.AI_PROVIDER = 'openrouter';
process.env.OPENROUTER_TEXT_MODEL = MODEL_ID;
process.env.AI_MAX_OUTPUT_TOKENS = String(MAX_TOKENS);
// Keep the analytics layer ON so this run also validates Obj 4 end-to-end.
// Isolate this run's analytics in a per-model file for a clean summary.
process.env.RECIPE_QUALITY_ANALYTICS = process.env.RECIPE_QUALITY_ANALYTICS ?? 'on';
process.env.RECIPE_QUALITY_ANALYTICS_PATH = process.env.RECIPE_QUALITY_ANALYTICS_PATH
  ?? resolve(apiRoot, `data/analytics-${modelSlug}.jsonl`);

// ─── Test set: 10 categories × 3 dishes ───────────────────────────────────────

type TestDish = { name: string; category: string; cuisine: string };

const TEST_DISHES: TestDish[] = [
  { name: 'Butter Chicken',          category: 'chicken',    cuisine: 'Indian' },
  { name: 'Chicken Stir Fry',        category: 'chicken',    cuisine: 'Chinese' },
  { name: 'Chicken Parmesan',        category: 'chicken',    cuisine: 'Italian' },
  { name: 'Beef Tacos',              category: 'beef',       cuisine: 'Mexican' },
  { name: 'Beef Bulgogi',            category: 'beef',       cuisine: 'Korean' },
  { name: 'Classic Beef Burger',     category: 'beef',       cuisine: 'American' },
  { name: 'Garlic Butter Shrimp',    category: 'seafood',    cuisine: 'American' },
  { name: 'Salmon Teriyaki',         category: 'seafood',    cuisine: 'Japanese' },
  { name: 'Fish Tacos',              category: 'seafood',    cuisine: 'Mexican' },
  { name: 'Spaghetti Carbonara',     category: 'pasta',      cuisine: 'Italian' },
  { name: 'Fettuccine Alfredo',      category: 'pasta',      cuisine: 'Italian' },
  { name: 'Pad Thai',                category: 'pasta',      cuisine: 'Thai' },
  { name: 'Chicken Biryani',         category: 'rice',       cuisine: 'Indian' },
  { name: 'Vegetable Fried Rice',    category: 'rice',       cuisine: 'Chinese' },
  { name: 'Mushroom Risotto',        category: 'rice',       cuisine: 'Italian' },
  { name: 'Chicken Noodle Soup',     category: 'soup',       cuisine: 'American' },
  { name: 'Tomato Basil Soup',       category: 'soup',       cuisine: 'American' },
  { name: 'Ramen',                   category: 'soup',       cuisine: 'Japanese' },
  { name: 'Vegetable Curry',         category: 'vegetarian', cuisine: 'Indian' },
  { name: 'Shakshuka',               category: 'vegetarian', cuisine: 'Middle Eastern' },
  { name: 'Eggplant Parmesan',       category: 'vegetarian', cuisine: 'Italian' },
  { name: 'Eggs Benedict',           category: 'breakfast',  cuisine: 'American' },
  { name: 'French Toast',            category: 'breakfast',  cuisine: 'American' },
  { name: 'Banana Pancakes',         category: 'breakfast',  cuisine: 'American' },
  { name: 'Grilled Cheese Sandwich', category: 'sandwich',   cuisine: 'American' },
  { name: 'Club Sandwich',           category: 'sandwich',   cuisine: 'American' },
  { name: 'Philly Cheesesteak',      category: 'sandwich',   cuisine: 'American' },
  { name: 'Chocolate Chip Cookies',  category: 'dessert',    cuisine: 'American' },
  { name: 'Tiramisu',                category: 'dessert',    cuisine: 'Italian' },
  { name: 'Apple Pie',               category: 'dessert',    cuisine: 'American' },
];

const PROTEIN_BY_CATEGORY: Record<string, string> = {
  chicken: 'chicken', beef: 'beef', seafood: 'fish or shrimp',
};

function buildAnalysis(dish: TestDish): FoodImageAnalysis {
  return foodImageAnalysisSchema.parse({
    candidateScanId: `gemma-${dish.category}-${dish.name.replace(/\s+/g, '-').toLowerCase()}`,
    aiSource: 'openrouter_ai',
    dishName: dish.name,
    broadDishCategory: dish.category,
    cuisine: dish.cuisine,
    restaurantStyle: 'casual dining',
    scanState: 'clear_food',
    confidence: 0.88,
    confidenceReason: 'Validation run — dish identity is known.',
    isFoodImage: true,
    isRestaurantMeal: true,
    visibleIngredients: [],
    likelyIngredients: [],
    possibleDishNames: [dish.name],
    visibleComponents: {
      protein: PROTEIN_BY_CATEGORY[dish.category] ?? '',
      sauce: '', baseStarch: '', vegetables: '', toppingsGarnish: '',
      cookingMethod: 'varies',
    },
    restaurantPriceEstimate: 18,
    homemadeCostEstimate: 6.5,
    matchScore: 8.5,
    difficulty: 'Medium',
    modes: ['Restaurant Copy', 'Budget', 'Healthy'],
    notes: ['Gemma validation run.'],
  });
}

// ─── Field scoring (10 coaching fields the audit tracks) ──────────────────────

type FieldName =
  | 'why' | 'commonMistake' | 'lookFor' | 'doneWhen' | 'chefTip'
  | 'commonQuestion' | 'decisionPoint' | 'ingredientsUsed' | 'toolsUsed' | 'stepImagePrompt';

const FIELDS: FieldName[] = [
  'why', 'commonMistake', 'lookFor', 'doneWhen', 'chefTip',
  'commonQuestion', 'decisionPoint', 'ingredientsUsed', 'toolsUsed', 'stepImagePrompt',
];

function fieldPresent(step: RecipeStep, field: FieldName): boolean {
  switch (field) {
    case 'why':             return Boolean(step.why || step.whyItMatters);
    case 'commonMistake':   return Boolean(step.commonMistake || step.safetyNote);
    case 'lookFor':         return Boolean(step.lookFor);
    case 'doneWhen':        return Boolean(step.doneWhen);
    case 'chefTip':         return Boolean(step.chefTip);
    case 'commonQuestion':  return Boolean(step.commonQuestion && step.commonQuestionAnswer);
    case 'decisionPoint':   return Boolean(step.decisionPoint && step.ifYes && step.ifNo);
    case 'ingredientsUsed': return Boolean(step.ingredientsUsed?.length);
    case 'toolsUsed':       return Boolean(step.toolsUsed?.length);
    case 'stepImagePrompt': return Boolean(step.stepImagePrompt);
  }
}

function fieldRates(steps: RecipeStep[]): Record<FieldName, number> {
  if (steps.length === 0) return Object.fromEntries(FIELDS.map((f) => [f, 0])) as Record<FieldName, number>;
  const out = {} as Record<FieldName, number>;
  for (const f of FIELDS) {
    const n = steps.filter((s) => fieldPresent(s, f)).length;
    out[f] = Math.round((n / steps.length) * 100);
  }
  return out;
}

// ─── Log intercept — capture repair signals, suppress provider noise ──────────

type Capture = {
  repairTriggered: boolean;
  repairApplied: boolean;     // from coaching trends log
  trendInitial?: number;
  trendFinal?: number;
  fallbackStatus?: number;
};

let active: Capture | null = null;
const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;

console.log = (...args: unknown[]) => {
  const key = String(args[0] ?? '');
  if (active) {
    if (key === '[recipe-quality] coaching repair triggered') active.repairTriggered = true;
    if (key === '[recipe-quality] coaching trends') {
      const d = args[1] as { initialScore?: number; finalScore?: number; repairApplied?: boolean } | undefined;
      active.trendInitial = d?.initialScore;
      active.trendFinal = d?.finalScore;
      active.repairApplied = Boolean(d?.repairApplied);
    }
  }
  const suppress = key.startsWith('openrouter_') || key.startsWith('api_openrouter_')
    || key.startsWith('api_scan_') || key.startsWith('ai_') || key.startsWith('[recipe-quality]')
    || key === 'fallback_ai' || key.startsWith('[recipe-validator]') || key.startsWith('[recipe-causality]');
  if (!suppress) origLog(...args);
};
console.warn = (...args: unknown[]) => {
  if (String(args[0] ?? '').startsWith('[recipe-quality]') || String(args[0] ?? '').startsWith('[recipe-')) return;
  origWarn(...args);
};
console.error = (...args: unknown[]) => {
  const key = String(args[0] ?? '');
  if (key === 'openrouter_http_error' && active) {
    active.fallbackStatus = (args[1] as { status?: number } | undefined)?.status;
  }
  // suppress provider error noise
};

// ─── Result types ─────────────────────────────────────────────────────────────

type RecipeResult = {
  dish: string;
  category: string;
  ok: boolean;            // delivered a real AI recipe (not mock/starter)
  compact: boolean;
  repairTriggered: boolean;
  repairDelivered: boolean;
  score: number;          // production coaching score of the delivered recipe
  stepCount: number;
  durationMs: number;
  fieldRates: Record<FieldName, number>;
};

const dumped: Array<{ dish: string; category: string; score: number; compact: boolean; steps: RecipeStep[] }> = [];

// ─── Runner ───────────────────────────────────────────────────────────────────

function pad(s: string | number, w: number, right = false) {
  const t = String(s);
  if (t.length >= w) return t.slice(0, w);
  const p = ' '.repeat(w - t.length);
  return right ? p + t : t + p;
}

async function runRecipe(dish: TestDish, idx: number, total: number): Promise<RecipeResult> {
  active = { repairTriggered: false, repairApplied: false };
  const t0 = Date.now();

  let steps: RecipeStep[] = [];
  let compact = false;
  let aiSource = 'unknown';
  try {
    const output = await generateRecipeFromDish({ analysis: buildAnalysis(dish), mode: 'Restaurant Copy' });
    steps = output.recipe?.structuredSteps ?? [];
    compact = Boolean(output.recipe?.isCompactRecipe);
    aiSource = output.aiSource ?? 'unknown';
  } catch {
    // generateRecipeFromDish has internal fallbacks; a throw here is a hard failure
  }

  const durationMs = Date.now() - t0;
  const cap = active!;
  active = null;

  const ok = aiSource === 'openrouter_ai' && steps.length > 0;
  const score = steps.length > 0 ? calculateRecipeCoachingScore(steps) : 0;
  const repairDelivered = cap.repairApplied && (cap.trendFinal ?? 0) >= (cap.trendInitial ?? 0);

  dumped.push({ dish: dish.name, category: dish.category, score, compact, steps });

  const bar = '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10));
  const tags = [
    !ok ? 'FALLBACK' : '',
    compact ? 'C' : '',
    cap.repairTriggered ? (repairDelivered ? 'R+' : 'R-') : '',
  ].filter(Boolean).join(' ');
  origLog(
    `  [${pad(idx, 2, true)}/${total}] ${pad(dish.category, 11)} ${pad(dish.name, 26)} ${bar} ${pad(score, 3, true)}%  ${pad(tags, 9)}  ${(durationMs / 1000).toFixed(1)}s`,
  );

  return {
    dish: dish.name, category: dish.category, ok, compact,
    repairTriggered: cap.repairTriggered, repairDelivered,
    score, stepCount: steps.length, durationMs, fieldRates: fieldRates(steps),
  };
}

// ─── Stats ─────────────────────────────────────────────────────────────────────

const avg = (n: number[]) => (n.length === 0 ? 0 : Math.round(n.reduce((a, b) => a + b, 0) / n.length));
const median = (n: number[]) => {
  if (n.length === 0) return 0;
  const s = [...n].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const p95 = (n: number[]) => {
  if (n.length === 0) return 0;
  const s = [...n].sort((a, b) => a - b);
  return s[Math.min(Math.ceil(s.length * 0.95) - 1, s.length - 1)] ?? 0;
};
const pct = (n: number, d: number) => (d === 0 ? '—' : `${Math.round((n / d) * 100)}%`);

async function main() {
  const dishes = TEST_DISHES.slice(0, LIMIT);

  origLog(`\n${'═'.repeat(84)}`);
  origLog(`  OKYO — PRODUCTION MODEL VALIDATION`);
  origLog(`  ${MODEL_ID}  |  max_tokens=${MAX_TOKENS}  |  ${dishes.length} dishes across ${new Set(dishes.map((d) => d.category)).size} categories`);
  origLog(`  Real production path: generate → compact retry → coaching repair → analytics`);
  origLog(`${'═'.repeat(84)}\n`);
  origLog(`  Legend: C=compact fallback   R+=repair improved   R-=repair attempted, no gain   FALLBACK=mock/starter\n`);

  const results: RecipeResult[] = [];
  for (let i = 0; i < dishes.length; i++) {
    results.push(await runRecipe(dishes[i], i + 1, dishes.length));
    if (DELAY_MS > 0 && i < dishes.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  // Persist recipe dump for the usefulness audit.
  try {
    await mkdir(dirname(OUT_PATH), { recursive: true });
    await writeFile(OUT_PATH, JSON.stringify(dumped, null, 2), 'utf8');
    origLog(`\n  Recipe dump written: ${OUT_PATH}`);
  } catch (err) {
    origLog(`\n  Failed to write recipe dump: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Report ──
  const n = results.length;
  const scores = results.map((r) => r.score);
  const durs = results.map((r) => r.durationMs);
  const successful = results.filter((r) => r.ok);
  const compactN = results.filter((r) => r.compact).length;
  const repairTrig = results.filter((r) => r.repairTriggered).length;
  const repairDel = results.filter((r) => r.repairDelivered).length;

  origLog(`\n${'═'.repeat(84)}`);
  origLog(`  GEMMA VALIDATION REPORT  (n=${n})`);
  origLog(`${'═'.repeat(84)}\n`);

  origLog(`  RELIABILITY`);
  origLog(`    Success (real AI recipe) : ${successful.length}/${n}  (${pct(successful.length, n)})`);
  origLog(`    Compact fallback         : ${compactN}/${n}  (${pct(compactN, n)})`);
  origLog(`    Fallback (mock/starter)  : ${n - successful.length}/${n}  (${pct(n - successful.length, n)})`);
  origLog(`    Repair triggered         : ${repairTrig}/${n}  (${pct(repairTrig, n)})`);
  origLog(`    Repair delivered         : ${repairDel}/${repairTrig || 1}  (${pct(repairDel, repairTrig || n)} of triggered)`);

  origLog(`\n  LATENCY`);
  origLog(`    Average : ${(avg(durs) / 1000).toFixed(1)}s`);
  origLog(`    Median  : ${(median(durs) / 1000).toFixed(1)}s`);
  origLog(`    p95     : ${(p95(durs) / 1000).toFixed(1)}s`);

  origLog(`\n  COACHING QUALITY (production score)`);
  origLog(`    Average : ${avg(scores)}/100`);
  origLog(`    Median  : ${median(scores)}/100`);
  origLog(`    Lowest  : ${Math.min(...scores)}/100`);
  origLog(`    Highest : ${Math.max(...scores)}/100`);

  origLog(`\n  FIELD COMPLETION (% of steps with field, averaged across recipes)`);
  for (const f of FIELDS) {
    const r = avg(results.map((x) => x.fieldRates[f]));
    const bar = '█'.repeat(Math.round(r / 5)) + '░'.repeat(20 - Math.round(r / 5));
    origLog(`    ${pad(f, 16)} ${bar} ${pad(r, 3, true)}%`);
  }

  origLog(`\n  PER-CATEGORY`);
  const cats = [...new Set(dishes.map((d) => d.category))];
  for (const cat of cats) {
    const r = results.filter((x) => x.category === cat);
    const cs = r.map((x) => x.score);
    origLog(
      `    ${pad(cat, 12)} avg ${pad(avg(cs), 3, true)}%  min ${pad(Math.min(...cs), 3, true)}%  max ${pad(Math.max(...cs), 3, true)}%  compact ${r.filter((x) => x.compact).length}/${r.length}  fallback ${r.filter((x) => !x.ok).length}/${r.length}`,
    );
  }

  origLog(`\n${'═'.repeat(84)}\n`);
}

main().catch((err) => {
  origError('Validation failed:', err);
  process.exit(1);
});
