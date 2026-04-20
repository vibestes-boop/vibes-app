import Link from 'next/link';
import type { Route } from 'next';
import { Clock3 } from 'lucide-react';

export default function StoryGroupNotFound() {
  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-16 text-center">
      <Clock3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Keine aktiven Stories</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dieser User hat aktuell keine aktiven Stories, oder sie sind bereits abgelaufen.
      </p>
      <Link
        href={'/' as Route}
        className="mt-6 inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
      >
        Zurück zum Feed
      </Link>
    </div>
  );
}
