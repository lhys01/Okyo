# Okyo website DNS and publication handoff

Status: website service and custom-domain registrations prepared; DNS edits blocked by unavailable Name.com access. The website is **not deployed** and public HTTPS is **not verified**.

## Verified cause

`okyoapp.com` is delegated to `ns1bqx.name.com`, `ns2bls.name.com`, `ns3qty.name.com`, and `ns4fpy.name.com`. Public and authoritative queries show no website A/AAAA/CNAME answer at the root. `www.okyoapp.com` returns NXDOMAIN. The root zone exists; it lacks an address for the website. Waiting alone will not create the missing records.

No apex MX or TXT answers were returned in the inspected queries. That is not an inventory of every subdomain or a reason to change mail/verification records. No DNS or mail records were changed.

There was no existing website deployment in either connected Railway project. A dedicated empty **okyo-website** service was created in the existing project `okyo-api-development`, environment `production`:

- Project: `5a43309f-dedb-4e68-9f7c-dded6fbfc71a`
- Website service: `3ec3218a-d877-4ce6-8d0a-07724602a1c3`
- Target port: `8080`
- Deployments: **none**
- Registered custom domains: only `okyoapp.com` and `www.okyoapp.com`
- Certificates: waiting for domain ownership verification

The API, Postgres, Redis and all existing services were not changed. No GitHub auto-deployment source was attached to the website service.

## Missing access and exact place

The existing browser goes to the Name.com login form rather than authenticated DNS management. No usable Name.com API configuration was found in the scoped environment checks. Google sign-in was also checked; its available profile did not establish the correct domain owner, so account selection was left to the user. Sign in yourself at [Name.com](https://www.name.com/account/login); do not send a password, API secret or one-time code in chat. Then open **My Domains → okyoapp.com → Domain Actions → Manage DNS Records**, or the [specific DNS page](https://www.name.com/account/domain/details/okyoapp.com/dns). Once the authenticated session is available, these record additions can be completed automatically within the authorized scope.

## Exact records returned by the website host

Use the existing Name.com nameservers. Add only these website records, preserving other legitimate records. TTL `300` is suitable. The TXT values below are public DNS ownership proofs, not account credentials.

| Type | Host in Name.com | Answer |
| --- | --- | --- |
| **ANAME** | blank / `@` (root) | `cyhkgv8i.up.railway.app` |
| CNAME | `www` | `or99oyvb.up.railway.app` |
| TXT | `_railway-verify` | `railway-verify=1c2dd60daa19efb64100e61a33107e474e18a21c906c220749919d6651f127e4` |
| TXT | `_railway-verify.www` | `railway-verify=ac8277e1fe714928c2b879fdb90034fa102ea777ffc0719d060189ec40abe164` |

For the root, Name.com's ANAME implements the flattening Railway requires; do not substitute a bare CNAME or copy a temporary resolved IP into a permanent A record. Name.com documents [ANAME/alias records](https://cs.name.com/hc/en-us/articles/115010493967-Adding-an-ANAME-Alias-record). Railway requires both routing and ownership TXT records and provisions certificates after verification: [Railway custom domains](https://docs.railway.com/networking/domains/working-with-domains).

Do not add a Name.com URL-forwarding service: the prepared web server handles a single **308 redirect from www to the root**, preserving path/query. This allows HTTPS on both hostnames and avoids a forwarding loop. Local automated tests verify that behavior. Live TLS/redirect behavior cannot be attested until DNS and deployment are complete.

## Prepared publication

The local, secret-free deployment package is:

`apps/mobile/.artifacts/submission-followup-2026-10-25/website-publication-final`

It contains prebuilt Privacy, Terms, Support and Delete Account pages, their public assets, a minimal Okyo link hub, a dependency-free read-only static server and a Dockerfile running as an unprivileged user. Clean routes work without `.html`. It includes no API code, environment files, credentials, user database or live waitlist form. The existing marketing site and waitlist implementation remain in the repository; this package publishes only the legal/support surface needed for submission.

The four pages omit launch-campaign/“Coming soon” controls and unconfigured waitlist forms. The legal-only privacy page does not claim it collects website waitlist entries. The operator-reported counsel approval is now recorded for the current legal text; future operator, age, market, product, or vendor changes require a fresh review.

After the user resolves those decisions and reviews the exact prepared text, a matching explicit review is required by:

```sh
cd /Users/rober/Desktop/Okyo-1
node apps/web/scripts/check-legal-publication.mjs
```

The legal review check should now pass for the current source and manifest fingerprints. On a later authorized website deployment, deploy only the prepared package to service `3ec3218a-d877-4ce6-8d0a-07724602a1c3`, environment `production`; report that deployment first. No API deployment is authorized by the current request.

Verify all four URLs without login after propagation and certificate issuance:

- `https://okyoapp.com/privacy`
- `https://okyoapp.com/terms`
- `https://okyoapp.com/support`
- `https://okyoapp.com/delete-account`

Also verify `https://www.okyoapp.com/privacy` redirects once to the root policy. The mobile release gate now checks all four legal/support URLs, not only three. Current public checks fail because neither hostname resolves to the website.
