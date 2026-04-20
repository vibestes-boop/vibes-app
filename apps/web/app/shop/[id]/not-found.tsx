import Link from 'next/link';
import type { Route } from 'next';
import { PackageSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ProductNotFound() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <div className="rounded-full bg-muted p-4">
        <PackageSearch className="h-10 w-10 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold">Produkt nicht gefunden</h1>
      <p className="text-sm text-muted-foreground">
        Dieses Produkt wurde entweder entfernt oder hat nie existiert. Schau im Shop nach
        ähnlichen Angeboten.
      </p>
      <Button asChild>
        <Link href={'/shop' as Route}>Zurück zum Shop</Link>
      </Button>
    </div>
  );
}
