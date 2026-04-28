'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

// -----------------------------------------------------------------------------
// ConversationSearch — Suche innerhalb einer DM-Konversation (v1.w.UI.78).
//
// Rendert einen Search-Icon-Button rechts im Thread-Header. Bei Aktivierung:
//   1. Header-Overlay mit Suchfeld (ESC / X → zurück).
//   2. Debounced Supabase-Query (200ms): `messages.content ILIKE '%term%'`
//      gefiltert auf `conversation_id`. RLS stellt sicher dass nur eigene
//      Konversationen durchsuchbar sind (kein extra Auth-Check nötig).
//   3. Ergebnis-Panel: bis zu 20 Treffer, chronologisch neu → alt.
//      Pro Treffer: Zeitstempel + Content-Excerpt mit Suchterm-Highlight.
//
// „Scroll to message" wurde bewusst zurückgestellt (v2-Scope): die geladenen
// 80 Messages sind ggf. nicht vollständig, Scroll-Target wäre oft nicht im
// DOM. Für v1 genügt der Read-Only-Überblick.
// -----------------------------------------------------------------------------

interface SearchResult {
  id: string;
  content: string | null;
  created_at: string;
  sender_id: string;
}

function supa() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function formatMsgTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const timeFmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
  const hhmm = timeFmt.format(d);
  // Heute
  if (d.toDateString() === now.toDateString()) return hhmm;
  // Gestern
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Gestern ${hhmm}`;
  // Älter: z.B. "14. Apr, 09:30"
  const dateFmt = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });
  return `${dateFmt.format(d)}, ${hhmm}`;
}

/** Hebt das Suchterm im Text hervor (case-insensitive). */
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term.trim()) return <>{text}</>;
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-brand-gold/30 text-foreground rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

interface ConversationSearchProps {
  conversationId: string;
  viewerId: string;
}

export function ConversationSearch({ conversationId, viewerId }: ConversationSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTokenRef = useRef(0);

  // ESC → schließen
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Autofokus nach Öffnen
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Debounced Supabase-Query
  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const token = ++searchTokenRef.current;
    setLoading(true);
    const tid = setTimeout(async () => {
      const { data } = await supa()
        .from('messages')
        .select('id, content, created_at, sender_id')
        .eq('conversation_id', conversationId)
        .not('content', 'is', null)
        .ilike('content', `%${trimmed}%`)
        .order('created_at', { ascending: false })
        .limit(20);
      if (token !== searchTokenRef.current) return;
      setResults((data as SearchResult[]) ?? []);
      setLoading(false);
    }, 200);
    return () => clearTimeout(tid);
  }, [query, open, conversationId]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults([]);
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="In Unterhaltung suchen"
        className="grid h-9 w-9 flex-none place-items-center rounded-full transition-colors hover:bg-muted"
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }

  // ── Aktiver Suchmodus ────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex flex-col border-b bg-background/98 backdrop-blur">
      {/* Suchfeld-Zeile */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Search className="h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="In Nachrichten suchen…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Suchbegriff eingeben"
        />
        {loading && (
          <Loader2 className="h-4 w-4 flex-none animate-spin text-muted-foreground" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Suche schließen"
          className="grid h-8 w-8 flex-none place-items-center rounded-full transition-colors hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Ergebnis-Panel */}
      {query.trim().length >= 2 && (
        <div className="max-h-[50dvh] overflow-y-auto border-t">
          {!loading && results.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-muted-foreground">
              Keine Treffer für „{query.trim()}".
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((r) => (
                <li key={r.id} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {r.sender_id === viewerId ? 'Du' : 'Kontakt'}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground/70">
                      {formatMsgTime(r.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-foreground">
                    <Highlight text={r.content ?? ''} term={query.trim()} />
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
