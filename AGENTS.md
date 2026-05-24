# AGENTS.md — Instructions for Codex

These are repository-level instructions for AI coding agents working on Okyo.

## Project identity

Project name: **Okyo**

Okyo is a React Native mobile app with a backend API. It lets users scan restaurant meals and receive homemade copycat recipes with cost comparisons, grocery lists, Dupe Challenge, rankings, and shareable result cards.

## Priority rules

1. Prioritize shipping the V1 MVP over over-engineering.
2. Keep the first user session fast: open app → scan meal → see result.
3. Do not add complex social feeds, comments, DMs, or maps unless explicitly requested.
4. Treat AI outputs as uncertain. Always include confidence and editable fields.
5. Never present AI-generated food identification, nutrition, cost, or recipe data as exact.
6. Use simple, readable TypeScript.
7. Prefer modular services over giant files.
8. Do not store user food images unless the user saves a recipe or explicitly opts in.
9. Use feature flags for paid/premium features where possible.

## Recommended stack

Frontend:
- React Native + Expo
- TypeScript
- React Navigation
- Zustand for local state
- TanStack Query for API state later
- Expo Image Picker / Camera
- Expo Sharing

Backend:
- Node.js + Express or NestJS
- TypeScript
- PostgreSQL via Supabase or Prisma later
- Zod for validation
- OpenAI-compatible vision + LLM layer later

## MVP build order

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
