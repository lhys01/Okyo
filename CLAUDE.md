# CLAUDE.md - Okyo Claude Code Instructions

These are permanent repository-level instructions for Claude Code working in Okyo. Claude Code reads this file at the start of a project session. Follow it unless the user explicitly says otherwise.

## Project Context

Project name: **Okyo**

Okyo is a mobile cooking app that helps users scan restaurant food, generate copycat-style or inspired-by recipes, estimate savings, save recipes, make grocery lists, and make cooking feel easier and more fun.

Okyo should feel:
- cute
- clean
- simple
- friendly
- modern
- food-focused
- not corporate
- not overly complicated

Okyo product priorities:
- fast onboarding
- simple scan flow
- recipe generation
- saved recipes
- grocery list features
- friendly UI copy
- smooth mobile experience
- viral/shareable moments when possible
- honest AI behavior

## Source Of Truth

For broad repo context, read:

1. `CLAUDE.md`
2. `README.md`
3. `docs/wiki/PRD_SUMMARY.md`
4. `docs/wiki/USER_FLOWS.md`
5. `docs/wiki/FRONTEND_ARCHITECTURE.md`
6. `docs/seed/OKYO_MASTER_ONE_NOTE.md`

Claude Code project skills live in `.claude/skills/`. Use them when their descriptions match the task:

- `okyo-project-context`
- `okyo-task-workflow`
- `okyo-ai-safety`
- `okyo-mvp-builder`

## How To Understand Prompts

- Restate the goal in simple terms before coding.
- If a prompt is vague, make a reasonable assumption and continue.
- Do not stop to ask unnecessary questions unless the task is impossible or dangerous.
- Break large requests into smaller steps before editing files.
- Prefer shipping the V1 MVP over over-engineering.
- Keep the first user session fast: open app, scan meal, see result.

## How To Work On Code

- Inspect the relevant files first.
- Do not rewrite unrelated code.
- Keep changes small, clean, and easy to review.
- Prefer simple solutions over complex ones.
- Reuse existing components, styles, folders, and patterns whenever possible.
- Do not delete existing features unless specifically asked.
- Do not change app structure unless it is clearly needed.
- Use simple, readable TypeScript.
- Prefer modular services over giant files.

## Task Workflow

For every prompt:

1. Understand the request.
2. Find the relevant files.
3. Explain the planned changes briefly.
4. Make the smallest correct code changes.
5. Test or reason through whether it works.
6. Summarize what changed.
7. Tell the user what to test manually.

## Building Features

- Make features feel complete, not half-done.
- Include loading states, empty states, and error states when relevant.
- Make UI mobile-friendly.
- Keep the user experience simple and intuitive.
- Match the existing design style of the app.
- Avoid complex social feeds, comments, DMs, or maps unless explicitly requested.
- Use feature flags for paid or premium features when possible.

## Fixing Bugs

- Identify the likely cause before editing.
- Fix the root problem, not just the symptom.
- Check for related bugs.
- Explain what caused the bug and what changed.
- Keep fallback paths honest and user-friendly.

## Writing Code

- Use clear names.
- Keep files organized.
- Avoid unnecessary dependencies.
- Avoid overengineering.
- Add comments only when they make the code easier to understand.
- Keep code readable for a beginner founder/developer.

## Protecting The Project

- Never expose API keys, secrets, or private data.
- Never hardcode sensitive values.
- Never commit `.env` files.
- Never log API keys or full base64 image payloads.
- Never run destructive commands unless the user clearly approves them.
- Do not store user food images unless the user saves a recipe or explicitly opts in.
- Treat AI outputs as uncertain. Always include confidence and editable or retry-friendly behavior.
- Never present AI-generated food identification, nutrition, cost, or recipe data as exact.

## Okyo AI Rules

- Never pretend a failed AI result is real.
- Never show the default mock pasta result for a real uploaded image failure.
- If OpenRouter fails on an uploaded image, show a clear friendly failure state.
- If the image is non-food or unclear, say so clearly.
- If the model is unsure but the image may be food, prefer an unclear-food-photo state over a definite not-food state.
- Recipes are copycat-style or inspired-by, never official restaurant recipes.
- Keep fallback behavior for demo/mock mode only.
- Do not show technical AI/provider errors to normal users.
- Development debug metadata is okay when hidden behind dev-only UI.

## Marketing Style

Okyo copy and marketing should be:
- hook-first
- TikTok-native
- casual
- curiosity-driven
- focused on the user's problem, like saving money, recreating restaurant food, or not knowing what to cook

## Recommended Stack

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
- OpenAI-compatible vision + LLM layer

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

## Reporting Back

At the end of every task, always respond with:
- What changed
- Files edited
- How to test it
- Any issues or next steps
