'use client';

import { useState, useTransition, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Search, UserPlus, X, BadgeCheck, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { getOrCreateConversation } from '@/app/actions/messages';

// -----------------------------------------------------------------------------
// NewConversationButton — "Neu"-Button im Messages-Header. Öffnet ein Modal
// mit Live-Suche über Profile (username ILIKE). Bei Klick auf einen User
// wird via `getOrCreateConversation`-Action eine DM erstellt/gefunden und
// dann nach `/messages/{id}` gepusht.
// -----------------------------------------------------------------------------

interface SearchResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
}

function supa() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export function NewConversationButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <UserPlus className="h-4 w-4" />
        Neu
      </button>
      {open && <UserPickerModal onClose={() => setOpen(false)} />}
    </>
  );
}

function UserPickerModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const searchTokenRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    const token = ++searchTokenRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supa()
        .from('profiles')
        .select('id, username, display_name, avatar_url, verified')
        .ilike('username', `%${trimmed}%`)
        .limit(20);
      if (token !== searchTokenRef.current) return;
      setResults((data as SearchResult[]) ?? []);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const onPick = useCallback(
    (userId: string) => {
      startTransition(async () => {
        const res = await getOrCreateConversation(userId);
        if (!res.ok) return;
        onClose();
        router.push(`/messages/${res.data.id}`);
      });
    },
    [router, onClose],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[10vh] backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl"
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">Neue Unterhaltung</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="@username oder Name"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {query.trim().length < 2 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Tippe mindestens 2 Zeichen.
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Keine Treffer.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onPick(r.id)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="relative h-[52px] w-[52px] flex-none overflow-hidden rounded-full bg-muted">
                      {r.avatar_url && (
                        <Image
                          src={r.avatar_url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="52px"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium">
                          {r.display_name ?? `@${r.username}`}
                        </span>
                        {r.verified && <BadgeCheck className="h-4 w-4 flex-none text-sky-500" />}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">@{r.username}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
