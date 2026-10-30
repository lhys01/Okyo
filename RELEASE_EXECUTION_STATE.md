# Release execution state

Last updated: 2026-09-26

## Frozen starting point

- Repository: `/Users/rober/Desktop/Okyo-1`
- Starting branch: `scaling`
- Working branch: `codex/app-store-readiness` (created from the starting HEAD; existing worktree carried forward)
- Starting commit: `a8d5f0aabb6107d4ab65678f103cfb0615b907af` (`feat(onboarding): restore stage2 pre-font onboarding visual system`, 2026-08-31)
- Starting dirty state: 222 tracked paths modified/deleted and 162 untracked paths; no pre-existing changes were staged. Preserve these as user work. Current status contains 394 changed/untracked paths after focused release fixes; none of the pre-existing work was reset or overwritten.
- Package manager: npm; root, `apps/mobile`, and `apps/api` each have npm lockfiles.
- Current mobile package declares Expo entry `index.ts`; Expo SDK 55.0.31 / React Native 0.83.10 / React 19.2.0. Node v22.22.3 and npm 10.9.8.

## Configuration inventory

Ignored environment files present: `.env`, `apps/mobile/.env`, `apps/mobile/.env.local`, `apps/api/.env`. Values are intentionally not recorded here. Variable names, presence, and non-secret configuration will be inventoried without printing secrets.

External credentials are not presumed available. Apple App Store Connect, Apple signing, physical-device, deployed backend, authentication-provider, and payment-provider access remain unverified until checked in this session.

## Phase tracking

| Phase | Status | Notes |
|---|---|---|
| Freeze source of truth | Complete | Initial commit, branch, dirty counts, and ignored env file names recorded. |
| API import/type/build failures | Complete | Exported and tested the current preference prompt helper/type; fixed preference-only goal context and correction-test rate-limit isolation. API typecheck, build, and all 223 tests pass after fixes. |
| Backend deployment | Blocked | Railway credentials and the correct existing `okyo-api-development` / `stunning-empathy` service are available. Its domain returned Railway 404 and service status is failed. Deployment of only `apps/api` was attempted as explicitly authorized, but Railway rejected it because the trial expired and requires a plan selection. No production service or data was changed. |
| Full mobile/API tests | Partial | API typecheck/build and 223/223 tests pass. Mobile typecheck passes; latest full suite 1278/1367 pass, 89 fail. Focused auth/permission/onboarding tests 57/57 pass. Expo Doctor 20/20, Expo package compatibility and asset validation pass. The remaining suite has stale source-contract expectations and unresolved onboarding/state/persistence/accessibility/legal failures; this is a release blocker. |
| Onboarding, signature, and auth | Partial | V4 remains intentionally disabled; active flow is legacy V3. Local tests cover signature and account routing, but simulator UI automation could not proceed because the Mac UI was locked. No Clerk production keys are configured. Removed demo Apple/Google/email sign-in; no-provider path proceeds locally. |
| Payments | Partial | No local/mobile or Railway RevenueCat production keys. Unconfigured paywall no longer traps onboarding or grants premium. Actual products, entitlements, restore, expiry, and App Store setup are unknown; treat subscriptions as not launching until configured and verified. |
| Privacy, AI safety, logging, permissions | Partial | Redacted recipe/ingredient/meal/nutrition detail from diagnostics; updated just-in-time permission disclosures in iOS strings; blocked unused Android audio, broad-storage, and overlay permissions. Privacy manifest currently declares an empty collected-data set despite photo/text AI processing. In-app legal text is not proof of current public policy; live Privacy/Terms/Support URLs, provider retention, labels/forms, and counsel review remain unverified. Mobile full-suite legal checks fail. |
| Native signing and release build | Partial | Unsigned iOS Release simulator build succeeded and clean-installed/launched on iPhone SE simulator as bundle `com.rober.okyo`, version 1.0.0, build 1, without Metro. No Apple signing identities/profiles. Android package is `com.anonymous.okyo`, release uses debug signing. No current `eas.json`; no distributable signed archive tested. |
| Store package and external review | Blocked | App Store Connect record, metadata, age rating, privacy label, export compliance, review notes, screenshots, support/legal URLs, and asset rights could not be verified. No submission performed. |

## Additional focused verification

- `recipePricing.test.ts` and `signatureDrawing.test.ts`: 20/20 pass, including local Smash Cheeseburger make-at-home/eating-out prices, serving/ingredient recalculation, unavailable-data behavior, and meaningful signature validation.
- Clean install of the unsigned iOS Release simulator app on the iPhone SE simulator reached the welcome screen, then survived a terminate/relaunch with no app crash. The only simulator log entries were a future UIKit scene-lifecycle warning and a focus-navigation notice.
- The Mac was locked when native UI automation was attempted. `simctl` launch/screenshot succeeded, but interactive screen-by-screen QA remains unverified.

## Blockers to resolve or report

- Access to external production services and App Store Connect has not been established.
- The physical iPhone requested by the execution plan may not be available in this environment.
- The pre-existing working tree is very large; all unrelated edits and untracked files must remain untouched.
- Railway development deployment requires an active paid plan; the platform rejected the authorized upload before it created a deployment.
- Local production dependency audit: mobile 32 advisories (1 low, 27 moderate, 4 high, 0 critical); API production dependencies 3 moderate, 0 high/critical. Remediation paths need review and compatibility testing.
- `ios/` and `android/` native projects are ignored by Git in this Expo project. Durable permission/config fixes were put in tracked `app.json` plugin/config settings; local native plist/manifest edits are generated artifacts and must not be relied on as the release source of truth.
- No physical iPhone or unlocked simulator UI was available. The simulator was launched and screenshotted through `simctl`, but interactive onboarding/device QA remains unverified.
- Exact HEAD remains `a8d5f0aabb6107d4ab65678f103cfb0615b907af`; release fixes are uncommitted local changes on `codex/app-store-readiness`, so this HEAD is not the source revision of the simulator binary.

## Railway/mobile connection follow-up (2026-09-26)

- Railway CLI still links to project `okyo-api-development`, environment `development`, service `stunning-empathy`; service status is Failed and its domain returns 404 `Application not found` for health, liveness, readiness, CORS preflight, describe/scan, generation/edit probes, and pricing-path probe. The last deployment ID is the old failed deployment `bef8e5b5-6363-4e8c-9706-0db8201bd8ce`; listed deployment history is removed and contains no current success.
- That project has a `production` environment, but it has no services or deployments. The separate Railway project `diplomatic-endurance` also has an empty `production` environment. No intended production API URL/service can be verified; no deploy was attempted because the production target is absent and spend/billing is not authorized.
- Current local mobile `.env` still configures the old development URL. There is no verified replacement. `apps/mobile/src/api/config.ts` now refuses `*-development.up.railway.app` as the release API endpoint; development clients retain their configured URL. Added a regression test. This prevents a release binary from silently targeting the failed dev deployment but does not connect to production.
- In-source URL usage is environment-driven. Remaining old-host strings are the ignored `apps/mobile/.env` value and historical audit/docs; no tracked mobile/API runtime source hardcodes that host. No Railway deployment config file is present in this checkout.
- Supabase is not imported or used by the mobile/API source, and neither package declares a Supabase dependency. Stale config remains: mobile `.env` has `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; Railway development service has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Production has no service/variable set. No Supabase tables, auth, storage, or RLS were accessed or changed. Never add the service-role key to the mobile app.
- Safe local API HTTP smoke test used a local production-mode process with `AI_ENABLED=false`, `EPICURE_ENABLED=false`, `IMAGE_GEN_ENABLED=false`, synthetic input, and no provider calls: `/health` 200 (`realAiEnabled:false`, `databaseEnabled:false`), `/live` 200, `/ready` 503 because persistent state is unavailable, valid description analysis 201, invalid description/edit 400, unknown analysis 404, synthetic photo scan 503 with a friendly AI-unavailable result, oversized JSON 413, CORS preflight 204 with wildcard origin, and rate-limit requests 429. No valid recipe-generation/edit request was sent to an AI provider. Local pricing tests remain 4/4 pass and use no network.
- `apps/mobile/src/api/config.test.ts`, `src/api/client.test.ts`, and `src/utils/recipePricing.test.ts`: 12/12 pass after adding the release guard. Mobile typecheck passes. Latest full mobile suite: 1278/1367 pass, 89 fail. API full suite: 223/223 pass. Current Xcode Release simulator rebuild passed and clean reinstall launched to the welcome screen on the iPhone SE simulator. Interactive connection-error/core-flow verification remains unavailable because the Mac UI is locked.
- Rate limits, idempotency, recipe/scan caches, in-memory analysis/recipe storage, and AI daily spending caps are process-local; restarts reset them. `/ready` intentionally blocks production until durable state is configured. CORS is currently `cors()` default (`Access-Control-Allow-Origin: *`); the native mobile client does not use browser CORS, but any web client origin policy remains undecided.
