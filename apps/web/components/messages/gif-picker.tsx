'use client';

// -----------------------------------------------------------------------------
// <GifPicker /> — v1.w.UI.190
//
// Parity with mobile `components/ui/GifPicker.tsx` (Giphy-powered).
//
// Features:
//   • Trending GIFs on mount (no query)
//   • Search with 400 ms debounce
//   • 2-column masonry-ish grid via CSS columns
//   • Click GIF → `onSelect(url)` → parent sends as image_url (no upload needed)
//   • X-button / click-outside closes picker
//   • Keyboard: Escape closes
//   • Giphy attribution (required by API terms)
//
// API:
//   NEXT_PUBLIC_GIPHY_API_KEY — same key as mobile EXPO_PUBLIC_GIPHY_API_KEY
//   Falls back to Giphy public test key if env var not set.
// -----------------------------------------------------------------------------

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const GIPHY_KEY =
  process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65';
const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';
const LIMIT = 24;

interface GiphyImage {
  url: string;
  width: string;
  height: string;
}

interface GiphyResult {
  id: string;
  title: string;
  images: {
    fixed_height: GiphyImage;
    fixed_height_small: GiphyImage;
  };
}

async function fetchGiphy(endpoint: 'trending' | 'search', query?: string): Promise<GiphyResult[]> {
  const params = new URLSearchParams({
    api_key: GIPHY_KEY,
    limit: String(LIMIT),
    rating: 'pg-13',
  });
  if (endpoint === 'search' && query) params.set('q', query);
  const res = await fetch(`${GIPHY_BASE}/${endpoint}?${params}`);
  if (!res.ok) return [];
  const json = await res.json() as { data: GiphyResult[] };
  return json.data ?? [];
}

export interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GiphyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial trending load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchGiphy('trending')
      .then((data) => { if (!cancelled) { setResults(data); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  // Debounced search
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value.trim()) {
      // Back to trending
      searchTimerRef.current = setTimeout(() => {
        setLoading(true);
        setError(false);
        fetchGiphy('trending')
          .then((data) => { setResults(data); setLoading(false); })
          .catch(() => { setError(true); setLoading(false); });
      }, 200);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      setLoading(true);
      setError(false);
      fetchGiphy('search', value.trim())
        .then((data) => { setResults(data); setLoading(false); })
        .catch(() => { setError(true); setLoading(false); });
    }, 400);
  }, []);

  // Click-outside + Escape close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  const handleSelect = useCallback((gif: GiphyResult) => {
    // Use fixed_height for good quality-to-size balance (same as mobile).
    const url = gif.images.fixed_height.url;
    onSelect(url);
  }, [onSelect]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'absolute bottom-full left-0 right-0 mb-2 z-50',
        'flex flex-col rounded-2xl border border-border bg-popover shadow-xl',
        'overflow-hidden',
        'max-h-[380px]',
      )}
      role="dialog"
      aria-label="GIF auswählen"
    >
      {/* Header — search + close */}
      <div className="flex items-center gap-2 border-b border-border bg-popover px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="GIF suchen…"
          autoFocus
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="GIF suchen"
        />
        <button
          type="button"
          onClick={onClose}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Schließen"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-2">
        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && !loading && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            GIFs konnten nicht geladen werden.
          </p>
        )}
        {!loading && !error && results.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Keine GIFs gefunden.
          </p>
        )}
        {!loading && !error && results.length > 0 && (
          /* 2-column grid — CSS columns for masonry-like stacking */
          <div className="columns-2 gap-1 space-y-0">
            {results.map((gif) => {
              const img = gif.images.fixed_height_small;
              const w = parseInt(img.width, 10) || 200;
              const h = parseInt(img.height, 10) || 150;
              return (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => handleSelect(gif)}
                  className="relative mb-1 block w-full overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={gif.title}
                  aria-label={gif.title || 'GIF senden'}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={gif.title || 'GIF'}
                    width={w}
                    height={h}
                    loading="lazy"
                    decoding="async"
                    className="h-auto w-full object-cover transition-opacity hover:opacity-80"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Giphy attribution — required by API ToS */}
      <div className="flex items-center justify-end border-t border-border bg-popover px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Powered by GIPHY
        </span>
      </div>
    </div>
  );
}
