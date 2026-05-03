import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, Edit } from 'lucide-react';
import { ProductForm } from '@/components/shop/product-form';
import { getProduct } from '@/lib/data/shop';
import { getUser } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Produkt bearbeiten · Shop-Studio',
  description: 'Passe Preis, Titel, Bilder oder Beschreibung deines Produkts an.',
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect(`/login?next=/studio/shop/${id}/edit`);

  const product = await getProduct(id);
  if (!product) notFound();

  // Ownership-Check — Edit-Seite ist kein RLS-Gate, das sitzt auf dem
  // UPDATE. Aber wir wollen hier nicht die Form einer fremden Person zeigen.
  if (product.seller_id !== user.id) redirect('/studio/shop' as Route);

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
          <Edit className="h-6 w-6 text-primary" />
          Produkt bearbeiten
        </h1>
        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">&bdquo;{product.title}&quot;</p>
      </div>

      <ProductForm existing={product} />
    </div>
  );
}
