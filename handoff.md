# Serlo / Vibes Handoff

Last updated: 2026-06-05

## Goal

Keep Serlo technically reliable before broader public use. Current focus is
release hygiene, production observability, media/upload reliability, App Store
build provenance, and maintainable code structure.

## Source Of Truth

- Active repo: `/Users/zaurhatuev/vibes-app`
- Active branch: `main`
- Current release commit:
  `ae97834 Refine creator and shop UI surfaces`
- Web production: `https://serlo-web.vercel.app`
- Native app identity: `Serlo 1.26.6 (279)`
- EAS project id: `02ab536a-5836-4560-a5ec-2dfd6e059f90`
- iOS bundle id: `com.vibesapp.vibes`
- Quarantined legacy checkout: `/Users/zaurhatuev/Desktop/vibes-app`

Do not build, submit, deploy, or run production commands from the quarantined
legacy checkout.

## Current Technical State

- Git working tree was clean before the 2026-06-03 hardening pass.
- `npm run release:gate` passed on 2026-06-05 after the latest production
  deploy.
- `npm run health:dashboard` passed on 2026-06-05.
- `npm run observability:health` passed on 2026-06-03 and reports Yellow until
  Sentry/PostHog envs are intentionally configured.
- `npm run observability:health -- --vercel-production` passed on 2026-06-03;
  Vercel Production has timing log env names, but no Sentry runtime/source-map
  env names yet.
- `npm run native:release-guard` passed from `/Users/zaurhatuev/vibes-app`.
- `npm run native:builds:audit` passed and reports latest Store build
  `1.26.6 (279)`.
- Production Web route/API/media/playback/auth/integrity checks are green.
- R2 upload smoke is included in production integrity and passed. It now covers
  iOS content-type signing, cache-control tolerance, and product-image prefix
  signing.
- Media playback health is green: checked videos are fast-start.
- Shop media health is green: active products have reachable media URLs.
- Legal readiness is no longer blocked by placeholder text.

## Latest Hardening Changes

- `r2-sign` now allows `products/images/...` object keys, fixing product image
  upload signing parity with the native/web product upload client.
- Production integrity now checks the product image signing contract without
  leaving product smoke files behind.
- Explore and Women-Only public pages were toned down: no pink/violet hero
  styling, no decorative gradient badges, and more restrained trust-oriented
  copy.
- Creator/shop UI cleanup wave: Studio Live, Studio Analytics,
  Studio Shop Analytics, product cards, and Women-Only activation now use
  neutral system styling instead of generator-like red/orange/pink gradients and
  emoji metrics.
- Vercel production is aliased to `https://serlo-web.vercel.app`; latest
  inspected deployment was Ready under the `serlo-web` project.
- Build audit now reads the current App Store Connect candidate from `app.json`
  instead of a hard-coded stale number.
- iOS release guard minimum Store build has been raised to `1.26.6 (279)`.
- iOS release docs and workspace strategy examples now use build `279`.
- Web `instrumentation.ts` now dynamically initializes Sentry for Node runtime
  when a DSN exists. Edge Sentry remains opt-in through `SENTRY_ENABLE_EDGE=1`
  to avoid the previous eager-import Edge crash.
- Deployment runbook now documents the required Vercel Sentry env vars and the
  rule to keep `SENTRY_ENABLE_EDGE` unset until preview verification.
- Observability health now has a dedicated guard and dashboard row. It reports
  local/Vercel env name presence without printing secret values.
- Observability now has an ownership entry and runs in the weekly integrity
  workflow.

## Open Technical Risks

- Product readiness remains the main risk, not infrastructure:
  `health:dashboard` is still Yellow for Product Metrics, Launch Readiness,
  Observability, and Push/Feed.
- Web Sentry requires Vercel env vars to actually emit events:
  `NEXT_PUBLIC_SENTRY_DSN` and/or `SENTRY_DSN`, plus source-map upload vars
  `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
- Edge Sentry should remain disabled until a preview deploy proves it no longer
  triggers the old `__dirname` crash.
- Very large modules increase regression risk:
  `app/live/host.tsx`, `app/live/watch/[id].tsx`, `app/create/index.tsx`,
  and `apps/web/app/actions/admin.ts`.
- The deployed `r2-delete` Edge Function is active, but its source is not
  present under `supabase/functions/` in this checkout. Bring it back into the
  repo before changing delete behavior; current production cleanup rejected a
  `products/images/...` smoke object path.
- The legacy Desktop checkout still exists and is dirty. It is preserved only
  for historical context.
- RevenueCat webhook still has phase-3 Apple/Google server-verification TODOs;
  paid flows should stay out of launch scope until this is resolved.
- `typedRoutes` is disabled in `apps/web/next.config.mjs` until route pushes and
  redirects are migrated to typed `Route` usage.

## Required Commands Before Web Release

```bash
cd /Users/zaurhatuev/vibes-app
npm run release:gate
npm run observability:health -- --vercel-production
npm run health:dashboard
```

## Required Commands Before iOS/TestFlight/App Store Build

```bash
cd /Users/zaurhatuev/vibes-app
npm run native:builds:audit
npm run native:build:production:check
npm run release:gate
```

Use guarded build commands only:

```bash
npm run native:build:production
```

Never use raw `npx eas build --platform ios --profile production` as the normal
release path.

## Next Technical Work

1. Continue the UI-quality audit on high-traffic surfaces not yet cleaned:
   profile/feed overlays, live viewer/host controls, create flow, coin shop, and
   notifications. Keep changes scoped and verify each wave with typecheck, lint,
   production deploy, release gate, and health dashboard.
2. Configure Sentry DSN envs in Vercel Preview/Production, then run
   `npm run observability:health -- --vercel-production --strict` only after
   the source-map secrets are also ready.
3. Keep `SENTRY_ENABLE_EDGE` unset until a preview deploy proves Edge routes
   are safe.
4. Recover the deployed `r2-delete` source into `supabase/functions/` before
   changing cleanup semantics.
5. Next refactor wave: extract narrow hooks/components from the largest native
   screens, starting with create/upload flow and live watch/host state.
