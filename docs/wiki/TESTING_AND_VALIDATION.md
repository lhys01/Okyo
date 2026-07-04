# Testing and Validation

## Purpose
List validation commands and manual smoke tests for API, mobile, default scan behavior, and Fable routing.

## Source Files Inspected
- `apps/api/package.json`
- `apps/mobile/package.json`
- `apps/api/src/server.ts`
- `apps/api/src/config/aiConfig.ts`
- `apps/api/src/middleware/costControls.ts`
- `apps/mobile/src/api/client.ts`
- `apps/mobile/src/api/config.ts`
- `apps/mobile/src/screens/ScanScreen.tsx`
- `apps/mobile/src/screens/ResultSummaryScreen.tsx`

## Current Behavior
Automated typechecks:
```bash
cd apps/api
npm run typecheck
```

```bash
cd apps/mobile
npx tsc --noEmit
```

Health check:
```bash
curl http://localhost:8081/health
```

Normal scan smoke:
- Start API and mobile.
- Upload a clear food photo.
- Confirm loading advances to result.
- Confirm result has dish name, confidence, homemade estimate, recipe, grocery action, save/share actions.
- Upload unclear or non-food image and confirm friendly failure with no unrelated mock recipe.

Fable disabled header test, expects 403:
```bash
curl -i -X POST http://localhost:8081/v1/scans \
  -H 'Content-Type: application/json' \
  -H 'x-okyo-model: fable' \
  -d '{"source":"photos","mode":"Restaurant Copy","image":{"placeholder":false,"dataUrl":"data:image/jpeg;base64,AAAA","mimeType":"image/jpeg"}}'
```

Fable enabled route:
- Set `FABLE_ENABLED=true`, `AI_ENABLED=true`, `OPENROUTER_API_KEY`, and a reachable scan image.
- Send `x-okyo-model: fable`.
- Confirm model metadata/logs show `FABLE_MODEL`.

Fable cap test, expects 429 after cap:
- Set `FABLE_DAILY_REQUEST_CAP=1`.
- Send two Fable requests.
- Confirm the second returns `fable_daily_cap_exceeded`.

Failure behavior:
- Break Fable model/key after enabling Fable.
- Confirm no Gemini/default fallback result appears.
- Confirm production mobile does not send the Fable header.

## Important Constraints
- Do not run tests with real provider keys unless expected.
- Avoid checking raw base64 or secrets into logs/docs.
- Fable validation requires a provider-visible real image to fully exercise model routing.

## Known Risks or Edge Cases
- The tiny `AAAA` data URL is useful for route gate tests, not real model success.
- Dependencies are absent in this workspace until install.
- In-memory caps reset on API restart.

## Related Docs
- [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)
- [FABLE_ROUTING.md](./FABLE_ROUTING.md)
- [SCAN_FLOW.md](./SCAN_FLOW.md)
- [COST_CONTROLS.md](./COST_CONTROLS.md)
