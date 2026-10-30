# Official Okyo iOS launch screen — 2026-10-25

Implementation checkout: `/Users/rober/Desktop/Okyo-1`.

## Artwork and presentation

The approved `Okyo_Loading_08.png` is copied byte for byte to `apps/mobile/assets/splash/okyo-loading.png` (850 × 1850, opaque RGBA). SHA-256: `b18d2dd7e7742ece1ab0d1b3bcbbfd2a940067738d53d6ba8a1b92b38fdbdb28`.

Both native iOS and React use this exact image, centered with proportional aspect-fill sizing against the physical screen edges. The reference's composition is preserved; Kiko is not extracted, repainted, stretched, or enlarged independently. Aspect-fill crops only surplus outer green on shorter displays. Geometry checks at 375×667, 375×812, 390×844, 402×874, and 440×956 retain the complete mascot and all four brackets. These are calculated layout checks, not five physical-device tests.

The fallback background is `#1BE390`, sampled from the supplied image. There is no light/dark artwork substitution. The app's existing light appearance setting and colors outside launch are preserved. Status bar content is hidden during launch and restored by the existing app status bar when launch completes. System hardware cutouts and the home indicator remain under iOS control.

## Expo and native integration

Installed versions: Expo SDK 55 (`55.0.31`) and `expo-splash-screen` `55.0.25`.

`app.json` uses the supported `expo-splash-screen` plugin with the green background and canonical image. The redundant legacy top-level `expo.splash` entry is removed. The standard plugin's fixed image sizing does not reproduce this full portrait composition, so `withOkyoLaunchScreen` applies ordinary iOS storyboard Auto Layout: an aspect-fill image view pinned to all four root-view edges, outside safe-area insets. The generated storyboard is shared by iOS's system launch and Expo's retained native splash. No deprecated `enableFullScreenImage_legacy` option is used.

The custom plugin runs before the SDK 55 splash plugin registration so its storyboard mutation runs after Expo's default image layout. An integration test executes Expo's actual config/mod resolution and verifies the final layout. It uses the installed SDK's storyboard mod helper; re-run the integration test when upgrading Expo.

The plugin bundles `OkyoLaunchArtwork.imageset`, sets the universal launch color, and removes the superseded generated `SplashScreenLogo.imageset`. `UILaunchStoryboardName` remains `SplashScreen`. `UIStatusBarHidden` is true at native launch. No AppDelegate, bundle identifier, app-icon, authentication, or entitlement change is required.

Generated `ios/` files are ignored by this repository. The committed plugin reproduces them on prebuild; `npm run splash:sync` updates an already-generated native project without replacing it. The existing `preios` hook now also runs this synchronization. Icon synchronization no longer regenerates the superseded iOS splash asset.

Expo documents the SDK's prevention, dismissal, fade APIs, and the need to verify a release build in its [SDK 55 splash-screen documentation](https://docs.expo.dev/versions/v55.0.0/sdk/splash-screen/).

## Readiness, recovery, and transition

`index.ts` imports `nativeSplash.ts` first. It calls `preventAutoHideAsync()` at module evaluation before root registration/providers.

`LaunchBoundary` covers the mounted application with the same full-screen image. Dismissal requires all of:

- Fonts are loaded, or the existing 1100 ms font fallback has elapsed, and the essential Zustand state has hydrated.
- Navigation is ready.
- The selected destination has committed, after onboarding restoration or the existing auth gate chooses it.
- The launch image has loaded and the full-screen root has laid out.

The destination signals after two animation frames. Main tabs, both existing onboarding engines, and standalone sign-in report readiness without choosing or changing routes. The standalone sign-in signal accounts for that screen being outside a stack navigator. Auth remains behind the existing `ClerkLoaded` provider. Onboarding completion, experiment assignments, draft restoration, and auth decisions are unchanged. Existing native URL/deep-link handlers are unchanged.

Initial onboarding entrance motion is suppressed while it is covered by launch, so the first screen is already in position when revealed. Subsequent onboarding transitions retain their existing motion. The existing onboarding splash timing/state-machine callbacks are retained; their artwork now matches the canonical launch asset, and the global layer hides their intermediate state.

Once ready, native dismissal and a subtle 180 ms React opacity fade reveal the already-mounted destination. Reduce Motion disables the launch fade. Optional analytics, RevenueCat, reminder synchronization, and API work are not readiness dependencies. There is no new minimum branding duration.

A 15-second JavaScript startup watchdog, or a launch-image error, reveals a friendly retry screen and dismisses native cover. Retry remounts the startup/provider tree and retries essential store hydration if necessary; it does not clear stored onboarding, recipes, or credentials. This handles initialization stalls after the React root can execute; a native crash or failure to execute JavaScript is outside a React watchdog's reach.

## Files created or modified

Paths below are relative to this checkout.

| File | Change |
| --- | --- |
| `apps/mobile/assets/splash/okyo-loading.png` | Exact approved artwork, new canonical launch asset |
| `apps/mobile/app.json` | Green Expo splash, native full-screen plugin, launch status bar setting |
| `apps/mobile/index.ts` | Earliest splash prevention import |
| `apps/mobile/App.tsx` | Readiness wrapper, navigation/resource signals, retry |
| `apps/mobile/src/startup/LaunchScreen.tsx` | Shared artwork, readiness context, startup cover, fade, recovery |
| `apps/mobile/src/startup/nativeSplash.ts` | Supported native prevention/dismissal APIs |
| `apps/mobile/src/startup/launchReadiness.ts` | Readiness contract and timing constants |
| `apps/mobile/src/startup/launchReadiness.test.ts` | Prevent premature destination exposure |
| `apps/mobile/plugins/withOkyoLaunchScreen.js` | Reproducible full-screen native storyboard/assets |
| `apps/mobile/scripts/sync-launch-screen.mjs` | Update existing native project |
| `apps/mobile/scripts/launch-screen.test.mjs` | Real Expo mod resolution and verbatim native asset tests |
| `apps/mobile/scripts/sync-app-icons.mjs` | Remove superseded iOS splash generation; icon pipeline preserved |
| `apps/mobile/package.json` | Add splash sync command and pre-iOS hook |
| `apps/mobile/src/navigation/MainTabs.tsx` | Main destination readiness signal |
| `apps/mobile/src/auth/SignInScreen.tsx` | Standalone sign-in destination readiness signal |
| `apps/mobile/src/onboarding-v3/OnboardingV3.tsx` | Restored V3 destination readiness signal |
| `apps/mobile/src/onboarding-v3/screens-v4/OnboardingV4.tsx` | Restored V4 destination readiness signal |
| `apps/mobile/src/onboarding-v3/screens/SplashScreen.tsx` | Replace old pink startup rendering with shared green artwork |
| `apps/mobile/src/onboarding-v3/assets/onboardingV3Assets.ts` | Point startup asset reference to canonical file |
| `apps/mobile/src/onboarding-v3/components/OnboardingScreenTransition.tsx` | Settle initial destination underneath launch |
| `apps/mobile/src/onboarding-v3/components/OnboardingBackTransition.test.ts` | Account for initial launch animation guard |
| `docs/audits/OFFICIAL_LAUNCH_SCREEN_2026-10-25.md` | This report |

Generated native files updated:

- `apps/mobile/ios/Okyo/SplashScreen.storyboard`
- `apps/mobile/ios/Okyo/Info.plist`
- `apps/mobile/ios/Okyo/Images.xcassets/OkyoLaunchArtwork.imageset/Contents.json`
- `apps/mobile/ios/Okyo/Images.xcassets/OkyoLaunchArtwork.imageset/okyo-loading.png`
- `apps/mobile/ios/Okyo/Images.xcassets/SplashScreenBackground.colorset/Contents.json`
- Superseded generated folder removed: `apps/mobile/ios/Okyo/Images.xcassets/SplashScreenLogo.imageset/`.

Other historical onboarding images remain in place for preservation. Active startup code/configuration no longer references the pink artwork. The official icon, other mascot artwork, recipe features, main-screen layouts, nutrition, subscriptions, and marketing screenshot assets are unchanged by this task. A pre-edit hash snapshot was used to distinguish this work from the checkout's substantial preexisting edits.

## Validation

- TypeScript: passed.
- Static asset validation: passed (341 references, 432 images).
- Official icon validation and derivative checks: passed; icon hash unchanged from this task's baseline.
- Targeted tests: 134 passed, covering launch readiness/config/native assets, auth decisions, startup routing, onboarding state machines, Reduce Motion, and subsequent onboarding transitions.
- Additional restoration integration group: one preexisting source-count assertion fails. It expects three JSX returns in the onboarding entry function; the pre-task source already has four. Removing only this task's two inserted lines reproduces the captured baseline hash and still gives four returns. This unrelated assertion was left unchanged. Evidence: `existing-test-failure.json`.
- Responsive aspect-fill composition checks: all artwork stays visible at the five dimensions above.
- Native Release simulator build: passed, arm64, using the existing Xcode workspace/scheme and bundled Hermes JavaScript. No Metro server or Expo Go is needed.
- Native binary inspection: compiled `SplashScreen.storyboardc`, 850×1850 `OkyoLaunchArtwork` rendition, universal green color, correct bundle ID, and launch status-bar setting are present. The superseded `SplashScreenLogo` rendition is absent.
- Simulator signing: the initial no-sign build caused iOS SplashBoard resource validation error `-67056` and a black system opening animation. The retained Release product was sealed with standard ad hoc signing (`codesign --force --deep --sign -`) and passed strict signature verification. Fresh installation/reboot cleared the failed snapshot cache. Repeated signed recordings start with the green image during the system opening animation. Normal Expo/Xcode builds should keep simulator signing enabled.

Actual simulator results, using the signed Release binary:

| Scenario | Result |
| --- | --- |
| Fresh install and first launch, iPhone 17 Pro / iOS 26.5 | Green system launch screen, then existing onboarding hero |
| Force-close / cold launch | Green launch screen and expected destination |
| Incomplete onboarding, dark system appearance | Resumes the saved `primaryGoal` step |
| Completed onboarding, signed out / auth unavailable in release configuration | Reaches the existing Home tab |
| Compact iPhone SE (3rd generation), iOS 26.5 | Entire Kiko/scanner remains visible; full green screen; reaches existing onboarding |
| System appearance | Light and dark cases checked; same launch composition |

The incomplete/completed state checks use disposable, locally seeded storage fixtures in this task's QA simulator, not a real user's state. No app routing code or Clerk configuration was changed to produce those cases. Signed iPhone 17 Pro recordings were reviewed and sampled at 30 fps: no full-screen blank white or black frames were found across the opening/transition. Existing onboarding/main layouts were visible after dismissal. This is evidence for those recordings, not a guarantee for every device or OS build.

QA simulators: `Okyo Icon Migration QA` / iPhone 17 Pro (`06D47E3D-7416-4A9A-B101-16E6C741A420`) and `Okyo Launch Compact QA` / SE 3 (`0BFFCBCA-C2DF-451A-930F-7729A5E0FC2E`). The Pro is left with a clean signed installation and light appearance; the compact simulator is shut down after checks. Other QA simulators were untouched.

After the Mac was unlocked, interactive checks also passed on the Pro simulator: opened the closed Release app by tapping its Home Screen icon, reached the existing onboarding hero, opened and dismissed its sign-in availability message, and opened/closed the Terms document. The destination controls responded normally after the launch overlay disappeared. This Release configuration reports “Sign-in isn’t available”; its existing auth configuration was preserved. No real account was created or signed in. A new Home Screen launch recording is retained as `unlocked-home-icon-launch.mp4`, with a shorter launch-focused excerpt in `unlocked-cold-launch-clip.mp4`, and the resulting screen in `unlocked-onboarding.png`. No further application code changes were needed.

Not verified on a physical device. A live authenticated Clerk session, configured signed-out sign-in prompt, true network-disabled launch, interactive auth callback/deep-link completion, runtime Reduce Motion toggles, and fault-injected retry UI were not exercised on-device. The Mac was initially locked; after unlocking, simulator taps and in-app navigation were checked as described above. This simulator's Settings omits physical networking controls, so no host-wide networking changes were made to manufacture an offline test. Native artwork/JS/fonts are bundled and startup has no optional-network readiness dependency, but that inspection is not a substitute for a true offline device test.

Local logs, calculated layout previews, baseline hashes, and native-build evidence are in `apps/mobile/.artifacts/launch-screen-2026-10-25/` (ignored).

Key evidence:

- `Okyo.app`: signed Release simulator product, with bundled JavaScript.
- `signed-first-launch.mp4`: fresh signed install, system launch through onboarding.
- `signed-dark-resume.mp4`: dark appearance and incomplete onboarding resume.
- `signed-main-launch.mp4`: completed installation reaching Home.
- `compact-launch.mp4`, `compact-cold-launch.mp4`, `compact-settled.png`: actual SE launch/layout checks.
- `verified-native-launch.png`, `react-launch.png`, `responsive-layout.png`: visual evidence and calculated composition comparison.
- `binary-inspection.json`, `adhoc-signing.log`, `signed-video-verification.json`, `task-changes.json`: packaging, signing, frame, and preservation checks.

The unchanged-file check includes all four app-icon assets/documentation files, 60 other mascot asset files, and 83 App Store screenshot project files from the pre-task snapshot.

## Rebuild and manual acceptance

A new native binary is required; Metro reload or an OTA JavaScript update alone cannot change the system launch storyboard.

From `/Users/rober/Desktop/Okyo-1/apps/mobile`:

```sh
npm run splash:sync
npm run ios -- --configuration Release
```

`npm run ios` also executes the existing icon checks/native icon synchronization plus launch synchronization. A fresh Expo prebuild picks up the custom plugin automatically. Do not run a destructive clean prebuild just to refresh this screen.

On a simulator or device, force-close and reopen the installed release binary. Check fresh onboarding, a saved incomplete onboarding draft, a completed signed-out install, a live authenticated install, offline launch, and both system appearances. The green image should cover the entire display until the selected usable page is ready, then fade directly to it. Also exercise an existing auth callback/deep link and Reduce Motion. Production Clerk/session and physical-device cases require a configured authenticated test installation; do not change authentication configuration just to manufacture a splash test.
