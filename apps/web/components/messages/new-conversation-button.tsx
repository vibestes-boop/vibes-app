'use client';

import type { Route } from 'next';
import { useState, useTransition, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Search, UserPlus, BadgeCheck, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { getOrCreateConversation } from '@/app/actions/messages';
import { useI18n } from '@/lib/i18n/client';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface SearchResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
}

export function NewConversationButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
        <UserPlus size={18} />{t('messages.new')}
      </button>
    </DialogTrigger>
    {open && <UserPickerModal onClose={() => setOpen(false)} />}
  </Dialog>;
}

function UserPickerModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<'search' | 'open' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [isPending, startTransition] = useTransition();
  const searchToken = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    const token = ++searchToken.current;
    const trimmed = query.trim().replace(/^@/, '');
    setResults([]);
    setError(null);
    setLoading(trimmed.length >= 2);
    if (trimmed.length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const client = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        const { data, error: searchError } = await client.from('profiles')
          .select('id, username, display_name, avatar_url, verified:is_verified')
          .ilike('username', `%${trimmed.replace(/[\\%_]/g, '\\$&')}%`).limit(20);
        if (searchError) throw searchError;
        if (token === searchToken.current) setResults((data as SearchResult[]) ?? []);
      } catch {
        if (token === searchToken.current) setError('search');
      } finally {
        if (token === searchToken.current) setLoading(false);
      }
    }, 200);
    return () => { clearTimeout(timer); searchToken.current += 1; };
  }, [query, attempt]);

  const onPick = useCallback((userId: string) => {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await getOrCreateConversation(userId);
        if (!result.ok) throw new Error('Conversation unavailable');
        if (!mounted.current) return;
        onClose();
        router.push(`/messages/${result.data.id}` as Route);
      } catch {
        if (mounted.current) setError('open');
      }
    });
  }, [isPending, router, onClose]);

  return <DialogContent className="serlo-user-picker top-[10%] flex max-h-[80dvh] w-[calc(100%_-_2rem)] max-w-md translate-y-0 flex-col gap-4 rounded-3xl p-5 sm:rounded-3xl">
    <div className="pr-12">
      <DialogTitle>{t('messages.newConversation')}</DialogTitle>
      <DialogDescription className="mt-2">{t('messages.searchHint')}</DialogDescription>
    </div>
    <div className="flex shrink-0 items-center gap-2 rounded-full border bg-background px-4">
      <Search size={18} className="shrink-0 text-muted-foreground" />
      <input value={query} onChange={event => setQuery(event.target.value)} aria-label={t('messages.searchUser')}
        placeholder={t('messages.usernamePlaceholder')} className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
      {loading && <Loader2 size={18} aria-label={t('common.loading')} className="shrink-0 animate-spin" />}
    </div>
    {error && <div role="alert" className="text-sm text-destructive">
      {t(error === 'search' ? 'messages.searchFailed' : 'messages.openFailed')}
      {error === 'search' && <button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-2 block min-h-11 rounded-full border px-4 text-foreground">{t('common.retry')}</button>}
    </div>}
    <div className="min-h-0 overflow-y-auto overscroll-contain" aria-busy={loading || isPending}>
      {results.length === 0 && !loading && !error && query.trim().replace(/^@/, '').length >= 2 && <p role="status" className="py-6 text-center text-sm text-muted-foreground">{t('messages.noPeople')}</p>}
      <ul className="divide-y divide-border">
        {results.map(person => <li key={person.id}>
          <button type="button" disabled={isPending} onClick={() => onPick(person.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-muted/50 disabled:opacity-50">
            <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-sm font-semibold">
              {person.avatar_url ? <Image src={person.avatar_url} alt="" fill sizes="44px" className="object-cover" /> : (person.display_name ?? person.username).slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5"><span className="truncate font-medium">{person.display_name ?? `@${person.username}`}</span>{person.verified && <BadgeCheck size={16} className="shrink-0" />}</span>
              <span className="block truncate text-xs text-muted-foreground">@{person.username}</span>
            </span>
          </button>
        </li>)}
      </ul>
    </div>
  </DialogContent>;
}
