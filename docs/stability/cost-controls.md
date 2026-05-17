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
- optional actual provider costs from `PROVIDER_COSTS_JSON`,
  `PROVIDER_COSTS_FILE`, or `PROVIDER_BILLING_DIR`

## Budgets

Defaults warn at 70%, fail at 90%, and mark a separate critical failure at
100%:

- `COST_AI_BUDGET_CENTS`
- `COST_TRACKED_BUDGET_CENTS`
- `COST_PROVIDER_BUDGET_CENTS`
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

## Actual Provider Cost Input

Provider billing APIs or scheduled exports can feed exact monthly spend into
`npm run cost:health` with `PROVIDER_COSTS_JSON`, `PROVIDER_COSTS_FILE`, or
`PROVIDER_BILLING_DIR`. This keeps the guard stable even when providers expose
billing through different API jobs or exports.

Expected shape:

```json
{
  "generated_at": "2026-05-17T00:00:00Z",
  "source": "billing-export",
  "cloudflare_r2_cents": 0,
  "supabase_cents": 0,
  "vercel_cents": 0,
  "livekit_cents": 0,
  "ai_cents": 0,
  "other_cents": 0
}
```

If `total_cents` is omitted, the guard sums all provider fields. The combined
actual provider spend is checked against `COST_PROVIDER_BUDGET_CENTS` with the
same 70% warning, 90% failure, and 100% critical thresholds.

For provider-specific JSON/CSV exports, place files in one directory and run:

```bash
npm run cost:fetch-providers -- --github-env
npm run cost:collect-providers -- --dir ./billing-exports
PROVIDER_BILLING_DIR=./billing-exports npm run cost:health
```

The collector infers the provider from the filename or row fields:
Cloudflare/R2, Supabase, Vercel, LiveKit, OpenAI/AI, and `other`. It recognizes
common money columns such as `total_cents`, `amount_cents`, `cost_cents`,
`total`, `amount`, `cost`, `usage_cost`, and `invoice_total`.

`cost:fetch-providers` can download exports directly from configured provider
API endpoints before collection. Use either a full source list:

```json
[
  {
    "provider": "cloudflare-r2",
    "url": "https://provider.example/billing/export",
    "headers": { "authorization": "Bearer ..." },
    "format": "json"
  }
]
```

or provider-specific shorthands:

- `CLOUDFLARE_BILLING_URL`
- `SUPABASE_BILLING_URL`
- `VERCEL_BILLING_URL`
- `LIVEKIT_BILLING_URL`
- `AI_BILLING_URL`

Each shorthand supports matching `*_BEARER_TOKEN`, `*_API_KEY`, `*_ACCOUNT_ID`,
`*_METHOD`, `*_BODY`, and `*_FORMAT`. The weekly workflow downloads configured
exports, writes only JSON/CSV files to `PROVIDER_BILLING_DIR`, then runs
`npm run cost:health`.

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

- Add concrete billing endpoint URLs/tokens as GitHub Secrets for Cloudflare
  R2, Supabase, Vercel, LiveKit, and AI spend
- Keep provider API tokens out of logs; only normalized cents reach
  `npm run cost:health`
