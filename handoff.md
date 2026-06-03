# Serlo / Vibes Handoff

Last updated: 2026-06-03

## Goal

Keep Serlo technically reliable before broader public use. Current focus is
release hygiene, production observability, media/upload reliability, App Store
build provenance, and maintainable code structure.

## Source Of Truth

- Active repo: `/Users/zaurhatuev/vibes-app`
- Active branch: `main`
- Current release commit before this hardening pass: `f177a4c Fill public legal launch details`
- Web production: `https://serlo-web.vercel.app`
- Native app identity: `Serlo 1.26.6 (279)`
- EAS project id: `02ab536a-5836-4560-a5ec-2dfd6e059f90`
- iOS bundle id: `com.vibesapp.vibes`
- Quarantined legacy checkout: `/Users/zaurhatuev/Desktop/vibes-app`

Do not build, submit, deploy, or run production commands from the quarantined
legacy checkout.

## Current Technical State

- Git working tree was clean before the 2026-06-03 hardening pass.
- `npm run release:gate` passed on 2026-06-03.
- `npm run health:dashboard` passed on 2026-06-03.
- `npm run native:release-guard` passed from `/Users/zaurhatuev/vibes-app`.
- `npm run native:builds:audit` passed and reports latest Store build
  `1.26.6 (279)`.
- Production Web route/API/media/auth/integrity checks are green.
- R2 upload smoke is included in production integrity and passed.
- Media playback health is green: checked videos are fast-start.
- Shop media health is green: active products have reachable media URLs.
- Legal readiness is no longer blocked by placeholder text.

## Current Hardening Changes In Progress

- Build audit now reads the current App Store Connect candidate from `app.json`
  instead of a hard-coded stale number.
- iOS release guard minimum Store build has been raised to `1.26.6 (279)`.
- iOS release docs and workspace strategy examples now use build `279`.
- Web `instrumentation.ts` now dynamically initializes Sentry for Node runtime
  when a DSN exists. Edge Sentry remains opt-in through `SENTRY_ENABLE_EDGE=1`
  to avoid the previous eager-import Edge crash.
- Deployment runbook now documents the required Vercel Sentry env vars and the
  rule to keep `SENTRY_ENABLE_EDGE` unset until preview verification.

## Open Technical Risks

- Web Sentry requires Vercel env vars to actually emit events:
  `NEXT_PUBLIC_SENTRY_DSN` and/or `SENTRY_DSN`, plus source-map upload vars
  `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
- Edge Sentry should remain disabled until a preview deploy proves it no longer
  triggers the old `__dirname` crash.
- Very large modules increase regression risk:
  `app/live/host.tsx`, `app/live/watch/[id].tsx`, `app/create/index.tsx`,
  and `apps/web/app/actions/admin.ts`.
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

1. Finish this hardening pass and commit it.
2. Verify Sentry instrumentation with typecheck, lint, and build.
3. Run `native:builds:audit`, `native:release-guard`, `release:gate`, and
   `health:dashboard` after the edits.
4. If checks pass, push to `origin/main`.
5. Next refactor wave: extract narrow hooks/components from the largest native
   screens, starting with create/upload flow and live watch/host state.
