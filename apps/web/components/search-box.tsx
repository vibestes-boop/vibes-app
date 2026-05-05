'use client';

import { useState, useTransition, useRef, useEffect, useCallback, useId } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { Route } from 'next';
import { Search, Loader2, Hash, BadgeCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuickSearchResult } from '@/app/api/search/quick/route';

// -----------------------------------------------------------------------------
// SearchBox — Input mit Live-Autocomplete-Dropdown (v1.w.UI.48).
//
// Architektur:
//  1. Debounce 220ms nach letztem Tastendruck → Fetch /api/search/quick
//  2. Dropdown: ≤5 User + ≤4 Hashtags + "Alle Ergebnisse"-Footer
//  3. Keyboard: ↑/↓ navigieren, Enter auf Item wählt aus, Escape schließt
//  4. Außerhalb-Klick schließt (mousedown-Guard)
//  5. Form-Submit / Enter ohne aktives Item → volle Suche auf /search?q=…
// -----------------------------------------------------------------------------

const DEBOUNCE_MS = 220;
const MIN_LEN = 2;

type SuggestionItem =
  | { kind: 'user'; id: string; username: string; display_name: string | null; avatar_url: string | null; verified: boolean }
  | { kind: 'hashtag'; tag: string; post_count: number }
  | { kind: 'all'; q: string };

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

  const [results, setResults] = useState<QuickSearchResult | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [isFetching, setIsFetching] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listboxId = useId();

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < MIN_LEN) {
      setResults(null);
      setDropdownOpen(false);
      return;
    }
    setIsFetching(true);
    try {
      const res = await fetch(
        `/api/search/quick?q=${encodeURIComponent(q.trim())}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const data: QuickSearchResult = await res.json();
      setResults(data);
      setDropdownOpen(data.users.length > 0 || data.hashtags.length > 0);
      setActiveIdx(-1);
    } catch {
      // silent — fall back to form submit
    } finally {
      setIsFetching(false);
    }
  }, []);

  // ── Debounced onChange ────────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < MIN_LEN) {
      setResults(null);
      setDropdownOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(v), DEBOUNCE_MS);
  };

  // ── Außerhalb-Klick ───────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        inputRef.current &&
        !inputRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setDropdownOpen(false);
        setActiveIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Cleanup Debounce bei Unmount ──────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Flatte Suggestions für Keyboard-Nav ──────────────────────────────────

  const items: SuggestionItem[] = [
    ...(results?.users ?? []).map(
      (u): SuggestionItem => ({ kind: 'user', ...u }),
    ),
    ...(results?.hashtags ?? []).map(
      (h): SuggestionItem => ({ kind: 'hashtag', ...h }),
    ),
  ];
  if (value.trim().length >= MIN_LEN) {
    items.push({ kind: 'all', q: value.trim() });
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  const navigate = (item: SuggestionItem) => {
    setDropdownOpen(false);
    setActiveIdx(-1);
    if (item.kind === 'user') {
      setValue(item.username);
      startTransition(() => router.push(`/u/${item.username}` as Route));
    } else if (item.kind === 'hashtag') {
      setValue(`#${item.tag}`);
      startTransition(() =>
        router.push(`/t/${encodeURIComponent(item.tag)}` as Route),
      );
    } else {
      startTransition(() =>
        router.push(`/search?q=${encodeURIComponent(item.q)}` as Route),
      );
    }
  };

  const submitSearch = (q: string = value) => {
    const trimmed = q.trim();
    if (trimmed.length < MIN_LEN) return;
    setDropdownOpen(false);
    startTransition(() =>
      router.push(`/search?q=${encodeURIComponent(trimmed)}` as Route),
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIdx >= 0 && activeIdx < items.length) {
      e.preventDefault();
      navigate(items[activeIdx]!);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDropdownOpen(false);
      setActiveIdx(-1);
    }
  };

  const clearInput = () => {
    setValue('');
    setResults(null);
    setDropdownOpen(false);
    setActiveIdx(-1);
    inputRef.current?.focus();
  };

  return (
    <div
      className={cn('relative', className)}
      role="combobox"
      aria-expanded={dropdownOpen}
      aria-haspopup="listbox"
      aria-controls={listboxId}
      aria-owns={listboxId}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (activeIdx >= 0 && activeIdx < items.length) {
            navigate(items[activeIdx]!);
          } else {
            submitSearch();
          }
        }}
        role="search"
        className="relative flex items-center"
      >
        <label htmlFor="search-input" className="sr-only">Suche</label>
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          id="search-input"
          type="search"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results && (results.users.length > 0 || results.hashtags.length > 0)) {
              setDropdownOpen(true);
            }
          }}
          placeholder="Suche Accounts, Videos, Hashtags…"
          autoComplete="off"
          autoFocus={autoFocus}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeIdx >= 0 ? `search-item-${activeIdx}` : undefined}
          className="h-11 w-full rounded-full border border-border bg-muted/50 pl-10 pr-10 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-background"
        />
        <div className="absolute right-3 flex items-center">
          {isPending || isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : value.length > 0 ? (
            <button
              type="button"
              onClick={clearInput}
              aria-label="Suche löschen"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </form>

      {/* ── Autocomplete Dropdown ────────────────────────────────────────── */}
      {dropdownOpen && items.length > 0 && (
        <div
          ref={dropdownRef}
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl"
        >
          {/* User-Sektion */}
          {results?.users && results.users.length > 0 && (
            <div>
              <div className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Accounts
              </div>
              {results.users.map((u, i) => {
                const initials = (u.display_name ?? u.username).slice(0, 2).toUpperCase();
                const isActive = activeIdx === i;
                return (
                  <button
                    key={u.id}
                    id={`search-item-${i}`}
                    role="option"
                    aria-selected={isActive}
                    type="button"
                    onClick={() => navigate({ kind: 'user', ...u })}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                      isActive ? 'bg-accent' : 'hover:bg-accent/60',
                    )}
                  >
                    {u.avatar_url ? (
                      <Image
                        src={u.avatar_url}
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {initials}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 truncate text-sm font-medium text-foreground">
                        <span className="truncate">{u.display_name ?? u.username}</span>
                        {u.verified && (
                          <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-brand-gold text-background" />
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">@{u.username}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Hashtag-Sektion */}
          {results?.hashtags && results.hashtags.length > 0 && (
            <div>
              {results.users && results.users.length > 0 && (
                <div className="mx-3 border-t border-border/50" />
              )}
              <div className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Hashtags
              </div>
              {results.hashtags.map((h, offset) => {
                const i = (results.users?.length ?? 0) + offset;
                const isActive = activeIdx === i;
                return (
                  <button
                    key={h.tag}
                    id={`search-item-${i}`}
                    role="option"
                    aria-selected={isActive}
                    type="button"
                    onClick={() => navigate({ kind: 'hashtag', ...h })}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                      isActive ? 'bg-accent' : 'hover:bg-accent/60',
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Hash className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">#{h.tag}</div>
                      <div className="text-xs text-muted-foreground">
                        {h.post_count.toLocaleString('de-DE')} Videos
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* "Alle Ergebnisse" Footer */}
          {(() => {
            const allIdx = items.length - 1;
            const isActive = activeIdx === allIdx;
            return (
              <button
                id={`search-item-${allIdx}`}
                role="option"
                aria-selected={isActive}
                type="button"
                onClick={() => submitSearch()}
                className={cn(
                  'flex w-full items-center gap-2 border-t border-border/50 px-3 py-2.5 text-left text-sm transition-colors',
                  isActive ? 'bg-accent' : 'hover:bg-accent/60',
                )}
              >
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Alle Ergebnisse für{' '}
                  <span className="font-semibold text-foreground">&bdquo;{value.trim()}&quot;</span>
                </span>
              </button>
            );
          })()}
        </div>
      )}
    </div>
  );
}
