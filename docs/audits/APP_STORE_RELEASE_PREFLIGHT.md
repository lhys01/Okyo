# Okyo submission build gate

Use the user-selected checkout `/Users/rober/Desktop/Okyo-1`.

```sh
cd /Users/rober/Desktop/Okyo-1/apps/mobile
npm run build:ios:release
```

This runs local configuration/privacy/legal checks and public HTTPS page checks, verifies Production API readiness/unsigned route restrictions, then creates `.artifacts/Okyo.xcarchive` with Xcode's Release configuration. It does not upload, submit, deploy, update vendor settings, or create accounts. `OKYO_ARCHIVE_PATH` can override the local archive path. Xcode's embedded-bundle phase independently runs the release configuration gate and resets Metro's transform cache.

The ignored local `.env.production.local` now selects the verified Production API origin and disables previews, demo/mock switches, PostHog, Sentry and subscriptions. It deliberately leaves the rotated live Clerk publishable key blank; RevenueCat values are blank because subscriptions are disabled for launch. The gate now records the operator-reported counsel approval and still blocks the missing mobile Clerk value. Development environment files were preserved. Never remove these checks or claim approval for text or vendors that were not included in the recorded review.

Provide the actual approved mobile Production build values through the release environment: public HTTPS API URL and the rotated live Clerk publishable key. Do not place any server secret in an `EXPO_PUBLIC_` variable. Keep `EXPO_PUBLIC_OKYO_SUBSCRIPTIONS_ENABLED=false` for this launch. Disable preview/probe/demo switches. Optional analytics must use an explicitly enabled separate Production project; optional crash reporting must use the intended Production project. Confirm the final vendor settings externally.

The Expo and native configuration use `com.rober.okyo`, team `7N86UDY734`, version `1.0.0`, build `1`. Confirm the registered App Store record and unused build number. Local signing evidence currently includes a matching Development profile/identity, but no Apple Distribution identity was found. Distribution provisioning and Apple-side registration are separate requirements.

The counsel-approved review is recorded in `legal-release-review.json` and `privacy-collected-data-review.json` with source/manifest fingerprints. `LEGAL_DOCUMENTS_ARE_COUNSEL_APPROVED` is true for this launch package, and the in-app Privacy Policy is published without a draft banner. Re-review after any generated native manifest, product, or vendor changes.

The configured public pages are `https://okyoapp.com/privacy`, `/terms`, `/support`, and `/delete-account`; DNS lookup currently fails. The prepared website pages must be legally reviewed and hosted over working public HTTPS without login. A dedicated empty Railway website service and both custom domains are now registered. DNS edits need an authenticated Name.com session; a legal/support publication package is prepared. No website code was deployed.

See `APP_STORE_SUBMISSION_FOLLOWUP_2026-10-25.md` for current exact results and remaining work, and `APP_STORE_PRIVACY_INVENTORY_2026-10-25.md` for category-by-category answers. The full signed live build and device flows must pass before submission readiness can be claimed.
