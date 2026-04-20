// -----------------------------------------------------------------------------
// Next.js 15 `instrumentation.ts` — canonical integration point for Sentry.
//
// TEMPORARILY NO-OP bis Sentry-Env-Vars (NEXT_PUBLIC_SENTRY_DSN, SENTRY_DSN,
// SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT) in Vercel gesetzt sind.
//
// Hintergrund: Der synchrone Top-Level-Re-Export `captureRequestError` und
// der `import * as Sentry from '@sentry/nextjs'` in sentry.edge.config.ts
// pullen das komplette `@sentry/nextjs`-Package in jede Runtime — auch Edge.
// `@sentry/nextjs` referenziert intern `__dirname` (Node-Global), das im
// V8-Isolate der Edge-Middleware nicht existiert → ReferenceError → 500.
//
// Zum Re-Aktivieren von Sentry:
//   1. Env-Vars in Vercel setzen (Production + Preview)
//   2. Diesen File auf die Version vor Commit [deploy-fix] zurücksetzen:
//      `git show HEAD~N:apps/web/instrumentation.ts > apps/web/instrumentation.ts`
//   3. Redeploy
// -----------------------------------------------------------------------------

export async function register(): Promise<void> {
  // noop — Sentry deaktiviert bis Env-Vars gesetzt sind.
}
