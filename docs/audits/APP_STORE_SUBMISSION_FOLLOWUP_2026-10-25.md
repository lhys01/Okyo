# Okyo submission follow-up — October 25, 2026

**Not ready to submit.** This report records work completed after the earlier final audit, under the new authorization for website-only hosting and `okyoapp.com` DNS. It supersedes the earlier configuration/privacy counts; the earlier manual flow evidence still applies where source was unchanged.

## Latest owner scope — October 27, 2026

- Treat the launch as a general-audience app; no Kids Category restriction or automatic child age gate has been added.
- Keep Clerk accounts and food-photo uploads enabled.
- Subscriptions are disabled for launch; no RevenueCat production product, price, purchase flow or entitlement configuration is required for the launch build.
- The confirmed operator name is **Roberto Ferrito**.
- Intended availability is worldwide where the App Store and applicable law permit distribution; no country-specific legal approval has been inferred.
- The Name.com session is authenticated and the CSV records are present: root ANAME flattened to `69.46.46.86`, `www` CNAME to Railway, both Railway verification TXT records, and the existing Clerk records. Railway reports DNS propagated and the custom-domain certificate valid.

## Completed automatically

1. Diagnosed root DNS failure using public and authoritative queries. Name.com serves the domain's nameservers, but the root has no website address and `www` does not exist. No unrelated records or domains were changed.
2. Confirmed there was no website host deployed in the connected Railway projects. Created a separate empty **okyo-website** service in the existing project, Production environment, and registered **only** root and `www` custom domains. Obtained exact routing/TXT records and prepared the canonical redirect. No code was deployed. See [the exact DNS handoff](OKYO_WEBSITE_DNS_2026-10-25.md).
3. Prepared and tested a secret-free legal/support publication package. The four pages have clean routes, correct content types, no launch/“Coming soon” campaign or inactive waitlist UI, and a single `www` → root redirect. A minimal link hub is supplied at `/`; this does not remove the existing marketing/waitlist source. Read-only server rejects POST; runs unprivileged in its Docker image.
4. Created ignored, mode-600 `apps/mobile/.env.production.local`. It selects the known Production API, disables all three previews, demo/mock auth/probes, PostHog, Sentry and subscriptions, and clears Development integration credentials. Existing Development environment files were preserved. The rotated public Clerk key still needs to be entered locally. RevenueCat values remain blank because subscriptions are disabled for launch. No credentials were fabricated or exposed.
5. Added an archive prerequisite verifying `/ready` and unauthenticated Library/Rankings restrictions. A merely healthy `/health` response cannot qualify the service. The check uses only anonymous GETs and does not print response bodies.
6. Tightened runtime RevenueCat platform-key matching and excluded unused Test Store/Development analytics settings from Release environments. No vendor mapping or price was invented.
7. Updated the App Privacy inventory and native/Expo manifest for the actual selected Release profile: PostHog and Sentry disabled; Development-only JSONL analytics excluded. **13** categories remain prepared, with no Crash Data declaration for disabled Sentry. Product Interaction reflects Clerk authentication/security activity, not disabled PostHog. Performance Data reflects unlinked aggregate server metrics, not Development event files. The operator-reported counsel approval is recorded and bound to the exact manifest; future product or vendor changes require a new review.
8. Found and fixed a screenshot-export bug: an empty label rendered the editor hint **LABEL** in exported images. Hints now appear only while editing. Regenerated and inspected a new export. Existing source screenshots/deck layout were preserved.
9. Expanded the public URL check to include `/delete-account`. Replaced a PostHog dashboard instruction in public policy text with an accurate explanation that enabled services receive network connection information. Internal review fingerprints and generated review documents were synchronized.

## Website access, publication and SSL

Name.com is authenticated in the available browser session. The exact records are present and public DNS queries return the Railway CNAME/TXT values. No Name.com API credentials were needed or stored. The exact click path and record values remain in the DNS report.

Railway custom-domain registration, DNS ownership verification and SSL issuance are complete. The website service is currently being deployed from the prepared static site; until that deployment finishes, public URLs return the service's 404 response.

A website-only Production deployment is allowed by the request once its content decisions are resolved and it is reported first. It was not performed while the following personal/legal answers remain unresolved. No approval record was silently changed.

### Exact legal wording requiring the owner's decision

- Privacy Policy: **“Okyo is a general-audience cooking app and is not designed for children under 13.”** Confirm the intended age floor and launch countries; Terms/store declarations must agree.
- Terms: **“You need to be old enough to form a binding agreement where you live, and to meet the minimum age stated in the app’s store listing.”** Confirm that requirement is appropriate for intended users/markets.
- Terms: **“Okyo may suspend or discontinue the service, or parts of it, and will not take a paid feature away without honoring the period you have paid for.”** This is a commercial promise for owner/legal review, not a guarantee proven by code.
- Privacy Policy: **“We do not sell personal information or use it for targeted advertising.”** Source contains no advertising/tracking integration; the owner still needs to confirm vendor/business practices support this representation.
- The text names the operator as **“Roberto Ferrito”** and uses `support.okyo@gmail.com`; no company name, address, governing-law jurisdiction or contractual retention period was invented.

The prepared pages accurately describe the intended sign-in and AI behavior, and state that subscriptions are disabled at launch. The API configuration has since been updated and redeployed with AI enabled; readiness still depends on the exact Clerk authorized-party values described below. The publication package can be reviewed locally; its preparation is not legal approval.

## Production API and vendor checks

Read-only Railway configuration and deployment evidence:

- API `NODE_ENV` is Production.
- `AI_ENABLED`, `PRODUCTION_AI_ENABLED` and `OPENROUTER_API_KEY` are configured in Railway Production and the resulting deployment succeeded.
- A `CLERK_SECRET_KEY` with a live prefix exists. Read-only Clerk instance/domain metadata requests returned **HTTP 403**. The secret was never printed.
- PostHog and Sentry remain disabled for the selected launch profile; no Development analytics project is used in Release.
- `/ready` still returns **503** because `CLERK_AUTHORIZED_PARTIES` is not configured. Unsigned `/v1/library` and `/v1/rankings/weekly` still return **200**, so the release API check correctly rejects the deployment.

The API configuration/deployment step was authorized and completed for the AI provider flags. The remaining change requires the exact authorized-party values from a legitimate production Clerk session; guessing them would weaken the authentication boundary and is not acceptable.

### Missing values and exact destinations

| Value | Destination / source |
| --- | --- |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Ignored `apps/mobile/.env.production.local` or approved Release CI environment. Obtain the verified live publishable key from **Clerk Dashboard → correct app → Production → Configure → API Keys**. Never put a Clerk secret key in the mobile app. |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | Not required while `EXPO_PUBLIC_OKYO_SUBSCRIPTIONS_ENABLED=false`. Add the iOS public SDK key only when subscriptions are deliberately re-enabled. |
| `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` | Not required while subscriptions are disabled. Add the verified entitlement only when a paid plan is deliberately introduced. |
| `OPENROUTER_API_KEY`, `AI_ENABLED`, `PRODUCTION_AI_ENABLED` | Configured in the existing API service's Production variables and deployed successfully. |
| `CLERK_AUTHORIZED_PARTIES` | Still required in the API service. Add only the exact HTTPS origins/native `okyo://` parties observed from legitimate Production Clerk sessions; do not guess. |
| Valid server Clerk configuration | Existing API's `CLERK_SECRET_KEY` has a live prefix; its raw value was never exposed. Verify the intended Clerk Production instance in the Clerk dashboard. |

The Apple team, bundle ID, version/build, icon and permission wording remain as audited previously. Icon checks pass. Apple Distribution identity/provisioning and the unused App Store build number still require account verification. Pricing and Apple submission/review were not changed.

## Source-backed App Privacy answers

The updated [privacy inventory](APP_STORE_PRIVACY_INVENTORY_2026-10-25.md) provides each category, collection/linkage/tracking/purpose and source paths. Current prepared profile:

| Category | Collected | Linked | Tracking | Purpose |
| --- | --- | --- | --- | --- |
| Name; Email Address | Yes through sign-in | Yes | No | App Functionality |
| Coarse Location | Yes, Clerk IP-derived city/country | Yes | No | App Functionality |
| User ID; Device ID | Yes, API/auth identity | Yes | No | App Functionality |
| Photos or Videos | Yes, submitted food photos; no video flow found | Yes | No | App Functionality |
| Other User Content | Yes, submitted descriptions/edits/questions and working recipe content | Yes | No | App Functionality; Product Personalization |
| Health | Yes, submitted allergy/dietary/nutrition targets | Yes | No | App Functionality; Product Personalization |
| Customer Support | Yes, submissions/correspondence | Yes | No | App Functionality |
| Purchase History | No at launch; subscriptions disabled | N/A | No | N/A |
| Product Interaction | Clerk sign-in/session activity; PostHog disabled | Yes | No | App Functionality |
| Performance Data | Aggregate API route/status latency metrics | No in those aggregates | No | App Functionality |
| Other Diagnostic Data | API/auth/device diagnostics | Yes for authentication records | No | App Functionality |
| Crash Data | **No for selected profile**, Sentry disabled | N/A | No | N/A |

Do not include Development PostHog project/events, Development JSONL analytics, test authentication or internal probes in Apple's answers. Pure local preferences/signature/age/activity inputs are not automatically collected. Purchase History is excluded because subscriptions are disabled for launch. No final App Store attestation can be made for a build that does not yet exist with the rotated live Clerk key and verified Production API. Re-enabling subscriptions or either optional telemetry integration requires revisiting the inventory, manifest and review.

## Screenshot and marketing results

New corrected export:

`/Users/rober/Downloads/okyo-ios-iphone-20261025-2202.zip`

24 PNGs: six images each at **1320×2868**, **1284×2778**, **1206×2622**, **1125×2436**. Every exported image is 24-bit RGB PNG without an alpha channel. These match accepted iPhone sizes in [Apple's screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/). The 1024×1024 app icon is opaque RGB and passes the icon validator.

Source images inside the editor include cropped screenshots and alpha channels; those are design inputs, not directly uploadable finished exports. The exporter produces accepted sizes and RGB output. The obsolete LABEL hint is absent in the inspected corrected output. No screenshots were uploaded to Apple. Existing captured app content/layout was preserved; the deck is not evidence that its pictured data or older UI was produced by the final audited Release build. Review final screenshot content against the eventual signed build before submission.

## Verification actually run

| Check | Result |
| --- | --- |
| `npm run typecheck` in mobile | PASS |
| `npm test` in mobile | **1,636 / 1,636 pass**, zero skipped/failures |
| `npm run build:ios:release` | BLOCKED before archive: the mobile `pk_live_` value is still blank and `/ready` is not yet passing. Owner legal/privacy review is recorded; RevenueCat is intentionally not required while subscriptions are disabled. |
| `node --import tsx scripts/check-release-api.ts` in mobile | FAIL as intended for current deployment: `/ready`503 and two unsigned routes200 |
| Four public legal/support URL checks | FAIL, no resolvable website address |
| Web Astro typecheck | PASS, zero errors/warnings/hints |
| Legal-only website build | PASS, six build pages; publication package selects only required pages and its minimal root |
| Static server integration tests | **3 / 3 pass**, including four routes, www redirect, HTML aliases, unknown routes and rejected writes |
| Screenshot project TypeScript | PASS |
| Actual regenerated screenshot bundle | PASS dimensions/RGB for all 24 images; first corrected image visually inspected |
| `plutil -lint` privacy manifest | PASS |
| `git diff --check` | PASS |

The earlier 277 API tests and manual simulator checks remain recorded in the [earlier audit](FINAL_APP_STORE_SUBMISSION_AUDIT_2026-10-25.md). Production AI flags were configured and deployed in this follow-up, but live authentication, exact Clerk authorized-party enforcement, continuous native dragging/signature and destructive deletion are not newly claimed as verified. Purchases are intentionally out of scope for this launch. The browser-based website suite was not rerun; the new local HTTP integration tests were run.

## What is pending from the user

The Name.com step is complete. The operator is Roberto Ferrito, the intended availability is worldwide where the App Store and applicable law permit distribution, and the launch is general-audience with no Kids Category restriction or automatic child age gate. Counsel approval is recorded for the current legal text, including its general-audience and under-13 wording. Store age-rating answers and any future audience or market change must remain consistent with that published text.

After access is resolved, complete the website-only deployment, exact DNS additions, certificate verification and all four public URL checks. The guarded app archive will still need the rotated live Clerk publishable key, exact `CLERK_AUTHORIZED_PARTIES`, actual Production API readiness and the remaining store-side review steps. The app must not be submitted until the remaining real-device/live-provider checks pass.

## Exact follow-up files changed

- `app-store-screenshots/src/components/editor/slide-canvas.tsx`
- `apps/mobile/app.json`
- `apps/mobile/ios/Okyo/PrivacyInfo.xcprivacy`
- `apps/mobile/legal-release-review.json`
- `apps/mobile/privacy-collected-data-review.json`
- `apps/mobile/scripts/build-ios-release.sh`
- `apps/mobile/scripts/check-release-api.ts`
- `apps/mobile/scripts/verify-public-release-urls.mjs`
- `apps/mobile/scripts/verify-release-api.test.ts`
- `apps/mobile/scripts/verify-release-api.ts`
- `apps/mobile/src/api/releaseEnvironment.test.ts`
- `apps/mobile/src/api/releaseEnvironment.ts`
- `apps/mobile/src/legal/legalDocuments.ts`
- `apps/mobile/src/services/subscriptionAvailability.ts`
- `apps/mobile/src/services/revenueCatConfig.test.ts`
- `apps/mobile/src/services/revenueCatConfig.ts`
- `apps/web/README.md`
- `apps/web/package.json`
- `apps/web/scripts/check-legal-publication.mjs`
- `apps/web/scripts/prepare-legal-publication.mjs`
- `apps/web/scripts/public-site.test.mjs`
- `apps/web/scripts/serve-public-site.mjs`
- `apps/web/src/components/Header.astro`
- `apps/web/src/layouts/Base.astro`
- `apps/web/src/legal-drafts/privacy.md`
- `apps/web/src/pages/privacy.astro`
- `docs/audits/APP_STORE_PRIVACY_INVENTORY_2026-10-25.md`
- `docs/audits/APP_STORE_RELEASE_PREFLIGHT.md`
- `docs/audits/APP_STORE_SUBMISSION_FOLLOWUP_2026-10-25.md`
- `docs/audits/FINAL_APP_STORE_SUBMISSION_AUDIT_2026-10-25.md`
- `docs/audits/OKYO_WEBSITE_DNS_2026-10-25.md`
- `docs/legal/PRIVACY_POLICY.md`

Local ignored configuration: `apps/mobile/.env.production.local` (not committed; no credential values added). Build packages, logs and validation JSON are in the ignored follow-up evidence folder. No files, accounts, databases or user data were deleted. No push, pricing change, Apple submission/review action or Production code deployment occurred. Only the explicitly reported website service/custom-domain metadata was created; existing Production services/settings were untouched.
