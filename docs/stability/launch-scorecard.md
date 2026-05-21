# Launch Scorecard

The launch scorecard is the invite gate for Serlo. It answers one question:
should we invite real users this week, or keep the app in recovery mode?

Run from `/Users/zaurhatuev/vibes-app`:

```bash
npm run launch:scorecard
```

Use strict mode before a planned cohort invite:

```bash
npm run launch:scorecard -- --strict
```

## Decisions

- `BLOCKED_FIX_STABILITY`: do not invite users. Fix technical gates first.
- `INVITE_GATE_CLOSED`: app is technically usable, but product activation is
  not strong enough for more users.
- `PRIVATE_COHORT_READY`: invite only a tiny private cohort, 5-10 people, and
  measure the next day.

## Technical Gates

These block invites when they fail:

- feed endpoint returns at least 12 posts
- media thumbnails missing equals 0
- at least 1 active native push token exists
- product, activation, push/feed, and thumbnail snapshots can be read

Technical failures are trust failures. They are fixed before product learning.

## Product Gates

These keep the invite gate closed until activation is real:

- North Star is at least 1
- active creators in 7 days is at least 2
- first-post conversion for new users in 30 days is at least 40%
- WAU is at least 5
- D1 retention has enough sample to judge, then target 25% or better

`INVITE_GATE_CLOSED` is not a failure. It means the next cycle is creator
activation work, not a bigger launch.

## Weekly Operating Loop

Every week:

1. Run `npm run health:dashboard`.
2. Run `npm run launch:scorecard`.
3. Open `/admin/activation`.
4. For each new user without a first post, create or resolve the activation
   support case.
5. For each new post, make sure it gets at least one real reply, save, follow,
   or useful comment within 24 hours.
6. Invite no more than 5-10 people unless the scorecard says
   `PRIVATE_COHORT_READY`.

## Current Bias

Serlo should bias toward quality over growth until the scorecard is ready. A
small app with stable uploads, a good icon, working TestFlight builds, and a
few real conversations is better than a larger app where users hit broken media
or an empty feed.
