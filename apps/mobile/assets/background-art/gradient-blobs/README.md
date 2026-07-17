# Gradient blob assets

Four transparent 384×384 WebP assets for the ambient Okyo screen background.

- Each asset uses two colors from `ambientColors` in `src/theme/okyoTheme.ts`.
- The alpha falloff is baked into the WebP, so the app never animates blur.
- Keep the rendered blob count at five or fewer per screen.
- Render at low opacity behind content and animate transforms only.
- The four files total roughly 60 KB.

The shapes use simple Figma-style radial and directional gradient stops, then
are rasterized locally to preserve clean transparent edges and predictable
mobile performance.
