#!/usr/bin/env tsx
/**
 * Okyo Schema Complexity Diagnostic
 *
 * Controlled experiment: one dish ("Chicken Stir Fry") × 5 models × 3 schema variants.
 * Makes direct OpenRouter fetch calls to capture actual token counts and finish_reason.
 *
 * Goal: determine whether compact fallback is caused by the MODEL or the SCHEMA.
 *
 * Schema variants:
 *   A — Full production schema (all coaching fields, full nesting)
 *   B — Stripped schema (title, instruction, phase, estimatedMinutes, ingredientsUsed, toolsUsed only)
 *   C — Minimal schema (title, ingredients as strings, steps as strings)
 *
 * If A fails but C works  → output length or schema complexity is the bottleneck, not the model
 * If A and C both fail    → model capability or JSON-mode compatibility is the bottleneck
 * If A works              → the model is fine; failure in benchmark was external (rate limits, etc.)
 *
 * Usage:  cd apps/api && npx tsx scripts/schema-complexity-test.ts
 * Flags:  --models mistral,gemma    (comma-separated label substrings, default: all)
 *         --max-tokens 8192         (output token budget, default: 8192)
 */

import { config as loadDotenv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiRoot   = resolve(currentDir, '..');      // scripts/ → apps/api/
const repoRoot  = resolve(apiRoot, '../..');      // apps/api/ → repo root
loadDotenv({ path: resolve(repoRoot, '.env'), quiet: true });
loadDotenv({ path: resolve(apiRoot, '.env'), quiet: true });

// ─── CLI ──────────────────────────────────────────────────────────────────────

const cliArgs = process.argv.slice(2);
const flagVal = (flag: string) => { const i = cliArgs.indexOf(flag); return i !== -1 ? cliArgs[i + 1] : undefined; };
const MODELS_FILTER = flagVal('--models');
const MAX_TOKENS    = Number(flagVal('--max-tokens') ?? 8192);
const TIMEOUT_MS    = 90_000;  // Raised vs production 45s to give reasoning models a chance

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY?.trim();
if (!OPENROUTER_KEY) {
  console.error('OPENROUTER_API_KEY is not set. Check apps/api/.env');
  process.exit(1);
}

// ─── Models ───────────────────────────────────────────────────────────────────

type ModelConfig = { id: string; label: string };

const ALL_MODELS: ModelConfig[] = [
  { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', label: 'nvidia/nemotron (baseline)' },
  { id: 'mistralai/mistral-7b-instruct',                       label: 'mistral-7b' },
  { id: 'meta-llama/llama-3.1-8b-instruct:free',               label: 'llama-3.1-8b (free)' },
  { id: 'qwen/qwen3-8b',                                       label: 'qwen3-8b' },
  { id: 'google/gemma-3-12b-it',                               label: 'gemma-3-12b (paid)' },
];

// ─── Schema variants ──────────────────────────────────────────────────────────

type SchemaVariant = {
  key: 'A' | 'B' | 'C';
  label: string;
  description: string;
  buildPrompt: () => string;
  validateResponse: (json: unknown) => { valid: boolean; stepCount: number; hasCoaching: boolean };
};

const DISH = 'Chicken Stir Fry';

// ── Schema A: Full production prompt (copied faithfully from openRouterProvider) ──
const SCHEMA_A: SchemaVariant = {
  key: 'A',
  label: 'Full (production)',
  description: 'All coaching fields: why, lookFor, doneWhen, chefTip, commonMistake, decisionPoint, stepImagePrompt, commonQuestion, ingredientsUsed, toolsUsed',
  buildPrompt: () => [
    `Create a compact inspired-by homemade recipe JSON for "${DISH}" in the Restaurant Copy mode only.`,
    `The recipe MUST be a homemade version of "${DISH}" as scanned. Do not switch to a different dish.`,
    'Return ONLY valid minified JSON. No markdown, no prose, no reasoning, no extra text.',
    'Return exactly: {"selectedMode":"Restaurant Copy","restaurantCopy":{...recipe fields...}}',
    'Include ONLY "selectedMode" and "restaurantCopy". Do NOT include other mode keys.',
    'Recipe fields: title, description, ingredients, steps, avoidMistake, substitutions, storageAndReheating, pantryNote, prepTime, cookTime, totalTime, servings, skillLevel, groceryItems.',
    'Strict limits: ingredients 6-12, steps 8-14 (objects), substitutions max 3, groceryItems max 10.',
    'Ingredients: each is one string that starts with an exact amount, then a normal grocery-store name.',
    'COOKING PHASES — Every step object MUST include a "phase" integer (1-6). Steps MUST appear in phase order.',
    'Phase 1 Preparation: wash, slice, chop, dice, mince, measure. Phase 2 Setup: preheat, heat pan. Phase 3 Cooking: sear, fry, roast, sauté. Phase 4 Assembly: combine cooked components. Phase 5 Finishing: drizzle, garnish. Phase 6 Serving: plate and serve — MUST be final step.',
    'Steps: Each step is an object with ALL of these fields:',
    '"phase" (integer 1-6, required)',
    '"title" (2-4 word action phrase naming the actual ingredient, e.g. "Sear Chicken", "Build Sauce")',
    '"instruction" (one plain sentence, starts with action verb, includes exact amount, heat level, and time — under 35 words)',
    '"why" (one sentence explaining why this step matters to the final dish — must mention actual ingredient or technique)',
    '"lookFor" (REQUIRED — one sentence using color, texture, movement, or sound vocabulary. MUST name actual ingredient and specific observable state.)',
    '"doneWhen" (REQUIRED for cooking steps — one sentence with an unambiguous completion signal using color, texture, or temperature.)',
    '"chefTip" (REQUIRED on every step — one sentence of technique advice that names the actual ingredient or cooking method. Must teach something non-obvious.)',
    '"commonMistake" (one sentence — the most common error at this step and its consequence)',
    '"ingredientsUsed" (REQUIRED — array of ingredient name strings used in this step. Never empty.)',
    '"toolsUsed" (REQUIRED — array of tool/equipment strings needed for this step. Never empty.)',
    '"stepImagePrompt" (required — food photography generation prompt: "Close-up food photography, [food and state in vessel], [color/texture cue], [progress sign], warm restaurant lighting, 45-degree camera angle, shallow depth of field, no text, no watermark.")',
    '"commonQuestion" (optional — one real question a beginner asks at this exact step)',
    '"commonQuestionAnswer" (required if commonQuestion is set)',
    '"decisionPoint" (at least one per cooking phase — a yes/no sensory check using color, texture, temperature, smell)',
    '"ifYes" (required if decisionPoint is set — what to do when yes)',
    '"ifNo" (required if decisionPoint is set — what to do when no, with time and next check)',
    '"estimatedMinutes" (integer — realistic time for this step in minutes)',
    'Meat steps must include safe internal temperature (165°F/74°C for chicken).',
    `Food: {"dishName":"${DISH}","cuisine":"Chinese","broadDishCategory":"chicken","visibleIngredients":["chicken","broccoli","peppers"],"likelyIngredients":["soy sauce","garlic","ginger","sesame oil"]}`,
  ].join('\n'),
  validateResponse: (json) => {
    const obj = json as Record<string, unknown>;
    const rc = obj?.restaurantCopy as Record<string, unknown> | undefined;
    if (!rc) return { valid: false, stepCount: 0, hasCoaching: false };
    const steps = rc.steps as unknown[];
    if (!Array.isArray(steps)) return { valid: false, stepCount: 0, hasCoaching: false };
    const stepObjs = steps.filter((s) => s && typeof s === 'object');
    const hasCoaching = stepObjs.some((s) => {
      const step = s as Record<string, unknown>;
      return Boolean(step.why || step.chefTip || step.lookFor || step.doneWhen);
    });
    return { valid: stepObjs.length > 0, stepCount: stepObjs.length, hasCoaching };
  },
};

// ── Schema B: Stripped — remove all heavy coaching text fields ──
const SCHEMA_B: SchemaVariant = {
  key: 'B',
  label: 'Stripped (no coaching text)',
  description: 'Removes: why, lookFor, doneWhen, chefTip, commonMistake, decisionPoint, stepImagePrompt, commonQuestion — keeps: title, instruction, phase, estimatedMinutes, ingredientsUsed, toolsUsed',
  buildPrompt: () => [
    `Create a recipe JSON for "${DISH}" in the Restaurant Copy mode only.`,
    'Return ONLY valid minified JSON. No markdown, no prose.',
    'Return exactly: {"selectedMode":"Restaurant Copy","restaurantCopy":{...recipe fields...}}',
    'Recipe fields: title, description, ingredients, steps, prepTime, cookTime, totalTime, servings, skillLevel.',
    'Ingredients: each is a string with exact amount and ingredient name, e.g. "2 tablespoons soy sauce".',
    'Strict limits: ingredients 6-12, steps 8-14 objects.',
    'Steps: Each step is an object with ONLY these fields:',
    '"phase" (integer 1-6. Phase order: 1=Prep, 2=Setup, 3=Cook, 4=Assemble, 5=Finish, 6=Serve. Must be in order.)',
    '"title" (2-4 word action phrase, e.g. "Sear Chicken")',
    '"instruction" (one plain sentence with action verb, amount, heat level, and time)',
    '"ingredientsUsed" (array of ingredient name strings used in this step)',
    '"toolsUsed" (array of tool name strings needed for this step)',
    '"estimatedMinutes" (integer)',
    `Food: {"dishName":"${DISH}","cuisine":"Chinese","broadDishCategory":"chicken"}`,
  ].join('\n'),
  validateResponse: (json) => {
    const obj = json as Record<string, unknown>;
    const rc = obj?.restaurantCopy as Record<string, unknown> | undefined;
    if (!rc) return { valid: false, stepCount: 0, hasCoaching: false };
    const steps = rc.steps as unknown[];
    if (!Array.isArray(steps)) return { valid: false, stepCount: 0, hasCoaching: false };
    const stepObjs = steps.filter((s) => s && typeof s === 'object');
    return { valid: stepObjs.length > 0, stepCount: stepObjs.length, hasCoaching: false };
  },
};

// ── Schema C: Minimal — flat structure, no nesting, plain string steps ──
const SCHEMA_C: SchemaVariant = {
  key: 'C',
  label: 'Minimal (flat JSON)',
  description: 'Simplest possible: flat JSON with title, servings, ingredients (strings), steps (strings). No coaching fields, no nesting.',
  buildPrompt: () => [
    `Generate a recipe for "${DISH}" as JSON.`,
    'Return ONLY valid JSON. No markdown.',
    'Use exactly this structure:',
    '{"title":"string","servings":4,"ingredients":["exact amount + ingredient name",...],"steps":["step 1 text",...],"prepMinutes":10,"cookMinutes":15}',
    'Requirements: 6-10 ingredients with exact amounts, 6-10 steps as plain strings under 25 words each.',
  ].join('\n'),
  validateResponse: (json) => {
    const obj = json as Record<string, unknown>;
    const steps = obj?.steps as unknown[];
    const ingredients = obj?.ingredients as unknown[];
    if (!Array.isArray(steps) || !Array.isArray(ingredients)) return { valid: false, stepCount: 0, hasCoaching: false };
    return {
      valid: steps.length > 0 && ingredients.length > 0,
      stepCount: steps.length,
      hasCoaching: false,
    };
  },
};

const VARIANTS: SchemaVariant[] = [SCHEMA_A, SCHEMA_B, SCHEMA_C];

// ─── Direct OpenRouter call ───────────────────────────────────────────────────

type CallResult = {
  model: string;
  variant: string;
  success: boolean;
  finishReason: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  stepCount: number;
  hasCoaching: boolean;
  valid: boolean;
  errorType?: string;
  errorDetail?: string;
};

async function callOpenRouter(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<CallResult & { raw?: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const t0 = Date.now();

  const body = JSON.stringify({
    model,
    max_tokens:      maxTokens,
    temperature:     0.2,
    response_format: { type: 'json_object' },
    reasoning:       { enabled: false },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
  });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization:   `Bearer ${OPENROUTER_KEY}`,
        'Content-Type':  'application/json',
        'HTTP-Referer':  'https://okyo.local',
        'X-Title':       'Okyo Schema Diagnostic',
      },
      body,
    });

    clearTimeout(timer);
    const durationMs = Date.now() - t0;

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let detail = text.slice(0, 200);
      try { detail = JSON.stringify((JSON.parse(text) as Record<string, unknown>)?.error ?? detail); } catch { /* noop */ }
      return {
        model, variant: '', success: false,
        finishReason: null, promptTokens: 0, completionTokens: 0, totalTokens: 0,
        durationMs, stepCount: 0, hasCoaching: false, valid: false,
        errorType: `http_${response.status}`,
        errorDetail: detail,
      };
    }

    const json = await response.json() as Record<string, unknown>;
    const usage = json.usage as Record<string, number> | undefined;
    const choice = (json.choices as Array<Record<string, unknown>> | undefined)?.[0];
    const finishReason = (choice?.finish_reason as string | undefined) ?? null;
    const message = choice?.message as Record<string, unknown> | undefined;
    const content = message?.content;

    const promptTokens     = usage?.prompt_tokens     ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;
    const totalTokens      = usage?.total_tokens      ?? (promptTokens + completionTokens);

    let parsed: unknown = null;
    let errorType: string | undefined;
    let errorDetail: string | undefined;

    try {
      const text = typeof content === 'string' ? content.trim() : JSON.stringify(content);
      // Strip markdown fences if present
      const candidate = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim() ?? text;
      parsed = JSON.parse(candidate);
    } catch {
      errorType   = 'json_parse_error';
      errorDetail = finishReason === 'length' ? 'Output truncated before JSON completed' : 'Response is not valid JSON';
    }

    return {
      model, variant: '', success: !errorType,
      finishReason, promptTokens, completionTokens, totalTokens,
      durationMs, stepCount: 0, hasCoaching: false, valid: false,
      errorType, errorDetail,
      raw: parsed,
    };
  } catch (err) {
    clearTimeout(timer);
    const durationMs = Date.now() - t0;
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      model, variant: '', success: false,
      finishReason: null, promptTokens: 0, completionTokens: 0, totalTokens: 0,
      durationMs, stepCount: 0, hasCoaching: false, valid: false,
      errorType: isAbort ? 'timeout' : 'network_error',
      errorDetail: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function pad(s: string | number, w: number, right = false) {
  const t = String(s);
  if (t.length >= w) return t.slice(0, w);
  const p = ' '.repeat(w - t.length);
  return right ? p + t : t + p;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const modelsToRun = MODELS_FILTER
    ? ALL_MODELS.filter((m) =>
        MODELS_FILTER.split(',').some((k) =>
          m.label.toLowerCase().includes(k.trim().toLowerCase()) || m.id.includes(k.trim())
        )
      )
    : ALL_MODELS;

  const systemPrompt = 'You are Okyo, a recipe assistant. Return ONLY valid JSON. No markdown. No reasoning. No explanations.';

  console.log(`\n${'═'.repeat(88)}`);
  console.log(`  OKYO SCHEMA COMPLEXITY DIAGNOSTIC`);
  console.log(`  Dish: ${DISH}  |  ${modelsToRun.length} models × ${VARIANTS.length} schema variants = ${modelsToRun.length * VARIANTS.length} API calls`);
  console.log(`  max_tokens=${MAX_TOKENS}  timeout=${TIMEOUT_MS / 1000}s  (raised vs prod 45s)`);
  console.log(`${'═'.repeat(88)}\n`);

  const allResults: (CallResult & { variantKey: string })[] = [];

  for (const model of modelsToRun) {
    console.log(`\n  ${model.label}`);
    console.log(`  ${model.id}`);
    console.log(`  ${'─'.repeat(80)}`);
    console.log(`  ${'VARIANT'.padEnd(26)}  ${'FINISH'.padEnd(8)}  ${'IN-TOK'.padStart(7)}  ${'OUT-TOK'.padStart(7)}  ${'STEPS'.padStart(5)}  ${'COACHED'.padStart(7)}  ${'VALID'.padStart(5)}  ${'TIME'.padStart(7)}`);
    console.log(`  ${'─'.repeat(80)}`);

    for (const variant of VARIANTS) {
      const rawResult = await callOpenRouter(model.id, systemPrompt, variant.buildPrompt(), MAX_TOKENS);
      const validation = rawResult.raw ? variant.validateResponse(rawResult.raw) : { valid: false, stepCount: 0, hasCoaching: false };

      const result: CallResult & { variantKey: string } = {
        ...rawResult,
        variant:     `${variant.key}: ${variant.label}`,
        variantKey:  variant.key,
        valid:       validation.valid,
        stepCount:   validation.stepCount,
        hasCoaching: validation.hasCoaching,
      };
      allResults.push(result);

      const finish  = rawResult.errorType ?? rawResult.finishReason ?? '?';
      const steps   = validation.stepCount > 0 ? String(validation.stepCount) : '—';
      const coached = validation.hasCoaching ? 'YES' : (rawResult.errorType ? 'ERR' : 'no');
      const valid   = validation.valid ? 'YES' : 'no';
      const time    = `${(rawResult.durationMs / 1000).toFixed(1)}s`;

      console.log(
        `  ${pad(`${variant.key}: ${variant.label}`, 26)}  ` +
        `${pad(finish.slice(0, 8), 8)}  ` +
        `${pad(rawResult.promptTokens || '—', 7, true)}  ` +
        `${pad(rawResult.completionTokens || '—', 7, true)}  ` +
        `${pad(steps, 5, true)}  ` +
        `${pad(coached, 7, true)}  ` +
        `${pad(valid, 5, true)}  ` +
        `${pad(time, 7, true)}`
      );

      if (rawResult.errorType && rawResult.errorDetail) {
        console.log(`    ↳ ${rawResult.errorType}: ${rawResult.errorDetail.slice(0, 100)}`);
      }
    }
  }

  // ─── Root-cause report ────────────────────────────────────────────────────

  console.log(`\n${'═'.repeat(88)}`);
  console.log(`  ROOT-CAUSE ANALYSIS`);
  console.log(`${'═'.repeat(88)}\n`);

  // Pivot: per variant, how many models succeeded?
  for (const variant of VARIANTS) {
    const vResults = allResults.filter((r) => r.variantKey === variant.key);
    const succeeded = vResults.filter((r) => r.valid);
    const avgIn  = vResults.filter((r) => r.promptTokens > 0).reduce((a, r) => a + r.promptTokens, 0) /
                   Math.max(vResults.filter((r) => r.promptTokens > 0).length, 1);
    const avgOut = vResults.filter((r) => r.completionTokens > 0).reduce((a, r) => a + r.completionTokens, 0) /
                   Math.max(vResults.filter((r) => r.completionTokens > 0).length, 1);
    const truncated = vResults.filter((r) => r.finishReason === 'length');
    const timeouts  = vResults.filter((r) => r.errorType === 'timeout');
    const httpErrs  = vResults.filter((r) => r.errorType?.startsWith('http_'));

    console.log(`  Schema ${variant.key}: ${variant.label}`);
    console.log(`  ${variant.description}`);
    console.log(`  Success: ${succeeded.length}/${vResults.length} models  |  avg prompt_tokens: ${Math.round(avgIn)}  |  avg completion_tokens: ${Math.round(avgOut)}`);
    console.log(`  Truncated (finish_reason=length): ${truncated.length}  |  Timeouts: ${timeouts.length}  |  HTTP errors: ${httpErrs.length}`);
    console.log();
  }

  // Cross-model pattern analysis
  console.log(`  ─── Pattern analysis ───\n`);

  for (const model of modelsToRun) {
    const mResults = allResults.filter((r) => r.model === model.id);
    const aResult = mResults.find((r) => r.variantKey === 'A');
    const bResult = mResults.find((r) => r.variantKey === 'B');
    const cResult = mResults.find((r) => r.variantKey === 'C');

    const aOk = aResult?.valid ?? false;
    const bOk = bResult?.valid ?? false;
    const cOk = cResult?.valid ?? false;

    let diagnosis = '';
    if (aOk && bOk && cOk) {
      diagnosis = '✓ MODEL IS CAPABLE. All schema variants succeed. Production failures are external (rate limits, timeout).';
    } else if (!aOk && !bOk && cOk) {
      diagnosis = '⚠ JSON MODE COMPATIBILITY. Model can produce flat JSON but fails nested {restaurantCopy:...} wrapper. Schema structure is the bottleneck.';
    } else if (!aOk && bOk && cOk) {
      diagnosis = '⚠ OUTPUT LENGTH. Model handles simple schemas but full coaching payload exceeds token budget or instruction following limits.';
    } else if (!aOk && bOk && !cOk) {
      diagnosis = '⚠ SCHEMA STRUCTURE. Model handles the nested wrapper but fails on flat JSON or full coaching. Mixed compatibility.';
    } else if (!aOk && !bOk && !cOk) {
      const isTimeout = mResults.every((r) => r.errorType === 'timeout');
      const isHttp    = mResults.every((r) => r.errorType?.startsWith('http_'));
      if (isTimeout) diagnosis = '✗ LATENCY / TIMEOUT. Model exceeds 90s on all schema variants. Cannot be used without disabling reasoning or raising timeout significantly.';
      else if (isHttp) diagnosis = '✗ API ACCESS. HTTP error on all variants — likely missing credits, rate limit, or model not available on this account.';
      else diagnosis = '✗ CANNOT FOLLOW JSON INSTRUCTIONS. No schema variant produces valid output. Model is not suitable for structured recipe generation.';
    } else {
      diagnosis = `? MIXED RESULTS. A=${aOk}, B=${bOk}, C=${cOk}. Requires deeper investigation.`;
    }

    const aFinish = aResult?.errorType ?? aResult?.finishReason ?? '?';
    const bFinish = bResult?.errorType ?? bResult?.finishReason ?? '?';
    const cFinish = cResult?.errorType ?? cResult?.finishReason ?? '?';

    console.log(`  ${model.label}`);
    console.log(`  Schema A (full):     ${aOk ? '✓ valid' : '✗ invalid'}  finish=${aFinish}  out=${aResult?.completionTokens ?? 0} tokens  ${(aResult?.durationMs ?? 0) / 1000}s`);
    console.log(`  Schema B (stripped): ${bOk ? '✓ valid' : '✗ invalid'}  finish=${bFinish}  out=${bResult?.completionTokens ?? 0} tokens  ${(bResult?.durationMs ?? 0) / 1000}s`);
    console.log(`  Schema C (minimal):  ${cOk ? '✓ valid' : '✗ invalid'}  finish=${cFinish}  out=${cResult?.completionTokens ?? 0} tokens  ${(cResult?.durationMs ?? 0) / 1000}s`);
    console.log(`  → ${diagnosis}`);
    console.log();
  }

  // Bottleneck verdict
  const anyASuccess = allResults.filter((r) => r.variantKey === 'A' && r.valid).length;
  const anyCSuccess = allResults.filter((r) => r.variantKey === 'C' && r.valid).length;
  const avgATokens  = allResults.filter((r) => r.variantKey === 'A' && r.completionTokens > 0)
    .reduce((a, r) => a + r.completionTokens, 0) /
    Math.max(allResults.filter((r) => r.variantKey === 'A' && r.completionTokens > 0).length, 1);

  console.log(`  ─── Primary bottleneck verdict ───\n`);
  if (anyASuccess === 0 && anyCSuccess > 0) {
    console.log(`  BOTTLENECK: SCHEMA COMPLEXITY AND/OR OUTPUT LENGTH`);
    console.log(`  No model produced a valid full-schema (A) recipe, but ${anyCSuccess}/${modelsToRun.length} succeeded with minimal JSON (C).`);
    console.log(`  The recipe generation prompt is either too large for the models' JSON-following capability,`);
    console.log(`  or the full coached recipe exceeds available output tokens.`);
    console.log(`  Fix: (1) simplify the step schema, (2) raise max_tokens, or (3) use a two-pass approach.`);
  } else if (anyASuccess > 0 && anyCSuccess > 0) {
    console.log(`  BOTTLENECK: MIXED — SOME MODELS CAPABLE, SOME NOT`);
    console.log(`  ${anyASuccess}/${modelsToRun.length} models successfully produced full coached recipes.`);
    console.log(`  The schema is workable — select the models that pass Schema A for production.`);
  } else if (anyASuccess === 0 && anyCSuccess === 0) {
    console.log(`  BOTTLENECK: EXTERNAL FACTORS (RATE LIMITS / API ACCESS)`);
    console.log(`  No model produced valid output for any schema variant.`);
    console.log(`  This likely reflects exhausted rate limits or missing API credits, not model capability.`);
    console.log(`  Re-run on a fresh day with a funded OpenRouter account.`);
  }

  if (avgATokens > 0) {
    console.log(`\n  Avg output tokens for Schema A (full): ${Math.round(avgATokens)}`);
    console.log(`  At this rate, max_tokens needed: ${Math.round(avgATokens * 1.3)} (30% headroom)`);
    if (avgATokens * 1.3 > 8192) {
      console.log(`  → Schema A requires MORE than 8192 output tokens. This is the primary compact trigger.`);
      console.log(`  → Either raise max_tokens to ${Math.round(avgATokens * 1.3)} or reduce the step field count.`);
    } else {
      console.log(`  → Schema A fits within 8192 tokens. Token limit is NOT the primary bottleneck.`);
    }
  }

  console.log(`\n${'═'.repeat(88)}\n`);
}

main().catch((err) => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
