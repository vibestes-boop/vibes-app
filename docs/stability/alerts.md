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

## Slack Alerts

GitHub Issues are the first alert channel. Slack is optional: set the repository
secret `SLACK_WEBHOOK_URL` to post the same failure summary to an incoming
webhook after the GitHub issue step. If the secret is missing, the workflow
keeps GitHub Issues as the only alert channel.

## Email Alerts

Email is optional and intended for a dedicated incident mailbox. Configure all
three repository secrets to enable it:

- `RESEND_API_KEY`
- `HEALTH_ALERT_EMAIL_TO`
- `HEALTH_ALERT_EMAIL_FROM`

`HEALTH_ALERT_EMAIL_TO` may contain a comma-separated list. If any of the three
secrets is missing, the workflow skips email and keeps GitHub Issues plus
optional Slack as the active alert channels.

Email alerts use the same failure summary as GitHub/Slack and must have an owner
and unsubscribe path through the incident mailbox or distribution list settings.
