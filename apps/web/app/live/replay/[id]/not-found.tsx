import Link from 'next/link';
import type { Route } from 'next';
import { Film, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';

// /live/replay/[id] — 404
// Replay wurde gelöscht, ist abgelaufen oder der Creator hat die Aufnahme
// deaktiviert. 30-Tage-Ablauf ist der häufigste Grund.

export default function ReplayNotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Film className="h-7 w-7 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Replay nicht verfügbar</h1>
        <p className="text-sm text-muted-foreground">
          Diese Aufzeichnung wurde gelöscht, ist abgelaufen oder vom Creator deaktiviert.
          Stream-Replays sind 30 Tage verfügbar.
        </p>
      </div>

      <Button asChild>
        <Link href={'/live' as Route}>
          <Radio className="h-4 w-4" />
          Zu den Live-Streams
        </Link>
      </Button>
    </main>
  );
}
