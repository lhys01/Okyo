# Known Risks

## Purpose
Real, currently-verifiable risks in this repo. Each was checked against the working tree on 2026-07-03.

## Source Files Inspected
`git ls-files` output, `.gitignore`, `apps/mobile/package.json`, `apps/api/src/config/costControlConfig.ts`, `README.md`, `docs/wiki/KNOWN_ISSUES.md`, asset directory sizes.

## Current Risks

### 1. Generated/runtime files are committed (verified)
A prior checkpoint commit ("checkpoint before installing claude-mem") swept in files that should never be tracked:
- `.swarm/memory.db`, `.swarm/memory.db-shm`, `.swarm/memory.db-wal` (runtime SQLite)
- `ruvector.db` (runtime vector DB)
- 39 `__pycache__/*.pyc` files inside skill mirrors
- ~346 files under generated skill-mirror dirs (`.agent/`, `.codebuddy/`, `.continue/`, etc.)
- `docs/generated/` screen PNGs (~13 MB)

Risk: churn in every diff, repo bloat, accidental runtime-state commits. Cleanup (git rm --cached + .gitignore entries) should be its own deliberate commit — do not bundle it into feature work.

### 2. Mobile dependency fragility
Expo SDK 55 + React 19.2 + RN 0.83 with exact-pinned native deps (skia `2.4.18`, view-shot `4.0.3`). No active ERESOLVE conflict is documented today, but casual bumps break the simulator build, and Expo Go can't run the app at all — simulator only.

### 3. Fable cost exposure if misconfigured
Fable is ~60-80× gpt-4o-mini per request. Protection is the double gate + hard cap of 10/day ([FABLE_ROUTING.md](./FABLE_ROUTING.md)) — but the cap counter is in-memory, so repeated server restarts reset it. Never deploy with `FABLE_ENABLED=true` on a public endpoint.

### 4. Silent model fallback risk
`getRecipeModelChain()` is the single guard keeping Fable fail-closed. Any future edit that appends fallback models unconditionally, or bypasses the chain, silently reintroduces Gemini fallback for Fable requests. Review this function on every AI-routing change.

### 5. Image ownership/licensing
Recipe images come from Pexels via `scripts/download-food-images.sh`; bundled placeholder art provenance is untracked. Verify license compliance before App Store submission ([IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md)).

### 6. Large asset footprint
`apps/mobile/assets` ≈ 51 MB (bundled PNGs), `docs/generated` ≈ 13 MB. Slows installs/clones and bloats the app bundle; audit before release.

### 7. Documentation drift in root README
`README.md` references `/Users/rober/Documents/Okyo-1` (repo now at `/Users/rober/Desktop/Okyo-1`) and says no real AI provider is wired ("fake-data V1") — the AI pipeline has since been fully built. Trust `docs/wiki/` over the root README until it is refreshed.

### 8. No automated tests
`*.test.ts` files exist but no runner is configured; typecheck is the only gate ([TESTING_AND_VALIDATION.md](./TESTING_AND_VALIDATION.md)).

### 9. In-memory server state
Caps, caches, saved library, coaching store all reset on API restart — fine for dev, blocking for public beta ([COST_CONTROLS.md](./COST_CONTROLS.md)).

## Related Docs
[SECURITY.md](./SECURITY.md) · [COST_CONTROLS.md](./COST_CONTROLS.md) · [CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md) · legacy [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)
