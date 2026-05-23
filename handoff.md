# Serlo / Vibes Handoff

Last updated: 2026-05-23

## Goal

Keep Serlo stable enough for a tiny private cohort before broader invites.
Prioritize release hygiene, activation, reliable uploads/playback, and a
credible product surface over new large features.

## Source Of Truth

- Active repo: `/Users/zaurhatuev/vibes-app`
- Active branch: `main`
- Current release commit: `6a462c8 Restart feed videos on re-entry and cache profiles`
- Web production: `https://serlo-web.vercel.app`
- Native version: `Serlo 1.26.6 (275)`
- Quarantined legacy checkout: `/Users/zaurhatuev/Desktop/vibes-app`

Do not build, submit, deploy, or run production commands from the quarantined
legacy checkout.

## Current State

- Git working tree was clean before this handoff/runbook update.
- Root tests passed: `67/67`.
- Web tests passed: `283/283`.
- Root and Web typecheck/lint passed.
- `npm run health:dashboard` passed.
- `npm run native:release-guard` passed before the handoff update.
- `npm run launch:scorecard` now passes with decision `BLOCKED_FIX_STABILITY`
  because legal pages still contain launch placeholders/review disclaimers.
- After this update, `node scripts/check-ios-release-source.mjs --profile development --allow-dirty`,
  `npm run workspace:doctor`, root/Web typecheck, and root/Web lint passed.
- Root tests passed: `67/67`; Web tests passed: `283/283`.
- `npm run legal:readiness` fails intentionally until the public legal pages
  contain real operator details and reviewed policy text.

The app is technically usable, but the invite gate remains closed. First blocker
is legal readiness; after that, activation is still thin because first-post
conversion, creator supply, and WAU are below private-cohort targets.

## Open Risks

- First-post conversion is too low for real invites.
- Creator supply is below target.
- WAU is below target.
- Public legal imprint still has TODO fields.
- Legal readiness is now guarded by `npm run legal:readiness` and by the
  launch scorecard local gate.
- RevenueCat webhook has Phase 3 Apple/Google verification TODOs.
- Live host guest reports now use `create_report`; still needs manual smoke on
  a real live session.
- App icon/brand polish should improve before broader user invites.

## Release Rules

Before any Web deploy:

```bash
cd /Users/zaurhatuev/vibes-app
npm run release:gate -- --phase pre
```

Before any iOS/TestFlight/App Store build:

```bash
cd /Users/zaurhatuev/vibes-app
npm run native:release-guard -- --profile production --expected-version 1.26.6 --expected-build-number 275
npm run launch:scorecard
```

Use guarded build commands only:

```bash
npm run native:build:production:check
npm run native:build:production
```

## Next Work

1. Finish and commit the handoff/runbook update.
2. Follow `docs/stability/recovery-waves.md` from Wave 1 through Wave 5.
3. Complete legal imprint/privacy/terms review before broader public launch.
4. Smoke-test the real live guest report flow before pushing Live/Guild growth.
5. Keep invite gate closed until first-post conversion, creators, and WAU pass
   scorecard targets.
6. Create the next TestFlight/App Store build only after release guards,
   health dashboard, launch scorecard, and manual smoke checks are clean.

## Manual Smoke Checklist

- Login/session persists.
- Feed opens quickly and first video starts fast.
- Avatar upload works.
- Story image/video post works.
- Post image/video upload works.
- Like/comment/bookmark work.
- Push token is active.
- Profile and foreign profile render on weak network.
- App Store/TestFlight build comes from `/Users/zaurhatuev/vibes-app`.
