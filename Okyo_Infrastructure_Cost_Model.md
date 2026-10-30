# Okyo Infrastructure Cost Model

**Status:** Read-only audit. No code, infrastructure, provider account, environment variable, database, or git state was changed.
**Scope:** locked architecture from [`Okyo_Scalable_Data_Architecture_Plan.md`](Okyo_Scalable_Data_Architecture_Plan.md) — Neon Postgres + Cloudflare R2 + Railway API. Pricing checked live on **2026-08-18**; all links below.

---

## 0. What the code actually configures today (source of every number below)

| Fact | Value | Source |
|---|---|---|
| AI provider | OpenRouter only | `apps/api/src/config/aiConfig.ts:18` |
| Default vision model | `openai/gpt-4o-mini` | `aiConfig.ts:12` |
| Default text/recipe model | `openai/gpt-4o-mini` | `aiConfig.ts:13` |
| Default Epicure enrichment model | `openai/gpt-4o-mini` | `apps/api/src/config/openRouter.ts:15` |
| Optional "Fable 5" model | `anthropic/claude-fable-5`, opt-in header only, hard-capped **≤10 requests/day** regardless of env | `aiConfig.ts:14`, `apps/api/src/config/costControlConfig.ts:1-3,29-32` |
| Vision call output cap | `min(maxOutputTokens, 900)` → 900 tokens (default `AI_MAX_OUTPUT_TOKENS`=1024) | `openRouterProvider.ts:1003` |
| Recipe generation output cap | `maxOutputTokens` default 1024 (up to 2048 for edits, 2400 for component repair) | `openRouterProvider.ts:1289,1485,4279` |
| Epicure output cap | 512 tokens | `epicureService.ts:34` |
| Vision retry | **One** extra vision call only if first output is ambiguous (quality retry, not resilience retry) | `openRouterProvider.ts:879-939` |
| Scan-level cache | 24h TTL (success), 1h TTL (rejection), key = sha1(image)+mode+pipeline-version, **in-memory, per-process** | `aiService.ts:80-88` |
| Recipe-level cache | 7-day TTL (`RECIPE_CACHE_TTL_DAYS`, default 7), key = dish+ingredients+mode | `openRouterProvider.ts:1124-1128` |
| Max image payload | 12,000,000 base64 chars (~9MB raw), body limit 16MB | `server.ts:57-58` |
| Epicure enabled by default? | **No** — gated by `EPICURE_ENABLED` env flag, not confirmed set in any environment this audit can read | `openRouter.ts:28` |
| Railway config in repo | **None found** — no `railway.json`/`railway.toml`/`Procfile`/`nixpacks.toml` anywhere in the tree | repo-wide search |
| Other paid runtime dependencies | **None** — `apps/api/package.json` deps are only `cors`, `dotenv`, `express`, `zod`; no Sentry/Datadog/Redis/queue client in either app's `package.json` | `apps/api/package.json`, `apps/mobile/package.json` |

**Model routing note:** there is exactly one production model configured today — `openai/gpt-4o-mini` — used for vision, recipe generation, and Epicure. Fable 5 is opt-in, header-gated, and capped at 10 req/day globally, so it contributes a bounded, near-zero fraction of total spend at any scale (modeled separately in §9, not folded into the main tables). No other model is a "configured production candidate" per the code — this audit does not model gpt-4o, claude, or gemini pricing because nothing in the repo selects them by default.

---

## 1. Pricing sources (checked 2026-08-18)

| Provider | Page | Key figures used |
|---|---|---|
| Railway | [railway.com/pricing](https://railway.com/pricing) | Memory: $0.00000386/GB-s (≈$10.00/GB-month continuous); CPU: $0.00000772/vCPU-s (≈$20.01/vCPU-month continuous); Volumes: $0.00000006/GB-s (≈$0.156/GB-month); Egress: $0.05/GB; Hobby $5/mo incl. $5 credit, Pro $20/mo incl. $20 credit |
| Neon | [neon.com/pricing](https://neon.com/pricing) | Launch: $0.106/CU-hour compute, autosuspend after 5 min (configurable); Scale: $0.222/CU-hour, autosuspend 1min–always-on; Storage: $0.35/GB-month (Launch/Scale, 0.5GB free on Free plan); Instant restore/PITR add-on: $0.20/GB-month (root branches); extra branches $1.50/branch-month; connection pooling included on all plans |
| Cloudflare R2 | [developers.cloudflare.com/r2/pricing](https://developers.cloudflare.com/r2/pricing/) | Storage: $0.015/GB-month (Standard); Class A ops (writes/lists): $4.50/million; Class B ops (reads): $0.36/million; **Egress: free**; Free tier: 10GB storage + 1M Class A + 10M Class B ops/month |
| OpenRouter | [openrouter.ai/openai/gpt-4o-mini](https://openrouter.ai/openai/gpt-4o-mini) | Input: $0.15/M tokens; Output: $0.60/M tokens; Cached input: $0.075/M tokens |
| OpenAI (image tokenization formula, applies to gpt-4o-mini via OpenRouter) | [developers.openai.com/api/docs/guides/images-vision](https://developers.openai.com/api/docs/guides/images-vision) | gpt-4o-mini image cost: 2,833 base tokens + 5,667 tokens per 512×512 tile, after scaling to fit 2048×2048 then shortest side to 768px |

---

## 2. AI cost per call — derived, not invented

**Image tokenization (the dominant AI cost driver):** OpenAI's own scaling algorithm (fit to 2048×2048, then shortest side to 768px) bounds the *effective* resolution regardless of the raw upload size — so Okyo's current lack of client-side compression (no resize/compress step exists anywhere in `apps/mobile/src`, confirmed by the architecture audit) does not blow up image-token cost; it's capped by OpenAI's downscaling before tiling.

- **Assumption (labeled):** typical mobile food photo is roughly 3:4 or 4:3 aspect ratio. After OpenAI's scaling, a portrait photo lands near 768×1024, giving a 2×2 tile grid (4 tiles).
- Tokens = 2,833 + (4 × 5,667) = **25,501 image tokens** per vision call.
- **Sensitivity:** an unusually elongated/panoramic photo could hit 6 tiles (2,833 + 6×5,667 = 36,835 tokens, +44%). A near-square close-up crop could land at 4 tiles minimum (the floor). Use 25,501 as expected, ±20% as the range.

| Call | Input tokens (assumption labeled) | Output tokens (code-capped) | Input $ | Output $ | Call cost |
|---|---|---|---|---|---|
| Vision analysis (`analyzeFoodImageWithOpenRouter`) | 25,501 image + ~400 prompt text = **~25,900** | capped 900, assume avg used **~400** (dish JSON is short) | $0.00389 | $0.00024 | **$0.00413** |
| Recipe generation (`generateRecipeWithOpenRouter`) | **assumption: ~1,800** (prompt assembled from `recipeSignatureProfiles`/`flavorPlan`/`dishAnatomy`/`recipeTime`/`recipeModes` text builders — exact length not derivable without running the pipeline) | capped 1024, assume avg used **~700** (ingredients+steps JSON) | $0.00027 | $0.00042 | **$0.00069** |
| Epicure enrichment (optional, `EPICURE_ENABLED`) | assumption: ~600 | capped 512, assume avg ~300 | $0.00009 | $0.00018 | **$0.00027** |
| Correction/coaching/ask (`generateRecipeEditWithOpenRouter` etc.) | assumption: ~1,500 | capped up to 2048–2400, assume avg used ~800 | $0.00023 | $0.00048 | **$0.00071** |

**Everything in the "assumption" column is explicitly not measurable from the repo** — the actual prompt text is assembled at runtime from several text-builder modules and depends on dish complexity, user dietary preferences, and mode. Treat these as the single largest source of estimate error; §11 lists this as unknown #1.

### Per-successful-scan cost, three scenarios

| Scenario | Formula | Cost/scan |
|---|---|---|
| **Low** (no retry, Epicure off, no correction) | vision + recipe | $0.00413 + $0.00069 = **$0.0048** |
| **Expected** (assumption: 15% of scans trigger the one quality-retry vision call; Epicure off by default per code; assumption: 20% of scans get one correction call) | vision + recipe + 0.15×vision + 0.20×correction | $0.0048 + $0.00062 + $0.00014 = **$0.0056** |
| **High** (assumption: 30% retry rate; Epicure ON for all scans; assumption: 50% correction rate) | vision + recipe + 0.30×vision + epicure + 0.50×correction | $0.0048 + $0.00124 + $0.00027 + $0.00035 = **$0.0067** |

**Cost per successful scan: $0.0048 (low) / $0.0056 (expected) / $0.0067 (high).** These retry/correction/Epicure rates are **assumptions, not measurements** — see §11 and §12 (instrumentation plan) for how to replace them with real numbers.

**Failed/rejected scans still cost the vision call** (non-food or ambiguous images are cached for only 1h, still consumed one full vision call before rejection) — model a **10% failed-submission rate (assumption)** adding `0.10 × $0.00413 = $0.0004` per *submitted* scan on top of the successful-scan figures above when computing total monthly spend (§4 formulas do this).

**Cache credit not applied (conservative/worst-case default):** the 24h scan cache and 7-day recipe cache could reduce this materially if many users scan the same popular dish or re-scan the same photo, but hit rate is unmeasured. All tables below assume **0% cache hit rate** (worst case, matches "do not invent traffic patterns"). §10 shows the caching upside as a separate lever.

---

## 3. Railway compute cost (formula-based, not MAU-linear)

Railway bills allocated container resources for however long the container runs (per-second metering), not per-request — so compute cost tracks **instance size and uptime**, which the team scales to handle peak concurrency, not MAU directly.

- CPU: $0.00000772/vCPU-s × 2,592,000 s/month (30d continuous) = **$20.01/vCPU-month**
- Memory: $0.00000386/GB-s × 2,592,000 s = **$10.00/GB-month**
- Volumes: not required in the locked architecture (all durable state moves to Neon + R2; Railway container is stateless) → **$0/month**
- Egress: images bypass the API entirely (direct-to-R2 presigned upload per the architecture plan, §7) — API responses are JSON-only. Assumption: ~20KB egress per scan-flow (4 small JSON responses). At 500,000 scans/month (High tier, 5 scans/user) that's 10GB → $0.50/month. **Immaterial at every tier — folded into "misc" below, not broken out per-tier.**

| MAU tier | Assumed instance sizing (labeled assumption — concurrency-driven, not a direct MAU formula) | Monthly compute |
|---|---|---|
| 1,000 | 1× (0.5 vCPU / 0.5 GB) | 0.5×$20.01 + 0.5×$10.00 = **$15/mo** |
| 10,000 | 1× (1 vCPU / 1 GB) | $20.01 + $10.00 = **$30/mo** |
| 50,000 | 2× (1 vCPU / 1 GB) for headroom + zero-downtime deploys | **$60/mo** |
| 100,000 | 3× (1 vCPU / 1 GB) | **$90/mo** |

This is a **sizing assumption**, not derived from a load test (none exists) — the API is I/O-bound (mostly waiting on OpenRouter), so actual CPU needs could be smaller; verify with real p95 latency/CPU metrics post-launch (§12).

---

## 4. Neon Postgres cost

- Compute: **$0.106/CU-hour** (Launch plan — sufficient at every modeled tier; Scale plan's $0.222/CU-hour and 30-day PITR only needed if compliance requires longer backup retention, see open question).
- Autosuspend after 5 min idle by default — actual billed compute-hours are **far below 730/month** except at high, near-continuous traffic.
- Storage: **$0.35/GB-month** on total data held (not monthly growth — growth accumulates).

| MAU tier | Assumption: DB "awake" fraction of the month (traffic-driven, not measured) | Assumed avg CU while awake | Compute cost | Cumulative storage after 12 months (from Architecture Plan §3 growth rates × 12) | Storage cost |
|---|---|---|---|---|---|
| 1,000 | 10% (730×0.10=73 CU-hrs) | 1 CU (min) | 73×$0.106=**$7.74/mo** | ~0.5 GB (within free 0.5GB) | **$0/mo** |
| 10,000 | 40% (292 CU-hrs) | 1 CU | 292×$0.106=**$30.95/mo** | ~24 GB | 24×$0.35=**$8.40/mo** |
| 50,000 | 75% (548 CU-hrs) | 2 CU | 1,096×$0.106=**$116.18/mo** | ~120 GB | 120×$0.35=**$42.00/mo** |
| 100,000 | 95% (694 CU-hrs) | 3 CU | 2,081×$0.106=**$220.55/mo** | ~240 GB | 240×$0.35=**$84.00/mo** |

PITR/instant-restore add-on ($0.20/GB-month) **not included by default** in these figures — it's an opt-in line item; enabling it at the High tier adds up to $48/mo (240GB×$0.20). Connection pooling is bundled free at every tier (no separate cost).

**These awake-fraction and CU-size assumptions are the second-largest source of estimate error** (§11 unknown #2) — Neon exposes real compute-hour usage in its dashboard from day one of any deployment, so this should be the fastest unknown to resolve post-launch.

---

## 5. Cloudflare R2 cost

Per the locked architecture (§7 of the Architecture Plan), only **saved-recipe images** persist in R2 — unsaved scans are never uploaded to durable storage in the target design, though *presigned-upload attempts* still count as Class A operations regardless of save outcome.

- Storage: $0.015/GB-month on cumulative bytes held.
- Class A ops (uploads + deletes): $4.50/million — but **free tier includes 1,000,000 Class A ops/month**.
- Class B ops (reads, e.g. displaying library images): $0.36/million — **free tier includes 10,000,000/month**.
- Egress: **always free**, at any volume — this is why R2 was locked in over S3.

| MAU tier | Scans/mo (5/user assumption) | Class A ops (≈1 per scan attempt) | Class B ops (assumption: 5 library-image views per saved recipe/mo) | Cumulative storage after 12mo (25% save rate × 300KB, Architecture Plan §3 growth ×12) | Storage cost | Ops cost |
|---|---|---|---|---|---|---|
| 1,000 | 5,000 | 5,000 | ~5,000 | ~1.4 GB | $0.02/mo | **$0** (well under free tier) |
| 10,000 | 50,000 | 50,000 | ~100,000 | ~72 GB | $1.08/mo | **$0** |
| 50,000 | 250,000 | 250,000 | ~625,000 | ~360 GB | $5.40/mo | **$0** |
| 100,000 | 500,000 | 500,000 | ~1,250,000 | ~720 GB | $10.80/mo | **$0** (1.25M Class B ops is within the 10M free allowance; Class A 500K is within the 1M free allowance) |

**R2 cost is trivial at every modeled tier** — under $11/month even at 100,000 MAU. Operations stay inside the free tier through the entire modeled range; only storage becomes a real (still small) line item.

---

## 6. Observability, background jobs, auth, email — currently $0, itemized for when they're added

None of these exist in the repo today (confirmed: no Sentry/Datadog dependency, no queue library, no auth library, no email/transactional-mail SDK in either `package.json`). These are **not current costs** — they're flagged because the architecture plan's Phase 1/2 will need some of them.

| Service | Current state | Illustrative future cost (requires verification — not sourced live, marked speculative) |
|---|---|---|
| Error tracking (e.g. Sentry) | Not integrated | Free tier likely covers Low/Medium tiers; ~$26+/mo team plan at High tier event volume |
| Background jobs | Design uses Postgres-backed `ai_jobs` table (Architecture Plan §5.11), polled by a worker — **no separate service, folds into Neon/Railway compute above** | $0 additional |
| Auth | Not built; identity layer to be built against Neon directly per locked decision (Supabase auth explicitly ruled out) | $0 (self-hosted against existing DB) |
| Transactional email (account deletion confirmation, etc.) | Not integrated | Free tier (e.g. Resend 3,000 emails/mo free) likely covers every modeled tier given account-deletion volume is a small fraction of MAU |

---

## 7. One-time migration/setup costs

**None from vendors.** The Architecture Plan (§12, Phase 1) confirmed this is a **greenfield schema creation** — `apps/api/src/store.ts` holds zero production data (the API's own `/health` endpoint hardcodes `databaseEnabled: false`), so there is no data-migration cost, no downtime-migration cost, and no vendor setup fee (Neon, R2, and Railway all have $0 account-creation cost). The only one-time cost is engineering time to build the Phase 1 persistence layer, which is out of scope for a dollar estimate here.

---

## 8. Cost per successful scan and cost per active user

Using the **Expected** AI-cost-per-scan scenario ($0.0056) plus amortized infra (Railway + Neon + R2 monthly bill ÷ monthly scan count), at 5 scans/user/month:

| MAU tier | Monthly scans | AI cost (expected) | Infra (Railway+Neon+R2, expected) | Total monthly cost | **Cost per successful scan** | **Cost per MAU** |
|---|---|---|---|---|---|---|
| 1,000 | 5,000 | $28 | $15+$7.74+$0.02=$22.76 | $50.76 | **$0.0102** | **$0.051** |
| 10,000 | 50,000 | $280 | $30+$30.95+$1.08=$62.03 | $342.03 | **$0.0068** | **$0.034** |
| 50,000 | 250,000 | $1,400 | $60+$116.18+$5.40=$181.58 | $1,581.58 | **$0.0063** | **$0.032** |
| 100,000 | 500,000 | $2,800 | $90+$220.55+$10.80=$321.35 | $3,121.35 | **$0.0062** | **$0.031** |

Cost per scan **decreases** with scale (infra amortizes over more scans) and converges toward the pure AI-cost floor (~$0.0056/scan) — infrastructure becomes a shrinking fraction of total cost as MAU grows, confirming §9 of the Architecture Plan's conclusion that AI inference dominates at scale.

---

## 9. Sensitivity tables — cost by MAU tier × scans/user/month

Monthly **AI cost only** (expected scenario, $0.0056/scan), to isolate the single biggest lever:

| MAU | 0.5 scans/user | 1 scan/user | 2 scans/user | 5 scans/user |
|---|---|---|---|---|
| 1,000 | $2.80 | $5.60 | $11.20 | $28.00 |
| 10,000 | $28.00 | $56.00 | $112.00 | $280.00 |
| 50,000 | $140.00 | $280.00 | $560.00 | $1,400.00 |
| 100,000 | $280.00 | $560.00 | $1,120.00 | $2,800.00 |

Monthly **total cost** (AI + Railway + Neon + R2, expected scenario — infra sizing assumptions from §3-§5 held constant per MAU tier regardless of scan rate, since instance sizing is concurrency-driven, not scan-count-driven; storage figures use the 5-scans/user growth assumption throughout for consistency, so treat the 0.5/1/2 scans columns' storage line as a slight overstatement):

| MAU | 0.5 scans/user | 1 scan/user | 2 scans/user | 5 scans/user |
|---|---|---|---|---|
| 1,000 | $25.56 | $28.36 | $33.96 | $50.76 |
| 10,000 | $90.03 | $118.03 | $174.03 | $342.03 |
| 50,000 | $321.58 | $461.58 | $741.58 | $1,581.58 |
| 100,000 | $601.35 | $881.35 | $1,441.35 | $3,121.35 |

**Fable 5 spillover (bounded, separate line item):** hard-capped at 10 requests/day globally regardless of MAU (`costControlConfig.ts`). At Fable's estimated 60-80× gpt-4o-mini pricing (per the code comment at `costControlConfig.ts:1-2` — not independently verified against a live Anthropic/OpenRouter Fable-5 pricing page since Fable 5 is not a real found OpenRouter model in this pass; flagged as **unverified**), worst case ≈ 10/day × 30 × ($0.0056 × 70) ≈ **$118/month maximum, at every MAU tier**, independent of scale. Not included in tables above; add as a flat worst-case line if Fable is enabled in production.

---

## 10. Recommendations, ranked by savings impact

1. **Cache-hit rate is the single largest unexploited lever.** The 7-day recipe cache and 24h scan cache already exist in code but run at an unmeasured (assumed 0% for these tables) hit rate. If even 20% of scans hit the recipe cache (plausible — many users will scan popular dishes), that's a ~$0.0001-0.0003/scan savings at the recipe-generation step alone, and cache hits skip the AI call entirely when the scan-level cache hits (up to $0.0041/scan saved on a full hit). **Action:** move both caches into Postgres (Architecture Plan §5.10/§5.11 already plans this) so hits survive restarts and are shared across instances — today's per-process in-memory caches lose their value on every deploy and don't share hits across Railway replicas.
2. **Image compression before upload is unlikely to reduce AI cost** (OpenAI's own downscaling already bounds image tokens regardless of raw size, per §2) but **does reduce Railway/mobile bandwidth and R2 storage** — implement the Architecture Plan's §7 recommendation (max 1600px, JPEG q80) primarily for upload latency and storage cost, not AI cost.
3. **Server-side quotas turn an unbounded AI bill into a bounded one.** Today's free-tier scan limit (3/week) is enforced client-side only (trivially bypassed) — making it server-authoritative (Architecture Plan §8) is the highest-leverage abuse-prevention change available, since AI cost is the dominant spend category at every scale.
4. **Idempotency (already designed in Architecture Plan §5.10, §8) directly caps AI cost from retried requests** — mobile network retries on a slow/flaky connection currently risk re-triggering a full AI call chain; durable idempotency keys eliminate this without any model/prompt change.
5. **Model routing:** no alternate production model is configured today, so there's no "cheaper model" lever to pull without a product-quality tradeoff decision. If cost pressure emerges at scale, the next cheapest OpenRouter vision-capable model would need to be evaluated against Okyo's confidence/accuracy bar — out of scope here since it's a product decision, not an infra one.
6. **Neon autosuspend is already the cheapest default** (§4) — the only lever is *not* disabling it prematurely; disabling autosuspend at low/medium MAU (to avoid cold-start latency) would roughly **10× the compute bill** at the 1,000-MAU tier ($7.74/mo → ~$77/mo). Keep autosuspend on until real traffic data justifies always-on (§12).
7. **Spending caps and alerts:** the code already has a global daily AI request cap (`AI_DAILY_REQUEST_CAP`, default 200 — almost certainly too low for even the 1,000-MAU tier's ~165 scans/day average, and this cap is a **hard request-count limit, not a dollar cap**) — recommend adding a dollar-denominated daily spend alert (via OpenRouter's own usage dashboard/webhooks, not built today) as a second, independent guardrail alongside the existing request-count cap, since request count alone doesn't protect against an image-size or retry-rate spike.
8. **Redis/queue/replicas are not justified at any modeled tier** (matches Architecture Plan §4.1's conclusion) — the R2 free-tier ops allowance alone (1M Class A/mo) absorbs 100,000 MAU at 5 scans/user without a queue; introduce a queue only if the Postgres-backed `ai_jobs` table (already the Phase 2 plan) shows measured worker lag under real load, not preemptively.

---

## 11. Likely monthly bill (expected scenario, 5 scans/user/month)

| MAU tier | AI | Railway | Neon | R2 | **Total** |
|---|---|---|---|---|---|
| 1,000 | $28 | $15 | $8 | $0.02 | **~$51/mo** |
| 10,000 | $280 | $30 | $31 | $1 | **~$342/mo** |
| 50,000 | $1,400 | $60 | $116 | $5 | **~$1,582/mo** |
| 100,000 | $2,800 | $90 | $221 | $11 | **~$3,122/mo** |

## Worst-case cost exposure

Using the **High** AI-cost scenario ($0.0067/scan), max reasonable instance sizing, Neon Scale-plan rate, PITR enabled, and Fable spillover at its cap:

| MAU tier | AI (high) | Railway (2x sizing) | Neon (Scale rate, PITR on) | R2 | Fable (capped) | **Worst-case total** |
|---|---|---|---|---|---|---|
| 1,000 | $33.50 | $30 | ~$25 | $0.05 | $118 | **~$207/mo** |
| 10,000 | $335 | $60 | ~$95 | $2 | $118 | **~$610/mo** |
| 50,000 | $1,675 | $120 | ~$350 | $8 | $118 | **~$2,271/mo** |
| 100,000 | $3,350 | $180 | ~$650 | $17 | $118 | **~$4,315/mo** |

Worst-case is dominated by the same lever as the expected case (AI cost) plus the flat, MAU-independent Fable ceiling — confirming that **AI spend controls (quotas, caching, retry limits) are the highest-leverage cost guardrail at every scale**, not infrastructure tier selection.

---

## 12. Top five unknowns to answer before this estimate can be trusted

1. **Actual recipe-generation and correction/coaching prompt token counts.** The prompt is assembled at runtime from several text-builder modules (`recipeSignatureProfiles.ts`, `flavorPlan.ts`, `dishAnatomy.ts`, `recipeTime.ts`, `recipeModes.ts`) — this audit estimated ~1,800 input tokens without running the pipeline. This is the single largest source of error in §2's per-call costs.
2. **Real vision-retry rate.** The 15%/30% (expected/high) retry-trigger assumption is a guess — `isRetryableVisionOutputError` fires on ambiguous dish detection, and its real-world frequency depends entirely on photo quality/dish variety in actual usage, which doesn't exist yet.
3. **Real correction/coaching/ask call rate per scan.** The 20%/50% assumption for how often a user asks for a correction or coaching after seeing a recipe is unmeasured — this is a product-usage number, not derivable from code.
4. **Neon "awake fraction" under real traffic patterns.** §4's 10-95% awake-fraction assumptions by tier directly drive compute cost and are the largest infra-cost uncertainty; Neon's own dashboard will report this from day one of any real deployment.
5. **Cache hit rate for the scan-level and recipe-level caches.** Currently modeled at 0% (conservative) — real hit rate depends on how often users scan the same dish or a dish someone else already scanned, unknowable without production traffic.

---

## 13. 30-day instrumentation plan to replace these assumptions with real numbers

1. **Day 0 (before any real traffic):** confirm `EPICURE_ENABLED` and `AI_DAILY_REQUEST_CAP`/`FABLE_ENABLED` actual production values (this audit could not read live env values by design) — this alone resolves whether §2's "Epicure off" or "Epicure on" column applies.
2. **Days 1-30:** log, per scan request (server-side, already close to the existing `scanEvalLogger.ts`/`recipeQualityAnalytics.ts` telemetry pattern — extend rather than rebuild): (a) actual prompt token count sent to OpenRouter for vision, recipe, and correction calls (OpenRouter's response includes `usage.prompt_tokens`/`usage.completion_tokens` — already available, just not currently logged to a durable store), (b) whether the vision-retry path fired, (c) cache hit/miss for both scan-level and recipe-level caches, (d) whether a correction/coaching/ask call followed within the same session.
3. **Days 1-30, infra side:** pull Neon's dashboard compute-hour and storage metrics daily (no code change needed — this is a provider-side report) to replace the awake-fraction assumption in §4 with real numbers within the first week of any beta traffic.
4. **Day 30:** recompute §2's per-call cost table using actual `usage.prompt_tokens`/`usage.completion_tokens` averages instead of the labeled assumptions, recompute §4's Neon awake-fraction from the dashboard export, and recompute cache hit rate from the logged hit/miss counters — republish this document with "measured" replacing "assumption" in every row that's now backed by data.
5. **Ongoing:** set a daily OpenRouter spend alert (via OpenRouter's usage dashboard, not built today) at a threshold below the "worst-case" daily figure implied by §11's table, so a runaway retry loop or Fable misconfiguration surfaces as a dollar alert, not just a request-count cap.

---

## Confirmation

No application code, infrastructure, provider dashboard/account, database resource, environment file, or git state was created, modified, deployed, provisioned, or reset while producing this document. The only filesystem change made is the creation of this single new file, `Okyo_Infrastructure_Cost_Model.md`, at the repository root.
