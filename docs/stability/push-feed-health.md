# Push And Feed Health

This guard covers two previously soft spots: push delivery plumbing and feed
emptiness/error masking.

Run:

```bash
npm run push-feed:health
```

## Push Signals

The Supabase snapshot reports:

- native Expo push tokens, when `push_tokens` exists
- stale native tokens older than 90 days
- web push subscriptions and stale subscriptions older than 60 days
- notification rows created in the last 24 hours and 7 days
- unread notification backlog and oldest unread age
- unread notification age buckets: older than 30, 60, and 90 days
- unread backlog shape without PII: users with unread notifications, accounts
  over 50/100 unread notifications, and max unread count for one account
- unread notifications by type
- required database triggers for notification and DM web-push dispatch
- `pg_net` availability

The check does not print token, endpoint, recipient, e-mail, or notification
content values.

## Feed Signals

The same guard checks:

- total public posts
- public posts created in the last 7 days
- public media posts
- public video posts missing thumbnails
- age of the latest public post
- `/api/feed/explore` for `forYou`, `trending`, and `newest`
- `/api/feed/foryou`
- app-code feed data source via `X-Feed-Data-Source`
- Feed RPC fallback count, defaulting to zero tolerated fallbacks

Feed endpoints must return at least three posts by default. This catches the
failure mode where an API catch block returns an empty array with HTTP 200.
They are checked with `diagnostics=1`, which bypasses public-feed caches and
requires the loader to report `rpc`, `postgrest-fallback`, or `error-empty`.
During rollout, a missing diagnostics header is a warning. Once the app deploy
contains the header, `postgrest-fallback` is counted and compared with
`--max-feed-rpc-fallbacks`.

## Response Rules

- Empty public feeds block deploys and broad feature work.
- Any unexpected Feed RPC fallback blocks deploys until the RPC path is restored
  or the fallback allowance is explicitly raised for a controlled incident.
- Public videos without thumbnails block media-heavy launches.
- Stale push token spikes require cleanup or token lifecycle fixes.
- Unread notification backlogs older than 60 days are yellow review signals.
  They should be handled by product policy or a deliberate cleanup, not by a
  silent destructive script.
- Web push subscriptions with a missing DM trigger block Web Push rollout.

## Live Notification Recovery

Live notifications are fan-out events and can create badge pressure for inactive
accounts. The database trigger now limits future live fan-out for a recipient
when:

- the same host already has an unread live notification for that recipient in
  the last 7 days
- the recipient already has 100 unread live/scheduled-live notifications in the
  last 30 days
- the recipient muted that live host

Old live-notification backlog is recoverable through an explicit admin/operator
tool. It dry-runs by default:

```bash
npm run push-feed:recover-live
```

Execute only after a product/ops decision:

```bash
npm run push-feed:recover-live -- --older-than-days 30 --execute
```
