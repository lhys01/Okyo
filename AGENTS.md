# AGENTS.md - Okyo Codex Instructions

These are permanent repository-level instructions for AI coding agents working in Okyo. Read this file first for every prompt in this repo and follow it unless the user explicitly says otherwise.

## Project Context

Project name: **Okyo**

Okyo is a mobile cooking app that helps users scan restaurant food, generate copycat-style or inspired-by recipes, estimate savings, save recipes, make grocery lists, and make cooking feel easier and more fun.

Okyo is an AI food companion, not a calorie tracker. Do not build or expand strict nutrition/calorie-counting features unless explicitly requested.

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

## How To Understand Prompts

- Before coding, restate the goal in simple terms.
- If a prompt is vague, make a reasonable assumption and continue.
- Do not stop to ask unnecessary questions unless the task is impossible or dangerous.
- Break large requests into smaller steps before editing files.
- Prefer shipping the V1 MVP over over-engineering.
- Keep the first user session fast: open app, scan meal, see result.

## How To Work On Code

- First inspect the relevant files.
- Do not rewrite unrelated code.
- Keep changes small, clean, and easy to review.
- Prefer simple solutions over complex ones.
- Reuse existing components, styles, folders, and patterns whenever possible.
- Do not delete existing features unless specifically asked.
- Do not change app structure unless it is clearly needed.
- Use simple, readable TypeScript.
- Prefer modular services over giant files.

## Task Workflow

For every prompt, follow this workflow:

1. Understand the request.
2. Find the relevant files.
3. Explain the planned changes briefly.
4. Make the smallest correct code changes.
5. Test or reason through whether it works.
6. Summarize what changed.
7. Tell the user what they should test manually.

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

## AI Provider & Model Routing

- OpenRouter is the default and only always-on AI provider. Do not change this default without explicit instruction.
- Fable is opt-in only, never a default. Two gates required together, not either alone:
  - Env: `FABLE_ENABLED=true`
  - Per-request header: `x-okyo-model: fable`
- If either gate is missing, requests fall through to normal OpenRouter path unchanged.
- Fable must fail closed: no silent fallback to Gemini or any other model on Fable failure/timeout/cap-exceeded. A failed Fable request must surface as a failure, not swap providers underneath the caller.
- Daily Fable request cap is hard-capped at 10 in code; env value cannot raise it above 10, only lower it.

## Run Commands

- API: `cd apps/api && npm run dev`
- Mobile: `cd apps/mobile && npx expo start`
- Typecheck before every commit (`npm run typecheck` in `apps/api`, or project equivalent). Do not commit if typecheck fails.

## Excluded Paths

Never read, edit, regenerate, or commit changes inside:
- `.swarm`
- `ruvector.db`
- `node_modules`
- `__pycache__` / `pycache`
- generated skill mirrors
- runtime databases

These are generated, vendored, or runtime state — not source.

## Secrets

- Never commit secrets, API keys, or `.env` files.
- Never hardcode sensitive values in source or docs.

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
