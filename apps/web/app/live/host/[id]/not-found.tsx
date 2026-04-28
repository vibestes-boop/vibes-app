import Link from 'next/link';
import type { Route } from 'next';
import { Radio, ArrowLeft } from 'lucide-react';

export default function LiveHostNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Radio className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold">Stream nicht gefunden</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Diese Live-Session existiert nicht oder gehört dir nicht. Starte einen neuen Stream oder
        schau dir andere Streams an.
      </p>
      <div className="flex gap-3">
        <Link
          href={'/live/start' as Route}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Neuen Stream starten
        </Link>
        <Link
          href={'/live' as Route}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zu Live
        </Link>
      </div>
    </div>
  );
}
