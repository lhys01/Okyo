# SwiftUI Migration Plan

Date: 2026-06-10

This is the first-pass migration plan for a parallel native iOS SwiftUI app. The React Native app in `apps/mobile` stays untouched. All Swift work lives in `apps/ios-swift`.

---

## 1. Screen Inventory

| Screen | Priority | Notes |
|--------|----------|-------|
| WelcomeView | Swift MVP | Onboarding entry |
| ScanView | Swift MVP | Core scan loop |
| AnalysisLoadingView | Swift MVP | Loading states |
| ResultSummaryView | Swift MVP | Dish result, cost, uncertainty |
| RecipeDetailView | Swift MVP | Ingredients, steps |
| GroceryListView | Swift MVP | Grocery list with categories |
| LibraryView | Swift MVP | Saved recipes |
| SettingsView | Swift MVP | API URL, reset, delete data |
| SavingsDashboardView | Later | Needs user-entered prices first |
| RankingsView | Later | Social features out of scope |
| RestaurantPacksView | Later | Static data, low urgency |
| ShareCardView | Later | Needs shareable image generation |
| DupeChallengeView | Later | XP/badges system out of scope |
| PaywallView | Ignore first pass | No payments yet |

---

## 2. API Endpoints Swift Needs

Swift MVP requires only:

```
GET  /health
POST /v1/scans
```

Future (not in first pass):
```
GET  /v1/scans/:scanId
GET  /v1/recipes/:recipeId
POST /v1/recipes/:recipeId/save
GET  /v1/library
GET  /v1/savings
```

The `/health` check is used to verify API reachability from Settings.

---

## 3. Scan Request / Response Contract

### Request: `POST /v1/scans`

```
Content-Type: application/json
Body size limit: 16 MB
Image data URL limit: 12,000,000 chars
```

```json
{
  "source": "camera" | "photos" | "mock",
  "mode": "Restaurant Copy" | "Budget" | "Healthy",
  "image": {
    "dataUrl": "data:image/jpeg;base64,...",
    "fileName": "okyo-scan-upload.jpg",
    "mimeType": "image/jpeg",
    "width": 1024,
    "height": 768,
    "sizeBytes": 204800,
    "dataUrlSizeBytes": 180000,
    "source": "photos",
    "placeholder": false,
    "conversionError": null
  }
}
```

### Response Envelope

```json
{ "ok": true, "data": CreateScanResult }
{ "ok": false, "error": { "code": "string", "message": "string" } }
```

### Success Response

```json
{
  "status": "success",
  "scan": ScanResult,
  "recipe": Recipe,
  "recipes": [Recipe],
  "note": "string",
  "aiSource": "openrouter_ai" | "mock_ai" | "fallback_ai",
  "confidence": 0.85,
  "scanState": "clear_food",
  "source": "photos"
}
```

### Partial Response

```json
{
  "status": "partial",
  "scan": ScanResult,
  "recipes": [],
  "partialReason": "string",
  "source": "photos"
}
```

### Rejected / Failed Response

```json
{
  "status": "rejected" | "failed",
  "scanId": "string",
  "rejectionType": "not_food" | "unclear_image" | "ai_failed",
  "rejectionReason": "string",
  "source": "photos"
}
```

### ScanResult Fields

```
id, dishName, bestGuessDishName, bestGuessNote, possibleDishNames
scanState: clear_food | food_present_uncertain_dish | partial_food | not_food | too_unclear
restaurantStyle, restaurantPrice, homemadeCost, estimatedSavings
confidence (0–1), matchScore (0–10)
difficulty, modes: [RecipeMode]
recipeId, groceryListId, shareCardId
```

### Recipe Fields

```
id, scanResultId, title, mode
prepTimeMinutes, cookTimeMinutes, totalTimeMinutes, servings
skillLevel, difficulty
estimatedHomemadeCost, estimatedSavings
ingredients: [{ name, quantity, pantryItem? }]
ingredientGroups: [{ component, items }]
steps: [string]
structuredSteps: [{ text, timeEstimate?, visualCue?, whyItMatters? }]
substitutions, pantryNote, confidenceNote
equipment, storage
groceryItems: [{ name, quantity, category, pantryItem?, pantryStaple?, sourceIngredient? }]
spicePairings, cookingTerms
```

### Pricing / Savings Rules in Swift

- `restaurantPrice` from API: never display as the restaurant price for real scans. It is an AI estimate.
- `homemadeCost`: show as "Estimated grocery cost: $X.XX"
- `estimatedSavings`: only show if the user manually enters what they paid at the restaurant.
- Never invent a restaurant price from a photo.
- Show savings only when: `userEnteredRestaurantPrice - homemadeCost > 0`.

---

## 4. Swift Models

All in `OkyoAPIModels.swift`:

- `RecipeMode` — enum, raw String: "Restaurant Copy" | "Budget" | "Healthy"
- `ScanSource` — enum: camera | photos | mock
- `ScanStatus` — enum: success | partial | rejected | failed
- `ScanState` — enum with underscore raw values
- `ScanRejectionType` — enum: not_food | unclear_image | ai_failed
- `AiSource` — enum with underscore raw values
- `ScanImagePayload` — Encodable, sent in request
- `ScanRequest` — Encodable, POST body
- `ScanResult` — Codable, Identifiable
- `RecipeIngredient` — Codable
- `RecipeIngredientGroup` — Codable
- `CookingTerm` — Codable
- `RecipeStep` — Codable
- `GroceryItem` — Codable
- `Recipe` — Codable, Identifiable
- `GroceryList` — Codable, Identifiable
- `CreateScanResult` — Decodable, API response
- `HealthCheckResult` — Decodable
- `APIEnvelope<T>` — generic Decodable envelope with `unwrap() throws -> T`
- `APIErrorBody` — Decodable
- `ScanSession` — app-side, NOT Codable, ephemeral
- `ScanFailure` — app-side
- `AppError` — enum, LocalizedError
- `ScanDecision` — enum namespace with static helpers

In `OkyoAppState.swift`:

- `AppTab` — enum: scan | library | settings
- `OkyoRoute` — enum, Hashable: analysisLoading | resultSummary | recipeDetail | groceryList
- `OkyoAppState` — @Observable @MainActor final class

In `OkyoAPIClient.swift`:

- `OkyoAPIClient` — actor with `healthCheck()` and `scan(_:)`

---

## 5. Swift Architecture

- **Language:** Swift 5.9+
- **UI:** SwiftUI
- **Minimum deployment target:** iOS 17.0
- **Async:** async/await with Swift concurrency
- **Networking:** URLSession + Codable + APIEnvelope
- **State:** `@Observable` + `@Environment` (no third-party state library)
- **Navigation:** `NavigationStack(path:)` with typed `OkyoRoute` enum
- **Photo picking:** `PhotosPicker` from `PhotosUI`
- **Image compression:** `UIGraphicsImageRenderer` + `UIImage.jpegData(compressionQuality:)`
- **Persistence:** `UserDefaults` or `JSONEncoder`/file for saved recipes (not in first scaffold)
- **No third-party dependencies** in first pass

### State Flow

```
OkyoSwiftApp
└── AppRootView
    ├── WelcomeView (if !hasCompletedOnboarding)
    └── MainTabView (TabView)
        ├── NavigationStack(path: $appState.scanPath)
        │   ├── ScanView [root]
        │   ├── AnalysisLoadingView [.analysisLoading]
        │   ├── ResultSummaryView [.resultSummary]
        │   ├── RecipeDetailView [.recipeDetail]
        │   └── GroceryListView [.groceryList]
        ├── LibraryView
        └── SettingsView
```

### Scan Session Model

- `OkyoAppState.scanSession` holds the active `ScanSession`
- `ScanSession.sessionId` guards against stale async responses
- `ScanSession.status` is nil while pending, set on completion
- `AnalysisLoadingView` monitors `status` and auto-navigates to result

---

## 6. Build Order

1. App shell + OkyoTheme + OkyoComponents
2. OkyoAPIModels (all Codable types)
3. OkyoAPIClient (URLSession actor)
4. OkyoAppState (@Observable, scan session, navigation)
5. WelcomeView + AppRootView navigation shell
6. ScanView: photo picker + image compression + scan trigger
7. AnalysisLoadingView: loading states + auto-advance
8. ResultSummaryView: result display, uncertainty, pricing rules
9. Confirm/edit dish name (edit field in ResultSummaryView)
10. RecipeDetailView: ingredients, steps, save
11. GroceryListView: categorized list, native share
12. LibraryView: saved recipes, empty state
13. SettingsView: API URL, reset, delete

---

## 7. Risks

| Risk | Mitigation |
|------|-----------|
| Wi-Fi API URL changes | Single `apiBaseURL` constant in `OkyoAPIClient`. Editable in Settings. |
| Image compression failures | Multi-attempt with `UIGraphicsImageRenderer`. Fall back to placeholder flag. |
| Base64 payloads too large | Same 12MB cap as TypeScript. Check `dataUrl.count` before sending. |
| OpenRouter inconsistency | Swift mirrors same scan decision logic as TypeScript `scanDecision.ts`. |
| Scan session persistence | `ScanSession` is ephemeral only. Saved recipes persist separately. |
| Pricing honesty | Never show `restaurantPrice` from AI as user-confirmed restaurant price. |
| Demo vs real scan | Only `source == .mock` may fall back to demo copy. Real scan failures fail honestly. |
| Xcode project setup | Must be done manually. See `apps/ios-swift/README.md`. |
| Missing assets | PNG assets need to be copied into Xcode `.xcassets`. See Assets README. |
| `@Observable` threading | `OkyoAppState` is `@MainActor`. Mutations from async scan tasks run on main actor. |

---

## 8. Next Implementation Slice

After this scaffold, the immediate next step is:

**Create the Xcode project manually** (see `apps/ios-swift/README.md`), then:

1. Add all Swift source files to the project.
2. Run the app in Simulator.
3. Confirm WelcomeView → ScanView navigation works.
4. Test `healthCheck()` against the running API at `http://192.168.1.115:8081`.
5. Test a demo scan (`source: .mock`) end-to-end to `ResultSummaryView`.
6. Test a real photo upload scan to `ResultSummaryView`.
7. Confirm scan decision rules: `not_food` rejects, `too_unclear` shows retry, partial shows best guess.
