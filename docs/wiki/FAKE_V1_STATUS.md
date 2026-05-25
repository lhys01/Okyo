# FAKE_V1_STATUS — Okyo Mobile (Fake-data V1)

Date: 2026-05-24

## Completed features

- Onboarding flow with goal selection and AsyncStorage persistence
- Mock first-scan flow (Welcome → Goal → Scan → Loading → Result Summary → Recipe Detail)
- Result summary with confidence, mode tabs, estimated savings
- Recipe detail with mode-specific recipes and ingredient/step fallbacks
- Grocery list generation with copy/share and pantry check UI
- Save to Library and Library screen with remove
- Savings dashboard (total and weekly mock stats)
- Share card preview with native Share and Copy Caption
- Dupe Challenge flow and Challenge Complete screen
- XP, badges, and Rankings (mock leaderboard)
- Static Restaurant Packs and Pack detail
- Settings screen with reset and clear-local-data options
- Analytics: console-only `track()` with typed events
- UI components library (`src/components/OkyoUI.tsx`) and shared styles

## Known limitations

- No backend or cloud persistence — all local AsyncStorage and mocks
- No real AI model — recipe data is seeded mock content
- Saving images / exporting real story images is placeholder
- Paywall/purchases are placeholders (no payment integration)
- Some UI polish work was committed but there are uncommitted local edits in the working tree

## QA summary (what I checked)

- TypeScript typecheck passes for `apps/mobile` (ran `npx tsc --noEmit`).
- Navigation param types (`RootStackParamList`) match screens that read `route.params`.
- Share and clipboard actions guarded with try/catch and show user-friendly alerts.
- XP awarding uses `awardXPOnce` to prevent duplicate stacking where appropriate.
- Empty states present for missing latest scan and missing challenge results.
- No remaining references to "DupeAI" found.

## Next recommended phase

1. Finalize UI polish and commit outstanding mobile changes.
2. Run a focused UX QA pass on iOS Simulator (flows: scan → result → save → grocery → challenge → share).
3. Add E2E smoke tests (detox / playwright) for core flows.
4. Prepare minimal API mock server for future AI/backends.
5. Define the exact AI prompt/eval harness for recipe generation.

## Exact next 5 backend / AI prompts to run later

1. "Design a minimal AI prompt schema that, given a dish name and image metadata, returns ingredients, steps, estimated homemade cost, estimated savings, substitutions, and difficulty." 
2. "Create an evaluation harness that compares generated recipe outputs to human references and computes a match score (0-10)." 
3. "Design a lightweight mock API to serve mock scan results and restaurant packs, with endpoints and response schemas." 
4. "Draft an auth-safe backend outline for user saved recipes, XP, and badges (no payments), specifying rate limits and schema." 
5. "Create a data seeding plan for restaurant packs and badge definitions to bootstrap development and QA."

---

If you want, I can:
- Commit the outstanding UI changes with a review commit message.
- Run the app on the iOS Simulator and walk through the main flows.
- Start the QA / bug-fix audit and fix any discovered runtime crashes.
