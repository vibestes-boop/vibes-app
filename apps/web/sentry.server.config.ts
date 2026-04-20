// -----------------------------------------------------------------------------
// Sentry — Node-Server-Init (Next.js 15 App Router)
//
// Läuft in der Node-Runtime (Server-Components, Route-Handlers, Server-Actions,
// Middleware-free-Routes). DSN ist hier OHNE `NEXT_PUBLIC_…`-Präfix, weil sie
// nie im Browser-Bundle landen soll — nur Server-Prozess-Env.
//
// Wir sammeln KEINE Replays und KEINE PII serverseitig — die Server-Logs
// könnten beliebig viel User-Input mitschleifen (Body-Payloads aus Server-
// Actions, Supabase-Query-Args, etc.). `sendDefaultPii: false` ist der
// Default-Guard, wird hier explizit gesetzt damit der Intent sichtbar ist.
// -----------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,

    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Weniger Breadcrumbs serverseitig — die meisten Default-Integrationen
    // (fetch-Breadcrumbs etc.) liefern nutzloses Rauschen weil Supabase-Calls
    // eigene, strukturiertere Events bekommen sollten wenn wir das brauchen.
    maxBreadcrumbs: 50,

    sendDefaultPii: false,

    enabled: process.env.NODE_ENV === 'production',
  });
}
