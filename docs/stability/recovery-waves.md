# Serlo Recovery Waves

Stand: 2026-05-23

This plan keeps Serlo out of broad invites until the app feels reliable,
credible, and active on real devices.

## Operating Principle

Do not trade trust for feature breadth. A small private cohort with stable
uploads, fast feed playback, a credible brand surface, and real replies is
more valuable than a larger launch with broken media or an empty feed.

## Wave 1: Release Hygiene

Goal: every deploy/build comes from the correct source and leaves a usable
handoff.

Exit criteria:

- `/Users/zaurhatuev/vibes-app` is the only release source.
- `/Users/zaurhatuev/Desktop/vibes-app` stays quarantined.
- `/Users/zaurhatuev/vibes-app/handoff.md` is current before long sessions end.
- `npm run native:release-guard` passes before iOS work.
- `npm run release:gate -- --phase pre` passes before Web deploys.

Commands:

```bash
cd /Users/zaurhatuev/vibes-app
npm run workspace:doctor
npm run native:release-guard
npm run health:dashboard
npm run launch:scorecard
```

## Wave 2: Trust-Critical Stability

Goal: the core app works repeatedly on a real phone without embarrassing
failures.

Exit criteria:

- Login/session persists.
- Avatar upload works.
- Story image/video upload works.
- Post image/video upload works.
- First feed video starts quickly.
- Returning to a video starts playback from the beginning.
- Own and foreign profiles render from cached data while fresh data loads.
- Media playback and thumbnail health are green.

Commands:

```bash
npm run media:playback-health
npm run media:thumbnail-health
npm test -- --runInBand
npm --prefix apps/web test -- --runInBand
```

## Wave 3: Legal And Trust Surface

Goal: no public growth before required legal and trust flows are honest.

Exit criteria:

- Imprint has full required operator details.
- Live report flow writes to a real report/moderation path.
- RevenueCat server verification is either completed or paid flows remain
  explicitly out of launch scope.
- Admin/moderation health remains green.

Commands:

```bash
npm run legal:readiness
npm run moderation:health
npm run governance:health
npm run support:health
```

## Wave 4: Product Activation

Goal: the app creates real first actions and conversations before invites
increase.

Exit criteria:

- First-post conversion reaches at least 40%.
- Active creators in 7 days reaches at least 2.
- WAU reaches at least 5.
- Every new post receives a meaningful reply/save/follow/comment within 24h.
- D1 retention has enough sample to judge.

Commands:

```bash
npm run product:activation
npm run product:health
npm run launch:scorecard
```

## Wave 5: Private Cohort And Store Release

Goal: invite only a tiny cohort after the scorecard says the app is ready.

Exit criteria:

- `launch:scorecard` reaches `PRIVATE_COHORT_READY`.
- Manual smoke checklist is clean on a physical iPhone.
- Health dashboard is green or explicitly accepted with a written reason.
- App Store/TestFlight candidate comes from `/Users/zaurhatuev/vibes-app`.

Commands:

```bash
npm run native:build:production:check
npm run native:build:production
npx eas build:view <build-id>
```

## Weekly Decision

Every week, decide one of three outcomes:

- Continue: technical health green and activation improves.
- Stop feature work: health green but activation flat.
- Pivot: activation flat for two weeks despite improved onboarding, creator
  prompts, and reply loops.

The default action while the invite gate is closed is not more features. It is
first-post activation, creator replies, feed relevance, and trust polish.
