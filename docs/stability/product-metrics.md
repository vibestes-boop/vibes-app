# Product Metrics

This is the first product-governance layer: every weekly review starts with the
same numbers, generated from production data.

## North Star

Weekly active creators with meaningful engagement:

- creator posted in the last 7 days
- at least one of those posts received a like, comment, bookmark, or follow
  after the post was created

Run:

```bash
npm run product:health
```

When North Star is `0`, run the activation recovery snapshot:

```bash
npm run product:activation
```

That report shows:

- new users who still need a first post
- creators who posted in the last 30 days but received no meaningful engagement
- posts, views, and meaningful engagement in the last 30 days
- concrete next actions for the creator activation review

The operational review lives at `/admin/activation`. Creator Ops can turn a
candidate into a real activation support case with
`admin_create_activation_support_thread`. Those cases use the normal
`/admin/support` queue with source `activation`, so outreach, follow-up,
ownership, SLA, and audit history stay in the central admin workflow instead of
becoming a separate spreadsheet.

## Weekly Review

Review these metrics before approving new feature work:

- North Star value and activation rate
- WAU, MAU, WAU/MAU
- D1 and D7 retention approximation
- Posts in the last 7 days
- Likes, comments, bookmarks, follows
- Engagement per view and comment per view
- Median time to first post
- Median time to first meaningful interaction

## Decision Rule

Every proposed feature must name:

- target metric
- expected user value
- cost risk
- rollback plan
- monitoring signal

If stability, retention, or creator activation is red, new broad feature work is
paused. Product review decisions use:

- `Keep`: metric moved or qualitative evidence is strong
- `Improve`: signal exists but conversion/quality is weak
- `Kill`: no signal, high cost, or stability risk

Cost decisions use the companion guard in `docs/stability/cost-controls.md`.
Run `npm run cost:health` in the same weekly review before approving expensive
AI, live, recording, or upload-heavy work.

## Current Limits

D1/D7 retention is an approximation using first-party DB activity events:
posts, likes, comments, bookmarks, follows, views, and dwell events. It does
not yet include passive anonymous browsing or client-only analytics events.
