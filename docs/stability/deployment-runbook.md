# Deployment Runbook

Use this runbook for every production release from the Web/Ops checkout:
`/Users/zaurhatuev/vibes-app`.

## 1. App Gate

```bash
cd /Users/zaurhatuev/vibes-app
npm run release:gate -- --phase pre
```

For high-risk frontend changes, include the production build:

```bash
npm run release:gate -- --phase pre --full
```

Release is blocked if this gate reports pending SQL migrations, direct `posts`
mutations, type errors, lint errors, or workspace/env drift.

## 2. SQL

Preview and apply migrations from the Web/Ops root:

```bash
supabase db push --dry-run
supabase db push
```

If `--dry-run` lists migrations, apply them before deploying the app. Never ship
Web/Native code that depends on a migration which has not reached Production.

## 3. Functions

Deploy only functions touched by the release. Current R2 lifecycle functions:

```bash
supabase functions deploy r2-sign --project-ref llymwqfgujwkoxzqxrlm
supabase functions deploy r2-delete --project-ref llymwqfgujwkoxzqxrlm --no-verify-jwt
```

`r2-delete` must keep `--no-verify-jwt`; it performs its own authorization and
also exposes the DB-cron queue processor.

## 4. Secrets

Confirm runtime secrets in their owning systems:

- Supabase Edge Functions: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional `R2_CLEANUP_SECRET`.
- Vercel Web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  public R2 URL/env used by media checks, and stability test-user secrets when
  auth smoke should run.
- Native: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` must
  match Web/Ops fingerprints.

Do not paste secret values into release notes. Use fingerprints or OK/DIFF
output from `npm run workspace:doctor`.

## 5. Cron

Required production cron jobs:

- `r2-delete-queue`: every 5 minutes, calls `r2-delete` with
  `{ "processQueue": true }`.

The post-deploy gate also reports other known cron jobs when visible through
`production_integrity_snapshot()`.

## 6. Verify

After app, SQL, functions, secrets, and cron are deployed:

```bash
npm run release:gate -- --phase post
```

This is the release completion signal. It checks:

- public routes and redirects
- public API contracts and cache headers
- media budget
- R2 cleanup queue health
- required cron jobs
- `r2-delete` and `r2-sign` reachability
- recent media references
- authenticated smoke when test-user secrets are configured

Paste the final `Release gate passed` line and commit SHA into the release
notes. If any post-deploy gate fails, treat the release as incomplete.

## 7. Weekly Integrity

The weekly job is intentionally deeper than the per-release gate:

```bash
npm run integrity:weekly
npm run product:health
npm run cost:health
```

It checks the production DB snapshot, queue age, failed queue rows, required
cron jobs, Edge Function reachability, recent media URL health, and R2 bucket
objects under `posts/` and `thumbnails/` that no longer belong to any post.

Required GitHub secrets for the weekly R2 orphan check:

- `SUPABASE_SERVICE_ROLE_KEY`
- `CF_R2_ACCOUNT_ID`
- `CF_R2_ACCESS_KEY_ID`
- `CF_R2_SECRET_ACCESS_KEY`
- `CF_R2_BUCKET`
- `CF_R2_PUBLIC_URL`

If it reports orphan objects, either enqueue/delete them through the protected
R2 cleanup flow or intentionally raise the threshold with a documented reason.

The product-health and cost-health reports are not deploy blockers by default.
They are the input to the weekly product review and feature Keep / Improve /
Kill decisions.

Cost-health covers tracked AI cost plus usage proxies for media, R2, live,
recording, and DB activity. Budget thresholds live in environment variables
documented in `docs/stability/cost-controls.md`.
