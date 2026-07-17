---
name: okyo-local-run
description: Run, smoke-test, or debug the Okyo API, Expo app, simulator, Metro, ports, environment URLs, and local end-to-end flow.
---

# Okyo local run

Read `README.md` and `docs/TESTING.md`. Resolve the checkout with `git rev-parse --show-toplevel`; never hardcode an old machine path.

## Start the stack

```bash
cd apps/api && npm run dev
cd apps/mobile && npm run sim
```

The API defaults to port 8081 and Expo uses port 8082. Check existing listeners before restarting services. A physical phone cannot reach the development machine through `localhost`; configure a reachable LAN or HTTPS URL.

## Verify

1. Request `/health`.
2. Launch the app and reach hero → scan.
3. Exercise the narrow flow relevant to the change.
4. Confirm real failures do not become demo results.
5. Run both typechecks, tests, and the appropriate Expo export.

Use `npm run sim` before manual cache deletion. Do not invent scripts or environment names; inspect both package manifests and app-specific `.env.example` files. Report simulator/device, mocked/live services, and blocked external checks separately.
