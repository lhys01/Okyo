# Textures

Design-first assets (see CLAUDE.md → Design-First Asset Workflow).

## linen-warm.png

- **Use:** full-screen backdrop on `GroceryListScreen` (via `ImageBackground`, `resizeMode="repeat"`), giving the list a warm kitchen-paper feel instead of a flat canvas.
- **Look:** `colors.background` ivory (#faf7f0) with a near-invisible woven grain in `colors.border`/`creamDeep` tones. Must stay subtle — material, never pattern.
- **Provenance:** authored as vector art and rasterized locally (Draw Things / ComfyUI were unavailable at creation, July 2026). Safe to regenerate with Draw Things at 1024×1024; keep the same filename and the same near-invisible contrast so text on top stays AA-readable.
