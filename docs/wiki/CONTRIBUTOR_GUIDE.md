# Contributor Guide

## Purpose
Rules for future agents (Claude Code, Codex, Conductor) and human contributors.

## Source Files Inspected
`CLAUDE.md`, `AGENTS.md`, this wiki.

## Rules

### Orientation
1. **Read `CLAUDE.md` first** — it routes you to the right wiki page.
2. **Use `docs/wiki/` as the source of truth.** If the root README or legacy docs disagree with a core wiki doc, the wiki wins; if the wiki disagrees with code, the code wins — then fix the doc.

### Working
3. Make the smallest correct change; don't rewrite unrelated code.
4. Small, focused commits (`<type>: <description>` conventional format). Never bundle repo-hygiene cleanup with feature work.
5. Run validation before every commit: `npm run typecheck` in `apps/api` and `npx tsc --noEmit` in `apps/mobile` ([TESTING_AND_VALIDATION.md](./TESTING_AND_VALIDATION.md)).
6. Do not commit unless the user asks.

### AI routing discipline
7. **Do not change model defaults casually.** OpenRouter/gpt-4o-mini is the default path; Fable stays opt-in, double-gated, hard-capped, fail-closed ([AI_MODEL_ROUTING.md](./AI_MODEL_ROUTING.md), [FABLE_ROUTING.md](./FABLE_ROUTING.md)).
8. Never add a public UI toggle for Fable; never add silent model fallback.

### Safety
9. Never expose or commit secrets, keys, or `.env` files ([SECURITY.md](./SECURITY.md)).
10. Avoid generated/runtime files entirely: `.swarm/`, `ruvector.db`, `node_modules`, `__pycache__`, skill mirrors, `docs/generated/`, `apps/*/dist`, `logs/`. Don't read, edit, or commit them.
11. Never run destructive commands without explicit user approval.

### Documentation
12. **Update the wiki when behavior changes.** A PR that changes scan flow, routing, caps, onboarding, or env vars must touch the matching wiki page in the same change.
13. Keep `CLAUDE.md` short (~200 words) — deep content goes in the wiki, CLAUDE.md only routes.

### Product guardrails
14. Okyo is an AI food companion — not a calorie tracker, generic recipe app, or meal planner ([PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md)).
15. Honest AI always: fail-closed scans, no mock results for real failures, estimates never presented as exact.

## Related Docs
[README.md](./README.md) (index) · [KNOWN_RISKS.md](./KNOWN_RISKS.md) · [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)
