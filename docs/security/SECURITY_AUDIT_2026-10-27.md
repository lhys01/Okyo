# Okyo security audit — October 27, 2026

**Outcome: repository fixes implemented; production release remains blocked.** No credentials were detected by the source, reachable-history, and inspected artifact scans. That is evidence about these scans, not a guarantee that every possible secret or vulnerability is absent. Dependency and production-readiness blockers are listed below. No deployment, credential rotation, Git-history rewrite, or secret-manager change was performed.

## Extracted prompt

> Perform a comprehensive security audit of the entire codebase, build pipeline, environment configuration, source maps, and production client-side bundles to ensure that no credentials, API keys, secrets, access tokens, private keys, database connection strings, or other sensitive information are ever embedded in or exposed to client-side code; move all sensitive operations and credentials to secure server-side services, replace exposed secrets with properly authenticated backend endpoints, and verify the final production artifacts are free of sensitive information before deployment.

## Scope and method

Reviewed the mobile Expo app, Express API, Astro website, waitlist service, Next.js screenshot editor, root dependency graph, CI configuration, release script, bundler settings, environment-variable references, authentication, ownership, database access, provider calls, error reporting, and static file serving. The source scanner includes tracked and nonignored untracked files, so existing work in this dirty workspace was included. Existing unrelated changes were preserved.

Scanned all 4,542 reachable historical Git blobs from the local clone, including deleted content. This covers refs available locally; it does not include unfetched remote refs, inaccessible forks, dangling objects, or another person's clone. Separate ignored agent worktrees, dependency source trees, and caches are outside the primary source-file inventory. Locally present dotenv files were inspected without displaying their values; the scanner uses private values as leak-detection inputs.

Built fresh production-mode Hermes bundles for both iOS and Android with inert public configuration and dotenv loading disabled. Scanned all 235 export files, fresh website output (136 files), and screenshot-editor public output (46 files). Also scanned 1,217 files across three pre-existing local `Okyo.app` builds, and the compiled API output. These pre-existing apps are historical artifacts, not newly signed releases.

Ran passive HTTP GET checks against the configured production API and public site. No authenticated production request, AI provider request, account deletion, paid operation, or mutation was used in this audit.

The adjacent evidence JSON records counts, tests, dependency advisories, passive HTTP results, and hashes of the fresh native bundles. Secret values, tokens, request bodies, and food-image payloads are excluded.

## Findings and implemented fixes

| Finding | Severity | Remediation and result |
| --- | --- | --- |
| Production AI endpoints accepted guests and silently treated invalid optional credentials as anonymous | High | Production scan, analysis, recipe generation, coaching, assistant, and correction routes now require the existing Clerk verification middleware. Auth runs before production dependency checks and provider work. Missing/malformed sessions return 401; unavailable verification fails closed. Local test/demo guests remain supported. |
| Production app flow depended on unauthenticated first scans | High, functional consequence of the auth fix | Both onboarding and the main navigator now require a session in release builds. Existing Apple/Google sign-in is reused, skipping is disabled for required sessions, and missing Clerk support cannot bypass the gate. Development retains its optional auth flow. **Sign-in now precedes production onboarding.** |
| Private experiment-admin email membership was supplied through an Expo public variable | Medium | Removed the automatic client email allowlist. Added authenticated `GET /v1/account/capabilities`; the backend compares the verified Clerk subject against server-only `OKYO_EXPERIMENT_ADMIN_USER_IDS`. Settings fetches only a boolean capability, requires the same signed-in user, and fails closed on errors. Experiment controls remain development-only. Existing explicit-list helper behavior is retained for compatibility. |
| Public environment validation did not reject backend credentials | High preventive control | Release validation now rejects secret/private/token/database/admin-email variables and unknown public key names. It also rejects recognizable backend credentials even under otherwise permitted public variable names. Failure messages identify variable names without echoing values. |
| No repository-wide credential or final-artifact gate | High preventive control | Added dependency-free scanning for source, reachable Git history, local secret values, client/server boundary violations, public variable names, private files, source maps, and final artifacts. CI runs source/history tests and builds/scans public and native outputs. Website/editor builds scan their public output, and the iOS release script scans before preflight and after archive generation. |
| API responses could enter intermediary caches | Medium | Added `Cache-Control: no-store` across API responses and removed `X-Powered-By`. Production validation logs redact arbitrary strings, unmatched errors avoid logging raw URL paths, and production recipe-validation errors no longer return provider diagnostics. |
| Static website server would serve arbitrary files in its output directory | High if a private file were misplaced | File serving now allows only declared public extensions, rejects dotfiles/maps/private formats, and verifies canonical paths to prevent symlink escapes. Regression tests put private files in a temporary public directory and verify 404 responses. |
| Local screenshot-editor write APIs relied on loose origin/media-type checks and parsed unbounded JSON | High if exposed | Dev/start commands bind to loopback. Reads and writes reject nonlocal/rebinding hostnames; writes require the exact same origin and exact JSON media type. Actual request streams are bounded before parsing (project 5 MiB, image 12 MiB, font 24 MiB). File-system errors return generic messages. This tool is intentionally local; remote hosting would require a separate authenticated service. |
| Vulnerable dependency versions, including critical findings | High / Critical | Updated compatible dependencies and lockfiles; migrated API Zod to 4.6.7 and screenshot-editor Next.js to 16.4.3. Adapted record schemas, parsing defaults, issue paths, schema-introspection tests, and two uncovered correction-array normalizers. API, website, and editor now have zero reported npm advisories. Remaining root/Expo issues are described below. |
| Mutable GitHub Action tags and incomplete app coverage | Medium preventive control | Pinned checkout/setup-node actions to their resolved v4 commit SHAs; kept read-only repository permissions. Added source/history checks, web/editor build scans and audits, native exports with a random backend-only canary, waitlist tests, and root dependency auditing. No repository secrets are needed for the audit jobs. |

## Existing controls verified in code

- OpenRouter vision, generation, enrichment, provider credentials, account deletion, Apple private-key operations, RevenueCat administrative calls, database connections, and quota HMAC keys reside in the API or local maintenance scripts. No new provider proxy was necessary.
- Client configuration uses public Clerk publishable keys, RevenueCat SDK keys, public analytics ingestion keys, and optional public Sentry DSNs. These identifiers are designed to be public and do not replace authorization. Supabase `anon` tokens are treated as public only when the decoded role is `anon`; service-role tokens are rejected by the scanner.
- Clerk authentication derives the account subject from a verified session; protected routes do not select a user from request-supplied IDs. Production requires live Clerk configuration and explicit authorized parties.
- Production temporary recipe/analysis storage is owner scoped. SQL uses parameters, private-schema migrations revoke public access, and connection initialization requires verified public TLS or explicit private-network transport. Actual deployed database grants were not inspected.
- AI calls already have model restrictions, request limits, concurrency limits, shared production quotas, deadlines, and disabled-provider failure states. These controls are retained.
- Photo uploads are size bounded; persistent runtime serialization removes image and credential fields. Failed real scans do not fall back to a demo meal.
- Mobile session tokens use the device keychain rather than AsyncStorage. Crash events are rebuilt from permitted metadata and exclude private exception messages, request bodies, and breadcrumbs.
- Waitlist exports/deletion use a server-side bearer secret with constant-time comparison; CSV cells are escaped, SQL is parameterized, and the admin UI does not embed its export token. Its Docker build context excludes dotenv files.

## Scanner policy and limitations

Run `npm run security:audit`, `npm run security:history`, and `npm run security:artifacts -- <output-directory> ...` from the repository root. `npm run test:security` checks scanner behavior plus local-editor and public-server boundaries.

The scanner emits only rule names, file locations, and historical object IDs. It compares known private values from the local/build environment and dotenv files, and detects common provider keys, private keys, credentialed database URLs, bearer-shaped JWTs, and hardcoded credential assignments. Unknown opaque credentials may require adding the corresponding environment variable or detector. Scans do not contact providers or validate whether a discovered value is still active.

Artifact scanning is recursive and includes binary/Hermes, UTF-16, gzip, and Brotli content, with overlap across stream chunks. Missing/empty outputs, unextractable package inputs, symlinks, private files, nonempty source maps, and inline source maps fail the gate. Extract IPA/APK/AAB/ZIP archives before supplying their payload directory. Public maps are disabled in bundler configuration. The sole permitted map structure is Turbopack's empty `{version: 3, sources: [], sections: []}` container, which contains no source or path data.

Native `assets/node_modules` folders contain legitimate packaged icons/fonts and are scanned normally. Apple's required `Okyo.app/embedded.mobileprovision` is permitted as a public signing profile; signing private keys, keystores, and `.p12` files remain forbidden. dSYM files may contain private source paths and must be kept in restricted symbol storage, outside public hosting. A source map or dSYM must never be used as a place to keep a secret, even when privately uploaded.

This is an automated/static audit with targeted runtime checks. It does not prove the absence of arbitrary encoded/obfuscated secrets, text rendered into images, memory disclosures, business-logic exploits, or every possible dependency vulnerability. It does not inspect remote secret-manager permissions, CI organization settings, signing-key custody, deployed source-map access policies, or App Store binaries not present locally. Client bundles use inert build configuration; the actual release configuration and exact signed archive must pass again before distribution.

## Validation

| Check | Result |
| --- | --- |
| Security scanner/editor/static-server regression tests | 14 passed |
| API TypeScript and test suite | Typecheck passed; 280 tests passed |
| Mobile TypeScript and test suite | Typecheck passed; 1,636 tests passed |
| Waitlist tests | 5 passed |
| Website build, Astro check, publication tests | Build passed; 0 diagnostics; 3 tests passed |
| Screenshot-editor production build and TypeScript | Passed, public artifact scan passed |
| iOS and Android production Hermes exports | Built; 235 files scanned, no findings |
| Website artifacts | 136 files scanned, no findings |
| Screenshot-editor public/static artifacts | 46 files scanned, no findings |
| Three existing local app builds | 1,217 files scanned, no findings |
| Reachable history | 4,542 blobs scanned, no findings |
| Source/environment and API artifact scans | Compiled API: 136 files, no findings; final source count in evidence |
| Diff whitespace check on edited files | Passed |

## Remaining release blockers

1. **Dependency advisories remain.** The root graph still reports one high-severity `image-size` advisory through the root React Native/Metro installation. Its patched major version removes file-path APIs used by that Metro version, so it was not forced into the graph. Mobile reports 10 affected packages: 3 high and 7 low, principally Expo CLI's Zod 3 and Expo/deepmerge dependencies. These are npm's propagated package counts, not 10 independent vulnerabilities. A coordinated supported Expo/React Native tooling upgrade is required. CI continues to fail on high/critical advisories; no blanket suppression was added. Use trusted local build inputs while this work remains open.
2. **Actual release environment is incomplete.** The existing full mobile release preflight rejects missing/invalid live Clerk and RevenueCat iOS production configuration. Configure public SDK identifiers in the mobile release environment and private service credentials only in the API secret manager. Existing legal and collected-data reviews are unapproved, so a new submission archive was not built. These approval records were left untouched.
3. **Deployment is not ready.** Passive checks returned API `/health` 200, `/ready` 503, and production `/debug/ai-config` and `/internal/metrics` 404 without credentials. The deployed responses do not yet have all locally added headers. The public website root, `/.env`, and `/.git/config` returned 404. No sampled response matched the credential detectors, but no production website bundle could be retrieved from that root. Apply configuration and deploy the reviewed changes through the gated pipeline before repeating deployment checks.
4. **Exact release artifacts require another gate.** Fresh native exports and existing app copies were scanned; a new signed archive, final IPA/APK/AAB, and deployed CDN files were not certified. Run the iOS release script with complete configuration/approvals, extract the final installable package when applicable, and scan that exact payload. Re-scan after any environment change or artifact transformation.
5. **Development admin configuration must migrate.** Set server-only `OKYO_EXPERIMENT_ADMIN_USER_IDS` to the appropriate verified Clerk subjects. Remove the old public admin-email variable from local/remote build environments. The development UI stays hidden until the authenticated capability response grants access.

No active credential leak was established, so no credential was rotated or revoked. If any separate source, old remote ref, public artifact, or provider audit log establishes a leak, revoke the affected credential at its issuer, replace it in the server secret manager, rebuild affected clients, and rescan. Removing a value from current source cannot revoke an already exposed credential.

## Files changed for this audit

- Root: `.gitignore`, `package.json`, `package-lock.json`, `.github/workflows/quality.yml`; `scripts/security/audit.mjs`, `audit.test.mjs`, `editor.test.mjs`, `public-server.test.mjs`; this report and its evidence JSON.
- API: `.env.example`, `package.json`, `package-lock.json`; `src/server.ts`, `src/server.production.test.ts`; `src/middleware/requireAuthenticatedUser.ts`, its tests, and `operationalSafety.ts`; `src/services/accountCapabilities.ts` and its tests, `aiService.ts`, `openRouterProvider.ts`, and `openRouterProvider.recipe.test.ts`.
- Mobile: `.env.example`, `package-lock.json`; `scripts/build-ios-release.sh`; `src/api/client.ts`, its tests, `releaseEnvironment.ts`, and its tests; `src/auth/AuthGate.tsx`, `authGateDecision.ts`, `auth.test.ts`; `src/navigation/AppNavigator.tsx`; `src/onboarding-v3/state/onboardingExperimentAdmin.ts`; `src/screens/SettingsScreen.tsx` and `settingsScreen.test.ts`.
- Website: `astro.config.mjs`, `package.json`, `package-lock.json`, `scripts/serve-public-site.mjs`.
- Screenshot editor: `next.config.mjs`, `package.json`, new `package-lock.json`, `src/lib/request-guard.ts`, and `src/app/api/{project,upload,upload-font}/route.ts`.

Several listed files already had uncommitted changes before this task. This list identifies files touched during the audit, not sole authorship of their complete diffs. Existing artwork and unrelated application changes were not intentionally edited.

## Manual verification before release

1. With live production public SDK configuration, cold-launch a release build, complete Apple/Google sign-in, finish onboarding, and scan a food image. Sign out and confirm protected flows require sign-in again. Confirm authentication failure shows a useful sign-in state rather than a fabricated recipe.
2. Confirm signed-in scan → analysis → recipe → ask/correct/coaching works, retry/loading behavior survives failures, and a different account cannot fetch another account's temporary results or saved recipes.
3. Request each protected API endpoint without a bearer token and with an invalid/expired token. Expect 401 or an authentication-unavailable response, no provider request, no successful private response, and `Cache-Control: no-store`. Verify a valid session for an unapproved authorized party is rejected.
4. Configure an allowed development admin subject and confirm only that signed-in development account sees experiment controls. Switch accounts and sign out; controls must disappear. Production never shows these controls.
5. Open the local screenshot editor, save a project, upload an image and font, and export a marketing image. Confirm another origin/port and oversized uploads are rejected without changing files.
6. Run the commands above and all release preflights against actual release configuration. Resolve dependency blockers, approve the exact legal/privacy declarations through the existing process, scan the final signed payload, and repeat passive deployment checks after deployment.

## References

- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/): `EXPO_PUBLIC_*` values are embedded in client code and must not carry secrets.
- [OWASP secrets management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html): credential storage, access, and rotation practices.
- Exact remaining advisory URLs and ranges are included in the evidence JSON from `npm audit`.
