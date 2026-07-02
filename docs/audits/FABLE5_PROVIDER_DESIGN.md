# Fable 5 Provider — Design Note (Phase 1)

## Status

Design only. No code implemented. No production defaults changed.

## Goal

Add Claude Fable 5 (Anthropic) as an optional, opt-in second AI provider for Okyo's scan (vision) and recipe-generation pipeline, without touching the current default path (OpenRouter → `gpt-4o-mini`) or breaking existing behavior.

## Current OpenRouter Flow (as of this design)

- `apps/api/src/config/aiConfig.ts`: `AiConfig.provider` is hardcoded to `'openrouter'`. Vision/text model IDs come from `OPENROUTER_VISION_MODEL` / `OPENROUTER_TEXT_MODEL` env vars, default `openai/gpt-4o-mini`.
- `apps/api/src/services/openRouterProvider.ts`: builds OpenAI-style chat completion requests against `https://openrouter.ai/api/v1/chat/completions` — `image_url` content parts, `response_format: {type:"json_object"}`, `temperature: 0.2`, `include_reasoning:false` / `reasoning:{enabled:false}`. Recipe generation has a hardcoded model fallback chain (`google/gemini-3.1-flash-lite`, `google/gemini-3.5-flash`, optional `RECIPE_PAID_FALLBACK_MODEL`), triggered on HTTP 429/402/404/503/timeout/network error (`isFailoverError`). Structural and quality repair passes retry against the same chain.
- `apps/api/src/services/aiService.ts`: orchestrates vision → food-gate → recipe generation → cost estimate → scan result. Fail-closed throughout: never fabricates a result; throws `AI_UNAVAILABLE`, `RECIPE_GENERATION_FAILED`, `IMAGE_NOT_AVAILABLE`, or `FoodRejectionError` on any failure path. Scan-level (24h success / 1h rejection) and recipe-level (7-day) in-memory caches sit in front of provider calls.
- Cost/latency guardrails (`.env.example`): `AI_ENABLED`, `AI_DAILY_REQUEST_CAP=200`, `MAX_SCAN_IMAGE_BYTES=10000000`, `AI_TIMEOUT_MS=45000`, `AI_MAX_OUTPUT_TOKENS=1024`, `SCAN_RATE_LIMIT_WINDOW_MS`/`MAX`.

## Proposed Provider Abstraction

### Config (`aiConfig.ts`)

```typescript
export type AiProviderName = 'openrouter' | 'fable';

export type FableConfig = {
  enabled: boolean;                  // FABLE_ENABLED, default false
  apiKey?: string;                    // FABLE_API_KEY
  visionModel: string;                // FABLE_VISION_MODEL, default 'claude-fable-5'
  textModel: string;                  // FABLE_TEXT_MODEL, default 'claude-fable-5'
  timeoutMs: number;                  // FABLE_TIMEOUT_MS, default 60000
  dailyRequestCap: number;            // FABLE_DAILY_REQUEST_CAP, default 10
  effort: 'low' | 'medium' | 'high';  // FABLE_EFFORT, default 'low'
};

export type AiConfig = {
  enabled: boolean;
  provider: AiProviderName;           // default 'openrouter' — never auto-switches
  openRouterApiKey?: string;
  openRouterVisionModel: string;
  openRouterTextModel: string;
  timeoutMs: number;
  maxOutputTokens: number;
  fable: FableConfig;
};
```

`provider` stays `'openrouter'` unless explicitly set AND `fable.enabled === true`. No implicit fallback from OpenRouter to Fable or vice versa in Phase 1 — a config error should fail closed, not silently switch providers.

### New provider module: `apps/api/src/services/fableProvider.ts` (NEW FILE)

Mirrors `openRouterProvider.ts`'s public shape exactly so `aiService.ts` needs minimal changes:

```typescript
export async function analyzeFoodImageWithFable(input: {
  config: AiConfig;
  image?: ScanImageMetadata;
  mode: RecipeMode;
}): Promise<OpenRouterVisionOutput>;   // reuse existing zod schema/shape

export async function generateRecipeWithFable(input: {
  analysis: FoodImageAnalysis;
  config: AiConfig;
  mode?: RecipeMode;
}): Promise<OpenRouterRecipeOutput>;   // reuse existing zod schema/shape
```

Internally: uses `@anthropic-ai/sdk`, translates `image_url` content → Anthropic `image` content blocks (base64 source), replaces `response_format: json_object` with `output_config.format` (json_schema derived from the existing zod schemas — none are recursive, so this should translate directly), omits OpenRouter-only reasoning-suppression params (Fable 5 always thinks — bounded instead via `output_config.effort`), and does not send `temperature` / `top_p` / `top_k` (rejected by Fable 5).

### Error / refusal / stop_reason mapping

New provider-neutral error type, reusing the shape `openRouterProvider.ts` already has:

```typescript
export type ProviderFailureReason =
  | 'provider_missing_key'
  | 'provider_http_error'
  | 'provider_timeout'
  | 'provider_empty_content'
  | 'provider_output_truncated'
  | 'provider_invalid_json'
  | 'provider_invalid_schema'
  | 'provider_network_error'
  | 'provider_refused'          // NEW — Anthropic stop_reason === "refusal"
  | 'provider_unknown_error';

export class ProviderError extends Error {
  readonly failure: {
    reason: ProviderFailureReason;
    provider: AiProviderName;
    model: string;
    httpStatus?: number;
    providerErrorMessage?: string;
  };
}
```

`fableProvider.ts` catches Anthropic SDK typed exceptions (`AuthenticationError`, `RateLimitError`, `APIConnectionError`, etc.) and the `stop_reason === "refusal"` case, and throws `ProviderError` in all cases. This bubbles into `aiService.ts`'s existing `catch (error) { throw error }` fail-closed path unchanged — no new logic needed in `aiService.ts` beyond the provider branch itself. Never fabricates a recipe or vision result on any Fable failure, exactly matching current OpenRouter behavior.

### `aiService.ts` branch points (2 call sites only)

```typescript
const output = config.provider === 'fable'
  ? await analyzeFoodImageWithFable({ config, image: input.image, mode: input.mode })
  : await analyzeFoodImageWithOpenRouter({ config, image: input.image, mode: input.mode });
```

Same pattern in `generateRecipeFromDish`. Everything downstream (normalize, sanitize, food-gate, cost estimate, caching) stays provider-agnostic and untouched.

## New env vars (`.env.example`)

```
FABLE_ENABLED=false
FABLE_API_KEY=
FABLE_VISION_MODEL=claude-fable-5
FABLE_TEXT_MODEL=claude-fable-5
FABLE_TIMEOUT_MS=60000
FABLE_DAILY_REQUEST_CAP=10
FABLE_EFFORT=low
```

All default to disabled/unset. No existing env var changes. Provider selection stays `openrouter` by default.

## Stricter Fable daily cap

`FABLE_DAILY_REQUEST_CAP` defaults to 10 vs OpenRouter's 200 — separate counter, separate enforcement point, not shared with `AI_DAILY_REQUEST_CAP`. Reason: Fable 5 pricing ($10/$50 per MTok) is roughly 60–80x `gpt-4o-mini`; a shared cap would let Fable traffic silently consume budget headroom sized for a cheap model. Exact enforcement location (likely `server.ts` or a rate-limit middleware) needs confirmation before implementation — not yet located in this pass.

## Timeout behavior

`FABLE_TIMEOUT_MS` defaults to 60000 (vs OpenRouter's 45000). Fable 5 runs always-on thinking and can take multiple minutes on hard tasks per Anthropic's own guidance; 60s is a starting point for a mobile scan context, not a guarantee — should be tuned against real latency data in testing before any wider rollout, and `effort` should stay at `low` (never `high`/`xhigh`/`max`) to keep this bounded.

## Fail-closed behavior (preserved, not changed)

- Never fabricate a recipe or vision result on any AI failure — Fable or OpenRouter.
- Any Fable error (auth, network, timeout, refusal, invalid schema) → `ProviderError` → same throw path as `OpenRouterProviderError` today (`AI_UNAVAILABLE`, `RECIPE_GENERATION_FAILED`, etc.).
- No cross-provider fallback: Fable does NOT fall back to OpenRouter or vice versa in Phase 1. If Fable is explicitly selected and fails, the scan fails closed — it does not silently retry on the cheap model. (Revisit only in a later phase if product wants automatic downgrade behavior; that needs its own explicit design, since silently switching providers mid-scan changes cost/quality characteristics without the user knowing.)

## Files likely affected (implementation phase, not now)

| File | Change |
|---|---|
| `apps/api/.env.example` | add Fable env vars (documented, all default off) |
| `apps/api/src/config/aiConfig.ts` | extend `AiProviderName`, add `FableConfig`, extend `getAiConfig()` |
| `apps/api/src/services/fableProvider.ts` | NEW — Anthropic SDK integration, mirrors `openRouterProvider.ts` shape |
| `apps/api/src/services/aiService.ts` | 2 branch points only (`analyzeFoodImage`, `generateRecipeFromDish`) |
| `apps/api/package.json` | add `@anthropic-ai/sdk` dependency |
| `apps/api/src/server.ts` | inspect for `AI_DAILY_REQUEST_CAP` enforcement location; add parallel Fable cap enforcement |
| `apps/api/src/types.ts` | NOT changed in Phase 1 — `aiSource: 'openrouter_ai'` stays generic for both providers; revisit only if product wants provider surfaced in UI/analytics |

## Rollout plan

1. Land config + `fableProvider.ts` + branch points behind `FABLE_ENABLED=false` default — ships dark, zero behavior change for any existing user.
2. Enable `FABLE_ENABLED=true` in local/dev only, manual testing against real food photos.
3. Shadow-test: run a sample of scans through both providers (dev-only), compare via existing `recipeQualityAnalytics` / `scanEvalLogger` infrastructure — quality score, latency, and estimated cost per scan.
4. If results look good: enable for an internal/staff-only build (still opt-in via config, not a user-facing toggle) with `FABLE_DAILY_REQUEST_CAP` kept low.
5. No path to production default in this phase. Any move to "Fable as default" or a user-facing premium tier is a separate decision requiring explicit product sign-off, cost modeling, and its own design pass.

## Test plan

- Unit: `fableProvider.ts` request/response mapping — vision content blocks, structured output parsing, error/refusal → `ProviderError` mapping, timeout behavior.
- Integration: `aiService.ts` branch points — confirm the `config.provider === 'openrouter'` path is 100% unchanged (regression-test existing scan/recipe flows); confirm the `config.provider === 'fable'` path fails closed correctly (mock refusal, mock timeout, mock auth error) and never returns a fabricated recipe.
- Manual: real food photo scans against Fable 5 in dev, compare dish/recipe quality and latency against the `gpt-4o-mini` baseline.
- Cost: confirm `FABLE_DAILY_REQUEST_CAP` actually blocks requests once hit (not just logged).

## Rollback plan

- `FABLE_ENABLED=false` (or unset) immediately reverts all scan/recipe traffic to OpenRouter — no code revert needed, config-only rollback.
- If `fableProvider.ts` itself needs removal: delete the file plus the 2 branch points in `aiService.ts` plus the config additions. Since the OpenRouter path is never touched by this work, rollback carries zero risk to the default path.
- No data migration, no schema change, no mobile-app-visible contract change in Phase 1 — rollback is safe at any point.

## Risks

- **OpenRouter catalog uncertainty**: not yet confirmed whether OpenRouter itself carries `claude-fable-5`. If it does, a lighter-weight path (route through OpenRouter with an Anthropic-prefixed model ID) may be viable instead of a second SDK integration — worth checking before implementation starts, since it could shrink this whole design.
- **Data retention requirement**: Fable 5 requires org-level 30-day data retention on the Anthropic side; if Okyo's Anthropic org is configured for shorter/zero retention, every Fable request returns `400`. Must confirm before implementation.
- **Cost surprise**: even at a 10/day cap, a misconfigured `dailyRequestCap` or a bug in cap enforcement could produce an unexpectedly large bill given the $10/$50 per MTok pricing. Cap enforcement must be verified functionally, not just configured.
- **Latency mismatch with mobile UX**: Fable 5's always-on thinking conflicts with prior latency work targeting 10–15s scans; even in shadow/opt-in mode, dev testing should measure this explicitly before any wider exposure.
- **Schema translation gaps**: Anthropic's `output_config.format` doesn't support all JSON Schema features (no recursive schemas, no numeric/string length constraints) — need to confirm the existing recipe/vision zod schemas translate cleanly; unsupported constraints may need to move to post-parse validation instead of schema-level constraints.
