import Link from 'next/link';
import { Clock3, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

// -----------------------------------------------------------------------------
// /s/[storyId] — 404.
// Zwei Gründe: (a) Story ID existiert nicht, (b) Story älter als 24h — expired.
// UI-seitig undistinguishable, die Message erwähnt beide Möglichkeiten.
// -----------------------------------------------------------------------------

export default function StoryNotFound() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Clock3 className="h-7 w-7 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Story nicht mehr verfügbar</h1>
        <p className="text-sm text-muted-foreground">
          Stories sind nur 24 Stunden sichtbar — diese ist entweder abgelaufen
          oder wurde vom Creator entfernt.
        </p>
      </div>

      <Button asChild>
        <Link href="/">
          <Home className="h-4 w-4" />
          Zur Startseite
        </Link>
      </Button>
    </main>
  );
}
