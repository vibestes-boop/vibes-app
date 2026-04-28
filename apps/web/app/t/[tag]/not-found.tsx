import Link from 'next/link';
import type { Route } from 'next';
import { Hash, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

// /t/[tag] — 404
// Tag ist leer (zu kurz / zu lang / keine Posts).

export default function HashtagNotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Hash className="h-7 w-7 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Hashtag nicht gefunden</h1>
        <p className="text-sm text-muted-foreground">
          Zu diesem Hashtag gibt es noch keine Posts — oder er wurde falsch eingegeben.
        </p>
      </div>

      <Button asChild>
        <Link href={'/explore' as Route}>
          <Compass className="h-4 w-4" />
          Entdecken
        </Link>
      </Button>
    </main>
  );
}
