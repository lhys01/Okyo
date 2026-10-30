# Okyo Analytics & Observability

Single source of truth for how Okyo measures itself. Invisible to users — no
screen, copy, or behavior changes for instrumentation.

## 1. Architecture

```
anonymous_id  (uuid v4, AsyncStorage "okyo:anon-id:v1", created once per install)
     │
     ├─ PostHog distinct_id
     ├─ RevenueCat appUserID   (Purchases.logIn on init)
     └─ Sentry user.id         (once a DSN is provided — not wired yet)

MOBILE  src/analytics/
  analyticsEnv.ts      env + PostHog key/host (bundle-safe client key)
  identity.ts / uuid.ts  anonymous_id (persisted) + uuidV4
  sessionContext.ts    in-memory session_id, resets on cold start / >30m background
  sanitize.ts          ALLOW-LIST + sanitizeProperties  ← privacy gate
  eventProperties.ts   buildBaseContext (app_version, platform, environment, session_id, primary_goal, subscription_status)
  propertyKeys.ts      camelCase → snake_case for existing call sites
  posthogTransport.ts  fetch POST {host}/capture/  (no SDK, fire-and-forget)
  analyticsClient.ts   track / screen / identify / reset / setPersonProperties / captureErrorContext
  track.ts             public API kept as-is (analyticsEvents + track); delegates to analyticsClient
  bootstrap.ts         App.tsx wiring: init, AppState lifecycle, screen-view dedup
  onboardingV4Events.ts  pre-existing V4 taxonomy, now routed through the shared client

BACKEND  apps/api/src/observability/
  requestContext.ts    AsyncLocalStorage { requestId, anonId } + Express middleware
  aiPricing.ts         central model pricing table + estimateCostUsd
  analytics.ts         captureEvent + emitAiGeneration → PostHog /capture/ (fetch, fire-and-forget)
  provider hook        openRouterProvider.ts emits `ai_generation` at the existing [token_usage] point
```

No SDKs added. No native rebuild required. Sending is best-effort: a failed
request is swallowed and never blocks or crashes the app.

## 2. Providers

| Provider | Role | Source of truth for |
|---|---|---|
| **PostHog** | product analytics, funnels, retention, paths, cohorts, session replay (off), feature flags (later) | events, user properties |
| **Sentry** | crashes, exceptions, perf, traces | reliability — **DSN not yet provided; integration stubbed in env only** |
| **RevenueCat** | subscriptions / paywall / revenue | entitlement, purchases, trials, renewal, cancellation, expiration, revenue |

Do NOT add Mixpanel, Amplitude, Firebase Analytics, AppsFlyer, etc.

## 3. Identity rules

- `anonymous_id` is the only identity until real auth exists. It is the PostHog
  `distinct_id`, the RevenueCat `appUserID`, and (later) the Sentry `user.id`.
- Anonymous users are fully trackable before any auth.
- When auth ships: call `identify(userId, props)` — it emits `$create_alias`
  (anon → userId) then `$identify`, so PostHog merges the person. Also call
  `Purchases.logIn(userId)`. Never mint a second competing id.
- `session_id` is in-memory only; new on cold start and after >30 min background.
- Correlation ids: `request_id` (mobile mints per API call, header
  `x-okyo-request-id`, backend echoes it), `trace_id` = `request_id` (no OTel),
  `scan_id` / `recipe_id` / `analysis_id` where the flow has them.
- IDs never carry secrets.

## 4. Event naming rules

- snake_case, present-tense verb-object (`recipe_saved`, `scan_submitted`).
- One event per meaningful behavioral transition — not per render.
- Backend-authoritative facts (AI cost/latency, subscription state) come from
  the backend or RevenueCat, not client guesses.
- Add a name to `analyticsEvents` in `track.ts` (keeps the typed union), or emit
  via `analyticsClient.track(name, props)` for dynamic names.

## 5. Event taxonomy

Wired now (mobile unless noted). `*` = reserved name, wired when the feature exists.

**Session/app**: `app_open`, `session_started`, `app_backgrounded`,
`app_foregrounded`, `client_error` · `session_ended`*

**Onboarding** (V3 live + V4 module): `onboarding_start` / `onboarding_started`,
`onboarding_screen_viewed`, `onboarding_answer_submitted`,
`onboarding_goal_selected` / `primary_goal_selected`, `personal_insight_viewed`,
`dietary_preferences_saved` (counts only), `personal_plan_viewed`,
`onboarding_complete` / `onboarding_completed` · `onboarding_branch_entered`*,
`onboarding_abandoned`*

**Scan**: `scan_started`, `photo_uploaded`, `dish_detected` · `camera_opened`*,
`photo_captured`*, `photo_selected`*, `describe_started`*, `scan_submitted`*

**Recipe generation**: `recipe_generated`, `result_viewed`, `result_error` ·
`recipe_generation_started/completed/failed`* (backend mirror)

**Recipe behavior**: `recipe_saved`, `mode_selected`, `share_card_generated`,
`share_tapped`, `share_completed` · `recipe_unsaved`*, `recipe_regenerated`*,
`servings_changed`*, `ingredient_changed`*

**Cooking**: `cooking_started`*, `cooking_completed`* — wire ONLY to the real
`activeCooking` / `completedMeals` transitions. A generated recipe is **not** a
cooking completion. `cooking_step_viewed`*, `cooking_timer_started`*,
`cooking_abandoned`*

**Grocery**: `grocery_list_viewed`, `grocery_list_exported` ·
`grocery_item_added`*, `grocery_item_completed`*

**Gamification**: `xp_event_recorded`, `badge_unlocked`, `leaderboard_viewed`,
`challenge_started`, `challenge_completed`, `accuracy_rating_submitted`,
`restaurant_pack_viewed`

**Monetization** (mirrors — RevenueCat is truth): `paywall_viewed`,
`paywall_plan_selected`, `trial_started`, `subscription_started`,
`subscription_renewed`, `subscription_cancelled`, `subscription_expired`.
Derived only from `CustomerInfo` transitions in `services/revenueCat.ts`.

**AI (backend)**: `$ai_generation` — one event per OpenRouter call, in PostHog's
LLM-analytics schema (`$ai_model`, `$ai_provider`, `$ai_latency` seconds,
`$ai_input_tokens`, `$ai_output_tokens`, `$ai_total_cost_usd`, `$ai_trace_id`,
`$ai_span_id`, `$ai_is_error`) plus Okyo extras (`request_type`, `retry_count`,
`fallback_used`, `confidence_bucket`, `cost_estimated`, `failure_category`).
`$ai_input` / `$ai_output_choices` are omitted on purpose (user content).
Shows in PostHog → **LLM analytics**.

**Screen views**: `$screen` with `screen` + `previous_screen`, deduped per route.

## 6. Important properties

Base context on every event (from `buildBaseContext`): `app_version`,
`platform`, `environment`, `session_id`, `primary_goal`,
`subscription_status`. `distinct_id` = anonymous_id (separate field).

Per-flow: `screen`, `screen_index`, `source`, `method`, `action_type`,
`branch`, `elapsed_ms`, `scan_id`, `recipe_id`, `request_id`, `model`,
`provider`, `request_type`, `generation_ms`, `retry_count`, `fallback_used`,
`confidence_bucket`, `ingredient_count`, `mode`, counts
(`allergy_count` …). Full list = `ALLOWED_PROPERTY_KEYS` in `sanitize.ts`.

## 7. Privacy / redaction rules

- **Allow-list, not block-list.** `sanitizeProperties` keeps only keys in
  `ALLOWED_PROPERTY_KEYS`; anything else is dropped before the event leaves the
  device. Strings truncated to 200 chars; objects/arrays/functions never sent.
- Dietary data → **counts only** (`allergy_count`), never the values.
- Never sent: email, name, raw dish descriptions, photo URIs / image bytes,
  AI prompts, AI output, auth headers, tokens, API keys, payment details,
  filesystem paths.
- Backend `ai_generation` sends token counts / latency / model only — never
  prompt or completion text, never images.
- Session replay: OFF by default (`EXPO_PUBLIC_POSTHOG_REPLAY=1` to enable) and
  must mask all inputs + images before it is turned on.
- **Under review** (existing behavior kept, not expanded): `dish_name` and a
  truncated `error_message` are still sent by legacy call sites. Decide whether
  to drop them.

### Apple App Privacy — data categories introduced

Identifiers (device-generated anonymous id; **not** IDFA), Product Interaction,
Diagnostics/Crash (when Sentry lands), Performance, Purchases (via RevenueCat).
No contact info, no photos, no health/dietary values, no precise location.
This is a factual inventory, not legal advice.

## 8. AI-cost methodology

- Emitted as PostHog `$ai_generation` from `openRouterProvider.ts` at the
  existing `[token_usage]` point (success) and in `catch` (failure). Built by
  hand in `observability/analytics.ts` — NOT PostHog's OpenAI SDK wrapper,
  since Okyo calls OpenRouter over raw fetch.
- One pricing table: `apps/api/src/observability/aiPricing.ts`, USD per 1M
  tokens, matched by case-insensitive substring on the model id.
- `estimateCostUsd(model, inputTokens, outputTokens)` →
  `{ costUsd, estimated, matchedModelKey }`. When `costUsd` is a number it is
  sent as `$ai_total_cost_usd`; when `null` the property is omitted and PostHog
  prices it from `$ai_model` + token counts where it recognises the model.
- Unknown model OR missing token counts → no `$ai_total_cost_usd`,
  `cost_estimated: false`. Values are **never fabricated**.
- Table values are operator-maintained estimates — verify against provider
  pricing pages. Known free tiers (`:free`, `nemotron`) price to a real `0`.
- `$ai_latency` is in seconds (PostHog convention); `time_to_first_token_ms`
  is always `null` — the provider is non-streaming.
- Anonymous server-side calls set `$process_person_profile: false` so they do
  not create junk PostHog persons.

## 9. RevenueCat source-of-truth rules

- RevenueCat remains authoritative for entitlement, purchases, trials, renewal,
  cancellation, expiration, revenue.
- Analytics events are a **mirror**, computed only from `CustomerInfo`
  transitions (previous vs next snapshot) — never from purchase button taps.
- Never compute subscription truth from PostHog events.
- `Purchases.logIn(anonymous_id)` aligns the RC appUserID with the analytics id.
- Pricing, offerings, paywall flow, and `purchasePackage` / `restorePurchases`
  are unchanged.
- Recommended: enable RevenueCat's PostHog + Sentry integrations in the RC
  dashboard so server-verified purchase events flow with the matching id.

## 10. How to add a new event

1. Add the name to `analyticsEvents` in `src/analytics/track.ts` (snake_case value).
2. If it needs a new property key, add that key to `ALLOWED_PROPERTY_KEYS` in
   `src/analytics/sanitize.ts` (one named key, no index signature).
3. Call `track(analyticsEvents.YOUR_EVENT, { ...props })` at the behavioral
   transition — not in a render path.
4. If the fact is backend-authoritative, emit it from `apps/api` via
   `captureEvent` / `emitAiGeneration` instead.
5. Add a line here.

## 11. Environment variables

Mobile (`EXPO_PUBLIC_*`, bundle-safe): `EXPO_PUBLIC_POSTHOG_KEY`,
`EXPO_PUBLIC_POSTHOG_HOST`, `EXPO_PUBLIC_ENV`, `EXPO_PUBLIC_POSTHOG_REPLAY`,
`EXPO_PUBLIC_SENTRY_DSN` (pending). A working PostHog default is compiled into
`analyticsEnv.ts`, so analytics is live with no `.env`.

Backend: `POSTHOG_PROJECT_API_KEY` (or `POSTHOG_API_KEY`), `POSTHOG_HOST`,
`ANALYTICS_ENABLED=off` hard switch, `SENTRY_DSN` /
`SENTRY_TRACES_SAMPLE_RATE` (pending). No key → backend analytics no-ops.

## 12. Founder Dashboard (PostHog insights to create)

Credentials/config-as-code not available — build these manually.

**North-star**: weekly *activated* users = did `onboarding_completed` →
`scan_started` → `recipe_generated` → `result_viewed` in the week.

**Activation funnel**: `app_open` → `onboarding_completed` → `scan_started` →
`recipe_generated` → `result_viewed` → (`recipe_saved` OR `cooking_started`).
Breakdown by `primary_goal` and `app_version`.

**Onboarding funnel**: `onboarding_started` → `onboarding_screen_viewed`
(step breakdown) → `primary_goal_selected` → `onboarding_completed`. Drop-off
by `screen`.

**Engagement** (trends per person, weekly): scans, `recipe_generated`,
`recipe_saved`, `cooking_started`, `cooking_completed`, `share_completed`.

**Retention**: retention on `app_open`, D1/D3/D7/D14/D30, cohort by first-seen
week and by `primary_goal`.

**Monetization funnel**: `paywall_viewed` → `paywall_plan_selected` →
`trial_started` → `subscription_started`. Plus trial→paid conversion and
`subscription_expired` / `subscription_cancelled` rate.

**AI performance/cost** — mostly prebuilt in PostHog → **LLM analytics**; custom insights on `$ai_generation`:
- avg + P50/P95 `$ai_latency` (seconds), split by `$ai_model`.
- success rate = `$ai_is_error = false` / all; failure rate by `failure_category`.
- sum `$ai_total_cost_usd` per day; cost per generated recipe (÷ distinct
  `recipe_generated`), per saved recipe, per `cooking_completed`, per retained
  user.
- `cost_estimated = false` share (coverage gap in the pricing table).

**Reliability**: Sentry crash-free users/sessions (when live); `result_error`
rate; `$ai_generation` where `$ai_is_error = true` rate; slowest `request_type` by P95.

---

Related: `docs/wiki/COST_ENGINE.md`, `docs/wiki/MONETIZATION.md`,
`docs/wiki/SECURITY_AND_COST_CONTROLS.md`. Legacy `ANALYTICS_EVENTS.md` is
superseded by section 5 above.
