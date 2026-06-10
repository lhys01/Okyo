# Assets

This folder documents which assets the Swift app needs.

## Mascot (Kiko)

The React Native app's mascot PNGs live at:
```
apps/mobile/assets/mascot/kiko-*.png
```

Available poses:
- `kiko-default.png` — neutral
- `kiko-scanning.png` — scanning/thinking pose
- `kiko-happy.png` — happy/success
- `kiko-thinking.png` — uncertain/processing
- `kiko-wave.png` — welcome
- `kiko-success.png` — scan success
- `kiko-cooking.png` — recipe detail
- `kiko-grocery-list.png` — grocery list
- `kiko-celebrating.png` — saved/challenge

## How to Add to Xcode

1. In Xcode, open `Assets.xcassets` (created automatically with the project).
2. For each PNG, drag it in from Finder.
3. Set the name to match: `kiko-scanning`, `kiko-happy`, etc.
4. Set `Scales` to `Single Scale` since the PNGs are not @2x/@3x sets yet.

## Using in SwiftUI

```swift
Image("kiko-scanning")
    .resizable()
    .scaledToFit()
    .frame(width: 120, height: 120)
```

## App Icon

Not set up in this scaffold. Add an app icon set in `Assets.xcassets` → `AppIcon` before TestFlight.

## Colors

All UI colors are defined in `OkyoTheme.swift` — no color assets needed.
