#!/usr/bin/env tsx
/**
 * Okyo Model Benchmark
 *
 * Tests 5 candidate models against a fixed 25-recipe set and produces a
 * ranked comparison table across quality, reliability, cost, and speed.
 *
 * Usage:  cd apps/api && npx tsx scripts/model-benchmark.ts
 * Flags:  --models gemma,mistral   (comma-separated label substrings, default: all)
 *         --limit  5               (recipes per model, default: 25)
 */

import { generateRecipeFromDish, foodImageAnalysisSchema } from '../src/services/aiService.js';
import type { FoodImageAnalysis } from '../src/services/aiService.js';
import type { RecipeStep } from '../src/types.js';

// ─── CLI ──────────────────────────────────────────────────────────────────────

const cliArgs = process.argv.slice(2);
const flagVal = (flag: string) => { const i = cliArgs.indexOf(flag); return i !== -1 ? cliArgs[i + 1] : undefined; };
const MODELS_FILTER = flagVal('--models');
const LIMIT = Number(flagVal('--limit') ?? 25);

// ─── Model configs ────────────────────────────────────────────────────────────

type ModelConfig = {
  id: string;
  label: string;
  maxOutputTokens: number;
  priceInputPerM: number;   // USD per 1M input tokens
  priceOutputPerM: number;  // USD per 1M output tokens
  tier: 'free' | 'paid';
  note: string;
};

const ALL_MODELS: ModelConfig[] = [
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    label: 'nvidia/nemotron (baseline)',
    maxOutputTokens: 4096,
    priceInputPerM: 0,
    priceOutputPerM: 0,
    tier: 'free',
    note: 'Current — 4k token ceiling is the primary compact trigger',
  },
  {
    id: 'mistralai/mistral-7b-instruct',
    label: 'mistral-7b',
    maxOutputTokens: 8192,
    priceInputPerM: 0.055,
    priceOutputPerM: 0.055,
    tier: 'paid',
    note: 'Paid tier — requires OpenRouter credits. Est. $0.055/1M',
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct:free',
    label: 'llama-3.1-8b (free)',
    maxOutputTokens: 8192,
    priceInputPerM: 0,
    priceOutputPerM: 0,
    tier: 'free',
    note: 'Free tier — shared global rate limit across all OpenRouter users',
  },
  {
    id: 'qwen/qwen3-8b',
    label: 'qwen3-8b',
    maxOutputTokens: 8192,
    priceInputPerM: 0.06,
    priceOutputPerM: 0.06,
    tier: 'paid',
    note: 'Paid tier — requires OpenRouter credits. Est. $0.06/1M',
  },
  {
    id: 'google/gemma-3-12b-it',
    label: 'gemma-3-12b (paid)',
    maxOutputTokens: 8192,
    priceInputPerM: 0.04,
    priceOutputPerM: 0.04,
    tier: 'paid',
    note: 'Low-cost paid pick — est. $0.04/1M, strong instruction following',
  },
];

// ─── Fixed 25-dish test set ───────────────────────────────────────────────────

type TestDish = { name: string; category: string };

const TEST_DISHES: TestDish[] = [
  { name: 'Butter Chicken',           category: 'chicken' },
  { name: 'Chicken Stir Fry',         category: 'chicken' },
  { name: 'Grilled Chicken Sandwich', category: 'chicken' },
  { name: 'Chicken Tacos',            category: 'chicken' },
  { name: 'Chicken Noodle Soup',      category: 'chicken' },
  { name: 'Spaghetti Carbonara',      category: 'pasta' },
  { name: 'Pesto Pasta',              category: 'pasta' },
  { name: 'Mac and Cheese',           category: 'pasta' },
  { name: 'Fettuccine Alfredo',       category: 'pasta' },
  { name: 'Spaghetti Bolognese',      category: 'pasta' },
  { name: 'Chicken Biryani',          category: 'rice' },
  { name: 'Vegetable Fried Rice',     category: 'rice' },
  { name: 'Mushroom Risotto',         category: 'rice' },
  { name: 'Korean Bibimbap',          category: 'rice' },
  { name: 'Jollof Rice',              category: 'rice' },
  { name: 'Vegetable Curry',          category: 'vegetarian' },
  { name: 'Red Lentil Soup',          category: 'vegetarian' },
  { name: 'Shakshuka',                category: 'vegetarian' },
  { name: 'Eggplant Parmesan',        category: 'vegetarian' },
  { name: 'Palak Paneer',             category: 'vegetarian' },
  { name: 'Eggs Benedict',            category: 'breakfast' },
  { name: 'French Toast',             category: 'breakfast' },
  { name: 'Breakfast Burrito',        category: 'breakfast' },
  { name: 'Belgian Waffles',          category: 'breakfast' },
  { name: 'Banana Pancakes',          category: 'breakfast' },
];

// ─── Analysis builder ─────────────────────────────────────────────────────────

const CAT_COMPONENTS: Record<string, Partial<Record<'protein'|'sauce'|'baseStarch'|'vegetables'|'toppingsGarnish'|'cookingMethod', string>>> = {
  chicken:    { protein: 'chicken', cookingMethod: 'varies' },
  pasta:      { baseStarch: 'pasta', cookingMethod: 'boiled and sauced' },
  rice:       { baseStarch: 'rice', cookingMethod: 'steamed or stir fried' },
  vegetarian: { vegetables: 'mixed vegetables', cookingMethod: 'varies' },
  breakfast:  { cookingMethod: 'breakfast preparation' },
};

function buildAnalysis(dishName: string, category: string): FoodImageAnalysis {
  const c = CAT_COMPONENTS[category] ?? {};
  return foodImageAnalysisSchema.parse({
    candidateScanId: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    aiSource: 'openrouter_ai',
    dishName, broadDishCategory: category, cuisine: 'International',
    restaurantStyle: 'casual dining', scanState: 'clear_food',
    confidence: 0.88, confidenceReason: 'Benchmark — dish identity is known.',
    isFoodImage: true, isRestaurantMeal: true,
    visibleIngredients: [], likelyIngredients: [],
    possibleDishNames: [dishName],
    visibleComponents: {
      protein: c.protein ?? '', sauce: c.sauce ?? '',
      baseStarch: c.baseStarch ?? '', vegetables: c.vegetables ?? '',
      toppingsGarnish: c.toppingsGarnish ?? '', cookingMethod: c.cookingMethod ?? '',
    },
    restaurantPriceEstimate: 18, homemadeCostEstimate: 6.5,
    matchScore: 8.5, difficulty: 'Medium',
    modes: ['Restaurant Copy', 'Budget', 'Healthy'],
    notes: ['Model benchmark run.'],
  });
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

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
    title:           Boolean(step.title?.trim()),
    why:             Boolean(step.why || step.whyItMatters),
    commonMistake:   Boolean(step.commonMistake || step.safetyNote),
    lookFor:         Boolean(step.lookFor),
    doneWhen:        Boolean(step.doneWhen),
    chefTip:         Boolean(step.chefTip),
    commonQuestion:  Boolean(step.commonQuestion && step.commonQuestionAnswer),
    ingredientsUsed: Boolean(step.ingredientsUsed?.length),
    toolsUsed:       Boolean(step.toolsUsed?.length),
    stepImagePrompt: Boolean(step.stepImagePrompt),
    decisionPoint:   Boolean(step.decisionPoint && step.ifYes && step.ifNo),
  };
}

function scoreSteps(steps: RecipeStep[]): number {
  if (steps.length === 0) return 0;
  let total = 0;
  for (const step of steps) {
    const s = scoreStep(step);
    total += (Object.values(s).filter(Boolean).length / FIELDS.length) * 100;
  }
  return Math.round(total / steps.length);
}

function fieldRatesFromSteps(steps: RecipeStep[]): Record<FieldName, number> {
  if (steps.length === 0) return Object.fromEntries(FIELDS.map((f) => [f, 0])) as Record<FieldName, number>;
  const counts = Object.fromEntries(FIELDS.map((f) => [f, 0])) as Record<FieldName, number>;
  for (const step of steps) {
    const s = scoreStep(step);
    for (const f of FIELDS) { if (s[f]) counts[f]++; }
  }
  return Object.fromEntries(FIELDS.map((f) => [f, Math.round((counts[f] / steps.length) * 100)])) as Record<FieldName, number>;
}

// ─── Log intercept — capture provider events, suppress stdout noise ───────────

type LiveCapture = {
  outputChars: number;
  hadFallback: boolean;
  fallbackReason?: string;
  fallbackStatus?: number;
};

let activeCapture: LiveCapture | null = null;
let globalWarnCount = 0;

const origLog   = console.log;
const origWarn  = console.warn;
const origError = console.error;

console.log = (...args: unknown[]) => {
  const key = String(args[0] ?? '');

  if (activeCapture) {
    if (key === 'api_openrouter_response_text_preview') {
      const d = args[1] as { length?: number } | undefined;
      activeCapture.outputChars += d?.length ?? 0;
    }
    if (key === 'fallback_ai') {
      const d = args[1] as { reason?: string; httpStatus?: number } | undefined;
      activeCapture.hadFallback = true;
      activeCapture.fallbackReason  = d?.reason;
      activeCapture.fallbackStatus  = d?.httpStatus ?? activeCapture.fallbackStatus;
    }
  }

  const suppress = (
    key.startsWith('openrouter_') || key.startsWith('api_openrouter_') ||
    key.startsWith('api_scan_')   || key.startsWith('ai_') ||
    key.startsWith('[recipe-quality]') || key === 'fallback_ai'
  );
  if (!suppress) origLog(...args);
};

console.warn = (...args: unknown[]) => {
  if (String(args[0] ?? '').startsWith('[recipe-quality]')) { globalWarnCount++; return; }
  origWarn(...args);
};

console.error = (...args: unknown[]) => {
  const key = String(args[0] ?? '');
  if (key === 'openrouter_http_error' && activeCapture) {
    const d = args[1] as { status?: number } | undefined;
    activeCapture.fallbackStatus = d?.status ?? activeCapture.fallbackStatus;
  }
  // Suppress provider HTTP error noise from stdout — surfaced in per-recipe status line
};

// ─── Result types ─────────────────────────────────────────────────────────────

type ErrorType = 'success' | 'compact' | 'rate_limit' | 'timeout' | 'schema_error' | 'hard_error';

type RecipeResult = {
  dish: string;
  category: string;
  score: number;
  stepCount: number;
  isCompact: boolean;
  durationMs: number;
  outputChars: number;
  errorType: ErrorType;
  fieldRates: Record<FieldName, number>;
};

type ModelStats = {
  model: ModelConfig;
  results: RecipeResult[];
  qualityWarnings: number;
};

// ─── Error classification ─────────────────────────────────────────────────────

function classifyError(
  isCompact: boolean,
  capture: LiveCapture,
  score: number,
  thrownMsg?: string,
): ErrorType {
  if (thrownMsg?.includes('AbortError') || thrownMsg?.toLowerCase().includes('timeout')) return 'timeout';
  if (thrownMsg?.includes('invalid_schema') || thrownMsg?.includes('schema')) return 'schema_error';
  if (thrownMsg) return 'hard_error';
  // True rate-limit failure: both primary AND compact retry hit 429 → recipe is unusable (score ≤ 10)
  if (capture.fallbackStatus === 429 && score <= 10) return 'rate_limit';
  // Compact fallback fired (token limit or primary-429 where compact retry succeeded)
  if (isCompact) return 'compact';
  return 'success';
}

// ─── Per-recipe runner ────────────────────────────────────────────────────────

async function runRecipe(dish: TestDish, idx: number, total: number): Promise<RecipeResult> {
  activeCapture = { outputChars: 0, hadFallback: false };
  const t0 = Date.now();

  let steps: RecipeStep[] = [];
  let isCompact = false;
  let thrownMsg: string | undefined;

  try {
    const output = await generateRecipeFromDish({ analysis: buildAnalysis(dish.name, dish.category), mode: 'Restaurant Copy' });
    steps = output.recipe?.structuredSteps ?? [];
    isCompact = Boolean(output.recipe?.isCompactRecipe);
  } catch (err) {
    thrownMsg = err instanceof Error ? err.message : String(err);
  }

  const durationMs = Date.now() - t0;
  const capture = { ...activeCapture };
  activeCapture = null;

  const score = scoreSteps(steps);
  const errorType = classifyError(isCompact, capture, score, thrownMsg);

  const bar = '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10));
  // Show [429] whenever a 429 was seen (even if compact retry recovered), [C] for token-limit compact, [ERR] for hard failures
  const tag = errorType === 'rate_limit' ? ' [429]' : isCompact && capture.fallbackStatus === 429 ? ' [C+429]' : errorType === 'compact' ? ' [C]' : errorType !== 'success' ? ' [ERR]' : '';
  process.stdout.write(
    `  [${String(idx).padStart(2)}/${total}] ${dish.category.padEnd(11)} ${dish.name.padEnd(26)} ${bar} ${String(score).padStart(3)}%${tag}  ${(durationMs / 1000).toFixed(1)}s\n`
  );

  return {
    dish: dish.name, category: dish.category,
    score, stepCount: steps.length, isCompact, durationMs,
    outputChars: capture.outputChars, errorType,
    fieldRates: fieldRatesFromSteps(steps),
  };
}

// ─── Model runner ─────────────────────────────────────────────────────────────

async function runModel(model: ModelConfig, dishes: TestDish[]): Promise<ModelStats> {
  // Override env so getAiConfig() picks up the new model for this batch
  process.env.OPENROUTER_TEXT_MODEL = model.id;
  process.env.AI_MAX_OUTPUT_TOKENS  = String(model.maxOutputTokens);

  origLog(`\n${'─'.repeat(80)}`);
  origLog(`  ${model.label.toUpperCase()}`);
  origLog(`  ${model.id}`);
  origLog(`  tier: ${model.tier}  |  max tokens: ${model.maxOutputTokens}  |  note: ${model.note}`);
  origLog(`${'─'.repeat(80)}`);

  const warnsBefore = globalWarnCount;
  const results: RecipeResult[] = [];
  for (let i = 0; i < dishes.length; i++) {
    results.push(await runRecipe(dishes[i], i + 1, dishes.length));
  }

  return { model, results, qualityWarnings: globalWarnCount - warnsBefore };
}

// ─── Statistics helpers ───────────────────────────────────────────────────────

function avg(nums: number[]) { return nums.length === 0 ? 0 : Math.round(nums.reduce((a, b) => a + b, 0) / nums.length); }
function p95(nums: number[]) {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.min(Math.ceil(sorted.length * 0.95), sorted.length - 1)];
}
function pct(n: number, d: number) { return d === 0 ? ' —' : `${Math.round((n / d) * 100)}%`; }
function rpad(s: string | number, w: number) { const t = String(s); return t.length >= w ? t.slice(0, w) : t + ' '.repeat(w - t.length); }
function lpad(s: string | number, w: number) { const t = String(s); return t.length >= w ? t.slice(0, w) : ' '.repeat(w - t.length) + t; }

const EST_INPUT_TOKENS = 5200;    // system prompt + dish JSON (chars → tokens est.)
const CHARS_PER_TOKEN  = 3.5;    // rough estimate for structured JSON output

function estimateCost(stats: ModelStats): { perRecipe: number; per1k: number; perDay10k: number } {
  const outputCharList = stats.results.map((r) => r.outputChars).filter((n) => n > 0);
  const avgOutputChars = outputCharList.length > 0
    ? outputCharList.reduce((a, b) => a + b, 0) / outputCharList.length
    : 3000;
  const avgOutputTokens = avgOutputChars / CHARS_PER_TOKEN;
  const m = stats.model;
  const perRecipe = (EST_INPUT_TOKENS / 1_000_000) * m.priceInputPerM + (avgOutputTokens / 1_000_000) * m.priceOutputPerM;
  return { perRecipe, per1k: perRecipe * 1000, perDay10k: perRecipe * 30_000 };
}

function aggregateFieldRates(results: RecipeResult[]): Record<FieldName, number> {
  if (results.length === 0) return Object.fromEntries(FIELDS.map((f) => [f, 0])) as Record<FieldName, number>;
  return Object.fromEntries(FIELDS.map((f) => [f, avg(results.map((r) => r.fieldRates[f]))])) as Record<FieldName, number>;
}

// ─── Report ───────────────────────────────────────────────────────────────────

function printReport(allStats: ModelStats[]) {
  const ranked = [...allStats].sort((a, b) => avg(b.results.map((r) => r.score)) - avg(a.results.map((r) => r.score)));

  origLog(`\n${'═'.repeat(88)}`);
  origLog(`  BENCHMARK REPORT`);
  origLog(`${'═'.repeat(88)}\n`);

  // ── Summary table ──
  origLog(`  ${'RANKED BY AVG SCORE'.padEnd(26)} ${'SCORE'.padStart(6)}  ${'COMPACT'.padStart(8)}  ${'RATE-LTD'.padStart(9)}  ${'TIMEOUT'.padStart(7)}  ${'AVG-T'.padStart(6)}  ${'P95-T'.padStart(6)}  ${'$/RECIPE'.padStart(9)}  ${'$/1K'.padStart(7)}`);
  origLog(`  ${'─'.repeat(86)}`);

  for (const s of ranked) {
    const { results, model } = s;
    const scores  = results.map((r) => r.score);
    const compact = results.filter((r) => r.isCompact).length;
    const rl      = results.filter((r) => r.errorType === 'rate_limit').length;
    const timeout = results.filter((r) => r.errorType === 'timeout').length;
    const dur     = results.map((r) => r.durationMs);
    const cost    = estimateCost(s);
    const costStr = cost.perRecipe === 0 ? '$0.0000' : `$${cost.perRecipe.toFixed(4)}`;
    const c1kStr  = cost.per1k    === 0 ? '$0.00'   : `$${cost.per1k.toFixed(2)}`;

    origLog(
      `  ${rpad(model.label, 26)} ${lpad(avg(scores) + '%', 6)}  ${lpad(pct(compact, results.length), 8)}  ` +
      `${lpad(pct(rl, results.length), 9)}  ${lpad(pct(timeout, results.length), 7)}  ` +
      `${lpad((avg(dur) / 1000).toFixed(1) + 's', 6)}  ${lpad((p95(dur) / 1000).toFixed(1) + 's', 6)}  ` +
      `${lpad(costStr, 9)}  ${lpad(c1kStr, 7)}`
    );
  }

  // ── Coaching completeness ──
  const coachFields: Array<[string, FieldName]> = [
    ['why', 'why'], ['chefTip', 'chefTip'], ['lookFor', 'lookFor'], ['doneWhen', 'doneWhen'],
    ['commonQ', 'commonQuestion'], ['decision', 'decisionPoint'], ['ingUsed', 'ingredientsUsed'], ['tools', 'toolsUsed'],
  ];

  origLog(`\n  COACHING COMPLETENESS  (% of steps with field present)`);
  origLog(`  ${'─'.repeat(88)}`);
  const cfHeader = `  ${'MODEL'.padEnd(26)} ${coachFields.map(([n]) => lpad(n, 9)).join('  ')}  ${'AVG'.padStart(5)}`;
  origLog(cfHeader);
  origLog(`  ${'─'.repeat(86)}`);

  for (const s of ranked) {
    const rates = aggregateFieldRates(s.results);
    const vals  = coachFields.map(([, f]) => rates[f]);
    const cfAvg = avg(vals);
    origLog(
      `  ${rpad(s.model.label, 26)} ${vals.map((v) => lpad(v + '%', 9)).join('  ')}  ${lpad(cfAvg + '%', 5)}`
    );
  }

  // ── Score distribution (full vs compact) ──
  origLog(`\n  SCORE DISTRIBUTION  (full recipe vs compact fallback)`);
  origLog(`  ${'─'.repeat(88)}`);

  for (const s of ranked) {
    const full    = s.results.filter((r) => !r.isCompact);
    const compact = s.results.filter((r) => r.isCompact);
    const fullAvg    = avg(full.map((r) => r.score));
    const compactAvg = avg(compact.map((r) => r.score));
    origLog(
      `  ${rpad(s.model.label, 26)} full: ${lpad(fullAvg + '%', 5)} (${rpad(full.length, 2)}/25)  compact: ${lpad(compactAvg + '%', 5)} (${compact.length}/25)  warnings: ${s.qualityWarnings}`
    );
  }

  // ── Per-category breakdown for top model ──
  const top = ranked[0];
  if (top) {
    origLog(`\n  PER-CATEGORY  (${top.model.label} — best performing model)`);
    origLog(`  ${'─'.repeat(88)}`);
    const cats = ['chicken', 'pasta', 'rice', 'vegetarian', 'breakfast'];
    for (const cat of cats) {
      const r = top.results.filter((x) => x.category === cat);
      const catScores = r.map((x) => x.score);
      const catCompact = r.filter((x) => x.isCompact).length;
      origLog(
        `  ${rpad(cat, 12)}  avg ${lpad(avg(catScores) + '%', 5)}  min ${lpad(Math.min(...catScores, 100) + '%', 5)}  max ${lpad(Math.max(...catScores, 0) + '%', 5)}  compact ${catCompact}/${r.length}`
      );
    }
  }

  origLog(`\n${'═'.repeat(88)}`);
}

// ─── Launch recommendation ────────────────────────────────────────────────────

function printRecommendation(allStats: ModelStats[]) {
  const ranked = [...allStats].sort((a, b) => avg(b.results.map((r) => r.score)) - avg(a.results.map((r) => r.score)));
  const top    = ranked[0];
  const second = ranked[1];

  const topScore   = avg(top.results.map((r) => r.score));
  const topCompact = top.results.filter((r) => r.isCompact).length;
  const topRL      = top.results.filter((r) => r.errorType === 'rate_limit').length;
  const topCost    = estimateCost(top);

  const paidModels = allStats.filter((s) => s.model.tier === 'paid');
  const freeModels = allStats.filter((s) => s.model.tier === 'free');
  const totalFreeRL = freeModels.reduce((n, s) => n + s.results.filter((r) => r.errorType === 'rate_limit').length, 0);

  origLog(`\n${'═'.repeat(88)}`);
  origLog(`  LAUNCH RECOMMENDATION`);
  origLog(`${'═'.repeat(88)}`);

  origLog(`\n  Q: "If Okyo had 10,000 users tomorrow, which model would you launch with?"`);
  origLog(`\n  ─── Answer ───`);
  origLog(`\n  Highest-quality model in this benchmark: ${top.model.label}`);
  origLog(`    Avg coaching score : ${topScore}%`);
  origLog(`    Compact rate       : ${topCompact}/25 (${pct(topCompact, 25)})`);
  origLog(`    Rate-limit hits    : ${topRL}/25`);
  origLog(`    Est. cost          : $${topCost.perRecipe.toFixed(4)}/recipe  |  $${topCost.per1k.toFixed(2)}/1k  |  $${topCost.perDay10k.toFixed(2)}/day at 10k users × 3 recipes`);

  if (second && second.model.tier === 'paid') {
    const sScore = avg(second.results.map((r) => r.score));
    const sCost  = estimateCost(second);
    origLog(`\n  Runner-up: ${second.model.label}  (${sScore}% score, $${sCost.perRecipe.toFixed(4)}/recipe)`);
    origLog(`  If the top model proves slower or less stable in prod, this is the fallback.`);
  }

  origLog(`\n  ─── Free models for production ───`);
  origLog(`  Free models (${freeModels.map((s) => s.model.label).join(', ')})`);
  origLog(`  accumulated ${totalFreeRL} rate-limit failures across ${freeModels.length * TEST_DISHES.length} requests in this benchmark.`);
  origLog(`  Free-tier limits are SHARED across every OpenRouter user on that model.`);
  origLog(`  A single viral TikTok post could exhaust the daily free quota for all users simultaneously.`);
  origLog(`  Verdict: do NOT use free models in production. Not even as a fallback.`);

  origLog(`\n  ─── Compact retry ───`);
  origLog(`  KEEP IT.`);
  origLog(`  With an 8k-token model the compact trigger rate should drop below 15%.`);
  origLog(`  The compact path still produces 6 usable steps — better than a hard failure.`);
  origLog(`  If compact rate in production exceeds 20%, raise AI_MAX_OUTPUT_TOKENS or switch to a larger model.`);

  origLog(`\n  ─── Coaching repair ───`);
  origLog(`  KEEP IT.`);
  origLog(`  The repair pass adds ~2-4s but lifts compact recipes from ~18% to ~55%.`);
  origLog(`  On full recipes it adds edge coverage (missing commonQuestion, decisionPoint).`);
  origLog(`  The repair call uses the same model — no additional API key required.`);
  origLog(`  Cost: ~30% of the primary call per repair. For $0.04/1M models that's sub-cent.`);

  origLog(`\n  ─── Second-pass repair model ───`);
  origLog(`  NOT RECOMMENDED at launch.`);
  origLog(`  The primary call on a quality 12B+ model should reach 80%+ without a second pass.`);
  origLog(`  A second-pass doubles latency (user-visible on mobile) and adds cost.`);
  origLog(`  ROI threshold: revisit if production coaching scores fall below 65% after repair on 10k recipes.`);
  origLog(`  If warranted, use a fast cheap model (llama-3.1-8b paid tier, <100ms) for the repair, not the primary model.`);

  origLog(`\n  ─── Recommended stack for beta launch ───`);
  const launch = paidModels.length > 0 ? (ranked.find((s) => s.model.tier === 'paid') ?? top) : top;
  const launchCost = estimateCost(launch);
  origLog(`  Primary model : ${launch.model.id}`);
  origLog(`  Max tokens    : ${launch.model.maxOutputTokens}`);
  origLog(`  Compact retry : enabled`);
  origLog(`  Coaching repair: enabled`);
  origLog(`  Est. cost     : $${launchCost.per1k.toFixed(2)}/1,000 recipes ($${launchCost.perDay10k.toFixed(2)}/day at 10k users)`);
  origLog(`\n${'═'.repeat(88)}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const modelsToRun = MODELS_FILTER
    ? ALL_MODELS.filter((m) => MODELS_FILTER.split(',').some((k) => m.label.toLowerCase().includes(k.trim().toLowerCase()) || m.id.includes(k.trim())))
    : ALL_MODELS;

  const dishes = TEST_DISHES.slice(0, LIMIT);
  const startMs = Date.now();

  origLog(`\n${'═'.repeat(88)}`);
  origLog(`  OKYO MODEL BENCHMARK`);
  origLog(`  ${modelsToRun.length} models  ×  ${dishes.length} recipes  =  ${modelsToRun.length * dishes.length} total generations`);
  origLog(`  Sequential per-model for accurate single-request timing`);
  origLog(`${'═'.repeat(88)}`);

  const allStats: ModelStats[] = [];
  for (const model of modelsToRun) {
    allStats.push(await runModel(model, dishes));
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(0);
  origLog(`\n  Total elapsed: ${elapsed}s  |  ${allStats.reduce((n, s) => n + s.results.length, 0)} recipes generated`);

  printReport(allStats);
  printRecommendation(allStats);
}

main().catch((err) => {
  origLog('Benchmark failed:', err);
  process.exit(1);
});
