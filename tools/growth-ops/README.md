# Okyo Growth Ops — local creator operations MVP

This is an **internal founder dashboard**, not a screen in the Okyo consumer iOS app. It lives separately so the shipped iOS app and App Store review submission are unaffected.

## Run locally

From the Okyo repository root, run:

```bash
cd tools/growth-ops
python3 -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765 in your browser. Do **not** deploy this folder to a public web host. It uses the browser's localStorage and has no login. The page makes no network requests.

Run the pure calculation tests with:

```bash
node --test tools/growth-ops/engine.test.mjs
```

## Your workflow

1. **Creators:** add two or three creators, their real agreements, and their desired posting cadence. Use $0 for unpaid collaborations. Agreements are manually entered; no contracts are signed.
2. **Hooks:** add ideas focused on real Okyo use cases: scan restaurant food, recreate meals at home, reveal estimated ingredients/macros, try a customized high-protein version.
3. **Briefs:** select a creator and hook, generate a truthful brief, approve it, then copy it into your normal communication channel. No message is sent from the dashboard.
4. **Videos:** record every published short-form video and its public URL. Enter updated total views, and **after seven days** enter its *seven-day views* (which drive the bonus). For edits, import the CSV again with the same creator handle and URL.
5. **Attribution:** only enter installs, trials, paid customers or revenue when truly attributed through links/codes or an analytics provider. Do not assign a portion of store-wide downloads to an individual creator without evidence.
6. **Payouts:** review the proposed monthly creator costs, confirm agreement terms and snapshot completeness, approve, then export the **proposed** payout CSV. You must pay creators yourself using your approved payment process.
7. **Data:** export a JSON backup frequently. Your data is saved in **that browser only**, not in GitHub, Railway or the Okyo production database.

## CSV import

Use **Data → Download CSV template**. Its exact header is:

```text
creator_handle,hook_title,posted_at,url,views,views_7d,likes,installs,trials,paid,revenue_usd,status
```

- `creator_handle` must match a previously added creator, including @.
- `hook_title` can be blank, or must match a created hook.
- `posted_at`: YYYY-MM-DD; `status`: `posted` or `draft`.
- `views_7d` stays blank until a measured day-seven snapshot exists; **zero is different from missing**.
- `installs`, `trials`, `paid`, `revenue_usd` may stay blank. Blank means unknown, not zero.
- The import checks all rows before saving any. Same creator + same video URL updates an existing video.

## Payout formula and important caveat

For each active creator in the selected calendar month:

```text
proposed payout = contractual monthly base
  + sum_over_posted_videos(
      round_to_cent(
        min(actual_day_7_views, agreed_views_cap_per_video)
          / 100000 * agreed_bonus_dollars_per_100k_views
      )
    )
```

- This intentionally uses *prorated* bonuses per 100k views; the original case study did not specify whether fractional blocks were paid. **Confirm each agreement's terms before paying.**
- Default cap is one million **per video**, not one million across all videos.
- The dashboard currently assumes a full monthly base is owed to every creator whose current status is `active`. It does **not** prorate for onboarding dates, partial months, missed deliverables or paused status. Review the contract and adjust manually before real payment.
- An approval is only a local approval record. It does not transfer money or create an invoice.
- Edits to roster, hooks or videos invalidate the selected month's approval; CSV imports invalidate all monthly approvals.

## What is deliberately **not** built in V1

This is not the fully automated 60-creator operation from the supplied case study. Before adding automation, connect provider data with documented authorization and carefully scope access:

- No PostHog, App Store Connect, RevenueCat, Superwall or MMP API sync yet.
- No ViewTrack, TikTok, Instagram or YouTube automated data fetch.
- No Slack messages, creator DMs, email sending, hiring decisions or payouts.
- No daily 8 AM background job or weekly AI-generated hook variants.
- No ad campaign creation or automatic ad spend.
- No multi-user authentication, hosted database or private creator portal.

Those changes require credentials, provider permissions, a secure private admin backend, and explicit decisions about who may view financial data. **Do not put admin tokens in the mobile app or front-end JavaScript.**

## Good initial operating cadence

Start with 2–3 creators and 2–3 creative formats. Each week compare (1) views, (2) *attributed* installs, (3) trial starts and (4) paid users, rather than maximizing views alone. Keep most posts on proven formats and reserve some posts for experiments; the article's 80/20 split is an optional hypothesis, not a universal fact. Scale only when the cost per retained subscriber makes sense.

Do not inflate view counts, impersonate customers, fake testimonials or seed deceptive comments. Follow each platform's advertising disclosure requirements and use real Okyo screen recordings.

## Engineering notes

- Plain HTML/CSS/JS module plus pure calculation module; no dependencies; no server or external API calls.
- Escape user-entered text before inserting into HTML.
- No keys, customer records, card details, scan photos or private contracts should be added to the repository.
- The primary Okyo repository may not reflect more recent local code. This tool is additive and should be reviewed before merging.
