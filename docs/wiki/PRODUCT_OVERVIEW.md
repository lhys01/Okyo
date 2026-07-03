# Product Overview

## Purpose
Defines Okyo's product identity so contributors and AI agents don't drift the scope.

## Source Files Inspected
`CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/wiki/PRD_SUMMARY.md`, `docs/seed/OKYO_MASTER_ONE_NOTE.md`, mobile screens under `apps/mobile/src/screens/`.

## Current Behavior (What Okyo Is)
Okyo is an **AI food companion**. The main user promise: *photograph a restaurant meal and get a copycat-style recipe you can cook at home, with an honest estimate of what you save.*

The three main features:
1. **Scan → Recipe** — photograph/upload food, AI identifies the dish, generates an inspired-by recipe with cost estimates ([SCAN_FLOW.md](./SCAN_FLOW.md), [RECIPE_GENERATION.md](./RECIPE_GENERATION.md)).
2. **Save & Shop** — saved recipe library, grocery lists with pantry check, share cards.
3. **Motivation loop** — savings dashboard, Dupe Challenge, XP/badges/rankings, restaurant packs.

## What Okyo Is Not
- **Not a calorie tracker** — no strict nutrition/calorie-counting features unless explicitly requested.
- **Not a generic recipe app** — recipes come from the user's own scans plus curated inspiration, not a searchable database.
- **Not a meal planner** — no meal-plan calendars or diet programs.
- No social feeds, comments, DMs, or maps.

## How The App Should Feel
Cute, clean, simple, friendly, modern, food-focused. Not corporate, not complicated. Copy is hook-first, casual, TikTok-native. Kiko the mascot carries personality ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)).

## Important Constraints
- Recipes are always "copycat-style" or "inspired-by", never official restaurant recipes.
- AI outputs (dish name, costs, savings, recipes) are estimates — never presented as exact.
- Honest AI: failed scans show friendly failure states, never fake results.

## Known Risks / Edge Cases
- Feature creep toward nutrition tracking or meal planning — reject by default.
- Marketing copy overstating AI accuracy contradicts the honesty rule.

## Related Docs
[APP_ARCHITECTURE.md](./APP_ARCHITECTURE.md) · [SCAN_FLOW.md](./SCAN_FLOW.md) · [ONBOARDING.md](./ONBOARDING.md) · legacy [PRD_SUMMARY.md](./PRD_SUMMARY.md)
