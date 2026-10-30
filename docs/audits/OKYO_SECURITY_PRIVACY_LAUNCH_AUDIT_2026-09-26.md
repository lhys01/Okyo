# Okyo security, privacy, cost and launch audit

**Reviewed:** 2026-09-26 (America/Los_Angeles)  
**Scope:** Current `/Users/rober/Desktop/Okyo-1` working tree against checklist IDs 001–1000.  
**Mode:** Read-only source review plus selected local, mocked API tests. No production requests, real AI calls, account changes, or destructive tests.

## Executive summary

This audit is of the current source tree, not a running production service. The checkout was already heavily modified before this audit: branch `codex/app-store-readiness` had many staged/unstaged/untracked files. Those changes were treated as audit input. The only files created for this task are this report and the accompanying CSV. No production deployment, API host, release binary, provider console, store console, billing dashboard, team-owner roster, or jurisdiction list was provided. Local `.env` files exist; their contents were not opened. No pass is inferred from a dependency or policy file alone.

The repository currently contains an Expo iOS/Android/web app and Express API. Useful controls include Zod request schemas, JSON/image limits, request deadlines, process-local rate/concurrency caps, idempotency, generic AI failure handling, structured logging, client analytics allowlisting, local data deletion, and an authenticated Clerk account-deletion endpoint. Selected local API tests passed (34/34).

The main launch blockers are architectural. Most API routes have no authentication or per-user authorization, while server resource state is global in-process mock data. The global daily AI cap is also in-process and is only incremented for real image scans; description scans and other AI routes can bypass it. A process restart or additional replica resets/splits limits. There is no provider-console evidence for a hard spend ceiling or an operational kill switch. The API `/ready` route explicitly returns not-ready under `NODE_ENV=production` because persistent state is not configured.

There is also a material privacy-disclosure mismatch: PostHog event transmission exists when its public project key is configured, and app events include dish names and allowlisted error text; legal copy says analytics is absent or disabled and does not name PostHog. The privacy text also makes conflicting statements about whether accounts exist. These should be reconciled against the actual shipping configuration before distribution.

**This audit does not establish that Okyo is currently exposed publicly or has incurred costs.** Hosting and live credentials were not inspected. If any AI-backed API with a real key is publicly reachable, treat the missing universal persistent quota and route-wide auth boundary as a critical pre-release issue. No finite checklist can guarantee an app will not be hacked or fined.

## Status counts

| Status | Count |
|---|---:|
| PASS | 3 |
| FAIL | 51 |
| PARTIAL | 71 |
| UNKNOWN | 847 |
| NOT_APPLICABLE | 28 |
| **Total** | **1000** |

Applicability is separately recorded as YES / NO / UNKNOWN. UNKNOWN means the repository or local evidence does not establish whether the check applies or works. NOT_APPLICABLE is used only with an explicit current-architecture reason; recheck if the product/deployment changes.

## Five immediate actions

1. Put one authentication/identity boundary in front of every user-data and billable route. Derive user/guest identity server-side, and scope reads, writes, quota and deletion by that identity. Until then, keep any real-key AI API private or disabled.
2. Apply one cost-control middleware to every provider call (vision, text scans, analysis-to-recipe, correction, ask, coaching and enrichment). Use an atomic shared budget/quota reservation across instances; cap input/image/output tokens, retries, concurrency and total daily spend. Add a tested operator kill switch.
3. Set and verify provider-side key/organization hard limits and alerts in OpenRouter. Keep the key server-side, restrict its use where supported, and document the owner and emergency shutdown steps. A request-count cap is not a hard dollar cap.
4. Do not route production traffic until the service has durable state, ownership isolation, cross-instance quotas/idempotency, and a readiness check that only turns green after those services are configured. Current `/ready` intentionally rejects production mode.
5. Align shipped privacy text, consent/data-store disclosures, PostHog settings, account/age handling, and App Store / Play declarations. Obtain jurisdiction and child-audience decisions plus legal and nutrition/food-safety review before launch.

## Critical and high findings

| Priority | Finding and evidence | Cheapest effective fix |
|---|---|---|
| **CRITICAL if public with live AI key** | The daily AI counter is process-local and resets on restart (`apps/api/src/middleware/costControls.ts:48-76`). It is called only for real-image scans (`apps/api/src/server.ts:400-404, 450-454`). `POST /v1/scans/analyze/:analysisId/recipe`, `POST /v1/recipes/:recipeId/ask`, `/correct`, `/coaching`, and text-only scans invoke provider work without a global budget reservation (`apps/api/src/server.ts:486-615`). The per-IP throttle is also local and only attached to scans, ask and correct (`apps/api/src/middleware/costControls.ts:5-46`; `server.ts:366-615`). | Create one provider-call wrapper with shared atomic budget reservations, per-identity and global caps, dollar-based ceiling, bounded retries and concurrency. Fail closed on budget-store loss. Attach every AI path to it. Add provider-side hard budget and verify kill switch. |
| **HIGH / cross-user access and integrity** | Clerk is verified for `DELETE /v1/account` (`apps/api/src/server.ts:318-331`; `apps/api/src/services/accountDeletion.ts:80-120`), but ordinary resource/AI endpoints have no auth middleware (`apps/api/src/server.ts:366-615, 517-583`). Read/save/library/savings/challenge/XP routes use shared mock store structures (`apps/api/src/store.ts:1-175`). There is no durable DB, and `/ready` refuses production mode (`apps/api/src/server.ts:287-303`). | Add common auth and server-derived identity, then move user-owned state to durable storage with owner predicates on every query/mutation. Do not expose the current shared mock routes as production user storage. |
| **HIGH / truthful privacy disclosure** | PostHog transport and event tracking are implemented (`apps/mobile/src/analytics/analyticsEnv.ts`, `analyticsClient.ts`, `posthogTransport.ts`); `sanitize.ts:13-38` allows `dish_name`, `goal`, and `error_message`; onboarding sends dish names (`apps/mobile/src/onboarding-v3/controller/useOnboardingV3Controller.ts:295,400`). Legal copy says no analytics at `apps/mobile/src/legal/legalDocuments.ts:468-470,502-504`, while analytics configuration is present in `apps/mobile/.env.example`. Legal copy also describes optional accounts at lines 67/123 but elsewhere says no accounts at lines 351/423. | Decide whether analytics ships. If yes, minimize properties, set consent/retention and vendor terms, then update disclosures/store declarations to match. If no, turn off transport in release builds and verify a network capture. Resolve the account and deletion wording inconsistencies. |
| **HIGH / age and sensitive nutrition data** | The app collects allergies, restrictions, goals and nutrition targets (`apps/mobile/src/onboarding-v3/screens-v4/DietarySafetyScreen.tsx`, related state); those values can be sent with AI requests (`apps/api/src/server.ts:125-201,333-356`). Legal copy says general audience and not directed to children, but minimum age is unset (`apps/mobile/src/legal/legalDocuments.ts:115-123,149`). Intended countries and child-audience likelihood are unknown. | Select launch countries and audience/age policy. Have counsel assess COPPA and UK Children’s Code applicability and any health-data rules. Either define/enforce an age approach or complete child-oriented privacy decisions before collection. |
| **HIGH / launch-policy declarations** | No signed release build, App Store Connect / Play Console configuration, or privacy-manifest bundle was supplied. Current Apple/Google requirements require accurate privacy disclosures and appropriate account-deletion handling when applicable; Play requires a Health Apps declaration for published apps, including an explicit no-health-features declaration if that is the conclusion. | Inspect actual platform builds and complete current store declarations only after data/vendor inventory and age/jurisdiction decisions are approved. |

Severity describes repository risk, not proof of a live exploit. Check whether the API is exposed and whether `AI_ENABLED` plus a valid provider key are active before attributing realized exposure or spend.

## Checks needing evidence beyond this repository

- **Production console / deployment:** API host and TLS; production environment flags and secrets; OpenRouter provider/key limits and usage alerts; Clerk allowed origins and auth config; PostHog project, retention, consent and staging separation; RevenueCat account deletion effects; cloud/database/network/backup controls; replica count; alerts/on-call; production budget thresholds.
- **Release/device verification:** iOS entitlements and SDK privacy manifests; required-reason APIs; Android merged permissions/target API; EXPO_PUBLIC output and bundle-secret scan; deep links; photo-picker denial; HTTPS enforcement; lock-screen notification content; backup behavior; all legal links; restore and rollback paths.
- **Security testing:** two-account and guest/account data isolation; forged/expired token tests across all routes; quota behavior across replicas/restarts; provider budget exhaustion and kill switch; prompt injection in text and image; upload/decoder boundary handling; account deletion during active AI work; safe alert delivery. Run only against test accounts/staging and mocked or capped providers.
- **Legal / privacy:** define countries, age and intended audience; have counsel decide COPPA/UK Children’s Code/US state consumer-health-data/GDPR applicability, lawful bases, notices, processor terms, retention and rights workflows. The current code alone cannot make these legal determinations.
- **Food/nutrition:** qualified reviewer for allergy language and recipe safety, nutrition/cost/savings methodology, medical or weight claims, and relevant database/content licenses.

## Conditional rules reviewed (2026-09-26)

This is a routing list for competent review, not a compliance opinion.

- Apple says apps supporting account creation must provide in-app account-deletion initiation and requires accurate app privacy disclosures; Apple also requires privacy manifests/signatures for listed third-party SDKs in applicable submissions. See [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app), [App Review privacy guidance](https://developer.apple.com/app-store/review/), and [third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/).
- Google Play requires an in-app deletion path and a web deletion resource when account creation is supported, plus a Health Apps declaration for published apps. Whether Okyo’s nutrition/weight features map to a declaration category must be decided from actual product functionality. See [Google account deletion](https://support.google.com/googleplay/android-developer/answer/13327111) and [Health Apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291).
- OpenRouter’s current API key documentation supports setting a key usage limit and reset period; this audit could not inspect Okyo’s provider account or confirm that a ceiling is configured. OWASP identifies unrestricted API resource consumption and unbounded LLM consumption as risks; request throttling alone does not establish a dollar ceiling. See [OpenRouter API key limits](https://openrouter.ai/docs/api/api-reference/api-keys/create-a-new-api-key), [OWASP API4:2023](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/), and [OWASP LLM10:2025](https://genai.owasp.org/llmrisk/llm102025-unbounded-consumption/).
- FTC COPPA applicability depends on whether the service is child-directed or has actual knowledge it collects personal information from under-13s; the FTC’s guidance covers mobile apps and persistent identifiers. The FTC Health Breach Notification Rule can apply to some consumer health apps outside HIPAA; whether Okyo meets its definitions requires counsel’s facts-based analysis. See [FTC COPPA guidance](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business), [FTC Health Breach Notification Rule guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0), and [FTC mobile health app tool](https://www.ftc.gov/business-guidance/resources/mobile-health-apps-interactive-tool).
- The UK Children’s Code applies to online services likely to be accessed by children, not only child-directed services; the ICO says likely access depends on service appeal and evidence. A playful general-audience cooking app’s UK status is a launch legal decision, not established by the repo. See [ICO scope guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/services-covered-by-this-code/).

## Sequenced fix plan

| Order | Work | Verification | Effort |
|---|---|---|---|
| 0 | Confirm no live public AI exposure; disable real provider use for public routes until universal limits exist. | Check deployment and provider console; run a capped staging request and verify disabled mode returns a generic failure. | 0.5–1 day |
| 1 | Common route auth + server-derived guest/user identity + ownership model. | Automated route matrix: no token, invalid token, user A/user B, guest; prove no cross-user reads/writes. | 2–5 days |
| 2 | Shared global cost/quota service, dollar hard-stop, universal AI wrapper, bounded job limits and operator kill switch. | Multi-instance/restart tests; exhaust test budget; prove all AI routes stop before next provider request. | 2–5 days |
| 3 | Durable per-user persistence, deletion/export design, idempotency and pending-job handling. | Two-user integration suite, account deletion and recovery/restore verification. | 1–3 weeks |
| 4 | Correct telemetry and privacy notices; settle age/country scope and vendor terms. | Inspect release network events and data map; legal review signs off on real collection/store forms. | 2–5 days plus counsel |
| 5 | Release supply-chain/store gates: dependency scan, secrets/history scan, build bundle inspection, privacy manifests, permissions and store metadata. | Signed iOS/Android test artifacts and staged store submission checklist. | 2–5 days |
| 6 | Food safety, nutrition, age suitability and marketing claim review; incident/backup/recovery exercise. | Written qualified review; staged backup restore and alert drill. | 2–5 days plus reviewer |

Effort assumes one developer familiar with the app. Legal/external review time is additional. Payments remain out of scope as requested; existing dormant subscription-related code is not used here to invent payment findings.

## Test evidence

Ran selected local API tests: `node --import tsx --test src/server.scan.test.ts src/server.correction.test.ts src/services/accountDeletion.test.ts src/services/aiExecutionGuard.test.ts src/middleware/idempotency.test.ts` from `apps/api`. Result: **34 passed, 0 failed**. These tests use local fixtures/mocks; they do not establish production auth, global spending limits, multi-replica behavior, real-provider limits, or store/legal compliance.

## Artifact

The companion CSV contains exactly one row per checklist ID, in order, with applicability, status, severity, evidence location, summary, verification need and owner hint. See `OKYO_1000_POINT_SECURITY_PRIVACY_LAUNCH_AUDIT_2026-09-26.csv` in this directory.
