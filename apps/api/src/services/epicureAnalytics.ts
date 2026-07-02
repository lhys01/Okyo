/**
 * Epicure usage analytics — internal, no UI.
 *
 * Records one row per enrichment attempt so we can answer "is Epicure actually
 * helping?": how often enrichment runs, how many ingredients it sees, how many
 * suggestions it returns, and across which generation modes.
 *
 * Design constraints (mirrors recipeQualityAnalytics.ts):
 *  - Best-effort and non-blocking: a failed write NEVER affects recipe delivery.
 *  - Off-switch: set EPICURE_ANALYTICS=off to disable file logging entirely.
 *  - Configurable path via EPICURE_ANALYTICS_PATH (default apps/api/data/).
 *  - Operator tooling only — no user-facing output.
 */

import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { RecipeMode } from '../types.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
// apps/api/src/services → apps/api
const apiRoot = resolve(currentDir, '../..');
const DEFAULT_ANALYTICS_PATH = resolve(apiRoot, 'data/epicure-analytics.jsonl');

export type EpicureUsageEvent = {
  epicureUsed: boolean;        // enrichment produced at least one usable suggestion
  ingredientCount: number;     // detected ingredients fed into Epicure
  suggestionCount: number;     // total suggestions returned (complementary + subs)
  generationMode: RecipeMode;  // mode the recipe was generated under
};

function analyticsPath(): string {
  return process.env.EPICURE_ANALYTICS_PATH?.trim() || DEFAULT_ANALYTICS_PATH;
}

function isEnabled(): boolean {
  return process.env.EPICURE_ANALYTICS !== 'off';
}

let writeWarned = false;

/**
 * Records one Epicure usage event. Fire-and-forget: callers should NOT await this
 * on the request hot path. Always logs a compact console line (dev only) and, when
 * enabled, appends a JSONL row. Errors are swallowed (logged once).
 */
export function logEpicureUsage(event: EpicureUsageEvent): void {
  if (process.env.NODE_ENV !== 'production') {
    console.log('epicure_usage', event);
  }

  if (!isEnabled()) {
    return;
  }

  const row = { timestamp: new Date().toISOString(), ...event };
  const path = analyticsPath();
  void (async () => {
    try {
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, `${JSON.stringify(row)}\n`, 'utf8');
    } catch (error) {
      if (!writeWarned) {
        writeWarned = true;
        console.warn('[epicure] analytics write failed (further errors suppressed)', {
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  })();
}
