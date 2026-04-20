import Link from 'next/link';
import { UserX, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

// -----------------------------------------------------------------------------
// /u/[username] — 404.
// Wird von `notFound()` in page.tsx getriggert, wenn getPublicProfile null gibt.
// `robots: noindex` setzen wir bereits in generateMetadata, also reicht hier UI.
// -----------------------------------------------------------------------------

export default function ProfileNotFound() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <UserX className="h-7 w-7 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Account nicht gefunden</h1>
        <p className="text-sm text-muted-foreground">
          Diesen Usernamen gibt's auf Serlo (noch) nicht — vielleicht ein Tippfehler,
          oder der Account wurde gelöscht.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/">
            <Search className="h-4 w-4" />
            Zur Startseite
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/signup">Eigenen Account erstellen</Link>
        </Button>
      </div>
    </main>
  );
}
