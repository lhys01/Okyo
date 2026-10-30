# Save Money icon audit

Audited 2026-09-19 for the two active Save Money question screens.

## Finding

`SaveMoneyBranchScreen.tsx` provided both an `icon` and `imageSource` for each
meal option. `SavingsOptionGrid` always renders `imageSource` first, bypassing
the shared `onboardingStickerIcons` renderer used by the recipe-priority
options. That made meal choices use an unguarded, separate asset path.

The identical rice fallback on the priority screen came from the previous
global `ResilientImage` default (`foodAssets.bowl`). The category-safe fallback
repair removes that global food fallback; the meal mapping repair removes the
separate direct-image override. Together, an icon load failure now receives a
bundled icon fallback and can never use food photography.

## Asset evidence

The five original meal assets remain present and distinct:

| Logical asset | File | SHA-256 prefix | Result |
| --- | --- | --- | --- |
| Breakfast | `meal-icons/iconbreakfast-transparent.png` | `b1fa71bf` | Breakfast sticker |
| Lunch | `meal-icons/iconlunch-transparent.png` | `489657da` | Sandwich-and-salad sticker |
| Dinner | `meal-icons/icondinner-transparent.png` | `6001c53f` | Dinner-plate sticker |
| Snacks | `meal-icons/iconsnacks-transparent.png` | `85d4f2ff` | Snack-yogurt sticker |
| It varies | `meal-icons/iconvaries-transparent.png` | `19c1416b` | Mixed-meal sticker |

Their files decode as transparent PNGs and have distinct hashes; no original
asset was overwritten. The priority icon assets are likewise distinct PNG
stickers and do not reference `assets/food/recipes`.

## Minimal repair

The five active meal rows now use their existing `stickerIcons` counterparts,
matching the stable priority-icon path. The shared renderer declares
`assetKind="icon"`, whose fallback is a bundled icon rather than food
photography. No option layout, selection behavior, persistence, calculations,
copy, or final-result markup changed as part of this icon repair.
