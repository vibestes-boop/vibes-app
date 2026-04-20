// -----------------------------------------------------------------------------
// Next.js 15 `instrumentation.ts` — canonical integration point for Sentry.
//
// Next ruft diese Datei EINMAL pro Runtime-Boot auf (Node oder Edge), bevor
// irgendein Request durchgeht. Wir routen zum passenden Sentry-Config-File
// anhand `NEXT_RUNTIME`:
//
//   • 'nodejs'  → ./sentry.server.config.ts
//   • 'edge'    → ./sentry.edge.config.ts
//
// Die Browser-Config (`sentry.client.config.ts`) wird NICHT hier geladen —
// sie wird vom Sentry-Webpack-Plugin automatisch in das Client-Bundle
// injected (siehe `withSentryConfig` in next.config.mjs).
//
// Dynamic-Import ist Absicht: das spart Edge-Isolate-Boot-Time falls jemals
// einer der beiden Runtimes ohne Sentry aktiv sein sollte (z.B. Self-Host
// ohne SENTRY_DSN).
// -----------------------------------------------------------------------------

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// React-Server-Component-Render-Errors bekommen über diesen Hook ihren
// eigenen Capture-Pfad — ohne den landen RSC-Errors nur im Next-Log,
// nicht in Sentry. Re-Export ist top-level synchron, damit Next den Hook
// beim Boot finden kann (kein dynamic import — der würde den Export zu
// einem Promise machen).
export { captureRequestError as onRequestError } from '@sentry/nextjs';
