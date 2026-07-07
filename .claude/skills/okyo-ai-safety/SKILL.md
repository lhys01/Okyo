---
name: Okyo AI Safety
description: Use when touching scan recognition, image upload, AI provider code, OpenRouter, recipe generation, costs, nutrition, fallback behavior, or result confidence.
---

# Okyo AI Safety

Use this skill whenever a task touches AI, image upload, scan results, recipes, nutrition, cost, or confidence.

## Hard Rules

- Never pretend a failed AI result is real.
- Never show the default mock pasta result for a real uploaded image failure.
- Keep mock/demo fallback behavior for demo/mock mode only.
- If OpenRouter fails on an uploaded image, show a clear friendly failure state.
- If the image is non-food or unclear, say so clearly.
- If the model is unsure but the image may be food, prefer an unclear-food-photo state over a definite not-food state.
- Recipes are copycat-style or inspired-by, never official restaurant recipes.
- Do not show technical AI/provider errors to normal users.
- Development debug metadata is okay when hidden behind dev-only UI.

## Privacy And Data

- Never expose API keys, secrets, or private data.
- Never hardcode sensitive values.
- Never commit `.env` files.
- Never log API keys or full base64 image payloads.
- Do not store user food images unless the user saves a recipe or explicitly opts in.

## Output Honesty

- Treat AI outputs as uncertain.
- Always include confidence and editable or retry-friendly behavior when relevant.
- Never present AI-generated food identification, nutrition, cost, or recipe data as exact.
- Cost and savings estimates should read as estimates, not facts.

## Debugging Scan Issues

When fixing scan handoff or result state bugs:

1. Check the API response first.
2. Check mobile scan decision logic.
3. Check Zustand state writes.
4. Check navigation params.
5. Check ResultSummary rendering source.
6. Do not change prompts or provider behavior unless the task explicitly asks.

## Check Prior Findings First

Before re-diagnosing any scan/image/state bug, scan `docs/audits/` filenames — 30 prior reports exist. Most relevant:

- `docs/audits/STATE_CONTAMINATION_REPORT.md` — stale scan state leaking into new scans
- `docs/audits/COLD_RESTART_AUDIT.md` / `IMAGE_PERSISTENCE_AUDIT.md` — image loss on restart; `recipe.imageUri` is canonical, permanent URIs live in NSDocumentDirectory
- `docs/audits/SCALE_FAILURE_REPORT.md`, `TOP_10_RISKS.md`
- `docs/wiki/KNOWN_ISSUES.md`, `docs/wiki/KNOWN_RISKS.md`

Scan evals are logged via `apps/api/src/services/scanEvalLogger.ts` — check its output before guessing at model behavior.

## Reference Files

Read these only when needed:

- `apps/mobile/src/screens/ScanScreen.tsx`
- `apps/mobile/src/screens/AnalysisLoadingScreen.tsx`
- `apps/mobile/src/screens/ResultSummaryScreen.tsx`
- `apps/mobile/src/state/useOkyoStore.ts`
- `apps/mobile/src/utils/scanDecision.ts`
- `apps/mobile/src/api/client.ts`
- `apps/api/src/services/aiService.ts` (`createAiScan`, `normalizeVisionOutput`, food-gate helpers)
- `apps/api/src/services/openRouterProvider.ts`
- `apps/api/src/services/scanEvalLogger.ts`
- `docs/wiki/AI_PIPELINE.md`
- `docs/wiki/SCAN_FLOW.md`

## Safe Commands

- API typecheck: `cd apps/api && npm run typecheck`
- Mobile typecheck: `cd apps/mobile && npx tsc --noEmit`
- Scan normalization tests (node:test; inferred invocation, no npm script wired): `cd apps/api && npx tsx --test src/services/aiService.scan.test.ts`
- Resolve repo root portably: `git rev-parse --show-toplevel` — never trust stale absolute paths.

## Fable Routing (fail-closed, non-negotiable)

Fable is opt-in only: `FABLE_ENABLED=true` env AND `x-okyo-model: fable` header, both required. Hard cap 10 requests/day in code (env can only lower). On Fable failure, surface failure — never silently swap providers. OpenRouter stays the default path; never change it unless explicitly asked.

## Example Final Output

> Fixed stale-scan contamination on retry. Cause: `useOkyoStore.ts` retry path skipped `getClearedLatestScanState`, so previous dish title survived into the new scan. Fix: retry now routes through the same reset helper as new scans. Prior report `docs/audits/STATE_CONTAMINATION_REPORT.md` covered save-flow only, not retry — new case documented there. Both typechecks clean, scan tests pass. Test: scan dish A → retry with dish B photo → title/price/ingredients all show B. Risk: none beyond retry path.

## Done Checklist

- [ ] `docs/audits/` checked before diagnosing; overlap with prior reports stated
- [ ] No mock/fake result path added to real scan failures
- [ ] Fable gates untouched (or task explicitly asked)
- [ ] Typechecks clean; scan tests run if `normalizeVisionOutput` touched
- [ ] Reported: files changed, commands run, risks, manual test steps
