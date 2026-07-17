---
name: okyo-kiko-system
description: Use Kiko consistently when changing mascot poses, motion, copy, onboarding emotion, cooking guidance, empty states, or reward moments.
---

# Okyo Kiko system

Treat Kiko as a product guide, not decoration.

## Implementation

- Use `apps/mobile/src/components/KikoMascot.tsx` as the only mascot component.
- Register approved static poses through `apps/mobile/assets/mascot/index.ts`.
- Keep unknown poses safely mapped to the default pose.
- Keep motion subtle and native-driven.
- Honor `AccessibilityInfo.isReduceMotionEnabled`; every moment must work statically.
- Check `apps/mobile/assets/mascot/README.md` before adding or replacing artwork.

## Emotional rules

- Celebrate real scans, saves, grocery exports, cooking completion, and sharing.
- Use a calm thinking/default pose for failure and invite retry.
- Guide onboarding without blocking the first scan.
- Never use Kiko for guilt, fake urgency, fabricated rewards, or purchase pressure.
- Omit Kiko when a screen has no emotional beat.

Do not recreate Kiko with emoji, SVG, gradients, or view primitives. Document provenance and intended use for new art, register it once, run the Kiko asset test, and manually verify Reduce Motion.
