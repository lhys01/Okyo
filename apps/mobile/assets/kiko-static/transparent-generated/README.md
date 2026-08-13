# Approved Kiko transparent derivatives

These PNGs are alpha-only derivatives of the approved artwork in the parent
`kiko-static` directory. The originals remain untouched. No mascot was drawn,
generated, or reinterpreted.

| Derived asset | Approved source |
| --- | --- |
| `kiko-wave.png` | `ec041431-c9cf-47fa-be98-d878c23d299a.png` |
| `kiko-happy.png` | `7a66978e-3804-40e0-98d8-49fa14892b32.png` |
| `kiko-thinking.png` | `7030013a-09f8-469e-9e0c-42b20f478a21.png` |
| `kiko-scanning.png` | `384183e9-8ebb-4d77-9c80-afae5aed6102.png` |
| `kiko-celebrating.png` | `2a6be0ee-fc9c-4764-a9a6-4b986e7abe58.png` |
| `kiko-success.png` | `c279b3db-0645-4378-b1a7-91e9628f1079.png` |

Run `python3 scripts/derive_kiko_transparency.py` from `apps/mobile` to
reproduce them. The script estimates the baked border color, removes only the
connected exterior background, preserves enclosed pale character details and
the original floor glow, and decontaminates soft edge pixels to prevent cream
halos.

