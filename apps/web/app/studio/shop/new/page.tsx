import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, Plus } from 'lucide-react';
import { ProductForm } from '@/components/shop/product-form';
import { getUser } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Neues Produkt · Shop-Studio',
  description: 'Lege ein neues Produkt in deinem Shop an.',
};

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=/studio/shop/new');

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      <Link
        href={'/studio/shop' as Route}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück zum Shop-Studio
      </Link>

      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Plus className="h-6 w-6 text-primary" />
          Neues Produkt
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fülle die Felder aus — du kannst danach jederzeit noch anpassen.
        </p>
      </div>

      <ProductForm existing={null} />
    </div>
  );
}
