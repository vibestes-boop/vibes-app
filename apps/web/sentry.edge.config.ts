// -----------------------------------------------------------------------------
// Sentry — Edge-Runtime-Init (Middleware + Edge-Route-Handlers + OG-Images)
//
// Edge läuft auf der V8-Isolate-Runtime (kein Node): KEIN fs, KEIN http-Modul,
// kein native Profiling. Wir initialisieren nur das Minimum — reine Error-
// Capture + Traces. Keine Replay-Integration (würde ohnehin nicht greifen,
// weil Edge kein DOM hat).
//
// Wichtig: Die OG-/Twitter-Image-Konventionen laufen auf `runtime = 'edge'`.
// Wenn dort ein Render-Fehler passiert (z.B. Supabase-Timeout beim Fetch
// der Story-Thumbnail-URL), kriegen wir ihn über dieses Config-File zu sehen.
// -----------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,

    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Edge-Isolates starten/sterben schnell — weniger Breadcrumbs sparen Memory
    // (Edge-Quota bei Vercel ist 128 MB RSS per Invocation).
    maxBreadcrumbs: 20,

    sendDefaultPii: false,

    enabled: process.env.NODE_ENV === 'production',
  });
}
