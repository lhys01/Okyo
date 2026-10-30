# Analytics and privacy-copy review notes

Engineering evidence only. These draft replacements are **not approved legal
language** and must be reviewed against the actual shipping build, enabled keys,
PostHog project settings, consent behavior, retention, hosting regions, and
subprocessor terms before publication. This file does not amend in-app or
hosted legal documents.

## What the code currently sends

- Mobile PostHog capture is an explicit REST `/capture/` call. There is no
  PostHog SDK, autocapture, or session-replay recorder in the transport.
- The mobile allowlist permits `app_open`, `session_started`,
  `app_backgrounded`, and `app_foregrounded`, plus the two coarse onboarding
  experiment events `onboarding_experiment_started` and
  `onboarding_experiment_branch_completed`. The experiment events carry only a
  fixed experiment name and A/B/C arm. They do not carry the selected goal
  branch, answers, screen names, or completion content. Other screen, product,
  health, identity, photo, prompt and error properties are discarded.
- Mobile `distinct_id` is an in-memory UUID for the current app session. It is
  not the separately persisted anonymous API/RevenueCat ID and is not linked
  to the Clerk user. It changes after a cold start or long background reset.
  `$process_person_profile: false` is sent with every capture.
- Mobile transmission starts when `EXPO_PUBLIC_POSTHOG_KEY` and a host exist.
  The `.env.example` leaves the key empty; the actual release bundle/key was
  not available for this review.
- The API also has a separate PostHog batch transport enabled by
  `POSTHOG_PROJECT_API_KEY` or `POSTHOG_API_KEY`, unless
  `ANALYTICS_ENABLED` does not exactly match `NODE_ENV`. It emits `$ai_generation` metadata such as model,
  provider, token counts, latency, estimated cost, success/failure category,
  request type and a trace identifier. It intentionally omits prompt and model
  input/output content. The client-supplied anonymous ID was previously used
  as a persistent backend analytics distinct ID; the current change removes
  that linkage and uses a fresh random ID per event with person profiles off.
- API `$ai_generation` properties are allowlisted to approved model/provider,
  request category, prompt-version identifier, token counts, latency, cost
  estimate, success/failure category, retry/fallback metadata, confidence
  bucket, environment, and a request/trace ID. PostHog's distinct ID is newly
  generated per event. No prompt or generated
  recipe content is sent.
- The session replay environment flag is not connected to any recorder.
- When the key and matching explicit environment opt-in are present, events
  are sent without an analytics-consent prompt or in-app analytics opt-out.
  The separate consent ledger does not currently gate either PostHog path.
- The app/API do not set PostHog retention. Retention and deletion behavior
  are controlled by the PostHog project and must be verified there. The actual
  Railway variables and signed release bundle were not inspected.

## Conflicting in-app statements

The following short excerpts need review if either mobile or server PostHog is
enabled in a release:

- Privacy Policy, “Analytics”: “transmission is switched off unless the
  publisher deliberately supplies an analytics key” ([source](/Users/rober/Desktop/Okyo-1/apps/mobile/src/legal/legalDocuments.ts:94)). This describes a conditional switch, but it does not name PostHog or explain the separate server-side key.
- Privacy Policy, “Who else receives data”: “Only the parties needed ... the
  AI provider ... and Apple plus RevenueCat” ([source](/Users/rober/Desktop/Okyo-1/apps/mobile/src/legal/legalDocuments.ts:110)). PostHog is an additional recipient when either PostHog configuration is active.
- Service providers, “What is not here”: “if enabled, its provider will be
  listed here and disclosed before release” ([source](/Users/rober/Desktop/Okyo-1/apps/mobile/src/legal/legalDocuments.ts:468)). PostHog is implemented but is not named in that section.
- Privacy requests, “Objection and consent withdrawal”: “Okyo runs no
  analytics, advertising or tracking to object to” ([source](/Users/rober/Desktop/Okyo-1/apps/mobile/src/legal/legalDocuments.ts:502)). That absolute statement conflicts with the configured-key transport paths.

## Proposed draft, pending review

If the release enables either transport, review wording along these lines:

> When analytics is enabled for this build, Okyo sends limited mobile app lifecycle and onboarding experiment metadata, plus server-side AI request metadata, to PostHog. Mobile experiment events identify a fixed experiment and its A/B/C version so overall branch-start and branch-completion rates can be compared. Mobile events do not include selected goal branches, answers, photos, meal descriptions, prompts, allergies, weight, health goals, email addresses, access tokens, screen names, or persistent user identifiers. Server events may include the selected model and provider, request type, token counts, latency, estimated cost, and a coarse success or failure category; they do not include AI prompts or generated recipe content. Okyo does not use autocapture or session replay in this build. Analytics configuration, PostHog project, retention, consent and regional processing are described for the actual release before publication.

If release analytics remains disabled, document the evidence for both mobile
and API environments and verify it in a release network capture before using
“no analytics” wording. Do not use either draft until privacy/legal review and
the project-console settings have been checked.

## Review before publication

Review the Privacy Policy analytics, data recipients, and objection sections;
the Service providers list; the privacy choices/consent flow; App Store privacy
labels; Google Play Data safety form; and the release build configuration. The
API backend analytics key and mobile EXPO public project key are independent
settings and both must be checked.

## Remediation configuration (engineering facts, not approved disclosures)

Mobile now requires `EXPO_PUBLIC_ANALYTICS_ENABLED=development` for a debug build or
`production` for a release build, plus its public key. Default/off/mismatch sends nothing.
API requires `ANALYTICS_ENABLED` equal to `NODE_ENV` (development or production) plus its key.
Only the US/EU PostHog ingestion hosts are accepted. Mobile emits the four lifecycle
events plus the two fixed-name experiment events above; other product, screen,
subscription and health telemetry remains excluded.
Both transports disable person profiles. No opt-out/consent UI has been invented.
The existing policy mismatch remains a release blocker until reviewed and approved.

New optional Sentry crash reporting and PostgreSQL temporary state also need disclosure
review: sanitized exception stacks/build metadata; temporary recipe state for 24 hours and
analysis state for 15 minutes, with scheduled deletion required. No uploaded images or
provider credentials are persisted by this new database path. Database backups and vendor
retention still require a founder decision and real configuration verification.
