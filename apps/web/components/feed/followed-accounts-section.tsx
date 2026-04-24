'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { BadgeCheck, Compass, Loader2, Users } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { FollowedAccount } from '@/lib/data/feed';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// FollowedAccountsSection — TikTok-Parity-Sidebar-Sektion „Konten, denen ich
// folge" (v1.w.UI.11 Phase B).
//
// Zeigt bis zu `initial.length` (SSR-gefetcht, Default 5) Rows der Accounts
// denen der Viewer folgt. Darunter „Alle anzeigen"-Button der ein linksseitiges
// Sheet öffnet mit der vollständigen Liste — lazy-geladen beim ersten Open via
// `/api/follows/me`, gecacht solange der Sheet offen bleibt.
//
// Wird nur für eingeloggte User in der Sidebar gemountet. Für Logged-out und
// Mobile (`< xl:block` auf dem Sidebar-Container in FeedSidebar) gar nicht
// gerendert.
//
// Empty-State (kein einziger Follow): dezenter Hinweis + Link zu `/explore`.
// TikTok zeigt in dem Fall gar keine Sektion — aber ein freundlicher Pointer
// ins Explore ist hier die bessere UX, weil die Sektion sonst verschwinden
// und der User nicht lernt, dass sie existiert.
// -----------------------------------------------------------------------------

interface FollowedAccountsSectionProps {
  initial: FollowedAccount[];
  /**
   * Schwelle ab der „Alle anzeigen" sichtbar wird. Default 5 — entspricht
   * der initial-SSR-Länge. Wenn der Viewer weniger als 5 Follows hat, macht
   * „Alle anzeigen" keinen Sinn (Liste ist schon vollständig).
   */
  revealAllThreshold?: number;
}

export function FollowedAccountsSection({
  initial,
  revealAllThreshold = 5,
}: FollowedAccountsSectionProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (initial.length === 0) {
    return (
      <section aria-label="Gefolgte Accounts" className="px-3">
        <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          <Users className="h-3.5 w-3.5" />
          Konten, denen ich folge
        </h2>
        <Link
          href={'/explore' as Route}
          className="flex items-center gap-2 rounded-md px-1 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Compass className="h-4 w-4" />
          <span>Accounts entdecken</span>
        </Link>
      </section>
    );
  }

  const canRevealMore = initial.length >= revealAllThreshold;

  return (
    <section aria-label="Gefolgte Accounts" className="flex flex-col gap-1 px-1">
      <h2 className="mb-1 flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
        <Users className="h-3.5 w-3.5" />
        Konten, denen ich folge
      </h2>

      <ul className="flex flex-col">
        {initial.map((a) => (
          <li key={a.id}>
            <AccountRow account={a} />
          </li>
        ))}
      </ul>

      {canRevealMore && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="mt-0.5 self-start rounded-md px-2 py-1.5 text-xs font-medium text-primary hover:bg-muted/60"
        >
          Alle anzeigen
        </button>
      )}

      <FollowedAccountsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initial={initial}
      />
    </section>
  );
}

// -----------------------------------------------------------------------------
// AccountRow — eine einzelne Avatar + Name-Zeile, kompakt für die Sidebar-
// Hauptansicht. Größer/breiter Zwilling lebt als `AccountRowFull` weiter unten.
// -----------------------------------------------------------------------------

function AccountRow({ account }: { account: FollowedAccount }) {
  const label = account.display_name ?? account.username;
  const initials = (account.display_name ?? account.username).slice(0, 2).toUpperCase();

  return (
    <Link
      href={`/u/${account.username}` as Route}
      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted"
      aria-label={`Profil von @${account.username}`}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={account.avatar_url ?? undefined} alt="" />
        <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 truncate text-[13px] font-semibold text-foreground">
          <span className="truncate">{label}</span>
          {account.verified && (
            <BadgeCheck className="h-3 w-3 shrink-0 text-brand-gold" aria-label="Verifiziert" />
          )}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">@{account.username}</div>
      </div>
    </Link>
  );
}

// -----------------------------------------------------------------------------
// FollowedAccountsSheet — Vollständige Liste aller Follows. Lazy-Load on
// first-open via `/api/follows/me`, danach im State gecacht. Nutzt den
// bestehenden shadcn/ui Sheet (Radix-Dialog) von links — passt visuell zur
// Sidebar, aus der der Trigger kommt.
//
// Pagination läuft chunk-weise (100er-Pakete). „Mehr laden"-Button am Listen-
// Ende statt Intersection-Observer — weil die allermeisten User unter 200
// Follows liegen (ein einziger Klick reicht), und ein Observer zusätzliche
// Complexity für Edge-Cases (Sheet-close-mid-fetch) bringen würde.
// -----------------------------------------------------------------------------

const CHUNK_SIZE = 100;

function FollowedAccountsSheet({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: FollowedAccount[];
}) {
  const [accounts, setAccounts] = useState<FollowedAccount[]>(initial);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChunk = useCallback(
    async (offset: number, mode: 'replace' | 'append') => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/follows/me?limit=${CHUNK_SIZE}&offset=${offset}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('fetch failed');
        const data = (await res.json()) as FollowedAccount[];

        setAccounts((prev) => {
          if (mode === 'replace') return data;
          // De-Dup mit bestehenden IDs (schützt vor Race-Conditions wenn
          // SSR-initial und erster Fetch sich überlappen).
          const seen = new Set(prev.map((a) => a.id));
          return [...prev, ...data.filter((a) => !seen.has(a.id))];
        });
        setHasMore(data.length === CHUNK_SIZE);
      } catch {
        setError('Liste konnte nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // First-open: Initial-Set war nur Top-5 (SSR-Prefetch). Wir holen jetzt die
  // vollen ersten 100 nach und ersetzen das alte Array.
  useEffect(() => {
    if (open && !loadedOnce) {
      setLoadedOnce(true);
      void fetchChunk(0, 'replace');
    }
  }, [open, loadedOnce, fetchChunk]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle>Konten, denen ich folge</SheetTitle>
          <SheetDescription>
            Alle Profile, denen du folgst. Tippe auf einen Account, um das Profil zu öffnen.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {accounts.length === 0 && loading ? (
            <div className="flex flex-1 items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Lädt …
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <Users className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                Du folgst noch niemandem.
              </p>
              <Link
                href={'/explore' as Route}
                className="text-sm font-medium text-primary hover:underline"
                onClick={() => onOpenChange(false)}
              >
                Accounts entdecken →
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border/50">
              {accounts.map((a) => (
                <li key={a.id}>
                  <AccountRowFull account={a} onNavigate={() => onOpenChange(false)} />
                </li>
              ))}
            </ul>
          )}

          {error && (
            <div className="px-6 py-3 text-center text-xs text-destructive">{error}</div>
          )}

          {accounts.length > 0 && hasMore && (
            <div className="border-t p-3">
              <button
                type="button"
                onClick={() => fetchChunk(accounts.length, 'append')}
                disabled={loading}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                  'bg-muted text-foreground hover:bg-muted/80',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Lädt …</span>
                  </>
                ) : (
                  <span>Mehr laden</span>
                )}
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AccountRowFull({
  account,
  onNavigate,
}: {
  account: FollowedAccount;
  onNavigate: () => void;
}) {
  const label = account.display_name ?? account.username;
  const initials = (account.display_name ?? account.username).slice(0, 2).toUpperCase();

  return (
    <Link
      href={`/u/${account.username}` as Route}
      onClick={onNavigate}
      className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-muted"
      aria-label={`Profil von @${account.username}`}
    >
      <Avatar className="h-11 w-11 shrink-0">
        <AvatarImage src={account.avatar_url ?? undefined} alt="" />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 truncate text-sm font-semibold text-foreground">
          <span className="truncate">{label}</span>
          {account.verified && (
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-label="Verifiziert" />
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">@{account.username}</div>
      </div>
    </Link>
  );
}
