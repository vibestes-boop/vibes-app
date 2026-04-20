'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { Search, Loader2, X } from 'lucide-react';

// -----------------------------------------------------------------------------
// ShopSearchInput — schreibt `?q=` in die aktuelle Shop-URL. Debounced, damit
// wir nicht für jeden Keystroke einen Server-Refresh triggern.
// -----------------------------------------------------------------------------

export function ShopSearchInput({ initialQuery = '' }: { initialQuery?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  // 300ms Debounce
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = value.trim();
      const current = params.get('q') ?? '';
      if (trimmed === current) return;
      const next = new URLSearchParams(params.toString());
      if (trimmed.length >= 2) next.set('q', trimmed);
      else next.delete('q');
      const qs = next.toString();
      const url = (qs ? `${pathname}?${qs}` : pathname) as Route;
      startTransition(() => router.replace(url));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative flex items-center">
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Produkte suchen …"
        className="h-10 w-full rounded-full border bg-muted/50 pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-background"
      />
      {isPending ? (
        <Loader2 className="absolute right-3 h-4 w-4 animate-spin text-muted-foreground" />
      ) : value ? (
        <button
          type="button"
          onClick={() => setValue('')}
          className="absolute right-3 rounded-full p-0.5 text-muted-foreground hover:bg-muted"
          aria-label="Suche löschen"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
