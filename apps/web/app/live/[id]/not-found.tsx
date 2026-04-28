import Link from 'next/link';
import type { Route } from 'next';
import { Radio, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

// -----------------------------------------------------------------------------
// /live/[id] — 404
// Häufigster Grund: Stream hat geendet oder Link ist veraltet.
// Wir unterscheiden absichtlich nicht ob Session nie existiert hat oder
// beendet wurde — kein Informations-Leak über private Streams.
// -----------------------------------------------------------------------------

export default function LiveNotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Radio className="h-7 w-7 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Stream nicht mehr live</h1>
        <p className="text-sm text-muted-foreground">
          Dieser Stream ist beendet oder existiert nicht. Schau in der Live-Übersicht
          nach — vielleicht ist gerade jemand anderes live.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href={'/live' as Route}>
            <Radio className="h-4 w-4" />
            Alle Live-Streams
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={'/' as Route}>
            <ArrowLeft className="h-4 w-4" />
            Startseite
          </Link>
        </Button>
      </div>
    </main>
  );
}
