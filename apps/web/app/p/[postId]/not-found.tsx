import Link from 'next/link';
import { VideoOff, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

// -----------------------------------------------------------------------------
// /p/[postId] — 404.
// Gründe warum Post nicht gefunden: gelöscht vom Creator, moderiert, oder die
// URL wurde falsch geteilt. Kein Unterschied in der UI — aus Datenschutz-Sicht
// unterscheiden wir absichtlich nicht, damit ein Troll nicht aus der
// Fehlermeldung ablesen kann "der Post existierte, wurde aber gelöscht".
// -----------------------------------------------------------------------------

export default function PostNotFound() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <VideoOff className="h-7 w-7 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Video nicht verfügbar</h1>
        <p className="text-sm text-muted-foreground">
          Dieses Video gibt&apos;s hier nicht (mehr). Vielleicht wurde es vom Creator gelöscht
          oder die URL ist nicht korrekt.
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
