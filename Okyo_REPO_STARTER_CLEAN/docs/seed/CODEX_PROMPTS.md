# Codex Prompts

## Prompt 1: Repo setup

```text
Read README.md, AGENTS.md, docs/wiki/BUILD_FROM_ZERO.md, docs/wiki/PRD_SUMMARY.md, and docs/seed/OKYO_MASTER_ONE_NOTE.md.

Set up the Okyo monorepo structure.

Create:
- apps/mobile
- apps/api
- packages/shared
- packages/config

Do not build app features yet.
```

## Prompt 2: Mobile shell

```text
Read AGENTS.md, docs/wiki/FRONTEND_ARCHITECTURE.md, and docs/wiki/USER_FLOWS.md.

Initialize the Expo React Native mobile app in apps/mobile using TypeScript.

Build only the starter app shell.

The app should run in Expo Go.
```

## Prompt 3: Mock first-scan flow

```text
Read docs/wiki/USER_FLOWS.md, docs/wiki/UX_COPY.md, docs/seed/MOCK_SCAN_RESULTS.json, and docs/seed/SHARE_CARD_EXAMPLES.md.

Build the Okyo mock first-scan flow with fake data only.

Do not add backend, real AI, login, payments, map, or comments.
```
