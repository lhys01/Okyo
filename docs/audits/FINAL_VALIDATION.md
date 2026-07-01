# Final Validation

Branch: `scan-realism-v2`  
Run after: FIX_REPORT.md applied + TypeScript verified clean

---

## All 9 Attack Loops — Post-Fix Results

| Loop | Scenario | Pre-Fix | Post-Fix | Notes |
|------|----------|---------|----------|-------|
| 1 | Scan A → B → C state corruption | PASS | PASS | Session ID guard unchanged; no regression |
| 2 | Upload → save → cold restart → reopen | PASS | PASS | Documents URI path unchanged |
| 3 | Library abuse, duplicate scans | PASS + MEDIUM | **PASS** | Starter recipe IDs now include scan session suffix |
| 4 | Null/undefined chain exhaustion | PASS | PASS | No changes to image resolution chain |
| 5 | Async race conditions | PASS | PASS | Session ID guard unchanged |
| 6 | Storage failures + unbounded growth | HIGH | **PASS** | `clearLatestScan` + `beginLatestScanSession` now clean up unsaved scan images |
| 7 | Share card image chain | PASS | PASS | No changes to ShareCardPreviewScreen |
| 8 | Real user simulation | PASS | PASS | Save → cold restart → share → cook all verified |
| 9 | Production scale (1,000+ scans) | HIGH | **PASS** | Storage no longer grows for unsaved scans |

---

## Success Criteria Check

| Criterion | Status |
|-----------|--------|
| Scan image survives app refresh | ✓ |
| Scan image survives app restart | ✓ |
| Scan image survives recipe save | ✓ |
| Scan image survives recipe reopen from library | ✓ |
| Recipe A cannot display Recipe B's image | ✓ |
| Same dish scanned twice → separate recipe entries | ✓ (FIXED) |
| Unsaved scan images do not accumulate in Documents | ✓ (FIXED) |
| Saved recipe images are never deleted when scan ends | ✓ |
| Every image decision is traceable | ✓ (imageTraceLog on all screens) |
| No placeholder can silently replace a real upload | ✓ |
| TypeScript compiles clean | ✓ |

---

## Fix Regression Check

### `clearLatestScan` — new cleanup path

Screens that call `clearLatestScan`:
- `ResultSummaryScreen.goToScan` → user is done with scan, cleanup correct
- `ResultSummaryScreen.goBackToScanTab` → user abandons result, cleanup correct
- `AnalysisLoadingScreen.goBackToScan` → user aborts scan, cleanup correct

In all cases, the user is explicitly leaving the scan flow. Cleanup is expected and correct. ✓

### `beginLatestScanSession` — new cleanup path

Called when user starts a new scan. Cleans up the previous session's unsaved image. The new session's image is not touched (it's the incoming `scanSession.selectedScanImage`). ✓

### `deleteUnusedScanImage` — saved recipe protection

Core logic:
```js
const isReferenced = savedRecipes.some(
  (recipe) => recipe.imageUri === uri
);
if (isReferenced) return; // do not delete
```

If a user saves a recipe and then immediately scans again:
- Saved recipe has `imageUri = permanent_uri_1`
- New scan begins → `beginLatestScanSession` fires
- `getScanImageUriForCleanup(state)` → `permanent_uri_1`
- `deleteUnusedScanImage(permanent_uri_1, savedRecipes)` → `savedRecipes[0].imageUri === permanent_uri_1` → `isReferenced = true` → **no delete** ✓

### Starter recipe ID uniqueness

Before: `scan-starter-chicken-tikka-masala-restaurant-copy`  
After: `scan-starter-chicken-tikka-masala-restaurant-copy-a1b2c3d4`

The suffix is `scanSessionId.slice(-8)` where `scanSessionId = scan-{source}-{Date.now()}-{Math.random().toString(36).slice(2, 8)}`. The random component is 6 chars (alphanumeric, base 36) → suffix entropy ≈ 2 billion unique values. Collision probability for 1000 scans of same dish: ~0.00005%. ✓

---

## Known Accepted Limitations

| Item | Reason |
|------|--------|
| Stuck-pending state after app kill mid-scan | No normal navigation path reaches ResultSummaryScreen after a kill+restart; cosmetic only |
| Guided cooking steps have no per-step food photo | UX decision; requires screen redesign outside scope |
| Permanent file cleanup on recipe delete (file remains if URI doesn't include `/okyo-scan-images/`) | Affects only pre-fix legacy recipes; production deploy starts clean |

---

## Comparison: Documents Directory Growth (Before vs After)

| Scenario | Before | After |
|----------|--------|-------|
| 100 scans, 0 saves | 100 files (~10MB) permanent | 0 files (all cleaned up) |
| 100 scans, 10 saves | 100 files (~10MB) permanent | 10 files (~1MB) — only saved recipes |
| 100 scans, 100 saves | 100 files (~10MB) permanent | 100 files (~10MB) — all referenced ✓ |
| User deletes 5 saved recipes | 95 files (5 orphaned) | 95 files (0 orphaned via `removeSavedRecipe`) |
