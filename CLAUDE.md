# Okyo repository guidance

`AGENTS.md` is the single operational source of truth for AI coding agents in this repository. Read it first for every task.

The concise supporting references are:

- `PRODUCT.md` — product, brand, accessibility, and anti-reference contract
- `README.md` — setup, commands, supported scope, and API surface
- `docs/ARCHITECTURE.md` — runtime flow, ownership, and trust boundaries
- `docs/DESIGN_SYSTEM.md` — visual language, Kiko, assets, and accessibility
- `docs/AI_AND_RECIPE_QUALITY.md` — provider routing, Fable, safety, and recipe quality
- `docs/TESTING.md` — automated gates and manual product checks

Specialized, current workflows live under `.claude/skills/okyo-*`. Load only the matching workflow for AI routing/safety, recipe quality, design, Kiko, local run, retention, monetization, or security work. `AGENTS.md` remains authoritative if guidance conflicts.

Do not treat old generated material, screenshots, runtime databases, dependency folders, or skill mirrors as product source. Never commit secrets or `.env` files. Typecheck both apps before a commit.
