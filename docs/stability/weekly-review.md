# Weekly Stability Review

This is the operating meeting for stability, product focus, cost, and trust.
Run it before approving broad new feature work.

## Required Checks

Run from `/Users/zaurhatuev/vibes-app`:

```bash
npm run integrity:weekly
npm run product:health
npm run cost:health
npm run moderation:health
npm run governance:health
npm run push-feed:health
```

## Status Board

Record one status per owned area:

- `Green`: guard passed and no owner concern
- `Yellow`: guard passed but metric trend or manual risk needs attention
- `Red`: guard failed, SLA breached, or owner blocks new scope

Required areas are defined in `docs/stability/ownership.json`:

- Data Lifecycle
- Web/Mobile Parity
- Feed/Algorithmus
- Push/Notifications
- R2/Media
- Release/CI
- Moderation/Trust
- Cost Monitoring
- Product Metrics

## Decision Rules

Feature decisions:

- `Keep`: metric moved or qualitative evidence is strong
- `Improve`: signal exists but conversion, cost, safety, or quality is weak
- `Kill`: no signal, high cost, trust risk, or stability risk

Feature freeze:

- Any Red stability, moderation, release, or data lifecycle area pauses broad
  feature launches.
- North Star at zero for two consecutive weekly reviews pauses non-activation
  features.
- Cost guard above 90% budget pauses rollout of the responsible feature.
- Moderation reports over 24h SLA pause community-growth pushes.

## Required Notes

Every weekly review records:

- check outputs or links to the workflow run
- open `stability-alert` GitHub issues
- push/feed health status
- Keep / Improve / Kill decisions
- frozen areas and unblock owner
- feature launches approved or rejected
- owner changes
- incidents and follow-up tasks

## Feature Intake

New feature ideas use `docs/stability/feature-intake.md`. A feature is not
eligible for build or rollout until it has an owner, target metric, user value,
cost risk, rollback plan, and monitoring signal.
