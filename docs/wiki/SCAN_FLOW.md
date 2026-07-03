# Scan Flow (End To End)

## Purpose
Traces one scan from mobile tap to result UI.

## Source Files Inspected
`apps/mobile/src/screens/ScanScreen.tsx`, `apps/mobile/src/screens/WelcomeScreen.tsx` (onboarding scan), `apps/mobile/src/utils/scanImageStorage.ts`, `apps/mobile/src/api/client.ts`, `apps/api/src/server.ts:96-161`, `apps/api/src/services/aiService.ts:498-660`, `apps/mobile/src/screens/AnalysisLoadingScreen.tsx`, `apps/mobile/src/screens/ResultSummaryScreen.tsx`, `apps/mobile/src/utils/scanDecision.ts`.

## Current Behavior

**Mobile (request side)**
1. User takes a photo or picks from Photos (expo-image-picker) on ScanScreen or the onboarding scan step.
2. Image is resized with expo-image-manipulator (max width 1400 px) and converted to a base64 data URL (≤12 MB).
3. `copyToDocuments()` copies the file to `Documents/okyo-scan-images/` so the URI survives cold restarts; `recipe.imageUri` derived from this is canonical.
4. Store starts a scan session (`beginLatestScanSession`), then `createMockScan()` POSTs `{ source, mode, image }` to `/v1/scans` (60 s timeout; dev-only Fable header per [FABLE_ROUTING.md](./FABLE_ROUTING.md)).

**API (`POST /v1/scans`)**
5. Per-IP rate limit → zod validation (jpeg/png/webp base64 data URL) → image-size guard (413) → global daily AI cap (429) → Fable gates (403/429).
6. `createAiScan()`:
   - Guards: real uploaded image requires usable AI config (`AI_UNAVAILABLE`) and a provider-visible image (`IMAGE_NOT_AVAILABLE`).
   - **Scan cache:** same dataUrl+mode returns cached result (24 h success TTL, 1 h rejection TTL).
   - **Vision:** `analyzeFoodImage()` returns dish name, scanState, confidence, ingredients, price estimates.
   - **Food gate:** non-food/unclear images throw `FoodRejectionError` → HTTP 422 with `rejectionType` (`no_food_detected` | `unclear_food`), `scanState`, `confidence`.
   - **Recipe:** `generateRecipeFromDish()` ([RECIPE_GENERATION.md](./RECIPE_GENERATION.md)). Fail-closed: any failure on a real image throws — no partial scans, no mock substitution.
   - Cost estimate, scan/grocery/share-card IDs assembled; timing logged as `[scan_timing]`.
7. Response 201: scan + recipe + grocery list; echoed image metadata has the data URL stripped (`hasDataUrl` flag).

**Mobile (result side)**
8. `writeLatestScanSession` stores result/failure; AnalysisLoadingScreen shows progress; `scanDecision.ts` helpers (`isUsableScan`, `shouldRejectScan`, `hasFoodEvidence`) decide the UI state.
9. ResultSummaryScreen renders dish, confidence, restaurant vs homemade cost, savings, and mode tabs; failures render friendly unclear/not-food states — never the mock pasta result for a real image.

## Important Constraints
- Fail-closed everywhere for real uploads: rejection > fake success.
- User images are not stored by the API; only the device keeps a permanent copy.
- 422 rejections are expected product states, not errors to "fix".

## Known Risks / Edge Cases
- Scan latency is dominated by model speed (see memory/audits): slow free-tier models push total time past 30 s.
- Cache means edits to prompts need a new image (or pipeline-version bump) to observe.
- Simulator camera is unreliable — use Upload From Photos for QA.

## Related Docs
[RECIPE_GENERATION.md](./RECIPE_GENERATION.md) · [AI_MODEL_ROUTING.md](./AI_MODEL_ROUTING.md) · [IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md) · [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md)
