'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Image from 'next/image';
import { Loader2, X, Plus, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createProduct, updateProduct } from '@/app/actions/shop';
import type { ProductCategory } from '@shared/types';
import type { ShopProduct } from '@/lib/data/shop';

// -----------------------------------------------------------------------------
// ProductForm — shared Create/Edit. Keine react-hook-form Abhängigkeit hier,
// weil die Form-Felder simpel sind und wir die Zod-Validation server-seitig haben
// (die Server-Action gibt uns den ersten Error als `result.error`, was wir als
// Toast rausreichen).
//
// Bild-URLs werden als Text eingegeben — eine echte Drag-Drop-Upload-UI auf R2
// kommt mit Phase 8 (Create-Flow). Bis dahin: User pasted URLs.
// -----------------------------------------------------------------------------

const CATEGORIES: Array<{ id: ProductCategory; label: string; hint: string }> = [
  { id: 'physical', label: '📦 Physisch', hint: 'Wird verschickt.' },
  { id: 'digital', label: '💾 Digital', hint: 'Download-Link.' },
  { id: 'service', label: '✨ Service', hint: 'Kontaktaufnahme nach Kauf.' },
  { id: 'collectible', label: '💎 Collectible', hint: 'Sammelobjekt.' },
];

interface FormState {
  title: string;
  description: string;
  category: ProductCategory;
  price_coins: string;
  sale_price_coins: string;
  stock: string;
  cover_url: string;
  image_urls: string[];
  free_shipping: boolean;
  location: string;
  women_only: boolean;
}

function fromProduct(p: ShopProduct | null): FormState {
  if (!p) {
    return {
      title: '',
      description: '',
      category: 'digital',
      price_coins: '',
      sale_price_coins: '',
      stock: '-1',
      cover_url: '',
      image_urls: [],
      free_shipping: false,
      location: '',
      women_only: false,
    };
  }
  return {
    title: p.title,
    description: p.description ?? '',
    category: p.category,
    price_coins: p.price_coins.toString(),
    sale_price_coins: p.sale_price_coins?.toString() ?? '',
    stock: p.stock.toString(),
    cover_url: p.cover_url ?? '',
    image_urls: p.image_urls,
    free_shipping: p.free_shipping,
    location: p.location ?? '',
    women_only: p.women_only,
  };
}

export function ProductForm({ existing }: { existing: ShopProduct | null }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(fromProduct(existing));
  const [imageInput, setImageInput] = useState('');
  const [isPending, startTransition] = useTransition();

  const price = Number(form.price_coins || 0);
  const salePrice = form.sale_price_coins ? Number(form.sale_price_coins) : null;
  const salePercent =
    salePrice && price > 0 ? Math.round(((price - salePrice) / price) * 100) : null;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addImage = () => {
    const trimmed = imageInput.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      toast.error('Ungültige URL');
      return;
    }
    if (form.image_urls.length >= 10) {
      toast.error('Maximal 10 Bilder');
      return;
    }
    update('image_urls', [...form.image_urls, trimmed]);
    setImageInput('');
  };

  const removeImage = (i: number) => {
    update(
      'image_urls',
      form.image_urls.filter((_, idx) => idx !== i),
    );
  };

  const handleSubmit = () => {
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      price_coins: Number(form.price_coins),
      sale_price_coins: form.sale_price_coins ? Number(form.sale_price_coins) : null,
      stock: Number(form.stock),
      cover_url: form.cover_url.trim() || null,
      image_urls: form.image_urls,
      free_shipping: form.free_shipping,
      location: form.location.trim() || null,
      women_only: form.women_only,
    };

    startTransition(async () => {
      const result = existing
        ? await updateProduct(existing.id, payload)
        : await createProduct(payload);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (existing) {
        toast.success('Produkt aktualisiert');
        router.push('/studio/shop' as Route);
      } else {
        const newId = (result.data as { id: string }).id;
        toast.success('Produkt angelegt');
        router.push(`/shop/${newId}` as Route);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-6">
        {/* Kategorie */}
        <section>
          <label className="text-sm font-medium">Kategorie</label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORIES.map((c) => {
              const active = form.category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    update('category', c.id);
                    if (c.id !== 'physical') update('free_shipping', false);
                  }}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
                    active
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/40',
                  )}
                >
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="text-[11px] text-muted-foreground">{c.hint}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Titel */}
        <section>
          <label htmlFor="title" className="text-sm font-medium">
            Titel
          </label>
          <input
            id="title"
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="z.B. „Tschetschenisches Kochbuch 2026"
            maxLength={80}
            className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring"
          />
          <div className="mt-1 text-right text-[11px] text-muted-foreground tabular-nums">
            {form.title.length} / 80
          </div>
        </section>

        {/* Beschreibung */}
        <section>
          <label htmlFor="description" className="text-sm font-medium">
            Beschreibung
          </label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Was bekommen Käufer? Details zu Versand, Inhalt, Zustand …"
            rows={6}
            maxLength={2000}
            className="mt-1.5 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <div className="mt-1 text-right text-[11px] text-muted-foreground tabular-nums">
            {form.description.length} / 2000
          </div>
        </section>

        {/* Preise */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="price" className="text-sm font-medium">
              Preis (Coins)
            </label>
            <input
              id="price"
              type="number"
              min={1}
              value={form.price_coins}
              onChange={(e) => update('price_coins', e.target.value)}
              placeholder="1000"
              className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm tabular-nums outline-none focus:border-ring"
            />
          </div>
          <div>
            <label htmlFor="sale-price" className="text-sm font-medium">
              Angebotspreis (Coins){' '}
              <span className="text-muted-foreground">· optional</span>
              {salePercent !== null && (
                <span className="ml-2 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                  −{salePercent}%
                </span>
              )}
            </label>
            <input
              id="sale-price"
              type="number"
              min={1}
              value={form.sale_price_coins}
              onChange={(e) => update('sale_price_coins', e.target.value)}
              placeholder="700"
              className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm tabular-nums outline-none focus:border-ring"
            />
          </div>
        </section>

        {/* Stock + Location */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="stock" className="text-sm font-medium">
              Lagerbestand
            </label>
            <input
              id="stock"
              type="number"
              value={form.stock}
              onChange={(e) => update('stock', e.target.value)}
              placeholder="-1 = unbegrenzt"
              className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm tabular-nums outline-none focus:border-ring"
            />
            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Info className="h-3 w-3" />
              <span>-1 = unbegrenzt, 0 = ausverkauft</span>
            </div>
          </div>
          <div>
            <label htmlFor="location" className="text-sm font-medium">
              Standort <span className="text-muted-foreground">· optional</span>
            </label>
            <input
              id="location"
              type="text"
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder="z.B. Berlin, Europe, Worldwide"
              maxLength={120}
              className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring"
            />
          </div>
        </section>

        {/* Bilder */}
        <section>
          <label className="text-sm font-medium">Cover-Bild-URL</label>
          <input
            type="url"
            value={form.cover_url}
            onChange={(e) => update('cover_url', e.target.value)}
            placeholder="https://…"
            className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring"
          />

          <div className="mt-4">
            <label className="text-sm font-medium">
              Gallery <span className="text-muted-foreground">· bis zu 10</span>
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="url"
                value={imageInput}
                onChange={(e) => setImageInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addImage())}
                placeholder="https://…"
                className="h-10 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:border-ring"
              />
              <Button type="button" variant="outline" onClick={addImage}>
                <Plus className="h-4 w-4" />
                Hinzufügen
              </Button>
            </div>
            {form.image_urls.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                {form.image_urls.map((src, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-md bg-muted">
                    <Image src={src} alt="" fill className="object-cover" sizes="120px" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Toggles */}
        <section className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/40">
            <input
              type="checkbox"
              checked={form.free_shipping}
              disabled={form.category !== 'physical'}
              onChange={(e) => update('free_shipping', e.target.checked)}
              className="h-4 w-4 accent-emerald-500"
            />
            <div className="flex-1">
              <div className="text-sm font-medium">Gratis Versand</div>
              <div className="text-xs text-muted-foreground">
                Nur für physische Produkte — wird als grüne Pille angezeigt.
              </div>
            </div>
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/40">
            <input
              type="checkbox"
              checked={form.women_only}
              onChange={(e) => update('women_only', e.target.checked)}
              className="h-4 w-4 accent-pink-500"
            />
            <div className="flex-1">
              <div className="text-sm font-medium">Nur für Frauen</div>
              <div className="text-xs text-muted-foreground">
                Nur verifiziert-weibliche Käuferinnen sehen das Produkt.
              </div>
            </div>
          </label>
        </section>

        {/* Submit */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/studio/shop' as Route)}
            disabled={isPending}
          >
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isPending} className="flex-1">
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : existing ? (
              'Änderungen speichern'
            ) : (
              'Produkt anlegen'
            )}
          </Button>
        </div>
      </div>

      {/* Live-Preview-Sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-xl border bg-card p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Live-Preview
          </div>
          <div className="mt-3 overflow-hidden rounded-lg border bg-background">
            <div className="relative aspect-[3/4] w-full bg-muted">
              {form.cover_url ? (
                <Image
                  src={form.cover_url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="300px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl opacity-60">
                  📦
                </div>
              )}
              {salePercent !== null && (
                <span className="absolute left-2 top-2 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  −{salePercent}%
                </span>
              )}
            </div>
            <div className="p-3">
              <div className="line-clamp-2 min-h-[2.5rem] text-sm font-medium">
                {form.title || 'Dein Produkt-Titel'}
              </div>
              <div className="mt-1 text-base font-semibold tabular-nums">
                🪙{' '}
                {(form.sale_price_coins ? Number(form.sale_price_coins) : price).toLocaleString(
                  'de-DE',
                )}
                {salePrice && (
                  <span className="ml-1 text-xs text-muted-foreground line-through">
                    {price.toLocaleString('de-DE')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
