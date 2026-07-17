# Testing Okyo

Use the automated gates first, then perform the smallest relevant manual journey. External provider, Supabase, physical-device, and purchase tests must be reported separately from local unit tests.

## API gates

```bash
cd apps/api
npm install
npm run typecheck
npm test
npm run build
```

Focused suites:

```bash
npm run test:auth
npm run test:persistence
```

Local smoke test:

```bash
npm run dev
curl http://127.0.0.1:8081/health
```

All `/v1` requests require a valid Supabase bearer token. A missing verifier configuration must fail closed; it is not a substitute for testing a real valid and invalid token against a configured local API.

## Mobile gates

```bash
cd apps/mobile
npm install
npm run typecheck
npm test
npx expo install --check
npx expo export --platform ios --output-dir /tmp/okyo-ios-export
npx expo export --platform android --output-dir /tmp/okyo-android-export
```

Run locally with `npm run sim` or `npx expo start`. A physical phone needs `EXPO_PUBLIC_OKYO_API_URL` set to a reachable LAN or HTTPS URL; localhost points back to the phone.

## Core manual journey

1. Fresh launch: Kiko-led hero reaches scan without fake plan-building or a paywall.
2. Clear food photo: analysis → result → recipe.
3. Uncertain and partial food: editable best guess and honest explanation.
4. Non-food and unreadable image: friendly retry, no demo recipe.
5. Provider timeout/offline: request exits loading and exposes no technical provider detail.
6. Edit dish name; confirm recipe, grocery, saved, and share contexts stay coherent.
7. Recipe Check and Make It Mine preserve the original recipe until the user accepts a change.
8. Save, restart, and reopen a recipe; confirm its local photo remains available.
9. Export groceries, complete guided cooking, and share a scan result; confirm each XP event awards once.
10. Clear local data and sign out; confirm app-owned photo copies and private local state are removed as intended.

## Device and accessibility pass

- Test camera and photo-library permission copy on a release-style build.
- Test a small phone, large phone, Android back behavior, and keyboard obstruction.
- Enable 200% text and Reduce Motion.
- Background the app during scan/loading and guided-cooking timers, then resume.
- Rapidly tap scan/save/share actions and navigate forward/back to look for duplicate work or stale state.

## AI quality and stress work

`apps/api/scripts/quality-stress-test.ts` uses real provider calls and may spend credits. Start with one recipe and concurrency one only after explicit approval. Input-bound tests in `recipeInput.test.ts` are local and free; they are not provider load tests.

## Repository checks

```bash
git status --short
git diff --check
```

Also check changed Markdown links, package/lock agreement, deleted-path references, environment examples, asset resolution, and secret patterns. There is currently no configured linter or CI workflow; do not claim either gate passed.
