/**
 * Recipe Quality Analytics — internal, no UI.
 *
 * A lightweight persistent layer that records one JSONL row per generated recipe
 * so we can answer "is recipe quality holding up?" across thousands of recipes:
 * average coaching score, repair rate + improvement, compact fallback rate,
 * latency, and the most common coaching issues (generic why, weak lookFor, …).
 *
 * Design constraints:
 *  - Best-effort and non-blocking: a failed write NEVER affects recipe delivery.
 *  - Off-switch: set RECIPE_QUALITY_ANALYTICS=off to disable entirely.
 *  - Configurable path via RECIPE_QUALITY_ANALYTICS_PATH (default apps/api/data/).
 *  - No user-facing output — this is operator tooling only.
 */

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
// apps/api/src/services → apps/api
const apiRoot = resolve(currentDir, '../..');
const DEFAULT_ANALYTICS_PATH = resolve(apiRoot, 'data/recipe-quality-analytics.jsonl');

function analyticsPath(): string {
  return process.env.RECIPE_QUALITY_ANALYTICS_PATH?.trim() || DEFAULT_ANALYTICS_PATH;
}

function isEnabled(): boolean {
  return process.env.RECIPE_QUALITY_ANALYTICS !== 'off';
}

export type RecipeQualityEvent = {
  timestamp: string;
  model: string;
  dish: string;
  category: string;
  score: number;             // final coaching score 0–100 (post-repair if applied)
  initialScore: number;      // pre-repair coaching score
  repairUsed: boolean;       // a repaired recipe was delivered
  repairImprovement: number; // finalScore − initialScore when repair delivered, else 0
  repairSuccess: boolean;    // repair delivered AND improved the score
  compact: boolean;          // compact fallback path produced this recipe
  generationMs: number;      // wall-clock time for the full generation
  stepCount: number;
  warnings: Record<string, number>; // coaching-quality issue tag → count
};

let writeWarned = false;

// Records one recipe-quality event. Best-effort: errors are swallowed (logged
// once) so analytics can never break recipe generation. Fire-and-forget — the
// caller should NOT await this on the request hot path.
export async function recordRecipeQuality(
  event: Omit<RecipeQualityEvent, 'timestamp'> & { timestamp?: string },
): Promise<void> {
  if (!isEnabled()) return;
  const path = analyticsPath();
  const row: RecipeQualityEvent = {
    timestamp: event.timestamp ?? new Date().toISOString(),
    ...event,
  };
  try {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(row)}\n`, 'utf8');
  } catch (error) {
    if (!writeWarned) {
      writeWarned = true;
      console.warn('[recipe-quality] analytics write failed (further errors suppressed)', {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export type RecipeQualitySummary = {
  totalRecipes: number;
  byModel: Record<string, number>;
  averageScore: number;
  medianScore: number;
  minScore: number;
  maxScore: number;
  compactRate: number;       // fraction 0–1
  repairRate: number;        // fraction of recipes where repair was delivered
  repairSuccessRate: number; // fraction of repaired recipes that improved
  averageRepairImprovement: number;
  averageGenerationMs: number;
  p95GenerationMs: number;
  commonIssues: Array<{ issue: string; recipes: number; rate: number }>; // rate = fraction of recipes with ≥1 of this issue
};

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function p95(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.min(Math.ceil(sorted.length * 0.95) - 1, sorted.length - 1)] ?? 0;
}

// Reads the analytics log and computes an aggregate quality summary. Returns null
// when there is no data yet. Tolerates malformed lines (skips them).
export async function summarizeRecipeQuality(path?: string): Promise<RecipeQualitySummary | null> {
  const file = path ?? analyticsPath();
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return null;
  }

  const events: RecipeQualityEvent[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as RecipeQualityEvent);
    } catch {
      // skip malformed line
    }
  }
  if (events.length === 0) return null;

  const scores = events.map((e) => e.score);
  const byModel: Record<string, number> = {};
  for (const e of events) byModel[e.model] = (byModel[e.model] ?? 0) + 1;

  const repaired = events.filter((e) => e.repairUsed);
  const repairedSucceeded = repaired.filter((e) => e.repairSuccess);

  // Common issues: count how many RECIPES had at least one of each warning tag.
  const issueRecipeCounts: Record<string, number> = {};
  for (const e of events) {
    for (const tag of Object.keys(e.warnings ?? {})) {
      issueRecipeCounts[tag] = (issueRecipeCounts[tag] ?? 0) + 1;
    }
  }
  const commonIssues = Object.entries(issueRecipeCounts)
    .map(([issue, recipes]) => ({
      issue: issue.replace('[recipe-quality] ', ''),
      recipes,
      rate: recipes / events.length,
    }))
    .sort((a, b) => b.recipes - a.recipes);

  return {
    totalRecipes: events.length,
    byModel,
    averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    medianScore: median(scores),
    minScore: Math.min(...scores),
    maxScore: Math.max(...scores),
    compactRate: events.filter((e) => e.compact).length / events.length,
    repairRate: repaired.length / events.length,
    repairSuccessRate: repaired.length > 0 ? repairedSucceeded.length / repaired.length : 0,
    averageRepairImprovement: repaired.length > 0
      ? Math.round(repaired.reduce((a, e) => a + e.repairImprovement, 0) / repaired.length)
      : 0,
    averageGenerationMs: Math.round(events.reduce((a, e) => a + e.generationMs, 0) / events.length),
    p95GenerationMs: p95(events.map((e) => e.generationMs)),
    commonIssues,
  };
}

// ── Platter coverage analytics ────────────────────────────────────────────────

export type PlatterCoverageEvent = {
  timestamp: string;
  dish: string;
  model: string;
  broadDishCategory: string;
  detectedComponentCount: number;
  generatedComponentCount: number;
  missingComponentCount: number;
  missingComponentNames: string[];    // actionable: shows WHICH components were missed
  coveragePercent: number;            // pre-repair
  finalCoveragePercent: number;       // post-repair (same as coveragePercent when repair didn't run)
  repairTriggered: boolean;
  repairAddedComponents: number;
  repairSucceeded: boolean;           // finalCoveragePercent > coveragePercent
};

const DEFAULT_PLATTER_ANALYTICS_PATH = resolve(apiRoot, 'data/platter-coverage-analytics.jsonl');

function platterAnalyticsPath(): string {
  return process.env.PLATTER_COVERAGE_ANALYTICS_PATH?.trim() || DEFAULT_PLATTER_ANALYTICS_PATH;
}

// Separate flag so a recipe-quality write failure doesn't suppress platter warnings.
let platterWriteWarned = false;

// Best-effort, fire-and-forget — never blocks recipe delivery.
export async function recordPlatterCoverage(
  event: Omit<PlatterCoverageEvent, 'timestamp'> & { timestamp?: string },
): Promise<void> {
  if (!isEnabled()) return;
  const path = platterAnalyticsPath();
  const row: PlatterCoverageEvent = {
    timestamp: event.timestamp ?? new Date().toISOString(),
    ...event,
  };
  try {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(row)}\n`, 'utf8');
  } catch (error) {
    if (!platterWriteWarned) {
      platterWriteWarned = true;
      console.warn('[platter-coverage] analytics write failed (further errors suppressed)', {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Formats a summary as a human-readable report block for the CLI / operator logs.
export function formatRecipeQualitySummary(summary: RecipeQualitySummary): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const lines: string[] = [
    'Recipe Quality Summary',
    '',
    `  Recipes analyzed : ${summary.totalRecipes}`,
    `  Models           : ${Object.entries(summary.byModel).map(([m, n]) => `${m} (${n})`).join(', ')}`,
    `  Average score    : ${summary.averageScore}/100  (median ${summary.medianScore}, min ${summary.minScore}, max ${summary.maxScore})`,
    `  Compact rate     : ${pct(summary.compactRate)}`,
    `  Repair rate      : ${pct(summary.repairRate)}  (success ${pct(summary.repairSuccessRate)}, avg +${summary.averageRepairImprovement} pts)`,
    `  Generation time  : ${(summary.averageGenerationMs / 1000).toFixed(1)}s avg, ${(summary.p95GenerationMs / 1000).toFixed(1)}s p95`,
    '',
    '  Common Issues:',
  ];
  if (summary.commonIssues.length === 0) {
    lines.push('    none — every recipe was fully coached');
  } else {
    for (const issue of summary.commonIssues.slice(0, 12)) {
      lines.push(`    ${issue.issue} (${pct(issue.rate)} of recipes, ${issue.recipes})`);
    }
  }
  return lines.join('\n');
}
