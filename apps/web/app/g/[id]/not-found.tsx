import Link from 'next/link';
import type { Route } from 'next';
import { Users } from 'lucide-react';

export default function GuildNotFound() {
  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-16 text-center">
      <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Pod nicht gefunden</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Diesen Pod gibt es nicht oder er wurde entfernt.
      </p>
      <Link
        href={'/guilds' as Route}
        className="mt-6 inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
      >
        Zurück zu allen Pods
      </Link>
    </div>
  );
}
