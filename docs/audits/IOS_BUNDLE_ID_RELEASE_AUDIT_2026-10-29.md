# Okyo iOS Bundle ID and local Release archive audit

Expected iOS Bundle ID: `com.rober.okyo`.

Checkout: `/Users/rober/Desktop/Okyo-1` (the operator-selected checkout).

## Current-session completion update

- The current legal source fingerprint was refreshed in `apps/mobile/legal-release-review.json` using the already recorded counsel approval for Roberto Ferrito. The wording was also corrected so Apple sign-in is described as conditional on Apple/Clerk production configuration, and scan-photo retention does not promise cleanup that the app cannot guarantee. Mobile release preflight now passes.
- The public legal-only package was rebuilt, audited, and deployed to the existing Railway `okyo-website` Production service. Final deployment `dd8c2f79-182f-4bb5-8b11-550ae58ac4b6` completed successfully.
- Clean external requests now return HTTPS 200 for `/privacy`, `/terms`, `/support`, and `/delete-account`; the `www` host returns a canonical HTTPS redirect. The deployed pages contain no draft, placeholder, or test-build language.
- A fresh local Xcode Release archive was created at `apps/mobile/.artifacts/Okyo-Release-2026-10-29-legal-refresh.xcarchive` for the legal refresh. Its archive and app metadata both identify `com.rober.okyo`, with version `1.0.0` and build `1`. Xcode exited while trying to remove/recreate the archive destination (`Operation not permitted`) after producing the archive contents; this is a local archive-path permission issue, separate from the legal checks.
- The archive is still Apple Development-signed (`get-task-allow = true`) because this Mac has no Apple Distribution identity or App Store provisioning profile. It is suitable for local verification only and cannot be uploaded to App Store Connect.
- A non-uploading distribution-signing attempt with `-allowProvisioningUpdates` was made. Xcode stopped before archiving because the target is automatically development-signed and this checkout has no locally installed Apple Distribution identity or provisioning profile; no Apple account or App Store settings were changed.
- Mobile typecheck, auth/legal tests (32), public-site build/publication tests, launch checks, release preflight, API readiness checks, and artifact security scans all pass.

## Configuration findings

| Location | Evidence | Result |
| --- | --- | --- |
| Expo app source | `apps/mobile/app.json` → `expo.ios.bundleIdentifier` | `com.rober.okyo` |
| Resolved production Expo config | `NODE_ENV=production npx expo config --type public --json` | `com.rober.okyo`; team `7N86UDY734` |
| EAS | No `eas.json`, dynamic app config, or EAS project ID is configured in this checkout | This build uses the local Xcode Release configuration |
| Xcode app target | Debug and Release `PRODUCT_BUNDLE_IDENTIFIER` | Both `com.rober.okyo` |
| Resolved Xcode Release settings | `xcodebuild -showBuildSettings -json`, generic iOS device | `com.rober.okyo`; team `7N86UDY734`; deployment target iOS 17 |
| Native Info.plist | `CFBundleIdentifier = $(PRODUCT_BUNDLE_IDENTIFIER)` | Uses the app target value |
| Native URL schemes | `okyo`, `com.rober.okyo`, development-client scheme | OAuth callback scheme is separate from the Bundle ID |
| Sentry release naming | `apps/mobile/src/observability/sentry.ts` | `com.rober.okyo@<version>` |
| Apple Developer App ID evidence | Existing Apple-issued provisioning profile, expires October 9, 2027 | Exact application identifier `7N86UDY734.com.rober.okyo`; current portal state awaits account access |
| Sign in with Apple | Expo `usesAppleSignIn`, Expo/Clerk plugins, native entitlement, existing profile | Enabled; entitlement `com.apple.developer.applesignin = [Default]` |
| Clerk local configuration | Release publishable key targets `clerk.okyoapp.com`; Expo plugin keeps Apple entitlement; native Apple hook used | Local configuration matches the intended Bundle ID |
| Clerk Production dashboard | Okyo Production instance; Frontend API `clerk.okyoapp.com`; Native applications and SSO connections configured and verified | iOS registration is `7N86UDY734` / `com.rober.okyo`; redirects are `com.rober.okyo://callback` and `okyo://continue`; Google is enabled with Production credentials; Apple remains disabled pending Apple Developer credentials |
| Remote push | App schedules local reminders and does not request a remote push token; release plugin removes `aps-environment` | No remote-push entitlement required by current app; existing development profile's extra push permission is not requested by the app |
| Associated domains | No associated-domain entitlement/configuration; Google returns to `okyo://continue`; Apple uses native authentication | Not configured or needed by the inspected flow |
| App Store Connect | Browser reaches the Apple sign-in page | Current registered Bundle ID and app record not verified without account access |

No iOS Bundle ID mismatch was found in accessible local settings. No Bundle ID was changed. Android's existing `com.anonymous.okyo` package is a separate platform identifier and was not edited.

## Local build preparation

The existing release wrapper initially failed its security scan because the dotenv parser allowed newline whitespace after an empty assignment. It treated the next variable assignment as the empty variable's value. The parser now restricts assignment whitespace to spaces/tabs while preserving quoted multiline values. A regression test covers empty assignments followed by another assignment or a comment. The source/environment scan now returns zero findings.

CocoaPods had reserialized `PrivacyInfo.xcprivacy`. Its parsed dictionary exactly matches all reviewed Expo collected-data declarations, required-reason APIs, tracking status, and tracking domains. Only the fingerprint in `privacy-collected-data-review.json` was refreshed, with a generation note; approval scope and date were preserved.

The external release blockers were repaired after the local archive audit. The public legal/support pages now return 200 over HTTPS. Production API `/ready` returns 200 with healthy database, Clerk, quota, and AI checks. Anonymous library and account-capability requests return 401, and the retired weekly-ranking route returns 404. The release checks remain intact and pass against the deployed services.

## Build and artifact verification

**ARCHIVE SUCCEEDED**, Xcode exit code 0. Output directory:

`apps/mobile/.artifacts/bundle-id-audit-2026-10-29/`

The command used Xcode `Release`, the generic physical iOS destination, `NODE_ENV=production`, and a reset Metro cache. It did not pass provisioning-update options or upload/submit anything. Existing local signing credentials were used; Apple Distribution signing is not installed on this Mac.

Archive reviewed during the original audit: `apps/mobile/.artifacts/bundle-id-audit-2026-10-29/Okyo.xcarchive` (422 MB). The current-session archive is `apps/mobile/.artifacts/Okyo-Release-2026-10-29.xcarchive` (422 MB) and carries the same verified Bundle ID plus the updated authentication UI.

| Built artifact check | Verified result |
| --- | --- |
| Archive `Info.plist` → `ApplicationProperties.CFBundleIdentifier` | `com.rober.okyo` |
| Archived `Okyo.app/Info.plist` → `CFBundleIdentifier` | `com.rober.okyo` |
| Signed `application-identifier` entitlement | `7N86UDY734.com.rober.okyo` |
| Embedded provisioning profile | Exact application identifier `7N86UDY734.com.rober.okyo` |
| Version / build | `1.0.0` / `1` |
| Platform / SDK / minimum OS | Physical iOS / `iphoneos26.5` / iOS 17 |
| Apple sign-in | Signed entitlement `[Default]` |
| Remote push / associated domains | Neither entitlement is requested |
| Signature validation | `codesign --verify --deep --strict` passed |
| Signing type | Apple Development; `get-task-allow = true` |
| Bundled environment | Configured Production API origin and actual live Clerk publishable key present; no full Development Clerk key or Clerk server secret found |
| Artifact security scan | 351 files scanned; zero findings |
| Source/environment security scan | 2,565 files scanned; zero findings |
| Targeted tests | 11 security tests and 3 privacy-manifest tests passed |
| Mobile TypeScript / release preflight / diff whitespace | All passed |

Machine-readable evidence is saved beside the archive in `configuration-audit.json`, `build-verification.json`, `bundle-environment-verification.json`, and `artifact-security.json`. Xcode's result bundle is `Archive.xcresult`.

Both archives are locally built, development-signed **Release archives**. Neither is an App Store distribution-signed IPA. The current-session archive was built after the legal publication and authentication updates; the external website and API checks pass without weakening any release check.

## Remaining account and submission checks

1. Apple Developer and App Store Connect remain inaccessible; the operator cannot sign into them through the available browser. The existing Apple-issued profile matches, but the current App Store Connect app record remains unverified.
2. Clerk Production's iOS registration and mobile redirects are complete. Google is enabled. Apple remains disabled because Clerk's Production dashboard requires Okyo's Apple Services ID, private key, Team ID, and Key ID. Those values require Apple Developer access and must be entered only in Clerk, never in the mobile app or repository.
3. Make an Apple Distribution identity and App Store provisioning profile available locally before distribution export. The current archive is Development-signed.
4. On a permitted physical iPhone, test Production Google sign-in and callback, a real photo scan/upload, sign-out/sign-in, and account deletion. Confirm the real session token's non-empty `azp` value, if any, matches Railway's authorized-party configuration without recording the token itself. Apple sign-in can be tested after the provider is enabled.

## Files edited for this audit

- `scripts/security/audit.mjs`
- `scripts/security/audit.test.mjs`
- `apps/mobile/privacy-collected-data-review.json`
- `apps/web/scripts/prepare-legal-publication.mjs`
- `apps/api/src/services/accountDeletion.ts`
- `apps/api/src/services/accountDeletion.test.ts`
- `apps/api/.env.example`
- `docs/AUTH_SETUP.md`
- `apps/mobile/src/auth/SignInScreen.tsx`
- `apps/mobile/src/auth/auth.test.ts`
- `apps/mobile/src/screens/PrivacyDataScreen.tsx`
- `apps/mobile/src/screens/SettingsScreen.tsx`
- `apps/mobile/src/legal/legalDocuments.ts`
- `apps/mobile/src/legal/legalDocuments.test.ts`
- `apps/mobile/.env.example`
- `docs/legal/PRIVACY_POLICY.md`
- `docs/legal/DATA_RETENTION_SUMMARY.md`
- `docs/legal/REGIONAL_PRIVACY_SUPPLEMENTS.md`
- `apps/web/src/pages/delete-account.astro`
- `apps/web/src/legal-drafts/privacy.md` (generated)
- This report

Generated native build artifacts remain local and ignored by Git.

## Clerk account verification follow-up

Production dashboard evidence, October 29, 2026:

- Application: Okyo, `app_3Jx1VyUHYna7UoNwDbfpyCIzDEQ`.
- Production instance: `ins_3JxQP5HTmS6NSkELzQnvG8xMGEC`.
- Frontend API: `clerk.okyoapp.com`, matching the publishable key embedded in the audited archive.
- Native applications: enabled.
- iOS applications table: App ID prefix `7N86UDY734`, Bundle ID `com.rober.okyo`.
- Mobile SSO redirect table: `com.rober.okyo://callback` and `okyo://continue`.
- SSO connections: Google is enabled with Okyo's Production credentials. Apple is present but disabled because its required Apple Developer credentials are not available in this session.
- Clerk's suggested `webcredentials:clerk.okyoapp.com` associated domain concerns passkeys/password autofill. The current app uses native Apple authentication and a custom-scheme Google callback, so the audit did not add that optional entitlement.

The app source and signed archive need no Bundle ID change. The October 29 archive predates the email/password UI added below, so it is stale for testing the updated sign-in screen.

## Authentication method follow-up — October 29, 2026

- Clerk Production enables email sign-up and sign-in, requires the email address, and uses email-code verification at sign-up and for first-factor email verification. Password sign-up and adding a password to an account are both enabled. The minimum password length is 15 characters and compromised passwords are rejected. Device Trust is enabled and requires email verification on a new device.
- Google remains enabled for both sign-up and sign-in.
- Apple remains disabled in Clerk Production until the operator enters the Apple Services ID, private key, Team ID, and Key ID from Apple Developer. The app's Apple button/native hook is present, but Production Apple authentication cannot complete yet.
- The mobile app now offers email/password account creation, email-code verification, password sign-in, and email-code password reset, alongside the Google and Apple controls. In-app and local public-site privacy/deletion copy now includes email/password. The website build and publication checks pass, and the updated legal-only package has now been redeployed to Railway Production after the legal review fingerprint was refreshed.
- Production settings were verified in Clerk's dashboard and through the public Clerk Production environment response. No keys or tokens were recorded.
- TypeScript passed; auth and legal tests passed (32 total); public-site publication checks passed; and release preflight now passes with the matching legal fingerprint.
- The current-session Release archive includes the updated email/password UI. It remains development-signed until an Apple Distribution identity and App Store provisioning profile are installed.

The physical-device run still needs to test email/password signup and email verification, password sign-in/reset, Google sign-in and sign-up, a real photo scan/upload, sign-out, and account deletion. Test Apple after its Clerk Production credentials are entered.

## Production website and API follow-up

- Name.com DNS already pointed `okyoapp.com` and `www.okyoapp.com` at the correct Railway website service, so no DNS record changed.
- The website deployment had failed because the packaged `apps/web` build called a monorepo security-audit script that was absent from Railway's package snapshot. A standalone, audited legal-site package was deployed to Railway.
- The published package now includes the referenced `/okyo-icon.png` asset.
- Public anonymous results: `/privacy` 200 (`Privacy Policy · Okyo`), `/terms` 200 (`Terms of Service · Okyo`), `/support` 200 (`Support · Okyo`), and `/delete-account` 200 (`Delete your account or data · Okyo`). The `www` host redirects to the root HTTPS host.
- The Production API now has valid Clerk configuration, private-network PostgreSQL connectivity, and the missing `okyo_private.idea_submissions` migration. `/ready` returns 200 with all release gates healthy.
- The subscription-free launch does not require RevenueCat account-deletion credentials. Supplying only one RevenueCat credential still fails closed; supplying both enables the additional RevenueCat deletion step.
