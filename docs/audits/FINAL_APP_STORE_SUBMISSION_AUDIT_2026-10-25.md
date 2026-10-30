# Okyo final App Store submission audit — October 25, 2026

**Later follow-up:** see [APP_STORE_SUBMISSION_FOLLOWUP_2026-10-25.md](APP_STORE_SUBMISSION_FOLLOWUP_2026-10-25.md) for the new Release profile, updated 13-category privacy manifest, additional safeguards, website service/DNS preparation and current results. The findings below describe the earlier audit state.

**Decision: NOT READY TO SUBMIT.** The local source checks pass, but Production service readiness, authentication/subscription configuration, public legal publication, signing, privacy/legal approval, and several real-device flows remain unresolved. No submission, upload, Production deployment, vendor setting change, push, or account deletion was performed.

Repository audited and changed: `/Users/rober/Desktop/Okyo-1`, as explicitly requested. The other worktree was not changed. Existing unrelated changes were preserved. Icon, green launch artwork, and approved fox illustrations were preserved.

## The five original blockers

| Blocker | Code/source result | Remaining owner action |
| --- | --- | --- |
| Medical-device declaration | Intended-use answer **No**. Okyo is a cooking app providing estimated food identification, recipes, ingredients, nutrition, calories, macros, savings and cooking guidance. It does not diagnose, treat, cure, prevent or monitor disease. The disclaimer includes these limits. No FDA, CE, UKCA, approval or medical-accuracy claim was added. | Enter No in the applicable App Store declaration. Confirm the same intended use in the listing, screenshots and selected markets. This is an intended-use assessment, not a regulator's certification. |
| Production build | Fixed static Expo API substitution, release URL restrictions, Development-key/preview/SDK checks, console removal, Release signing team, and a native archive preflight. Removed seeded community rankings and production-reachable misleading copy. | Supply approved live configuration; reconcile the deployed API; finish distribution signing; verify version/build against App Store Connect. The current release command intentionally fails before archive. |
| Public Privacy Policy | Prepared accurate current app/site text, including Clerk IP-derived coarse location, AI handling, local photo retention, temporary PostgreSQL records, subscriptions and deletion limits. Site policy and Terms use the app registry. Publication and archive gates require explicit review. | **No working public policy URL was verified.** Publish approved pages on a working public HTTPS domain, then rerun URL checks. No site was published during this audit. |
| App Privacy answers | Source inventory and 13 collected-data manifest categories prepared for the selected Release profile; no tracking declared. Required-reason declarations retained. Counsel-approved review is bound to the exact manifest hash. | Keep the inventory synchronized with enabled SDKs/vendor retention/linkage and complete App Store Connect's separate questionnaire. |
| Pricing | No price selected or changed. Manual instructions below. | Set the app's price schedule/availability and, if offered, each subscription's price and configuration; complete required agreements/tax/banking. |

The general wellness/cooking intended use is consistent with the [FDA healthy-lifestyle guidance](https://www.fda.gov/medical-devices/digital-health-center-excellence/step-3-software-function-intended-maintaining-or-encouraging-healthy-lifestyle). It does not authorize disease-related claims.

## Production configuration and live read-only findings

- Bundle identifier: `com.rober.okyo`; version `1.0.0`; iOS build `1`. Source/native values agree. App Store Connect's record and whether build 1 has already been used were not available for verification.
- Apple team: `7N86UDY734`, verified against an existing matching Development profile and local signing identity. Release now explicitly uses that team and automatic signing. Two Development identities and **no Apple Distribution identity** were found. The existing profile is a Development profile, not proof of App Store provisioning.
- Actual Railway Production service domain, obtained from read-only service metadata: `https://stunning-empathy-production-production.up.railway.app`.
- The current local environment still supplies a Development API URL and Development Clerk publishable key, enables all three stage-two preview switches, and lacks a configured iOS RevenueCat SDK key/entitlement. No credentials were copied into this report or changed.
- Production GET `/health`: **200**. GET `/ready`: **503**. The latter is a release blocker even though the health route responds.
- Unauthenticated Production GET `/v1/account/session`: **401**. GET `/v1/library` and `/v1/rankings/weekly`: **200 success envelopes**. The rankings envelope contains nonempty structured data. Raw responses and account/content details were neither printed nor included here.
- This conflicts with the inspected local API: Library requires authentication; Production rankings also have a mock-route block and authentication. The local API suite passes 277 tests. **The deployed revision and Production configuration must be reconciled by an authorized operator.** These probes do not establish that the response contains real private user data, but they prevent attesting that the deployed service matches the protected local source.
- No POST/DELETE probe, sign-in, subscription purchase, personal photo upload, Production write or account deletion was used to investigate that discrepancy.

### Build command and fail-closed behavior

After approved legal/privacy review and actual live configuration are supplied:

```sh
cd /Users/rober/Desktop/Okyo-1/apps/mobile
npm run build:ios:release
```

The wrapper runs icon validation, native/config/environment review gates, public legal URL checks, then:

```sh
xcodebuild -workspace ios/Okyo.xcworkspace -scheme Okyo -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$PWD/.artifacts/Okyo.xcarchive" archive
```

`OKYO_ARCHIVE_PATH` can override the archive path. This command does not upload. The native React Native bundle phase independently runs the environment gate for non-Debug configurations, so opening Xcode does not bypass it.

Running the wrapper now fails before archive for pending privacy/legal review, Development API/Clerk configuration, three preview flags, and missing Production RevenueCat configuration. This failure is expected protection, **not a passing production build**. Configure these in the local Release environment or CI through the owner's credential process; do not commit `.env` files:

- `EXPO_PUBLIC_OKYO_API_URL`: the verified, ready Production API origin.
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`: the actual Production live key; verify Apple/Google and redirect configuration in the existing Production instance.
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`: actual iOS app/entitlement associated with App Store products.
- Disable all stage-two preview, mock, demo-auth and internal-probe switches.
- Disable analytics/crash reporting, or explicitly configure the reviewed Production PostHog/Sentry integrations. The inspected local UI bundle disables both. Do not reuse the Development PostHog project.

### Local production-mode bundle inspection

A clean-cache Expo production Hermes bundle was exported safely with the actual Production API origin, no fabricated Clerk/RevenueCat credentials, and analytics/crash reporting disabled. It was installed into a fresh dedicated iPhone 17 Pro / iOS 26.5 simulator using an existing compiled Release simulator product. There is no Metro dependency. Native source was not recompiled into an App Store archive during this audit.

Final inspection found the intended Production origin, zero complete Development Clerk credentials, no Development Railway/LAN endpoints, and none of the targeted obsolete owned copy (including Development-placeholder, mock-recipe, unimplemented-export, future-hosting and image-coming-soon wording). Production Babel removes unshadowed `console.*` calls **and their argument evaluation**; its regression test passes. Internal SDK identifiers and test/helper source names are not user-facing product claims.

An initial export without cache reset reused a Development credential from Metro's prior transform cache. The safe export was repeated with `--reset-cache`, and the final scan confirms it is absent. The native bundling script already uses cache reset. The final artifact is only a local inspection artifact; it is not eligible for submission with authentication/subscriptions unconfigured.

## Privacy Policy, Terms and support

Configured exact URLs:

| URL | Verification result |
| --- | --- |
| `https://okyoapp.com/privacy` | **FAILED — public HTTPS page could not be verified; DNS did not resolve during the audit.** |
| `https://okyoapp.com/terms` | Failed public verification for the same domain. |
| `https://okyoapp.com/support` | Failed public verification for the same domain. |
| Production API origin + `/privacy` or `/terms` | Both returned 404; these are not replacement policy URLs. |

Support contact in app and site: `support.okyo@gmail.com`. The email link was inspected; no email was sent. There is no evidence here that the mailbox's operational response process has been tested.

The prepared policy now describes Apple/Google sign-in and Clerk, account/device/network information, IP-derived city/country, camera and selected-library images, typed dishes/customization, dietary/allergy/macro inputs, generated content, OpenRouter/model providers, Railway/PostgreSQL, optional PostHog/Sentry, RevenueCat, retention, local cleanup and account deletion. It distinguishes working-record expiry from physical backup/vendor retention. Scanned photos can remain locally even if a recipe is not saved; the in-app camera notice discloses this. The API runtime database excludes photo bytes. No immediate universal provider-deletion promise is made.

Additional in-app Security, Service Providers and Privacy Requests documents were corrected to remove obsolete all-data-is-local, future-hosting and unimplemented-export claims. Public deletion instructions now acknowledge vendor retention and identity verification. Prepared legal content has no user-facing draft banner; the operator-reported counsel approval is recorded in `legal-release-review.json` and the privacy review is bound to its exact manifest fingerprint. Website publication checks also require the matching fingerprint.

The recorded counsel review covers the current publisher identity, age wording, intended markets, consumer/health-data obligations, provider and backup retention, subscription/refund terms and support/identity-verification process to the extent stated in the published documents. Keep the app's minimum age control aligned with store declarations and re-review any change. No governing-law jurisdiction or retention contract was invented. Generated `docs/legal` and `src/legal-drafts` files remain internal review material and are not the public page rendering source.

The website builds six pages and typechecks cleanly. Its launch gate still blocks on pending legal approval and an unconfigured waitlist endpoint (reported on all six pages because the shared dialog is included). Set the actual existing waitlist endpoint in the site's publication environment or make a deliberate product decision about that feature; no endpoint was guessed or deployed.

## App Privacy answers

See [the source-backed inventory](APP_STORE_PRIVACY_INVENTORY_2026-10-25.md) for source paths and all requested information types. The conservative prepared answers below assume the reviewed production feature set includes configured subscriptions and the optional SDKs indicated. They are **not a completed App Store Connect submission**. Remove optional rows only after confirming that the final app and all partners do not collect them. Apple's questionnaire includes partner processing, not just Okyo's own database; see [Apple App Privacy details](https://developer.apple.com/app-store/app-privacy-details/).

| Apple data type | Collected | Linked | Tracking | Purpose |
| --- | --- | --- | --- | --- |
| Name | Yes, provider-shared account name | Yes | No | App Functionality |
| Email Address | Yes, including relay email | Yes | No | App Functionality |
| Coarse Location | Yes, Clerk IP-derived city/country | Yes | No | App Functionality |
| User ID | Yes | Yes | No | App Functionality; Analytics |
| Device ID | Yes | Yes | No | App Functionality; Analytics |
| Photos or Videos | Yes, food photos; no video upload found | Yes | No | App Functionality |
| Other User Content | Yes, descriptions/edits/questions/generated working content | Yes | No | App Functionality; Product Personalization |
| Health | Yes, relevant allergies/dietary constraints/nutrition targets sent for features | Yes | No | App Functionality; Product Personalization |
| Customer Support | Yes, submissions/correspondence | Yes | No | App Functionality |
| Purchase History | Yes with configured RevenueCat subscriptions | Yes | No | App Functionality; Analytics |
| Product Interaction | Yes with PostHog; review authentication-provider activity | Yes | No | Analytics |
| Crash Data | Only if Sentry is enabled | No in sanitized app event; vendor linkage needs review | No | App Functionality |
| Performance Data | PostHog/API operation metrics | Yes | No | App Functionality; Analytics |
| Other Diagnostic Data | Yes, service/authentication/device diagnostics | Yes | No | App Functionality |

No source collection path was found for GPS/Precise Location, payment card/bank information, contacts, mailbox contents, audio, browsing/search history, advertising data, environment scanning or hand/head movement. No IDFA or advertising/tracking integration was found. Spending answers stay local; do not select Other Financial Info solely for those answers. Onboarding activity answers are local inputs to estimates; no exercise/sensor-history upload was found, so Fitness is not selected solely for the macros branch. Free text can contain sensitive information; review that risk with the privacy reviewer. Final vendor settings can change these conclusions.

Clerk session activity includes geographic fields resolved by IP and associated with a user session: [SessionActivity](https://clerk.com/docs/reference/backend/types/backend-session-activity), [Session](https://clerk.com/docs/reference/backend/types/backend-session). RevenueCat's guidance requires both functionality and analytics for purchase history and explains custom-ID linkage: [Apple privacy guidance](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy). An installation UUID is pseudonymous, not automatically unlinked. AI requests support account identity when signed in and guest/request scope otherwise.

## Manual App Store Connect pricing steps

1. Open **Apps → Okyo → Monetization → Pricing and Availability**. Verify the correct app record, choose the intended base country/region, and deliberately choose free or a paid price. Save the required price schedule and intended availability countries. **No price is selected by this audit.** [Apple app-price instructions](https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/).
2. If subscriptions will be offered, open **Monetization → Subscriptions**, select the subscription group and each product, verify product IDs/durations/localization/review information, and set each product's availability and subscription price schedule. Decide any introductory offers separately. Verify that RevenueCat's offering/package/product/entitlement mapping and the app's displayed localized prices match. [Apple subscription pricing](https://developer.apple.com/help/app-store-connect/manage-subscriptions/manage-pricing-for-auto-renewable-subscriptions).
3. The Account Holder must complete applicable Paid Apps agreements, tax and banking requirements for paid apps or in-app purchases. Verify agreements are active. No agreement was accepted during this audit.
4. Before submission, confirm version/build availability, age rating, medical declaration, App Privacy, Privacy Policy URL, screenshots, support URL and review information in the actual account. The prepared factual review text is in [APP_REVIEW_NOTES_2026-10-25.txt](APP_REVIEW_NOTES_2026-10-25.txt); it contains no credentials. It does not certify that live login was tested.

## Fixes found by tests and simulator inspection

- Expo could not statically inline an API URL accessed through a whole environment object. Direct `process.env.EXPO_PUBLIC_OKYO_API_URL` access fixes release routing; Development fallback literals are removed from production bundles.
- Current savings steps were incorrectly normalized into the introduction, creating restoration/navigation problems. Current steps now survive normalization.
- Completed plans used fixed totals and ignored the assigned question variant. Final progress now derives from visible branch questions: Savings A/B/C = 5/5, 5/5, 4/4; Health = 8/8, 5/5, 3/3; Macros = 7/7, 5/5, 4/4. The final simulator checked C counts for all three branches.
- Health plan Back entered a question omitted by the assigned variant. Back now honors the same skip list as forward navigation; simulator verified final plan → selected goal question.
- Macros C displayed a consistency obstacle the person had never answered. Omitted obstacle answers no longer appear as the user's stated challenge.
- Settings detail Back defaulted to Home. Tab history now returns to the actual source; both the real navigation router test and rebuilt simulator verified Settings → Dietary Preferences → Settings, and Liked → Recipe → Liked.
- Slider responders now use the initial touch plus native gesture deltas, and adjustable controls are accessible. Signature drawing similarly normalizes/clamps gesture deltas without retaining pooled events. Pure-model tests pass; full continuous native dragging remains unverified, as described below.
- Fixed misleading accessibility destinations and the personalization-skip label; retained approved artwork. Registry artwork loads lazily so metadata can be tested without attempting to parse PNG bytes as code.
- Removed seeded leaderboards, fake rank/community rows and production diagnostic/admin/preview routes. Production scan failures remain failures rather than fabricated dishes. Empty user collections and zero savings were manually checked.
- Repaired stale assertions against the already-approved onboarding/artwork/reset implementation without undoing those features. Before fixes: 1,613 tests, 26 failures. Current: 1,628 tests, no failures.

## Full flow results (all 38 requested checks)

“Manual” below refers to the local production-mode simulator artifact, not a signed App Store build or a successful Production account session. The fresh simulator began signed out with no recipes or history. Only local QA names/choices and deliberate actions on a bundled curated recipe were entered. No real account or personal photo was used.

| # | Flow | Evidence / result |
| --- | --- | --- |
| 1 | Launch screen | Existing green native launch assets retained; cold relaunch recorded. Final frame inspection is in the local evidence folder. No Metro required. |
| 2 | Welcome/onboarding | Manual: approved welcome, sequential value pages and normal Back/Continue transitions render. |
| 3 | Food-goal selection | Manual: three choices and skip personalization work; approved dumbbell artwork retained. |
| 4 | Fox introduction/naming | Manual: selected composition, empty-name disabled guard, suggested name and Continue work. |
| 5 | User-name entry | Manual: entered local QA name; software keyboard leaves field, Continue and Skip unobscured. Screenshot saved. |
| 6 | All branches | Manual: all three assigned C paths inspected. A/B/C state/progress/skip variants covered by automated tests; A/B not exhaustively traversed manually. |
| 7 | Savings plan | Manual: snapshot → household → 4/4 final; choices persist on Back. Potential savings disclose estimated $6 home-meal assumption; no actual savings awarded. |
| 8 | Health plan | Manual: problem/barrier/goal → 3/3 final. Fixed Back returns to actual previous visible goal. |
| 9 | Macro plan | Manual: protein goal/flexible targets → 4/4 final, unset values remain Not set, no invented obstacle answer. |
| 10 | Dietary/allergy | Manual Settings page renders restrictions/allergies with safety warning and editable controls. This assigned onboarding path did not ask these questions; future requests use saved preferences. No personal health information sent. |
| 11 | Back on every screen | Manual on visited onboarding/C branch, signature, Settings detail and curated recipe/Cook screens; router/state tests pass. Cannot certify every live authenticated screen. |
| 12 | Forward on every screen | Manual on visited flows; guards intentional for empty name/signature. Live sign-in/AI paths blocked. |
| 13 | Progress indicators | Final C counters verified on all three rebuilt plans; all nine variant totals covered by tests. |
| 14 | Signature | Empty Continue disabled; Clear and Back work; geometry/serialization/validity tests pass. Automated native drag registers an initial touch but no continuous stroke. **Hands-on drawing and valid-signature continuation remain a release QA requirement.** This is not marked passed. |
| 15 | Apple sign-in | 65 focused auth tests cover provider flow, duplicate-flight guards and completion. **Actual live sign-in blocked**: Production key/configuration unavailable. No personal account used. |
| 16 | Google sign-in | Same boundary: automated flow/redirect tests pass; actual live Production flow unverified. |
| 17 | Account creation completion | State/handoff tests pass. **Not completed against live Production authentication.** Local artifact lacking Clerk is not evidence of account creation. |
| 18 | Home | Manual: clean state, zero savings/completed macros, no user history, real local name. Bundled editorial ideas are separate from saved user recipes. |
| 19 | Camera scan | Manual privacy notice → iOS permission → friendly Camera unavailable/Use Upload message on simulator. Actual capture/device upload unverified. |
| 20 | Photo-library scan | Manual system picker opens with private selected-item access; cancel returns Home without a scan/upload. Actual image processing unverified. |
| 21 | Scan states | Focused tests cover loading, success, timeout, cancellation, error copy, retry/in-flight behavior and real-image failure integrity. **No complete live Production AI scan**, given readiness failure. |
| 22 | Recipe result | Curated recipe detail manually inspected; generated result and correction contracts covered by tests. Live AI result unverified. |
| 23 | Nutrition/macros | Flexible-plan unset values manually verified; estimate/target logic covered by suite. No claim that a live generated nutrition result was manually validated. |
| 24 | Ingredients | Curated recipe ingredients, amounts and servings manually rendered; grocery item added from ingredient. |
| 25 | Customization | Manual sheet/chips/input/disabled-empty Update/cancel. No AI customization submitted to Production; service behavior covered by tests. |
| 26 | Save/unsave | Manual curated-recipe Like → Liked list → Unlike → empty Liked list. No fabricated scan result was created. |
| 27 | Liked recipes | Manual initial empty, deliberate saved item, then empty after Unlike. Final photo fallback wording verified. |
| 28 | Grocery | Manual initial empty, one selected ingredient, expandable group and checkbox checked. |
| 29 | Cook Mode | Manual curated recipe steps 1 → 2 → 1 and Back; Home shows an active local session without awarding a completed meal or savings. Completion/timer logic covered by tests. |
| 30 | Guided tour | Source gating requires available/loaded/signed-in auth. Automated tour suite is included in full tests; **signed-in manual tour remains unverified**. |
| 31 | Settings | Manual production-facing options render; no admin/experiment controls. Detail Back history fixed and verified. |
| 32 | Privacy Policy | Manual onboarding modal shows prepared text without draft banner. Source/site aligned; **external URL fails verification**. |
| 33 | Terms | Manual onboarding terms modal renders current text. Source/site aligned; **external URL fails verification**. |
| 34 | Support | Manual FAQ screen and email contact link inspected. No email sent; external support page cannot be verified. |
| 35 | Account deletion | Focused UI/cleanup/reset tests and API deletion tests pass using injected dependencies. **No real account deleted**, as prohibited. |
| 36 | Deletion → true first screen | Automated reset/navigation assertions only; no live deletion. Must be verified later using a specifically authorized disposable account. |
| 37 | Local deletion cleanup | Automated device images/state/reminders/identity/reset coverage. No deletion action executed in simulator or Production. |
| 38 | Relaunch after sign-out/deletion | Normal force-terminate/relaunch manually preserves deliberate local state and remains usable. Automated sign-out/deletion reset tests pass. **No live post-sign-out or post-deletion relaunch exercised.** |

Slider increment accessibility actions visibly update the value and downstream estimate. Taps register. Both slider and signature `drag` calls registered an initial contact without observable movement, before and after the responder changes. This automation result cannot distinguish a native-input delivery limitation from an app gesture defect. Do not waive the hands-on drag test. Only iPhone 17 Pro was inspected during this audit; compact phones, Dynamic Type, real camera and all device sizes are not certified by those screenshots.

## Commands and test results

Evidence root: `apps/mobile/.artifacts/app-store-final-2026-10-25/` (local ignored artifacts, not committed credentials). Focused command arrays and file lists are recorded in `focused-tests.json`; their reproducible local runner is `run-focused.cjs`.

| Check | Command / location | Result |
| --- | --- | --- |
| Mobile TypeScript | `npm run typecheck` in `apps/mobile` | PASS |
| Full mobile suite | `npm test` in `apps/mobile` | **1,628 / 1,628**, zero skipped/failures |
| API suite | `npm test` in `apps/api` | **277 / 277**, zero skipped/failures; no API source changed |
| Focused authentication | `node --import tsx --test src/auth/*.test.ts` | **65 / 65**, 8 files |
| Focused scan | runner's explicit 21-file scan/API list | **148 / 148** |
| Focused deletion/reset | runner's explicit 6-file list | **25 / 25**; injected tests only |
| Focused privacy/analytics | runner's explicit 12-file list | **75 / 75** |
| Final focused runner | `node .artifacts/app-store-final-2026-10-25/run-focused.cjs` in mobile | All four groups PASS; overlaps full suite |
| Release archive wrapper | `npm run build:ios:release` | **BLOCKED before archive**, pending reviews/live configuration |
| Public pages | `node scripts/verify-public-release-urls.mjs` in mobile | **FAIL**, no working domain pages verified |
| Expo inspection export | `node .artifacts/app-store-final-2026-10-25/export-inspection.cjs` in mobile | PASS: reset-cache production Hermes export, 4,362 modules / 245 assets |
| Simulator artifact seal | `codesign --verify --deep --strict` on local `Okyo.app` | PASS, ad hoc simulator seal only |
| Native files | `plutil -lint` on project and PrivacyInfo | PASS |
| Website typecheck/build | `npm run check`, `npm run build` in `apps/web` | PASS, 0 errors/warnings/hints, 6 pages |
| Website publication gate | `npm run check:launch` | **BLOCKED**, legal approval + waitlist environment configuration |
| Whitespace | `git diff --check` in repository | PASS |

The browser-based website suite was not run; its two stale legal-status expectations were updated for shared current Terms/Privacy and the explicit legal publication gate. These are not counted as executed browser tests. All listed mobile/API test counts are actually executed, not source-only estimates.

## Remaining blockers and next test session

1. Reconcile Production API deployed revision/configuration: `/ready` must succeed, and protected routes must enforce the intended identity/mock restrictions. No Production changes were authorized here.
2. Supply actual live Clerk/RevenueCat configuration and verify both sign-in providers, account completion, entitlements and restore purchases using approved account/product workflows.
3. Approve legal text and source-derived privacy declarations after checking enabled vendors, retention/linkage and publisher/market decisions. Keep review fingerprints synchronized with the exact reviewed files.
4. Publish approved legal/support pages at the selected working HTTPS domain, configure the site waitlist endpoint, and rerun both URL and publication checks. No working policy URL is currently attested.
5. Complete signing/provisioning, App Store medical/privacy/pricing/availability metadata and confirm the next unused build number.
6. Run the guarded archive command successfully, then inspect that exact archive's bundled configuration. Finish real-device/compact-size/keyboard/Dynamic Type, continuous slider/signature, live camera/library AI success/failure/timeout/retry, customization, signed-in tour and auth relaunch QA. Only after explicit authorization, use a disposable non-Production account for end-to-end deletion/cleanup/first-screen/relaunch verification.

Checked production-facing owned copy and the inspected bundle no longer contain the obsolete app-as-demo/test/placeholder/Development language targeted by this audit. No fake community identities or pre-awarded user savings/history were observed. **A universal confirmation about the unpublished site, unknown live archive and mismatched deployed API cannot honestly be made.** No submission-readiness claim is made until those external and manual checks pass.

## Exact files changed in this audit

The following list compares the audit-start content hashes of existing files and adds newly created files explicitly. It is not the entire preexisting dirty Git diff. API data/log entries listed separately were generated by the local API test suite; no API implementation or Production data was edited. Local ignored build/log/screenshot evidence is outside this source list.

### Source, configuration, tests and reports

- `apps/mobile/app.json`
- `apps/mobile/babel.config.js`
- `apps/mobile/ios/Okyo.xcodeproj/project.pbxproj`
- `apps/mobile/ios/Okyo/PrivacyInfo.xcprivacy`
- `apps/mobile/legal-release-review.json`
- `apps/mobile/package.json`
- `apps/mobile/plugins/stripReleaseConsole.js`
- `apps/mobile/privacy-collected-data-review.json`
- `apps/mobile/scripts/build-ios-release.sh`
- `apps/mobile/scripts/release-console.test.mjs`
- `apps/mobile/scripts/validate-release-config.ts`
- `apps/mobile/scripts/verify-public-release-urls.mjs`
- `apps/mobile/src/api/config.test.ts`
- `apps/mobile/src/api/config.ts`
- `apps/mobile/src/api/releaseEnvironment.test.ts`
- `apps/mobile/src/api/releaseEnvironment.ts`
- `apps/mobile/src/auth/SignInScreen.tsx`
- `apps/mobile/src/auth/authReentry.test.ts`
- `apps/mobile/src/components/FoodImage.tsx`
- `apps/mobile/src/components/OkyoUI.tsx`
- `apps/mobile/src/legal/LegalDocumentView.tsx`
- `apps/mobile/src/legal/legalCenter.test.ts`
- `apps/mobile/src/legal/legalDocuments.test.ts`
- `apps/mobile/src/legal/legalDocuments.ts`
- `apps/mobile/src/mocks/xp.ts`
- `apps/mobile/src/navigation/MainTabs.tsx`
- `apps/mobile/src/navigation/tabHistory.test.ts`
- `apps/mobile/src/observability/sentry.ts`
- `apps/mobile/src/onboarding-v3/OnboardingV3.tsx`
- `apps/mobile/src/onboarding-v3/assets/kikoOnboardingRegistry.ts`
- `apps/mobile/src/onboarding-v3/branch-ui/SavingsPlanComponents.tsx`
- `apps/mobile/src/onboarding-v3/branch-ui/branchPlanProgress.test.ts`
- `apps/mobile/src/onboarding-v3/branch-ui/branchPlanProgress.ts`
- `apps/mobile/src/onboarding-v3/branch-ui/branchVisualSystem.test.ts`
- `apps/mobile/src/onboarding-v3/branchCommitmentFlow.test.ts`
- `apps/mobile/src/onboarding-v3/components/MacroTargetSlider.tsx`
- `apps/mobile/src/onboarding-v3/components/StartingEstimateSlider.tsx`
- `apps/mobile/src/onboarding-v3/onboarding2FirstPage.test.ts`
- `apps/mobile/src/onboarding-v3/onboardingV3RestorationIntegration.test.ts`
- `apps/mobile/src/onboarding-v3/onboardingV3VisualRevision.test.ts`
- `apps/mobile/src/onboarding-v3/screens/AgeEligibilityScreen.tsx`
- `apps/mobile/src/onboarding-v3/screens/BranchPersonalizedPlanScreen.test.ts`
- `apps/mobile/src/onboarding-v3/screens/BranchPersonalizedPlanScreen.tsx`
- `apps/mobile/src/onboarding-v3/screens/BranchSignatureCommitmentScreen.tsx`
- `apps/mobile/src/onboarding-v3/screens/HealthBranchScreen.tsx`
- `apps/mobile/src/onboarding-v3/screens/MacrosBranchScreen.tsx`
- `apps/mobile/src/onboarding-v3/screens/MacrosVisuals.tsx`
- `apps/mobile/src/onboarding-v3/screens/NameFoxValueScreens.tsx`
- `apps/mobile/src/onboarding-v3/screens/OnboardingPaywallScreen.tsx`
- `apps/mobile/src/onboarding-v3/screens/PersonalizedOnboardingScreen.tsx`
- `apps/mobile/src/onboarding-v3/screens/SaveMoneyBranchScreen.tsx`
- `apps/mobile/src/onboarding-v3/screens/healthBranchScreen.test.ts`
- `apps/mobile/src/onboarding-v3/screens/macrosBranchScreen.test.ts`
- `apps/mobile/src/onboarding-v3/screens/nameFoxValueScreens.test.ts`
- `apps/mobile/src/onboarding-v3/state/healthBranch.ts`
- `apps/mobile/src/onboarding-v3/state/macrosBranch.ts`
- `apps/mobile/src/onboarding-v3/state/saveMoneyBranch.ts`
- `apps/mobile/src/onboarding-v3/state/signatureDrawing.test.ts`
- `apps/mobile/src/onboarding-v3/state/signatureDrawing.ts`
- `apps/mobile/src/onboarding/canonical/resetControllerParity.test.ts`
- `apps/mobile/src/privacy/privacyManifestValidation.test.ts`
- `apps/mobile/src/privacy/privacyManifestValidation.ts`
- `apps/mobile/src/screens/DupeChallengeScreen.tsx`
- `apps/mobile/src/screens/PrivacyDataScreen.tsx`
- `apps/mobile/src/screens/RankingsScreen.tsx`
- `apps/mobile/src/screens/RestaurantPackDetailScreen.tsx`
- `apps/mobile/src/screens/ResultSummaryScreen.tsx`
- `apps/mobile/src/screens/SettingsScreen.tsx`
- `apps/mobile/src/screens/ShareCardPreviewScreen.tsx`
- `apps/mobile/src/screens/homeDashboard.test.ts`
- `apps/mobile/src/screens/recipeCompletionArtwork.test.ts`
- `apps/mobile/src/screens/settingsExpansion.test.ts`
- `apps/mobile/src/screens/settingsScreen.test.ts`
- `apps/mobile/src/state/useOkyoStore.ts`
- `apps/web/scripts/check-launch-ready.mjs`
- `apps/web/src/components/Footer.astro`
- `apps/web/src/config/site.ts`
- `apps/web/src/legal-drafts/privacy.md`
- `apps/web/src/legal-drafts/terms.md`
- `apps/web/src/pages/delete-account.astro`
- `apps/web/src/pages/terms.astro`
- `apps/web/tests/site.spec.ts`
- `docs/audits/APP_REVIEW_NOTES_2026-10-25.txt`
- `docs/audits/APP_STORE_PRIVACY_INVENTORY_2026-10-25.md`
- `docs/audits/APP_STORE_RELEASE_PREFLIGHT.md`
- `docs/audits/FINAL_APP_STORE_SUBMISSION_AUDIT_2026-10-25.md`
- `docs/legal/ACCESSIBILITY_STATEMENT.md`
- `docs/legal/AI_NUTRITION_AND_RECIPE_DISCLAIMER.md`
- `docs/legal/DATA_RETENTION_SUMMARY.md`
- `docs/legal/PRIVACY_POLICY.md`
- `docs/legal/PRIVACY_REQUESTS_AND_DELETION.md`
- `docs/legal/REFUND_AND_CANCELLATION_POLICY.md`
- `docs/legal/REGIONAL_PRIVACY_SUPPLEMENTS.md`
- `docs/legal/SECURITY_OVERVIEW.md`
- `docs/legal/SUBSCRIPTION_TERMS.md`
- `docs/legal/TERMS_OF_SERVICE.md`
- `docs/legal/VENDOR_AND_SUBPROCESSOR_LIST.md`

### Local files generated by API tests

- `apps/api/data/epicure-analytics.jsonl`
- `apps/api/data/platter-coverage-analytics.jsonl`
- `apps/api/data/recipe-quality-analytics.jsonl`
- `apps/api/logs/scan-evals.jsonl`

No Production settings or accounts were changed. No accounts were deleted. No app or website was submitted, uploaded, published or deployed. No push or commit was performed.
