# CLAUDE.md

Guidance for AI agents (Claude / Codex / Fable) in this repo. Read this first, then open the matching `.claude/skills/` file before doing any work.

## Okyo Identity

Okyo is an **AI food companion**: scan restaurant food → get a copycat-style ("inspired-by") recipe → see honest savings → save, shop, cook. It is **not** a calorie tracker, **not** a generic recipe app, **not** a meal planner. Goal: make food easier, smarter, more personal, emotionally rewarding, and premium.

## Product Taste

Warm premium cookbook + liquid iOS glass (translucency/depth used purposefully — floating chrome only, never wallpaper, never on scrolling content). Magical but practical. Clean hierarchy, low friction, playful not childish. Kiko the fox mascot carries the emotion. Never: ugly data-heavy UI, generic SaaS screens, cold calorie-tracker feel, fake stats/savings/streaks/people. Binding anti-references: `PRODUCT.md`.

## Working Style (the founder)

- Uses Claude/Codex/Fable heavily; wants direct, practical, high-leverage changes.
- Strong opinions over vague option lists.
- Cares most about: scan reliability, recipe quality, onboarding, retention, premium UI, honest product UX.
- Dislikes: generic AI copy, ugly data UI, overcomplicated explanations, stale mock data, huge risky rewrites.

## Hard Rules

- **OpenRouter/gpt-4o-mini is the default model path** — never change it unless explicitly asked.
- **Fable is opt-in only**: requires both `FABLE_ENABLED=true` AND request header `x-okyo-model: fable`. **Fails closed** — no silent fallback to any other model, hard cap 10/day (env can only lower it), no public UI toggle.
- Honest AI: real scan failures show friendly errors, never mock results. Savings display gated on user-entered restaurant price.
- Never edit or commit generated/runtime files: `.swarm/`, `ruvector.db`, `node_modules`, `__pycache__`, skill mirrors, `docs/generated/`, `apps/*/dist`.
- Never commit secrets or `.env` files. Typecheck both apps before any commit.

## Tech Stack & Repo Map

- Mobile — Expo/React Native, TypeScript, Zustand: `apps/mobile/src/` → `screens/` (21), `components/OkyoUI.tsx`, `state/useOkyoStore.ts`, `theme/okyoTheme.ts` (sole token source), `navigation/`
- API — Express, TypeScript, Zod: `apps/api/src/` → `server.ts`, `services/`, `middleware/costControls.ts`
- AI provider/model config: `apps/api/src/config/{aiConfig,openRouter,costControlConfig}.ts`
- Recipe generation: `apps/api/src/services/aiService.ts` (~4.5k lines) + `openRouterProvider.ts` (prompts) + `recipeIngredientValidation.ts`; eval scripts in `apps/api/scripts/`
- Scan flow: `ScanScreen` → `AnalysisLoadingScreen` → `ResultSummaryScreen` + `useOkyoStore.ts` + API scan services
- Audits & prior findings: `docs/audits/` (30 reports) · `docs/design/`
- Design references: `PRODUCT.md`, `docs/OKYO_UI_REDESIGN_V2.md`, `apps/mobile/assets/BitePal iOS Onboarding/`
- Wiki (source of truth): `docs/wiki/README.md` — key routes: `SCAN_FLOW.md`, `RECIPE_GENERATION.md`, `AI_MODEL_ROUTING.md` + `FABLE_ROUTING.md`, `ONBOARDING.md`, `LOCAL_DEVELOPMENT.md`, `APP_ARCHITECTURE.md`, `KNOWN_RISKS.md`, `CONTRIBUTOR_GUIDE.md`. **Update the matching wiki page whenever behavior changes.**
- Skills (canonical location — there is no root `/skills`): `.claude/skills/`

## Common Workflows → Skills

- UI polish / design system → `.claude/skills/okyo-design-system/SKILL.md`
- Recipe quality / prompts / evals → `.claude/skills/okyo-recipe-quality/SKILL.md`
- Hostile audits / verification → `.claude/skills/okyo-audit-loop/SKILL.md`
- Local run / Expo / simulator debugging → `.claude/skills/okyo-local-run/SKILL.md`
- AI/scan safety + scan-state debugging → `.claude/skills/okyo-ai-safety/SKILL.md`
- Product direction / copy / onboarding assets → `.claude/skills/okyo-project-context/SKILL.md`
- General task workflow → `.claude/skills/okyo-task-workflow/SKILL.md`

## Run & Verify

- API: `cd apps/api && npm run dev` · typecheck: `cd apps/api && npm run typecheck`
- Mobile: `cd apps/mobile && npm run sim` (Expo, clears cache, port 8082) · typecheck: `cd apps/mobile && npx tsc --noEmit`
- Repo checks: `git status --short`, `git diff --stat`, `git diff --check`
- Paths: the active worktree is often `/Users/rober/conductor/workspaces/Okyo-1/tallinn`, but checkouts move. Resolve with `git rev-parse --show-toplevel`. Do NOT trust stale absolute paths (e.g. `/Users/rober/Documents/Okyo-1` inside `./run` is stale).

## Known Debt & Guardrails

- `aiService.ts` is far over the size budget — extract into new services when touched; do not grow it blindly.
- No CI yet — typecheck both apps manually before every commit.
- Check `docs/audits/` before re-diagnosing scan/state/image bugs; most have prior reports.
- Theme tokens come from `okyoTheme.ts` ONLY; `OkyoUI.tsx` must not re-export tokens (past runtime crash).
- Never silently make Fable the default; Fable/OpenRouter routing stays opt-in and fail-closed.
- Do not invent APIs, models, screens, assets, env vars, prices, or fake social proof. If it's inferred, say so.

## Definition of Good Output

A good session: inspects files first · keeps the change focused · preserves Okyo identity · zero fake data · improves one real product loop (scan, recipe, save, shop, share) · runs typecheck/eval validation · ends with exact files changed, commands run, risks, and manual test steps.

Example: "Polished `ResultSummaryScreen.tsx` savings hero: tokens from `okyoTheme.ts`, savings hidden until user enters restaurant price, `typography.hero` for the number. Both typechecks clean. Test: scan → result, verify no savings shown before price entry. Risk: none — display-only."
