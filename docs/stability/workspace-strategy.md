# Serlo/Vibes Workspace Strategy

This project now treats `/Users/zaurhatuev/vibes-app` as the single source of
truth for Web/Ops and Native release work.

The previous Native checkout under `/Users/zaurhatuev/Desktop/vibes-app` is
quarantined. It may still contain useful historical context, but it must not be
used for App Store, TestFlight, Vercel, Supabase, or production release work.

## Active Roots

| Surface | Local path | Remote | Main responsibility |
| --- | --- | --- | --- |
| Web/Ops + Native | `/Users/zaurhatuev/vibes-app` | `vibestes-boop/vibes-app` | `apps/web`, Supabase migrations, Vercel deploys, monitoring scripts, Expo app runtime, iOS/Android UX, native build fixes |
| Legacy Native quarantine | `/Users/zaurhatuev/Desktop/vibes-app` | `MyxcuH2025/vibes-app` / `vibes-social/vibes-app` | Historical context only. Do not build or deploy from here. |

## Rules

1. Deploy Web only from `/Users/zaurhatuev/vibes-app`.
2. Run native iOS/Expo work only from `/Users/zaurhatuev/vibes-app`.
3. Never run `eas build --profile production`, `eas submit`, `vercel`, or
   `supabase db push` from `/Users/zaurhatuev/Desktop/vibes-app`.
4. Backend contract changes belong in Web/Ops first: Supabase migrations,
   public API routes, and stability checks.
5. Native can consume the same backend only after env parity is green.
6. Before any Web deploy or cross-checkout change, run:

```bash
cd /Users/zaurhatuev/vibes-app
npm run release:gate -- --phase pre
```

7. Before any iOS EAS build, run:

```bash
cd /Users/zaurhatuev/vibes-app
npm run native:release-guard
```

For a production/TestFlight build, require the intended App Store version and
build number explicitly:

```bash
npm run native:release-guard -- --profile production --expected-version 1.26.6 --expected-build-number 279
```

Before ending a long debugging or release session, update
`/Users/zaurhatuev/vibes-app/handoff.md`. New sessions should read that file
before touching EAS, App Store Connect, Vercel, Supabase, or production data.

## Current Source Of Truth

Supabase and R2 are shared infrastructure. Web and Native must agree on:

- Supabase URL
- Supabase anon key
- public R2 media host when Native uses direct media URLs

Secret values must never be pasted into reports. Use fingerprints or OK/DIFF
status only.

## Future Consolidation

The release source is already consolidated in `/Users/zaurhatuev/vibes-app`.
Future cleanup should remove or archive the quarantined checkout only after its
untracked assets and historical commits have been reviewed.

Keep `workspace:doctor`, `native:release-guard`,
`stability:native-backend`, `stability:api-contracts`, `monitor:prod`,
`monitor:integrity`, and `product:health` green after each release slice.
