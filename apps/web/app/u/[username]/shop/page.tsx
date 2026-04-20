import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { BadgeCheck, ArrowLeft, Store } from 'lucide-react';
import { ProductCard } from '@/components/shop/product-card';
import { getPublicProfile } from '@/lib/data/public';
import { getMerchantProducts } from '@/lib/data/shop';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) return { title: 'Shop nicht gefunden' };
  return {
    title: `Shop von @${profile.username} · Serlo`,
    description:
      profile.bio ??
      `Alle Produkte von @${profile.username} — Shop-Storefront auf Serlo.`,
    openGraph: {
      title: `Shop von @${profile.username}`,
      description: profile.bio ?? undefined,
      images: profile.avatar_url ? [profile.avatar_url] : [],
    },
  };
}

export default async function MerchantShopPage({ params }: PageProps) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  const products = await getMerchantProducts(profile.id, 60);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      {/* Breadcrumb */}
      <Link
        href={`/u/${profile.username}` as Route}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück zu @{profile.username}
      </Link>

      {/* Merchant-Header */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center">
        <div className="relative h-20 w-20 flex-none overflow-hidden rounded-full bg-muted ring-2 ring-primary/20">
          {profile.avatar_url && (
            <Image src={profile.avatar_url} alt="" fill className="object-cover" sizes="80px" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h1 className="text-2xl font-semibold">
              {profile.display_name ?? `@${profile.username}`}
            </h1>
            {profile.verified && <BadgeCheck className="h-5 w-5 text-sky-500" />}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Store className="h-4 w-4" />
            Shop
            <span className="text-muted-foreground/40">·</span>
            <span>{products.length} Produkt{products.length === 1 ? '' : 'e'}</span>
          </div>
          {profile.bio && (
            <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{profile.bio}</p>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="mt-8">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <div className="text-4xl">📭</div>
            <p className="text-sm text-muted-foreground">
              @{profile.username} hat aktuell keine aktiven Produkte.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
