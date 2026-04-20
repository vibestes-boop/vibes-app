import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="text-8xl font-bold tracking-tighter text-muted-foreground/40">404</div>
      <div>
        <h1 className="text-2xl font-semibold">Seite nicht gefunden</h1>
        <p className="mt-2 text-muted-foreground">Die Adresse existiert nicht oder wurde verschoben.</p>
      </div>
      <Button asChild>
        <Link href="/">Zurück zur Startseite</Link>
      </Button>
    </main>
  );
}
