# Serlo/Vibes Workspace Strategy

This project currently has two local checkouts that must be treated as separate
working surfaces until we intentionally consolidate them.

## Active Roots

| Surface | Local path | Remote | Main responsibility |
| --- | --- | --- | --- |
| Web/Ops | `/Users/zaurhatuev/vibes-app` | `vibestes-boop/vibes-app` | `apps/web`, Supabase migrations, Vercel deploys, monitoring scripts |
| Native | `/Users/zaurhatuev/Desktop/vibes-app` | `vibes-social/vibes-app` | Expo app runtime, iOS/Android UX, native build fixes |

The Web/Ops checkout also contains legacy or mirrored top-level native files.
For now, do not treat those files as the production Native source unless we make
an explicit consolidation plan.

## Rules

1. Deploy Web only from `/Users/zaurhatuev/vibes-app`.
2. Run native iOS/Expo work from `/Users/zaurhatuev/Desktop/vibes-app`.
3. Do not reset, overwrite, or merge the Native checkout while it has local
   changes.
4. Backend contract changes belong in Web/Ops first: Supabase migrations,
   public API routes, and stability checks.
5. Native can consume the same backend only after env parity is green.
6. Before any deploy or cross-repo change, run:

```bash
cd /Users/zaurhatuev/vibes-app
npm run release:gate -- --phase pre
```

## Current Source Of Truth

Supabase and R2 are shared infrastructure. Web and Native must agree on:

- Supabase URL
- Supabase anon key
- public R2 media host when Native uses direct media URLs

Secret values must never be pasted into reports. Use fingerprints or OK/DIFF
status only.

## Future Consolidation

Consolidation is possible, but it should be a planned migration:

1. Backup the Native checkout.
2. Commit or stash all Native changes.
3. Decide whether the target is one monorepo or two repositories.
4. Move only one ownership slice at a time.
5. Keep `workspace:doctor`, `stability:native-backend`,
   `stability:api-contracts`, `monitor:prod`, and `monitor:integrity` green
   after each slice.
