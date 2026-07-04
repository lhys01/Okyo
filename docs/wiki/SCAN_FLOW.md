# Scan Flow

## Purpose
Trace the full scan journey from mobile screen to API request to AI response to result UI.

## Source Files Inspected
- `apps/mobile/src/screens/ScanScreen.tsx`
- `apps/mobile/src/screens/AnalysisLoadingScreen.tsx`
- `apps/mobile/src/screens/ResultSummaryScreen.tsx`
- `apps/mobile/src/screens/WelcomeScreen.tsx`
- `apps/mobile/src/api/client.ts`
- `apps/mobile/src/state/useOkyoStore.ts`
- `apps/mobile/src/utils/scanDecision.ts`
- `apps/mobile/src/utils/scanImageStorage.ts`
- `apps/api/src/server.ts`
- `apps/api/src/services/aiService.ts`
- `apps/api/src/services/openRouterProvider.ts`

## Current Behavior
User flow:
1. User takes a photo or uploads from Photos in onboarding or `ScanScreen`.
2. Mobile resizes/compresses the image, tries to create a JPEG data URL under 12 MB, and copies a preview image to app Documents.
3. Mobile creates a scan session in Zustand with pending state and navigates to loading.
4. `createMockScan` posts to `/v1/scans` with source, mode, and image metadata. Despite the name, this can hit real AI.
5. API validates the request, checks size/rate/global/Fable caps, and calls `createAiScan`.
6. AI vision analyzes the image. Non-food or too-unclear real images throw `FoodRejectionError` and return a friendly 422.
7. Recipe generation creates one canonical inspired-by recipe, grocery list, share card, confidence, model metadata, and estimated savings.
8. Mobile writes success or failure into the active scan session.
9. Loading navigates to `ResultSummaryScreen`, which shows success, pending, recipe issue, or scan issue states.

## Important Constraints
- A real uploaded image must never silently show unrelated mock data on provider failure.
- The result screen must support uncertain/best-guess states and editable dish naming.
- Do not log raw full base64 payloads.
- Keep scan UX fast and clear; loading has a 90-second safety fallback.

## Known Risks or Edge Cases
- Local/private file URIs are not provider-visible unless converted to data URL.
- Large images can exceed mobile/API size limits even after compression.
- Stale scan sessions are ignored to avoid late responses overwriting newer scans.
- API client naming still says `createMockScan`, which can confuse contributors.

## Related Docs
- [MOBILE_APP.md](./MOBILE_APP.md)
- [API_BACKEND.md](./API_BACKEND.md)
- [AI_MODEL_ROUTING.md](./AI_MODEL_ROUTING.md)
- [IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md)
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md)
