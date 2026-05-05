'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';

// -----------------------------------------------------------------------------
// Page-Level Error-Boundary (sitzt innerhalb des Root-Layouts; Header/Sidebar
// bleiben stehen). Für Layout-Level-Crashes greift `app/global-error.tsx`.
//
// Next.js lädt diese Komponente wenn irgendein Server-Fehler in einem
// Page/Layout durchrauscht. "use client" ist hier Pflicht (Next-Convention).
// -----------------------------------------------------------------------------

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry-Capture immer — der Init in `sentry.client.config.ts` ist in
    // Dev deaktiviert (`enabled: NODE_ENV === 'production'`), also ist das
    // hier in Dev ein No-Op. In Prod liefert es uns den Client-Seitigen
    // Error-Stream.
    Sentry.captureException(error, {
      // digest korreliert Server-Side-Errors mit Next-Logs — nur attachen
      // wenn vorhanden (nicht jeder Client-Error hat einen digest).
      tags: error.digest ? { nextDigest: error.digest } : undefined,
    });

    if (process.env.NODE_ENV !== 'production') {

      console.error('[GlobalError]', error);
    }
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle className="h-7 w-7 text-red-500" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Ups, da lief was schief.</h1>
        <p className="text-sm text-muted-foreground">
          Wir haben den Fehler automatisch protokolliert. Versuch&apos;s nochmal,
          oder geh zurück zur Startseite.
        </p>
        {error.digest && (
          <p className="pt-1 font-mono text-[10px] text-muted-foreground/60">
            digest: {error.digest}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={reset}>
          <RefreshCw className="h-4 w-4" />
          Nochmal versuchen
        </Button>
        <Button asChild variant="outline">
          <Link href="/">
            <Home className="h-4 w-4" />
            Startseite
          </Link>
        </Button>
      </div>
    </main>
  );
}
