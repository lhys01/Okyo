# Okyo iOS App Store Readiness Audit

Audit date: 2026-09-22  
Decision: **NOT READY FOR SUBMISSION**

This is a source-and-native-configuration audit. It does not replace a real-device test, a legal review, App Store Connect configuration, or an approved production API deployment.

## A. Executive summary

Okyo has a strong local-first recipe flow and an honest AI failure path, but it is not shippable today. The highest-risk blocker is the API: `/ready` intentionally returns `503` when `NODE_ENV=production` because there is no durable database, queue, or production-state implementation. The public privacy policy is also still explicitly a draft, has no public URL or support contact, and has not had counsel approval.

The implementation work in this audit closes several concrete release gaps: iPhone-only targeting, production HTTPS enforcement, contextual photo access, privacy-safe analytics defaults, local-data deletion, authenticated account deletion, RevenueCat identity reset, and updated native dependencies/privacy declarations.

## B. Release blockers

| Priority | Blocker | Evidence / required action |
| --- | --- | --- |
| P0 | Production API is deliberately not ready | `apps/api/src/server.ts` returns `503` from `/ready` in production and reports `persistentStateConfigured: false`. Deploy durable state, a worker/queue where needed, backups, monitoring, and a tested rollback/runbook. |
| P0 | Legal/public support is incomplete | In-app documents remain `LEGAL_DOCUMENTS_ARE_COUNSEL_APPROVED = false`; no legal entity, physical/business contact, support email, public Privacy Policy URL, Terms URL, retention schedule, or age rating decision is provided. Finalize and host these before App Store Connect submission. |
| P0 | Store metadata and commerce setup are not verifiable from source | Create products/subscription group, tax/banking agreements, screenshots, support and marketing URLs, review notes/test credentials, price schedule, age rating, privacy nutrition, and submission build in App Store Connect. |
| P0 | Account deletion needs production credentials and a real-device test | Set `CLERK_SECRET_KEY`, `CLERK_AUTHORIZED_PARTIES`, `REVENUECAT_PROJECT_ID`, and `REVENUECAT_V2_SECRET_API_KEY` on the API. Test Apple/Google sign-in, RevenueCat deletion, Clerk deletion, subscription survival/cancellation wording, and retry behavior. |
| P1 | Legacy Clerk package remains | iOS 15.1 compatibility currently requires deprecated `@clerk/clerk-expo@2.20.1`. The maintained package line currently requires iOS 17 and failed the project’s pod/SPM integration. Choose a supported auth migration plan before the legacy package reaches end-of-life. |
| P1 | Dependency security review remains | `npm audit --omit=dev` reported 32 findings (1 low, 27 moderate, 4 high) after package updates. Review the high findings and nested Clerk/wallet dependency tree; do not use a blind `npm audit fix --force`. |
| P1 | Full API typecheck is red | An untracked `openRouterProvider.preferences.test.ts` imports non-exported names. Resolve or remove that stale test only with its author’s intent, then require a clean API typecheck in CI. |
| P1 | Sign in with Apple deletion follow-up | Confirm Clerk/Apple token revocation handling for deleted users and document it; this source does not store or revoke Apple refresh tokens itself. |

## C. Code and configuration changes completed

- Set Expo and Xcode configuration to iPhone-only (`supportsTablet: false`, `TARGETED_DEVICE_FAMILY = 1`).
- Removed development local-network/Bonjour declarations and the generic Expo URL scheme from the iOS plist. Kept only `okyo` and `com.rober.okyo` URL schemes.
- Rewrote camera and photo-library usage text to describe dish scanning. Photo selection now invokes the iOS picker without a premature broad-library permission request.
- Removed the unused remote-push entitlement; grocery reminders remain local notifications.
- Release builds now reject HTTP API URLs and fail closed if no HTTPS API URL is supplied. Development retains an explicit LAN fallback.
- Disabled PostHog by default: no baked key means no analytics transmission. Enabling it requires a privacy-label and policy update.
- Added API-side bearer-token verification and `DELETE /v1/account`. It derives the Clerk user only from the verified session, requests RevenueCat customer deletion first, then deletes the Clerk user. It never accepts a client-provided user ID or exposes service secrets.
- Added account-deletion UI, a second confirmation, local data/image/reminder cleanup, RevenueCat logout, analytics identity reset, and sign-out.
- Updated factual references to account deletion in Help and legal draft text. The documents intentionally remain visibly unapproved drafts.
- Updated Expo/React Native patch versions and regenerated pods. CocoaPods completed successfully; the native privacy manifest contains tracking `false`, no app-declared collected data, and required-reason API declarations only.

## D. Privacy data map and proposed App Privacy answers

These are proposed answers to validate against the production deployment, all enabled Clerk providers, and every configured analytics setting. They are not a substitute for App Store Connect's exact questionnaire.

| Data type | Collected / sent | Destination and purpose | Linked | Tracking |
| --- | --- | --- | --- | --- |
| Food photos, dish descriptions, correction text, recipe context | Yes, only when user requests scan/generation/correction | Okyo API then configured OpenRouter/model provider; app functionality | Treat as linkable to device/session; re-evaluate if authenticated scans are added | No |
| Dietary restrictions, allergies, dislikes, nutrition targets | Yes, with relevant recipe request | Okyo API and configured AI provider; personalized recipe generation | Treat as linkable to device/session | No |
| Local recipes, lists, profile, progress, scan images | Local by default | Device app storage; not a server-side recipe database | Device-local | No |
| Account identity (Apple/Google sign-in information and Clerk user ID) | Optional, when sign-in is configured and used | Clerk; used for authentication and account deletion | Yes | No |
| Subscription/customer identifiers and purchase status | Yes, when RevenueCat is configured | Apple / RevenueCat; purchases and entitlement restoration | Yes when signed in; otherwise device/app user identity | No |
| Operational request metadata | Yes | Okyo API logs; security, reliability, abuse prevention | Do not intentionally link to a named account in current logging | No |
| Analytics identifiers and usage events | **No by default**; only if a PostHog key is deliberately supplied | PostHog; product analytics | Likely yes | No, unless future behavior changes |

Do not mark data as "not collected" merely because it is transient or vendor-processed. Final answers must match the deployed model provider, production logs, Clerk configuration, RevenueCat configuration, and whether PostHog is enabled.

## E. Permissions and notifications

| Capability | Current behavior | Submission position |
| --- | --- | --- |
| Camera | Requested only after the user chooses to photograph a dish. Text: “Okyo uses your camera so you can photograph a dish to scan.” | Required for scan-by-camera. |
| Photo selection | Opens the system picker after the user chooses a saved dish photo. Text: “Okyo lets you choose a dish photo to scan.” | Required for scan-by-photo; no proactive broad-library request. |
| Notifications | Optional local grocery reminders/timers; no remote push token or push service. | Explain as optional reminders; test first-use prompt and Settings recovery. |
| Microphone, contacts, location, Bluetooth, health kit, tracking | Not found in app configuration/source audit. | Do not add declarations or ATT prompt. |

## F. Subscriptions, restore, refunds, and account deletion

The app uses RevenueCat and presents purchase, restore, manage-subscription, terms, and privacy controls. The subscription offer must still be configured and tested in App Store Connect/RevenueCat. A user can manage/cancel through Apple subscription settings; deleting an account does not cancel a paid subscription.

Account deletion flow:

1. Settings → Privacy & data → Delete account.
2. Two confirmations prevent accidental deletion.
3. App sends only an authenticated bearer token to the API.
4. API verifies the session, requests RevenueCat customer deletion, then deletes the authenticated Clerk user.
5. App removes local Okyo storage, stored scan images, scheduled grocery reminder, RevenueCat identity, analytics identity, and local authentication state.

External deletion is not transactional across vendors. A network failure after RevenueCat accepts deletion but before Clerk deletion results in an honest retry message rather than a false "nothing was deleted" claim. Production support must have a documented manual resolution path.

## G. Third-party SDK / manifest audit

Observed first-party integration: Expo 55.0.31 / React Native 0.83.10, `expo-image-picker`, `expo-notifications`, Expo Secure Store/Auth Session/Web Browser, `react-native-purchases` 10.6.0, Clerk Expo auth, and a disabled-by-default hand-written PostHog REST transport. No Sentry, Firebase, Supabase, Neon, R2, advertising SDK, attribution SDK, or remote push provider was found in app source/configuration.

`apps/mobile/ios/Okyo/PrivacyInfo.xcprivacy` declares required-reason API use for file timestamps, user defaults, system boot time, and disk space; tracking is false and it declares no collected-data types. Dependency manifests should be re-inspected after every SDK upgrade and before archive submission.

## H. Security and production operations

Positive controls include HTTPS-only release API configuration, ATS without arbitrary loads, input validation, image size/type bounds, rate/cost controls, generic user-facing provider errors, structured request context, and local-first storage. No secret is committed in the reviewed source.

Required production work: HTTPS DNS/TLS, secret manager, separate staging/prod keys, durable database/cache/queue decisions, database access control and backup restore test, API authentication/authorization design for any future persisted content, monitoring/alerting, privacy-safe log retention, incident response contacts, DPA/subprocessor review, abuse/rate-limit verification, health/readiness probes that can become healthy, and a rollback plan.

## I. Final metadata package to supply in App Store Connect

- App name: Okyo
- Bundle ID: `com.rober.okyo`
- Version/build source defaults: 1.0.0 (1); increment build number for each upload
- Category proposal: Food & Drink; choose a secondary category only if useful
- Subtitle proposal: “Turn restaurant cravings into recipes”
- Promotional text proposal: “Snap the dish you’re craving and cook your own inspired-by version at home.”
- Keywords proposal: `recipes,food scan,cooking,meal ideas,grocery list,restaurant copycat`
- Support URL: **required — not provided**
- Marketing URL: optional, but provide a real public URL if used
- Privacy Policy URL: **required — host approved public policy, not this draft**
- Copyright: legal entity/year **required**
- Age rating: complete truthfully after legal/product review; avoid invented answers
- Review notes: explain camera/photo scan, optional sign-in, subscription testing account/sandbox setup, deletion location, and that recipes are inspired-by rather than official restaurant recipes

## J. Validation completed and still required

Completed locally:

- Mobile TypeScript typecheck: pass.
- Focused mobile safety tests: 10 pass, including release HTTPS behavior and deletion storage/image cleanup.
- API account deletion tests: 3 pass.
- Expo Doctor: 20/20 checks pass.
- CocoaPods: successful after Expo/RN updates.
- iOS Release simulator build: pass (`xcodebuild ... -configuration Release ... CODE_SIGNING_ALLOWED=NO`), with ordinary pod/script warnings only.

Required before submission:

- Clean API typecheck after resolving the untracked stale preference test.
- Production archive/upload signed with distribution credentials.
- Physical-device tests on the oldest supported iOS, current iOS, and at least one small iPhone: onboarding, camera, picker, denied/re-enabled permission, scan success/failure, offline handling, subscription purchase/cancel/restore, account sign-in/deletion/retry, local deletion, notification reminder, accessibility, and all links.
- TestFlight review by external users and App Review metadata preflight.

## K. Human tasks before submission

1. Deploy and verify durable production API infrastructure until `/ready` can truthfully return healthy.
2. Create and test App Store products, subscription group, RevenueCat entitlement/offering, restore flow, cancellation wording, and sandbox purchase path.
3. Configure Clerk Apple/Google providers, allowed redirect URLs, production domain/origin configuration, and production API secrets; run end-to-end deletion tests.
4. Finalize legal entity, support contact, public support/privacy/terms URLs, age rating, data retention/log policy, AI vendor terms, and counsel approval.
5. Complete App Privacy questionnaire from the final deployment, not this source snapshot.
6. Resolve high dependency findings and establish dependency-update ownership.
7. Produce App Store screenshots, icon, localization, accessibility review, review notes, and TestFlight release notes.

## L. Final score

**3/10 — not ready for App Store submission.**

The app’s mobile privacy and account flows are substantially safer after this audit, but production infrastructure, legal/policy/support facts, commercial configuration, full build/test evidence, and dependency remediation remain release-critical.

## M. Manually test these changes

1. In a development build, verify a configured HTTP LAN URL works only in development; in a release configuration, it must fail closed.
2. Tap Camera and Photo library from scan; verify the permission copy and denial/retry path.
3. Schedule and cancel a grocery reminder; verify no remote-push permission/path is implied.
4. With production-like Clerk and RevenueCat credentials, sign in with Apple and Google, buy/restore a sandbox subscription, delete account, and confirm local data clears while Apple subscription management remains available.
5. Turn on a PostHog key only after completing the updated privacy labels/policy; otherwise verify no analytics requests leave the device.
