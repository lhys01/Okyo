# Contributor Guide

## Purpose
Give rules for future agents and human contributors working in Okyo.

## Source Files Inspected
- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `docs/wiki/README.md`
- `.gitignore`
- `apps/api/.env.example`
- `apps/mobile/.env.example`

## Current Behavior
Start every task by reading `CLAUDE.md`, then route into this wiki for details. Use `AGENTS.md` for full repository-level coding rules. Make small, reviewable changes that match current app patterns.

Rules:
- Read `CLAUDE.md` first.
- Use `docs/wiki` as the source of truth for current behavior.
- Inspect code before writing claims or changing behavior.
- Make small commits only when explicitly asked.
- Run validation relevant to the touched area.
- Do not change model defaults casually.
- Do not expose secrets.
- Avoid generated/runtime files.
- Update docs when behavior changes.
- Keep UI cute, clean, simple, friendly, modern, and food-focused.
- Keep AI outputs honest and retry-friendly.

## Important Constraints
- Do not commit `.env` files, raw base64 payloads, logs with secrets, dependency folders, generated native folders, `.swarm/`, or `ruvector.db`.
- Do not show unrelated mock recipes for failed real uploads.
- Do not add public Fable controls without explicit product approval.
- Do not delete existing features unless asked.

## Known Risks or Edge Cases
- Some existing docs are stale; prefer the new wiki plus inspected code.
- The repo contains many product/audit docs, so avoid broad rewrites outside the requested area.
- Parallel agents may touch nearby files; check git status before and after work.

## Related Docs
- [README.md](./README.md)
- [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)
- [TESTING_AND_VALIDATION.md](./TESTING_AND_VALIDATION.md)
- [KNOWN_RISKS.md](./KNOWN_RISKS.md)
