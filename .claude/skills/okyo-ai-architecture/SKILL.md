---
name: Okyo AI Architecture
description: Use when changing AI model routing, providers, fallback chains, caching, timeouts, cost controls, latency, or benchmarking/evaluating models.
---

# Okyo AI Architecture

## When to use this

Any change to which model runs, how it's called, what happens when it fails, what it costs, or how we prove a model is better.

## THE lesson (costliest mistake in Okyo's history — founder-confirmed)

**Model/provider flailing.** Weeks were burned chasing free models (Gemma: too slow; nemotron; truncation bugs), and a slow/failing pipeline was misdiagnosed as an architecture problem when the real cause was an **unfunded OpenRouter account** (June 2026). Rules that fell out of that:

1. When scans get slow or flaky, **check the OpenRouter account is funded FIRST**, before touching code.
2. Free models are failover insurance, never the primary path. The paid default is `openai/gpt-4o-mini`.
3. No model change ships on vibes. Run `scripts/model-benchmark.ts` and compare the ranked table.
4. Latency work: dominant cost is model inference, not architecture. Path to a 10–15s scan is a faster paid model + lower timeout — not a rewrite. Profiling instrumentation already exists.

## Routing map (read before any change)

- `apps/api/src/config/aiConfig.ts` — defaults: vision + text `openai/gpt-4o-mini`, 45s timeout, 1024 max output tokens. **Never change the default model path unless explicitly asked** (CLAUDE.md hard rule).
- `apps/api/src/config/costControlConfig.ts` — per-IP scan rate limit, global daily AI cap (default 200), image ≤ 10MB, image-gen kill switch, Fable cap.
- `apps/api/src/config/openRouter.ts` — provider plumbing.
- **Fable 5 is a model selection, not a second provider** — same OpenRouter endpoint. Opt-in only: requires `FABLE_ENABLED=true` AND `x-okyo-model: fable` header. **Fails closed** — no silent fallback to another model. Hard cap 10/day, clamped in code (`FABLE_DAILY_REQUEST_CAP_HARD_MAX`); env can only lower it. Fable is ~60–80× gpt-4o-mini per request. See `docs/wiki/FABLE_ROUTING.md`.
- `getRecipeModelChain()` (in `openRouterProvider.ts`) is the single guard keeping Fable fail-closed. Review it on EVERY routing change — an unconditional fallback append silently reintroduces cross-model fallback (docs/wiki/KNOWN_RISKS.md #4).
- `apps/api/src/services/aiService.ts` (~4,650 lines, over budget) — `analyzeFoodImage`, `generateRecipeFromDish`, `createAiScan`, Zod schemas. Extract into new services when touched; do not grow it.
- `apps/api/src/services/openRouterProvider.ts` — prompts live here (`getRecipePrompt`, retry prompt).

## Resilience & caching

- Failover chain: 3 free models with backoff behind the primary (June 2026 pipeline-resilience work).
- Recipe cache: 7-day TTL — same dish doesn't re-bill.
- Honesty rules for failures/fallbacks: defer to the okyo-ai-safety skill (binding) — real failures are never masked by mock data.
- All model output is untrusted: Zod-validate (`foodImageAnalysisSchema`, `generatedRecipeOutputSchema`), then repair via `recipeIngredientValidation.ts`.

## Cost control state

- Current caps are **in-memory and reset on every server restart** — acceptable for dev, blocking for public beta.
- The fix is in flight: Supabase migration `202607120001_initial_okyo_cohort_schema.sql` implements per-user + global daily scan caps with transaction-level advisory locks on UTC date. Move cap enforcement there before any public endpoint.
- Never deploy with `FABLE_ENABLED=true` on a public endpoint.

## Evaluation procedure (the only way to change models)

- `cd apps/api && npx tsx scripts/model-benchmark.ts --limit 5` — models × recipes, ranked table. **Spends real OpenRouter credits**; start with `--limit 5`, never run the full matrix unprompted.
- `scripts/quality-stress-test.ts`, `scripts/recipe-quality-report.ts`, `scripts/schema-complexity-test.ts`.
- Persistent quality analytics: `recipeQualityAnalytics.ts` (JSONL); scan evals: `scanEvalLogger.ts` → `apps/api/logs/scan-evals.jsonl`.
- Manual gate: `docs/wiki/AI_SCAN_TESTING_CHECKLIST.md` (10-image pass) before declaring a model viable.

## Migration playbook (swapping the paid model later)

1. Confirm account funded and candidate model available on OpenRouter.
2. Benchmark candidate vs incumbent (`model-benchmark.ts`), then quality report.
3. Run the 10-image manual scan checklist.
4. Change ONLY the default in `aiConfig.ts`; leave failover chain and Fable gates untouched.
5. Re-verify `getRecipeModelChain()` behavior + typecheck + scan eval log for one live day.

## Dead ends — do not revisit

- Free-model-first pipelines (slow, flaky, truncation-prone).
- Gemma (validated too slow, June 2026).
- Silent fallbacks that hide provider failures from users.
- Fake multi-mode generation (three "modes" from one call were fabricated; deleted — modes are now view projections of ONE real recipe).
- Growing `aiService.ts` instead of extracting services.
