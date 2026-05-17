# Alerts

Health checks should create visible work, not just failed logs.

## GitHub Issues

The weekly integrity workflow opens or updates a GitHub issue when any weekly
guard fails:

- `npm run integrity:weekly`
- `npm run product:health`
- `npm run cost:health`
- `npm run moderation:health`
- `npm run governance:health`
- `npm run push-feed:health`
- `npm run health:dashboard`
- `npm run feature:freeze`

Alert issue:

- title: `Weekly health guards failing`
- label: `stability-alert`
- action: assign the owner from `docs/stability/ownership.json`

The workflow keeps running all guards with `continue-on-error`, opens or updates
the alert issue with all outcomes, then fails the workflow so GitHub still shows
the run as red.

## Response Rules

- Red stability, data lifecycle, release, moderation, or cost freezes broad
  feature launches.
- Every alert needs an owner and a note in `docs/stability/weekly-review.md`.
- If an alert is accepted rather than fixed, the owner records the reason,
  expiry date, and rollback condition.

## Next Channels

GitHub Issues are the first alert channel. Slack or email can be added later by
posting the same failure summary to an incoming webhook after the GitHub issue
step.
