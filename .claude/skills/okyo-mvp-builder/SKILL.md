---
name: Okyo MVP Builder
description: Use when building or sequencing Okyo MVP features, scaffolding from zero, or converting seed prompts into implementation tasks.
---

# Okyo MVP Builder

Use this skill for roadmap sequencing and MVP build tasks.

## Build Philosophy

- Prefer shipping the V1 MVP over over-engineering.
- Keep the first user session fast: open app, scan meal, see result.
- Build mock/fake-data flows before production AI and infrastructure.
- Add real providers only after the mock app feels good.

## MVP Build Order

1. Repo setup
2. Expo mobile app shell
3. Mock first-scan flow
4. Result summary screen
5. Recipe detail screen
6. Grocery list screen
7. Share card preview
8. Saved recipe library
9. Savings dashboard
10. Dupe Challenge
11. XP, badges, rankings
12. Static Restaurant Packs
13. API skeleton
14. Real image upload
15. AI service interface
16. Real AI provider
17. Cost engine
18. Paywall and subscriptions
19. Analytics
20. TestFlight / App Store prep

## Standard Constraints

Unless the user asks otherwise:

- Do not add real AI early.
- Do not add login early.
- Do not add payments early.
- Do not add maps.
- Do not add comments, DMs, or social feed.
- Do not add backend complexity before mock flows are stable.

## Claude Prompt Seeds

Use `docs/seed/CLAUDE_PROMPTS.md` for starter prompts rewritten for Claude Code.

Use `docs/wiki/BUILD_FROM_ZERO_CLAUDE.md` for a Claude Code-oriented build path.

## Helpful References

- `README.md`
- `CLAUDE.md`
- `docs/wiki/BUILD_FROM_ZERO_CLAUDE.md`
- `docs/wiki/PRD_SUMMARY.md`
- `docs/wiki/FRONTEND_ARCHITECTURE.md`
- `docs/wiki/USER_FLOWS.md`
- `docs/wiki/V1_BUILD_TASKS.md`
- `docs/seed/MOCK_SCAN_RESULTS.json`
