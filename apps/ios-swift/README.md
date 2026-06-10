# OkyoSwift — Native iOS App

Parallel native SwiftUI implementation of Okyo. The React Native app in `apps/mobile` is unchanged.

## Status

Swift source scaffold created. No Xcode project exists yet.

**Swift source scaffold created, but xcodebuild was not run because no .xcodeproj/.xcworkspace exists yet.**

---

## Manual Xcode Setup

Follow these steps exactly to create the Xcode project and wire in the Swift source files.

### Step 1 — Create new Xcode project

1. Open Xcode.
2. Choose **File → New → Project**.
3. Select **iOS → App**.
4. Set:
   - Product Name: `OkyoSwift`
   - Team: your Apple developer account or None
   - Organization Identifier: `com.okyo`
   - Bundle Identifier: `com.okyo.OkyoSwift`
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Uncheck "Include Tests" (add later)
5. Save the project **inside** `apps/ios-swift/` so the project file is at:
   ```
   apps/ios-swift/OkyoSwift.xcodeproj
   ```

### Step 2 — Delete generated boilerplate

Xcode will create `ContentView.swift` and `OkyoSwiftApp.swift` inside the project. Delete both — the scaffold versions in `OkyoSwift/` replace them.

### Step 3 — Add source files to the project

Drag these folders from Finder into the Xcode project navigator **under the OkyoSwift target**:
```
OkyoSwift/Design/
OkyoSwift/API/
OkyoSwift/State/
OkyoSwift/Features/
```

Then add these root-level files directly:
```
OkyoSwift/OkyoSwiftApp.swift
OkyoSwift/AppRootView.swift
```

When prompted, choose **"Create groups"** (not folder references) and check **"Add to target: OkyoSwift"**.

### Step 4 — Set deployment target

1. Select the project in the navigator.
2. Under **Targets → OkyoSwift → General**, set:
   - Minimum Deployments: **iOS 17.0**

### Step 5 — Add capabilities

Under **Targets → OkyoSwift → Signing & Capabilities**:
- Add **Photos Library Usage** (if not already present)
- In `Info.plist`, add:
  - `NSPhotoLibraryUsageDescription`: `Okyo needs photo access to scan your food.`
  - `NSCameraUsageDescription`: `Okyo needs camera access to photograph food.`
- Under **App Transport Security Settings**, add exception for `192.168.1.115` (local API):
  - Or set `NSAllowsArbitraryLoads = true` for local dev only. Do not ship this.

### Step 6 — Configure API URL

The default base URL is:
```
http://192.168.1.115:8081
```

This is set in `OkyoSwift/API/OkyoAPIClient.swift`. To change it without recompiling, edit the URL in Settings → API URL while the app is running.

### Step 7 — Add assets

Copy mascot PNG assets from the React Native app into an Xcode asset catalog:
```
apps/mobile/assets/mascot/kiko-*.png
```

See `OkyoSwift/Assets/README.md` for details.

### Step 8 — Build and run

1. Select an iPhone 17 Pro simulator (or matching iPhone simulator).
2. Press ⌘R or click the Run button.
3. Confirm the app launches to WelcomeView.

---

## Running the API

The Swift app expects the API to be running locally:

```bash
cd /Users/rober/Documents/Okyo-1/apps/api
npm install
npm run dev
```

Health check from terminal:
```bash
curl http://192.168.1.115:8081/health
```

Or from the app: Settings → API Health Check.

---

## Folder Structure

```
apps/ios-swift/
├── README.md                       ← this file
└── OkyoSwift/
    ├── OkyoSwiftApp.swift           ← @main entry point
    ├── AppRootView.swift            ← root + tab view
    ├── Design/
    │   ├── OkyoTheme.swift          ← colors, spacing, radius
    │   └── OkyoComponents.swift     ← card, button, badge
    ├── API/
    │   ├── OkyoAPIClient.swift      ← URLSession actor
    │   └── OkyoAPIModels.swift      ← Codable types + scan decision
    ├── State/
    │   └── OkyoAppState.swift       ← @Observable state + navigation
    ├── Features/
    │   ├── Welcome/WelcomeView.swift
    │   ├── Scan/
    │   │   ├── ScanView.swift
    │   │   └── AnalysisLoadingView.swift
    │   ├── Result/ResultSummaryView.swift
    │   ├── Recipe/RecipeDetailView.swift
    │   ├── Grocery/GroceryListView.swift
    │   ├── Library/LibraryView.swift
    │   └── Settings/SettingsView.swift
    └── Assets/
        └── README.md
```

---

## Rules

- Never substitute demo food (Spicy Vodka Rigatoni) for a real scan failure.
- Show `homemadeCost` as "Estimated grocery cost", never as confirmed savings.
- Show savings only if the user manually enters the restaurant price.
- `source: .mock` scans may use demo fallback copy. Real scans must fail honestly.
- Keep the `OkyoAPIClient` base URL in one place only.
