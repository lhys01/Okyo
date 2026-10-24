# Okyo website (`apps/web`)

Static marketing and legal site for okyoapp.com, built with [Astro](https://astro.build).
It is separate from the mobile app (`apps/mobile`) and API (`apps/api`): it has its own
`package.json` and no analytics. Only the waitlist form makes an API call, to the standalone
`apps/waitlist` service. Build with `PUBLIC_WAITLIST_API_URL=https://<waitlist-domain>/api/waitlist`.
The local preview uses port 4392 automatically; start the service with `npm start` in `apps/waitlist`.
The export secret stays on the server and is never included in the website.

> **Not ready to launch.** Terms and the legal entity still need review. All six image slots
> use real app captures. Production waitlist storage also needs to be configured. `npm run check:launch` lists every blocker.
> Do not deploy or connect a domain until it passes and hosting has been chosen.

## Commands

Run from `apps/web` with Node 22.

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies (first time only) |
| `npm run dev` | Local dev server with live reload |
| `npm run build` | Build the static site into `dist/` |
| `npm run check` | Type-check Astro and TypeScript files |
| `npm test` | Build, then run the Playwright + axe test suite |
| `SCREENSHOTS=1 npx playwright test screenshots` | Save review screenshots to `test-results/screens/` |
| `npm run sync:legal` | Re-copy the legal drafts from `docs/legal/` |
| `npm run check:launch` | Launch gate. Fails while drafts or placeholders remain |

## Where things live

- `src/pages/`: one file per route (`/`, `/privacy`, `/terms`, `/support`, `/delete-account`, 404).
- `src/config/site.ts`: support email, legal entity placeholder, footer links.
- `src/config/screenshots.ts`: screenshot slots. Add release-build screenshots here.
- `src/config/supportFaq.ts`: support answers, copied from the in-app Help screen.
- `src/styles/tokens.css`: design tokens copied from `apps/mobile/src/theme/okyoTheme.ts`.
- `src/legal-drafts/`: generated copies of `docs/legal/` drafts. Don't edit by hand.
- `src/assets/brand/`: app icon and Kiko images, copied from `apps/mobile/assets/`.

## Before launch

1. Replace the legal drafts with counsel-approved text, and switch the pages away from the
   `LegalDraft` layout (which forces noindex and the draft banner).
2. Set the legal entity in `src/config/site.ts`.
3. Recheck the six actual app captures in `src/config/screenshots.ts` against the release build.
4. Settle the email deletion process on `/delete-account`.
5. Confirm ownership of the Kiko mascot and app icon.
6. Choose hosting. The build output is plain static files in `dist/` (pages are `*.html`;
   the host must serve `/privacy` from `privacy.html`, "clean URLs").

## Waitlist

Every Coming soon badge has a Join the waitlist button. It opens the same accessible
first-name/email form with explicit permission, loading, retry and saved states. See
[waitlist setup and CSV export](../waitlist/README.md). Publish only after its storage
URL is configured and the existing launch blockers are resolved.
