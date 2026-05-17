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
- required database triggers for notification and DM web-push dispatch
- `pg_net` availability

The check does not print token or endpoint values.

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
- Web push subscriptions with a missing DM trigger block Web Push rollout.
