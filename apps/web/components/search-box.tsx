'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// SearchBox — Input + Submit, pusht `/search?q=…`.
// Shared zwischen der dedizierten Suchseite und dem Header (später).
// -----------------------------------------------------------------------------

export function SearchBox({
  initialQuery = '',
  className,
  autoFocus = false,
}: {
  initialQuery?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  const submit = (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    const params = new URLSearchParams({ q: trimmed });
    startTransition(() => {
      router.push(`/search?${params.toString()}` as Route);
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
      className={cn('relative flex items-center', className)}
      role="search"
    >
      <label htmlFor="search-input" className="sr-only">
        Suche
      </label>
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
      <input
        id="search-input"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Suche Accounts, Videos, Hashtags…"
        autoComplete="off"
        autoFocus={autoFocus}
        className="h-11 w-full rounded-full border border-border bg-muted/50 pl-10 pr-10 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-background"
      />
      {isPending && (
        <Loader2 className="absolute right-3 h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </form>
  );
}
