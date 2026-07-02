#!/usr/bin/env tsx
/**
 * Prints the persistent recipe-quality analytics summary.
 *
 * Usage:  cd apps/api && npx tsx scripts/recipe-quality-report.ts
 * Flags:  --path /custom/recipe-quality-analytics.jsonl
 */

import { summarizeRecipeQuality, formatRecipeQualitySummary } from '../src/services/recipeQualityAnalytics.js';

const args = process.argv.slice(2);
const pathFlag = (() => { const i = args.indexOf('--path'); return i !== -1 ? args[i + 1] : undefined; })();

async function main() {
  const summary = await summarizeRecipeQuality(pathFlag);
  if (!summary) {
    console.log('No recipe-quality analytics data yet. Generate some recipes first.');
    return;
  }
  console.log(`\n${'═'.repeat(72)}`);
  console.log(formatRecipeQualitySummary(summary));
  console.log(`${'═'.repeat(72)}\n`);
}

main().catch((err) => {
  console.error('Report failed:', err);
  process.exit(1);
});
