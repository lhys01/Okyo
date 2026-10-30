# Okyo app icon migration — 2026-10-25

Working checkout: `/Users/rober/Desktop/Okyo-1` (explicitly selected by the user after the chat opened in its older worktree). `Okyo-1-stage2` was not edited. Existing unrelated changes were preserved.

## A. Changes completed

The official icon is installed at `/Users/rober/Desktop/Okyo-1/apps/mobile/assets/app-icon/icon.png`. All artwork pixels match the supplied file; only an explicit PNG sRGB metadata chunk was added. No redesign, crop, corner mask, or new visual effects were applied.

- Expo SDK installed: **55.0.31**. Active configuration: `apps/mobile/app.json`; no dynamic config or EAS override was found. Top-level and explicit iOS icons both resolve to the canonical master.
- The website imports the mobile master directly for its header, favicon, Apple touch icon, and social preview. Its independent old icon copy was removed.
- The screenshot editor uses a generated public copy, refreshed before dev/build. The existing six-slide project, screenshot rasters, headings, composition, and device frames were retained.
- Android gets a mechanically padded derivative: the complete image is resized to 432px inside a 1024px layer, fitting its diagonal within the 66/108 adaptive safe circle. Padding extends existing green edge colors. Legacy, round, and adaptive native launcher resources were regenerated.
- Both active splash source copies retain their 852 × 1846 size and gradient. Only the old white logo area (x=248–604, y=717–1111) changed, using the existing approved transparent Kiko head. All surrounding pixels are unchanged. iOS and Android splash resources were refreshed without native-project regeneration.
- Added deterministic generation/check commands, stricter image validation, native-run hooks, release-preflight checks, and icon-pipeline documentation. No dependencies were added.

### Exact application/configuration/native file paths

The following table enumerates source assets/configuration/scripts and regenerated native outputs. Native folders are ignored by Git; their sources and generation commands are tracked separately. Existing files in the website and screenshot editor were already untracked in this checkout.

| File | Action |
| --- | --- |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/app.json` | modified |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/assets/app-icon/favicon.png` | modified |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/assets/app-icon/icon.png` | modified |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/assets/onboarding ex/icon.png` | removed |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/assets/onboarding ex/icon.svg` | removed |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/assets/onboarding ex/onboarding1.png` | modified |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/assets/onboarding/onboarding-ex/icon.png` | removed |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/assets/onboarding/onboarding-ex/icon.svg` | removed |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/assets/onboarding/onboarding-ex/onboarding1.png` | modified |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/package.json` | modified |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/scripts/validate-app-icon.mjs` | updated-existing-or-added |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/scripts/sync-app-icons.mjs` | updated-existing-or-added |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/assets/app-icon/adaptive-foreground.png` | updated-existing-or-added |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/assets/app-icon/README.md` | updated-existing-or-added |
| `/Users/rober/Desktop/Okyo-1/apps/web/src/layouts/Base.astro` | updated-existing-or-added |
| `/Users/rober/Desktop/Okyo-1/apps/web/src/components/Header.astro` | updated-existing-or-added |
| `/Users/rober/Desktop/Okyo-1/apps/web/src/assets/brand/app-icon.png` | removed |
| `/Users/rober/Desktop/Okyo-1/app-store-screenshots/package.json` | updated-existing-or-added |
| `/Users/rober/Desktop/Okyo-1/app-store-screenshots/public/app-icon.png` | updated-existing-or-added |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/ios/Okyo/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/ios/Okyo/Images.xcassets/SplashScreenLogo.imageset/image@3x.png` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/ios/Okyo/Images.xcassets/SplashScreenLogo.imageset/image@2x.png` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/ios/Okyo/Images.xcassets/SplashScreenLogo.imageset/image.png` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/mipmap-mdpi/ic_launcher.webp` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/mipmap-mdpi/ic_launcher_round.webp` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.webp` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/mipmap-hdpi/ic_launcher.webp` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/mipmap-hdpi/ic_launcher_round.webp` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.webp` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/drawable/ic_launcher_background.xml` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.webp` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.webp` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/mipmap-xxhdpi/ic_launcher.webp` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.webp` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.webp` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/values/colors.xml` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/drawable-xhdpi/splashscreen_logo.png` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/drawable-xxhdpi/splashscreen_logo.png` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/drawable-hdpi/splashscreen_logo.png` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/drawable-mdpi/splashscreen_logo.png` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/mipmap-xhdpi/ic_launcher.webp` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.webp` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.webp` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/drawable-xxxhdpi/splashscreen_logo.png` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml` | regenerated-native |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/assets/favicon.ico` | removed-unused |
| `/Users/rober/Desktop/Okyo-1/apps/mobile/ios/Okyo/Images.xcassets/AppIcon.appiconset/Contents.json` | regenerated-native |


Audit evidence and generated preview/export files are listed in the evidence directory manifest. The before-state inventory contains 929 raster assets. Evidence, detailed before/after inventories, raw validation logs, the successful simulator app, and all exports are saved locally at `/Users/rober/Desktop/Okyo-1/apps/mobile/.artifacts/icon-migration-2026-10-25/` (ignored by Git). The exact evidence-file list is `evidence-files.json` in that directory. Contact sheets were visually reviewed, including historical QA captures and unhelpfully named assets; 16 active video assets were sampled and contain decorative backgrounds rather than legacy launcher artwork.

## B. Old icon occurrences

Counts distinguish source use sites from generated resources:

| Category | Discovered | Result |
| --- | ---: | --- |
| Source use sites for the old official icon | 9 | All now use the new master or its generated derivative |
| Active splash source references (Expo splash, plugin, React registry) | 3 | All now resolve to the updated splash artwork |
| Active stock Expo favicon reference | 1 | Replaced with a derivative of the new master |
| Generated native launcher images | 16 | 1 iOS + 15 Android regenerated |
| Generated native splash images | 8 | 3 iOS + 5 Android regenerated |
| Obsolete/redundant files removed | 6 | Four unused old PNG/SVG icon duplicates, one unused old ICO, one independent website icon copy |

The nine official-icon source use sites are `expo.icon`, Android adaptive foreground, `imageAssetFallbacks.ts`, `AnalysisLoadingScreen.tsx`, `ShareCardPreviewScreen.tsx`, the two Astro imports, and the screenshot project’s `appIcon` plus first-slide overlay. Existing unchanged source paths now resolve to replacement image content.

Remaining old-logo appearances in historical QA screenshots, videos, diff captures, and this audit’s before-state galleries are retained as history. They are not imported by active app/website/marketing source. Approved Kiko character/sticker/profile art was retained. A final exact-file hash scan covered **33 prior raster occurrences / 28 distinct legacy hashes** and found **zero legacy icons** in active mobile assets, native app resources, website source assets, and screenshot-editor public assets. Resolved configuration and source-reference checks also pass.

## C. New icon verification

- Master: **1024 × 1024; PNG; 8-bit RGB; explicit sRGB; no alpha channel**.
- All four corners and their 8 × 8 patches are opaque green. There is no white or black exterior mask.
- Original image samples are byte-for-byte identical to the supplied approved artwork.
- Native iOS master also passes the strict RGB/sRGB/corner checks.
- AppIcon catalog has one universal iOS asset and no appearance variants; no Icon Composer asset or alternate-icon definitions were found. Dark/tinted system appearances use the supported system fallback from this new universal icon.
- Android has no configured custom monochrome icon. The complete resized artwork in the padded derivative was compared pixel by pixel: **186,624/186,624 pixels match**.
- Visual master previews at 60 × 60, 120 × 120, and 180 × 180 and an Android circle crop were inspected. Kiko and scanner brackets remain recognizable.
- Validator negative checks reject oversized (2048px), RGBA, and white-corner fixtures.

## D. Build and validation results

| Actual command (from the indicated package) | Result |
| --- | --- |
| `npm run icons:check` (mobile) | Pass; master, generated derivatives, and resolved Expo references current |
| `node scripts/validate-app-icon.mjs ios/Okyo/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png` (mobile) | Pass |
| `npm run typecheck` (mobile) | Pass |
| `npm run validate-assets` (mobile) | Pass: 340 static references, 431 image files |
| `node --import tsx --test src/utils/imageAssetFallbacks.test.ts src/utils/mascotNamePropagation.test.ts src/utils/productIntegrityRegression.test.ts src/screens/shareCardPreview.test.ts src/onboarding-v3/screens/splashLayout.test.ts` (mobile) | 24/24 pass |
| `npm run build` (website) | Pass: 6 static pages, including generated icon/touch/social assets |
| `npm run build` (screenshot editor) | Pass |
| `npm run preflight:release:config` (mobile) | Icon check passes; existing privacy declaration/review requirements block release |
| `./gradlew :app:assembleDebug` (Android) | Cannot build: no Java runtime installed |
| `git diff --check` for edited tracked configuration/scripts | Pass |

The preflight’s two existing failures are the absent collected-data declarations in `PrivacyInfo.xcprivacy` and unapproved `privacy-collected-data-review.json`. They were not changed by this task. Sentry’s existing missing organization/project warning was also observed.

The native iOS build started with a fresh task-specific DerivedData folder, leaving existing DerivedData/signing/provisioning and other simulator installations alone. The initial universal build was interrupted as free disk space fell to approximately 1.5 GB. Only task-created x86 intermediates (1.2 GB) were removed; the build then resumed for arm64 with two concurrent jobs on this 16 GB host:

```sh
cd /Users/rober/Desktop/Okyo-1/apps/mobile
SENTRY_DISABLE_AUTO_UPLOAD=true SENTRY_ALLOW_FAILURE=true xcodebuild \
  -workspace ios/Okyo.xcworkspace -scheme Okyo -configuration Debug \
  -sdk iphonesimulator -destination "id=06D47E3D-7416-4A9A-B101-16E6C741A420" \
  -derivedDataPath .artifacts/icon-migration-build -jobs 2 \
  CODE_SIGNING_ALLOWED=NO ONLY_ACTIVE_ARCH=YES ARCHS=arm64 build
```

**Native build result: `BUILD SUCCEEDED` (exit 0).** The new native icon is bundled in the successful Debug simulator build. The built app was installed on the isolated **Okyo Icon Migration QA / iPhone 17 Pro / iOS 26.5** simulator (`06D47E3D-7416-4A9A-B101-16E6C741A420`). The installed Home Screen icon was visually checked: correct system rounding, no white/black exterior corners, complete Kiko face, and visible scanner brackets. A comparison capture is `installed-icon-comparison.png`. The headless system-dark-appearance command also completed with the new icon present. Custom Home Screen icon tint/style selection and full JS startup remain pending because the Mac locked during the build and the simulator development-client URL is waiting at “Open in Okyo?”. No claim of a completed functional app-launch test is made. A fresh native build passed; no signed distribution archive or upload was created.

The successful `Okyo.app` is retained in the evidence directory. Only this task’s intermediate build/cache directory was removed after preserving that app, recovering several GB of disk space. Existing user build outputs remain untouched.

Eleven regenerated Expo image-cache directories were cleared under `apps/mobile/.expo/web/cache/production/images` after source/native synchronization. Devices/settings, Metro state, signing material, old user-owned build outputs, and global Xcode DerivedData were preserved. Source-level configuration and generation, rather than cache clearing, prevent old icons in future builds.

## E. App Store Connect and promotional assets

App Store Connect was opened read-only and redirected to its login page (`/login?...authResult=FAILED`). No authenticated account, dedicated connector, or `asc`/Fastlane CLI was available. **No build or screenshot was uploaded, no app was submitted for review, and no live store or website deployment was changed.**

The first slide is the only existing promotional slide containing the official icon. The supplied replacement package contains that first slide in the existing four export sizes: **1320 × 2868, 1284 × 2778, 1206 × 2622, and 1125 × 2436**, English. All 11 pre-existing promotional/website screenshot raster files remain byte-identical.

The full six-slide export was inspected. An existing packaging problem makes slides 2–4 blank because their composed SVGs refer to external PNG URLs; slide 6 likewise loses its nested transformation photos. The before-state source has the same external references. No screenshot layouts, copy, image content, or renderer code were changed to address that separate issue. The full-deck ZIP (`okyo-ios-iphone.zip`) is audit evidence only and must **not** be uploaded. Use only `/Users/rober/Desktop/Okyo-1/apps/mobile/.artifacts/icon-migration-2026-10-25/app-store-first-slide-icon-update.zip` for this icon update.

Apple obtains the app icon from the uploaded native build; changing local assets or an OTA JS update cannot change the live store icon. See [Apple: Add an app icon](https://developer.apple.com/help/app-store-connect/manage-app-information/add-an-app-icon/), [Apple: Upload app previews and screenshots](https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/), and [Expo SDK 55 configuration](https://docs.expo.dev/versions/v55.0.0/config/app/).

## F. Remaining tasks and manual verification

1. **Release/privacy owner:** approve and complete the existing collected-data declarations, then rerun the release preflight.
2. **Distribution build:** choose an iOS build number higher than the latest App Store Connect build, create a signed Release archive of `ios/Okyo.xcworkspace` → scheme `Okyo` → Any iOS Device, validate it in Xcode Organizer, then upload. The task does not change the bundle ID or release numbering.
3. **App Store Connect:** after processing, select the new uploaded build for the intended version. The launcher/store icon comes from that build. Replace only the first screenshot for each currently used display-size slot/localization with its matching `01-hero.png`; keep the remaining five existing store screenshots. Save without submitting/publishing until explicitly authorized.
4. **Screenshot editor follow-up:** inline the nested raster sources (or otherwise package them correctly) before any future full six-slide export. Audit-only exports with blank slides are not release assets.
5. **Website:** deploy the verified website build through the existing hosting workflow when desired; confirm header icon, favicon, Apple touch icon, and social preview at the live domain, then refresh external social preview caches if needed.
6. **External assets:** replace profile/app-icon images on any social, press-kit, support, or promotional service outside this checkout. No inaccessible service is assumed updated.
7. **Android:** install a supported JDK/Android build environment, rerun `./gradlew :app:assembleDebug`, and verify launcher circle/squircle/adaptive behavior on a device/emulator.
8. **Physical iPhone:** install the new native build, verify Home Screen/default/dark/tinted icon styles, normal launch, updated splash, Analysis Loading, and Share Card Preview. Existing installations retain their bundled old icon until replaced.

A final comparison against the pre-task tracked-file hashes found changes only in the ten intended tracked icon/configuration/splash/package files, with no unexpected tracked changes. Additional new/untracked website/editor/scripts/docs/native files are enumerated above. All original app functionality, mascot illustrations, navigation, authentication, API, subscription, analytics, and legal/privacy settings remain unchanged by the icon migration.

The native UI tool reported that macOS was locked after the build. Unlocking is a user action; the task does not bypass that lock. Headless simulator installation, icon captures, and system appearance changes were completed. Full interactive startup and custom icon-style testing remain explicitly pending.
