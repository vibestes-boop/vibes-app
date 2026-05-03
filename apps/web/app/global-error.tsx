'use client';

// -----------------------------------------------------------------------------
// Global-Error-Boundary (Next.js 15 App Router)
//
// `app/global-error.tsx` fängt Errors OBERHALB des `layout.tsx` ab — d.h.
// alles was das Root-Layout selbst zum Absturz bringt (z.B. Fehler in einem
// Server-Component das über das Layout geladen wird, oder ein Render-Crash
// in einem Provider). Wichtig: diese Datei MUSS ihr eigenes `<html>`+`<body>`
// rendern, weil sie das kaputte Root-Layout ersetzt.
//
// Die weniger fatal-gate-Errors landen in `app/error.tsx` — das sitzt
// innerhalb des Root-Layouts und behält Header/Sidebar.
//
// Ziele hier:
//   1) Sentry den Error melden (ohne auf das Boundary zu vertrauen, Next
//      triggert das `onRequestError` auch für Client-Errors nicht zuverlässig
//      weil das nur für Server-Errors greift).
//   2) Dem Nutzer ein funktionierendes „Neu laden" + „Zurück zum Feed"
//      anbieten — nicht nur eine leere Seite.
// -----------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import NextError from 'next/error';
import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
}

export default function GlobalError({ error }: GlobalErrorProps) {
  useEffect(() => {
    // `digest` ist das von Next produzierte Server-Side-Error-Hash — hilft
    // Server-Logs mit dem Sentry-Event zu korrelieren.
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background:
            'linear-gradient(135deg, #050508 0%, #1a0a2e 45%, #3a0f2a 100%)',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* `NextError` rendert das Standard-500-Blatt — wir re-verwenden es
            nur als semantischen Slot. Die eigentliche UI oben + unten ist
            unsere eigene. */}
        <div style={{ display: 'none' }}>
          <NextError statusCode={500} />
        </div>

        <div
          style={{
            maxWidth: '480px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background:
                'linear-gradient(135deg, #F59E0B 0%, #F43F5E 50%, #D946EF 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              fontSize: '32px',
              fontWeight: 800,
              color: '#050508',
            }}
          >
            S
          </div>

          <h1 style={{ fontSize: '1.75rem', margin: 0, letterSpacing: '-0.5px' }}>
            Ups — da ist etwas schiefgelaufen
          </h1>
          <p style={{ color: '#c7c3d0', margin: 0, lineHeight: 1.5 }}>
            Der Fehler wurde automatisch an unser Team gemeldet. Wir kümmern
            uns drum. Du kannst die Seite neu laden oder zurück zum Feed gehen.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              marginTop: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <Link
              href="/"
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                borderRadius: '12px',
                background:
                  'linear-gradient(135deg, #F59E0B 0%, #F43F5E 50%, #D946EF 100%)',
                color: '#050508',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Zum Feed
            </Link>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Neu laden
            </button>
          </div>

          {error.digest && (
            <div
              style={{
                marginTop: '1.5rem',
                fontSize: '0.75rem',
                color: '#8d8a99',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              Error-ID: {error.digest}
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
