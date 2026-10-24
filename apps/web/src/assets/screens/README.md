# Actual app screenshots

Captured October 23, 2026 from the running Okyo development build on the dedicated
Okyo Website Screenshots iPhone 17 Pro simulator, iOS 26.5. Mobile source:
`/Users/rober/Desktop/Okyo-1/apps/mobile`. These are actual UI captures,
not generated artwork or release-build certification. Status bar: 9:41.
No personal account was signed in.

- home.png: first-dish Home state with macros and meal ideas.
- scan.png: Add a dish options sheet.
- recipe.png: built-in Sheet-Pan Lemon Chicken with estimated pricing.
- customize.png: actual change input and suggestions, before submission.
- cook.png: first guided cooking step for the built-in recipe.

## Nutrition screenshot

nutrition.png shows the existing saved Lighter Pan-fried Dumplings recipe, rendered
in the current app on the same dedicated simulator. Its original estimate is
226 calories, 18 g protein, 25 g carbohydrates and 6 g fat per serving. The existing
recipe was copied from the original simulator into the dedicated QA install for
capture. No nutrition values were invented or edited. Its old image was no longer
available; the app correctly renders the recipe text and nutrition cards without it.

## Refresh

Inspect the desired screen for private information, then capture using
`xcrun simctl io <device-id> screenshot <absolute-output-path>`.
Keep device, light appearance, and clean status bar consistent. Replace the file
and run `npm run check`, `npm test`, and `npm run check:launch` in apps/web.
Verify all screenshots against the release build before launch.
