# Cost Controls

This guard keeps expensive product surfaces visible before they become a
business risk. It is intentionally conservative: use actual tracked cost where
the database has it, and usage proxies where provider billing APIs are not yet
integrated.

Run:

```bash
npm run cost:health
```

## Current Signals

- AI image generation cost from `ai_image_generations.cost_cents`
- tracked cost per MAU
- media uploads and referenced R2 media objects
- live session minutes and recording minutes
- R2 cleanup queue rows and errors
- DB activity proxy: posts, comments, likes, bookmarks, follows, post views

## Budgets

Defaults warn at 70%, fail at 90%, and mark a separate critical failure at
100%:

- `COST_AI_BUDGET_CENTS`
- `COST_TRACKED_BUDGET_CENTS`
- `COST_PER_MAU_BUDGET_CENTS`
- `COST_LIVE_MINUTES_BUDGET`
- `COST_RECORDING_MINUTES_BUDGET`
- `COST_MEDIA_UPLOADS_BUDGET`
- `COST_R2_OBJECTS_BUDGET`
- `COST_EDGE_DB_EVENTS_BUDGET`

The same values can be passed as CLI flags, for example:

```bash
npm run cost:health -- --ai-budget-cents 2500 --r2-objects-budget 20000
```

## Feature Rule

Features that can create large variable cost need a feature flag, a monthly budget,
and a rollback owner before launch. This includes AI generation, live
streaming, video recording, high-volume uploads, and background jobs.

If a feature crosses 70% of its budget, it moves to Improve before more scope is
added. If it crosses 90%, new rollout stops until the owner lowers cost or
raises the budget with a documented reason. If it reaches 100%, the owner must
disable or narrow the relevant runtime feature flag before more rollout.

## Runtime Feature Flags

High variable-cost surfaces are guarded by `public.feature_flags` and the
`is_feature_enabled(flag_key)` RPC. The Web server actions fail closed when the
RPC cannot be checked.

Current runtime flags:

- `ai_image_enabled`
- `live_streaming_enabled`
- `live_whip_ingress_enabled`
- `live_recording_enabled`
- `live_shop_enabled`

Emergency disable example:

```sql
UPDATE public.feature_flags
SET enabled = false, updated_at = NOW()
WHERE flag_key = 'live_recording_enabled';
```

Re-enable only after the rollback owner has documented the budget impact and
`npm run cost:health` is green again.

## Next Provider Integrations

The current guard should be upgraded with direct provider billing reads when
those APIs are available in CI secrets:

- Cloudflare R2 storage, class A/B operations, and egress
- Supabase database, Edge Function, and storage usage
- Vercel traffic and function duration
- LiveKit participant minutes, egress, and recording storage
- AI provider spend by feature
