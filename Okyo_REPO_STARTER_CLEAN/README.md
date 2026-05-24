# Okyo

Okyo is a mobile-first AI food app that turns restaurant meal photos into homemade copycat recipes with estimated cost savings, grocery lists, Dupe Challenge, rankings, and shareable result cards.

## Source of Truth

Codex should read these files first:

1. `AGENTS.md`
2. `docs/wiki/BUILD_FROM_ZERO.md`
3. `docs/wiki/PRD_SUMMARY.md`
4. `docs/seed/OKYO_MASTER_ONE_NOTE.md`
5. `docs/wiki/V1_BUILD_TASKS.md`

The app name is **Okyo**. Do not use DupeAI as the product name.

## V1 Scope

Build:
- mock first-scan flow
- photo upload
- AI dish recognition
- recipe generation
- cost comparison
- grocery list
- saved recipe library
- share cards
- Dupe Challenge
- XP, badges, weekly rankings
- static Restaurant Packs
- freemium scan limits
- basic premium paywall
- analytics
- onboarding, settings, privacy/support screens

Do not build yet:
- full map
- full social feed
- comments
- DMs
- restaurant reviews

## Clean Repo Structure

```text
okyo/
  README.md
  AGENTS.md
  .gitignore
  .env.example
  docs/
    wiki/
    seed/
```

## First Codex Prompt

```text
Read README.md, AGENTS.md, docs/wiki/BUILD_FROM_ZERO.md, docs/wiki/PRD_SUMMARY.md, and docs/seed/OKYO_MASTER_ONE_NOTE.md.

Set up the Okyo monorepo structure.

Create:
- apps/mobile
- apps/api
- packages/shared
- packages/config

Do not build app features yet.
Do not add backend logic yet.
Do not add real AI.
Do not add login.
Do not add payments.
Do not add map.
Do not add social feed.

After setup, tell me exactly what files you created and how to run the project.
```
