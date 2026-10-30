# Okyo Auth Setup — Clerk with email/password, Apple, and Google

All app code is already written. Auth stays **completely dormant** until
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is set — until then the app behaves
exactly as it did before, with no sign-in screen.

The existing Clerk application is linked to this repo (`app_3Jx1VyUHYna7UoNwDbfpyCIzDEQ`). Do not create a second application.

---

## Step 1 — Clerk (~5 min, free)

1. In the Clerk Dashboard, open the linked Okyo application.
2. Under **Native applications**, enable the **Native API** and register both platforms. The app identifiers currently in `apps/mobile/app.json` are iOS `com.rober.okyo` and Android `com.anonymous.okyo`.
3. Enable **Google** for sign-up and sign-in. Google is already configured in
   Clerk Production with the app's OAuth credentials.
4. Under **Email, Phone, Username**, enable email address, require it, verify it
   at sign-up with an email code, and use it as a first factor. Keep both
   **Sign-up with password** and **Add password to account** enabled. Production
   currently requires at least 15 characters. Phone, username, passkeys, and
   other unused methods can stay off.
5. Apple sign-in is wired into the app but is not enabled in Clerk Production
   yet. Clerk requires the Apple Services ID, private key, Team ID, and Key ID
   from Apple Developer before the Production connection can be enabled.
6. **Configure → API keys →** copy the **Publishable key** (`pk_live_…`).
6. Put it in `apps/mobile/.env.local`:

   ```
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
   ```

**Never** put the Secret key (`sk_…`) in `apps/mobile`. It belongs on a server
only. If one ever lands in the app, rotate it immediately.

Email/password and Google sign-in/sign-up are available in Production after
Native API setup. Apple requires the credential setup above before it works.

The Clerk CLI linked the application from the repository root and wrote its
environment values to the root `.env` file. Keep that file ignored and local;
never copy its secret value into the mobile package.

---

## Step 2 — Sign in with Apple (native iOS flow)

The current mobile implementation uses Clerk Expo's native
`useSignInWithApple()` hook (`@clerk/expo/apple`) with the iOS Apple
Authentication capability. It does not open a browser or use an OAuth
redirect.

For each Clerk environment used by the native app:

1. In Clerk **Native applications**, register the iOS App ID Prefix / Team ID
   and bundle ID `com.rober.okyo`.
2. In that same Clerk environment, enter the Apple Services ID, private key,
   Team ID, and Key ID from Apple Developer, then enable Apple for both
   sign-up and sign-in. Clerk's Production connection is currently disabled
   because these values are not configured. The mobile app uses the native
   Apple authentication hook, but Clerk still needs its provider credentials.
   Never put the private key in the mobile app or repository.
3. Keep `expo-apple-authentication`, `expo-crypto`, the
   `expo-apple-authentication` config plugin, and the iOS Sign in with Apple
   capability in the native build. Rebuild the development client after native
   configuration changes.
4. Test on a physical iPhone before release; simulator support is limited and
   requires an Apple Account signed into the simulator.

The Services ID and key satisfy Clerk's Production provider configuration;
they do not replace the native iOS application registration or entitlement.

---

## Step 3 — Google

Google is enabled in Clerk Production for both sign-up and sign-in, using
Okyo's Production OAuth credentials. Do not create another Google project or
replace those credentials. The app opens the system browser and returns through
`okyo://continue`; verify that callback on the physical-device test build.

---

## Step 4 — Run it

```bash
cd apps/mobile && npx expo start --ios --clear
```

Complete onboarding; the account screen offers email/password, Apple, and
Google. Email sign-up requires an emailed verification code; password reset
also uses an email code. Apple remains unavailable until Step 2 is complete.
The app continues only after Clerk confirms a new sign-in session, or after
the user explicitly chooses to continue with an already signed-in account.

> Sign in with Apple can fail in the iOS Simulator depending on configuration
> — test it on a physical device.

## API secrets and production authorized parties

Set `CLERK_SECRET_KEY` only in the API deployment's secret manager. The API
requires `CLERK_AUTHORIZED_PARTIES` in production. Railway currently allows
the registered native origin `okyo://`; the API validates that configuration
and protected routes fail closed without a valid Clerk session. During the
physical-iPhone test, inspect the real Production session token's `azp` claim
without recording the token itself. If Clerk emits a different non-empty
authorized party, replace the Railway value with that exact origin. Never use
wildcards.

---

## How it behaves

| Situation | Result |
|---|---|
| No Clerk key set | No sign-in screen; app unchanged |
| Onboarding not finished | Auth never interrupts it |
| Finished onboarding, signed out, not yet asked | Sign-in screen shows once |
| Taps "Maybe later" | Goes straight to the app; re-openable later from **Settings → Sign in** |
| Already signed in at the account step | Sees an explicit choice to continue with that account or sign out and choose another |
| Signed in, reopens app | Session restored from keychain |
| Signs out in Settings | Session cleared; not re-prompted, but **Settings → Sign in** reappears |
| Session expires | Treated as signed out; sign back in from **Settings → Sign in** |
| Offline during sign-in | "You're offline. Reconnect and try again." — stays on the screen |
| Cancels the Apple/Google sheet | Returns to the account screen with a retry message |

## Where things live

| File | Role |
|---|---|
| `src/auth/authStrategies.ts` | The Apple+Google OAuth allowlist; email/password uses a separate Clerk form |
| `src/auth/authGateDecision.ts` | Pure decision logic for the one-time gate (unit tested) |
| `src/auth/AuthGate.tsx` | Renders sign-in vs app, once, after onboarding |
| `src/auth/SignInScreen.tsx` | The screen itself (also mounted as a sheet from Settings) |
| `src/auth/useOkyoAuth.ts` | Read-only auth snapshot for normal screens (e.g. Settings) |
| `src/auth/clerkTokenCache.ts` | Session token → device keychain |
| `src/auth/clerkRuntime.ts` | Lazy/guarded Clerk load + `completePendingAuthSession()` (closes the OAuth browser tab on redirect) |
| `src/auth/authPromptPersistence.ts` | "Have we asked?" flag |
| `src/auth/OkyoAuthProvider.tsx` | Clerk provider + key validation; runs `completePendingAuthSession()` at module load |

## Current data behavior

Recipes, savings, XP and grocery lists in the app remain on the device and do
not sync to a new install. The API has Clerk-verified protected routes for its
library, savings, challenges, XP and account deletion endpoints; its current
store is in-memory and is not production persistence. The mobile client sends a
Clerk bearer token for authenticated library access and account deletion.

## Future: "sign in on another phone and get my data back"

Not built. Durable API persistence and local↔cloud sync are still required:

1. **Per-user database.** Replace the in-memory arrays in `apps/api/src/store.ts`
   with a real store (Postgres) keyed by `user_id`: `recipes`, `grocery_lists`,
   `saved_savings`, `xp_events`, `completed_meals`. One row-owner column,
   every query scoped to `req.userId`.
2. **Sync endpoints.** `GET /v1/me/state` (everything for this user) and
   `PUT /v1/me/state` (or granular per-entity upserts) with an
   `updatedAt` per record.
3. **Local↔cloud merge on sign-in.** On first sign-in of a device that has
   local data: push local records the server doesn't have, pull server
   records the device doesn't have, and for genuine conflicts take
   last-write-wins by `updatedAt` (recipes are append-mostly, so real
   conflicts are rare). Never delete local data on sign-in.
4. **Anonymous → identified handoff.** Before sign-in, data is under a local
   anon id. On sign-in, tag those local records with the Clerk `sub` and
   push them; keep a local `migratedAt` marker so it runs once.
5. **Offline-first.** Local store stays the source of truth for reads; sync
   is a background reconciliation, not a blocking load.

## Security notes

- Session tokens go to the **device keychain** (`expo-secure-store`), never
  AsyncStorage. A leaked session token is a full account takeover.
- The prompt flag stores only `'true'` — never identity, never a token, and it
  is never used as an auth check. Whether a user is signed in always comes
  from Clerk's live session.
- Raw provider errors are never shown to users; they're logged via `uiLog`
  and surfaced as a friendly retry message.
- Every failure path (locked keychain, storage error) fails toward
  **signed out**, never toward falsely-authenticated.
