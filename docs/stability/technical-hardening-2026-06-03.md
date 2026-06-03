# Technical Hardening Snapshot — 2026-06-03

This snapshot records the non-growth project risks for Serlo/Vibes and the
current hardening priorities.

## What Is Healthy

- The active release source is consolidated at `/Users/zaurhatuev/vibes-app`.
- The legacy Desktop checkout is detected and quarantined by workspace checks.
- `release:gate` covers workspace parity, post-mutation audit, Web typecheck,
  Web lint, production route smoke, API contracts, media budget, media playback,
  thumbnails, shop media, backend integrity, and authenticated interactions.
- `health:dashboard` reports production health across lifecycle, cost,
  moderation, support, regions, media, shop, observability, and governance.
- R2 direct-upload signing is protected by authenticated smoke tests.
- Native production builds use guarded npm commands with source/version checks.
- Latest Store/TestFlight build observed by EAS audit is `1.26.6 (279)`.

## Current Technical Risks

1. Web Sentry needs production env vars before it can catch server/client errors.
2. Edge Sentry remains opt-in because an earlier eager import caused an Edge
   runtime crash.
3. Large native/web modules increase regression risk during small changes.
4. The quarantined Desktop checkout still exists and can confuse manual work.
5. RevenueCat webhook server verification is incomplete for Apple/Google.
6. `typedRoutes` is disabled, so route regressions rely on tests/lint instead
   of the stronger Next typed-route compiler gate.
7. Supabase has a large migration history; release safety depends on always
   using migration files and `supabase db push --dry-run`.

## Hardening Done In This Pass

- EAS iOS build audit now reads the current App Store candidate from `app.json`.
- iOS release minimum build was raised to `1.26.6 (279)`.
- iOS release documentation now names `1.26.6 (279)` as the current candidate.
- Web instrumentation now initializes Sentry dynamically for Node runtime when
  a DSN exists, while keeping Edge Sentry disabled unless `SENTRY_ENABLE_EDGE=1`.
- Deployment runbook now lists the required Vercel Sentry env vars and the
  Edge-Sentry opt-in rule.
- `npm run observability:health` checks local and optional Vercel Production
  observability env names without printing secret values, and the summary is
  now visible in `npm run health:dashboard`.
- Observability now has an owner-matrix entry and a weekly workflow guard.
- `handoff.md` was refreshed with the current release source, build identity,
  checks, and next technical work.
- `npm --prefix apps/web run build` passes. The build still prints a known
  Sentry/OpenTelemetry critical-dependency warning, but it does not block the
  Next production build.

## Next Hardening Wave

1. Set and verify Web Sentry on Vercel Preview/Production with
   `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN`.
2. Add source-map upload secrets only after the Sentry project is confirmed:
   `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
3. Keep `SENTRY_ENABLE_EDGE` unset until preview proves Edge routes are safe.
4. Split the largest modules by extracting stable hooks first:
   create/upload state, live host controls, live watch co-host state, and admin
   action groups.
5. Decide whether the Desktop checkout should be archived after its dirty files
   and historical commits are reviewed.

## Mandatory Checks

Before Web release:

```bash
npm run release:gate
npm run observability:health -- --vercel-production
npm run health:dashboard
```

Before iOS production build:

```bash
npm run native:builds:audit
npm run native:build:production:check
npm run release:gate
```
