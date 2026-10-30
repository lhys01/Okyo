# Okyo app identity

`icon.png` is the authoritative approved green Kiko scanning icon. It is a fully
opaque 1024 × 1024 RGB PNG tagged sRGB. Its artwork pixels match the supplied
`Okyo_AppIcon_1024_Ready.png`; only color metadata was added during installation.
Do not add a corner mask, redesign the artwork, or edit a generated copy.

From `apps/mobile`:

```sh
npm run icons:generate
npm run icons:check
node scripts/sync-app-icons.mjs --native ios
node scripts/sync-app-icons.mjs --native android
```

The generator derives `favicon.png`, `adaptive-foreground.png`, and the screenshot
editor's `public/app-icon.png` from this master. Android padding keeps the full
square, including the scanner brackets, inside the adaptive icon's safe circle.
The website imports this master directly and generates its favicon, touch icon,
social preview, and header image through Astro.

`npm run ios` / `npm run android` check the source pipeline and refresh only native
icon and splash image resources before building. Native folders are ignored by
Git; future Expo prebuilds use `app.json`. The screenshot editor refreshes its
public icon before development and production builds. Release preflight also
checks the master and derivatives.

iOS uses a universal PNG with the system fallback for dark/tinted appearances.
There are no alternate app icons or Icon Composer assets. Android has no custom
monochrome variant. Do not reintroduce old appearance resources.

Splash screens intentionally use the existing transparent Kiko head on the
existing gradient, rather than the square launcher icon. Other approved mascot
illustrations are separate character artwork and must remain unchanged.

An icon change requires a new native build and reinstall/upload; an OTA JavaScript
update cannot change an installed launcher icon. Existing simulator installs and
older binaries may still show their bundled historical icon until replaced.

See `docs/audits/APP_ICON_MIGRATION_2026-10-25.md` at the repository root for the
asset audit, verification results, App Store replacement files, and remaining
external release steps.
