import Link from 'next/link';
import type { Route } from 'next';
import { Package, ArrowLeft } from 'lucide-react';

export default function EditProductNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Package className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold">Produkt nicht gefunden</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Dieses Produkt existiert nicht oder gehört dir nicht.
      </p>
      <Link
        href={'/studio/shop' as Route}
        className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Zurück zum Shop-Studio
      </Link>
    </div>
  );
}
