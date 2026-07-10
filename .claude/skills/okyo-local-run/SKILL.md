---
name: Okyo Local Run
description: Use when running the Okyo API or Expo app locally, debugging the iOS simulator, verifying changes end-to-end, or diagnosing Metro/Expo/mobile runtime issues.
---

# Okyo Local Run

## When to use this

You need to start, restart, or debug the local Okyo stack (Express API + Expo mobile app + iOS simulator), or verify a change actually works.

## Goal

Get the stack running from the CURRENT repo root, verify behavior in the simulator, and never chase stale paths or invented commands.

## Okyo product context

Okyo is an AI food companion, not a calorie tracker, not a generic recipe app, and not a meal planner. The core loop to keep working at all times: open app → scan meal → see result.

## Files to inspect first

- `docs/wiki/LOCAL_DEVELOPMENT.md` — canonical run guide.
- `docs/wiki/ENVIRONMENT_SETUP.md` — env vars (never invent var names; check here + `apps/api/src/config/`).
- `apps/api/package.json` / `apps/mobile/package.json` — real scripts.
- `apps/mobile/src/api/client.ts` — how mobile finds the API.
- `./run` — convenience script, but treat any hardcoded local path inside it as stale unless it matches the current `git rev-parse --show-toplevel` output.

## Safe commands

- API dev server: `cd apps/api && npm run dev` (tsx watch on `src/server.ts`; default port 8081 via `process.env.PORT ?? 8081`)
- Mobile: `cd apps/mobile && npm run sim` → `expo start -c --host lan --port 8082` (clears Metro cache)
- Alternatives: `npm run ios` / `npm run start` in `apps/mobile`
- Typechecks: `cd apps/api && npm run typecheck` · `cd apps/mobile && npx tsc --noEmit`
- Port check: `lsof -nP -iTCP:8082 -sTCP:LISTEN`
- Simulator (from `run` script pattern): `xcrun simctl list devices | grep iPhone`, boot via `xcrun simctl boot <UDID>` (repo targets "iPhone 17 Pro")
- API unit tests (node:test; inferred, no npm script): `cd apps/api && npx tsx --test src/services/aiService.scan.test.ts`

## Exact workflow

1. Confirm repo root: `git rev-parse --show-toplevel`. Use it for every path.
2. Start API first, then mobile (`npm run sim`).
3. If Metro behaves oddly, `-c` flag in `npm run sim` already clears cache — prefer it over manual cache deletion.
4. Verify the core loop in simulator: scan (dev/mock mode if no OpenRouter credit) → result → recipe.
5. AI notes: OpenRouter is the default provider. Fable is opt-in only (`FABLE_ENABLED=true` + header `x-okyo-model: fable`, hard cap 10/day, fails closed). Real scan failures must show friendly errors — never mock results.
6. Typecheck BOTH apps before any commit (hard rule from `CLAUDE.md`).

## Quality bar

- Stack runs from current worktree with zero path edits.
- Change verified in simulator or via API response, not just "typecheck passed".
- Any new run knowledge added to `docs/wiki/LOCAL_DEVELOPMENT.md`, not a new ad-hoc script.

## Bad patterns to avoid

- Trusting `./run` or any local script without checking paths against the current repo root.
- Inventing npm scripts, env vars, or test runners that aren't in `package.json` / config.
- Starting Expo on random ports (mobile client expects the documented setup; port 8082 is the convention).
- "Fixing" scan failures by enabling mock data on real image paths.
- Killing/restarting services without checking `lsof` first.

## Example final output

> Verified savings-hero change end-to-end. API on :8081 (`npm run dev`), Expo on :8082 (`npm run sim`), iPhone 17 Pro simulator. Scanned mock dish → ResultSummary shows "Save ~$9 next time" only after entering restaurant price; blank until then, as intended. Both typechecks clean. Known unrelated warning: Reanimated version notice on Metro start.

## Done checklist

- [ ] Paths resolved from current repo root, no stale absolute paths
- [ ] API + mobile both running, core scan loop exercised
- [ ] Both typechecks clean before any commit
- [ ] Behavior verified in simulator/API output, described concretely
