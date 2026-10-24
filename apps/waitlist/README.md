# Okyo launch waitlist

Standalone Node 22 service. No app API, AI provider, email service, or package dependencies.
Signups persist in SQLite. In production, attach a Railway volume at `/data` and run one replica.

## Local

Run `npm start` here. The service listens on 4392; the website preview on 4391 uses it automatically.
Local entries live in ignored `data/`. Run `npm test` for durability, validation, export and abuse checks.

## Railway setup

Create an `okyo-waitlist` service in the existing Okyo project. Attach a volume at `/data`
and deploy **this directory**. Its Dockerfile uses official Node 22. Set:

- `WAITLIST_DATABASE_PATH=/data/waitlist.sqlite`
- `WAITLIST_ADMIN_TOKEN`: random secret, at least 32 characters. Store only in Railway Variables
  and your password manager; never include it in the website or source.
- `WAITLIST_ALLOWED_ORIGINS=https://okyoapp.com,https://www.okyoapp.com`
  plus the actual preview origin when needed.
- `TRUST_PROXY=1` behind Railway's edge. Leave unset when running directly.

Generate a Railway HTTPS domain. Build apps/web with
`PUBLIC_WAITLIST_API_URL=https://<service-domain>/api/waitlist`.
Only the public endpoint is included in the website. Rebuild when it changes.
GET `/health` checks database access. Configure volume backups before collecting real signups.
Preserve the volume on redeploy; never scale this SQLite service beyond one replica.

## Download the list

Open `https://<service-domain>/admin`. Copy WAITLIST_ADMIN_TOKEN from the service's Railway
Variables into **Export key**, then press **Download CSV**. The file includes first names,
emails, signup times and permission version. The key is not stored in the browser or in URLs.

This service sends no emails. Import the CSV into your email tool when you are ready to launch.

## Remove a signup on request

POST `/admin/delete` with JSON `{ "email": "person@example.com" }` and header
`Authorization: Bearer <WAITLIST_ADMIN_TOKEN>`. Keep the token out of logs and shell history.
Remove their record from any exported copies too. Form and privacy page direct requests to support.

## Data handling

Only first name, normalized email, signup time, and launch-notification permission version are
stored. Request bodies are never logged. IPs are used only in expiring memory for rate limiting.
Duplicates succeed without revealing membership or replacing an existing name. CSV export is
protected and formula-safe. Keep the list only through launch follow-up or until removal is requested.
