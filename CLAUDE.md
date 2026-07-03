# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Okyo is an **AI food companion** — scan restaurant food, get a copycat-style recipe, see savings. It is **not** a calorie tracker, not a generic recipe app, and not a meal planner. It should feel cute, clean, friendly, honest.

## Hard Rules

- **OpenRouter/gpt-4o-mini is the default model path** — never change it unless explicitly asked.
- **Fable is opt-in only**: requires both `FABLE_ENABLED=true` AND request header `x-okyo-model: fable`. It **fails closed** — no silent Gemini fallback, hard cap 10/day, no public UI toggle.
- Never edit or commit generated/runtime files: `.swarm/`, `ruvector.db`, `node_modules`, `__pycache__`, skill mirrors, `docs/generated/`, `apps/*/dist`.
- Never commit secrets or `.env` files. Typecheck both apps before any commit.
- Honest AI: real scan failures show friendly errors, never mock results.

## Where To Read More

Wiki index: `docs/wiki/README.md`. Key routes:

- Onboarding → `docs/wiki/ONBOARDING.md`
- Scan flow → `docs/wiki/SCAN_FLOW.md`
- AI model routing → `docs/wiki/AI_MODEL_ROUTING.md` and `docs/wiki/FABLE_ROUTING.md`
- Local setup → `docs/wiki/LOCAL_DEVELOPMENT.md`
- Architecture → `docs/wiki/APP_ARCHITECTURE.md` · Risks → `docs/wiki/KNOWN_RISKS.md`
- Contributor rules → `docs/wiki/CONTRIBUTOR_GUIDE.md`

Update the matching wiki page whenever behavior changes.
