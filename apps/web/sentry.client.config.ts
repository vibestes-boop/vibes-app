// -----------------------------------------------------------------------------
// Sentry — Browser-Init (Next.js 15 App Router / React 19)
//
// Läuft nur im Browser-Bundle. DSN ist `NEXT_PUBLIC_…`, damit der Client
// sie beim Build in das JS-Bundle inlined bekommt. Release-Version kommt
// aus `SENTRY_RELEASE` (setzt CI beim Build, fallback: git commit sha).
//
// Sampling bewusst konservativ:
//   • traces:  10 % — reicht um Perf-Regressionen zu sehen ohne Quota zu
//              verbrennen. Kritische Routen (Live/Watch, Checkout) können
//              später über `tracesSampler` granular hochgezogen werden.
//   • replay:  10 % normale Sessions, 100 % wenn ein Fehler passiert —
//              Standard-Pattern für Bug-Reproduktion.
//
// `maskAllText`/`blockAllMedia` bewusst AN — wir tragen Nachrichten-Inhalte,
// DM-Bodies und Stream-Kommentare im DOM; die haben nichts in einem
// Fehler-Replay zu suchen (DSGVO + Nutzer-Vertrauen).
// -----------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

    // Performance
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session-Replay (nur bei echter DSN, sonst macht das Plugin ohnehin nichts)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Next.js fängt RSC-Errors bereits ab → Sentry bekommt ohnehin einen
    // Breadcrumb; wir wollen aber Browser-only-Errors sauber durchleiten.
    ignoreErrors: [
      // Klassiker — werden von Browser-Extensions / Ad-Blockern ausgelöst,
      // kein App-Bug, nur Noise im Issue-Stream.
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      // Safari Private-Mode IndexedDB-Quota
      'QuotaExceededError',
    ],

    // Nur in Produktion an — lokales Dev soll nicht gegen das Prod-Projekt
    // melden und Quota fressen.
    enabled: process.env.NODE_ENV === 'production',
  });
}
