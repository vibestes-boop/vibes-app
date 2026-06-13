'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { createBrowserClient } from '@supabase/ssr';
import {
  Clock,
  ExternalLink,
  Gift,
  Loader2,
  MessageCircle,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users2,
  X,
} from 'lucide-react';

import { toggleFollow } from '@/app/actions/engagement';
import { timeoutChatUser } from '@/app/actions/live';
import { cn } from '@/lib/utils';
import { createLiveRealtimeTopic } from './realtime-topic';

interface AudienceRailRow {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  verified: boolean;
  rank: number | null;
  commentsCount: number;
  giftsCount: number;
  totalCoins: number;
  lastActiveAt: string | null;
  joinedAt: string | null;
  isPresent: boolean;
  isModerator: boolean;
}

interface LiveAudienceRailProps {
  sessionId: string;
  hostId: string;
  initialCount: number;
  viewerId: string | null;
  isHost: boolean;
  isModerator: boolean;
  className?: string;
}

interface ProfileRef {
  id: string;
  username: string | null;
  display_name?: string | null;
  avatar_url: string | null;
  verified?: boolean | null;
}

interface CommentRow {
  user_id: string;
  created_at: string;
  profiles: ProfileRef | null;
}

interface GiftRow {
  sender_id: string;
  coin_cost: number | null;
  created_at: string;
  profiles: ProfileRef | null;
}

interface PresenceRow {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
  joined_at: string | null;
  is_moderator: boolean | null;
}

export function LiveAudienceRail({
  sessionId,
  hostId,
  initialCount,
  viewerId,
  isHost,
  isModerator,
  className,
}: LiveAudienceRailProps) {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  );

  const [rows, setRows] = useState<AudienceRailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState<AudienceRailRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadRows() {
      const [audienceResult, commentsResult, giftsResult, moderatorsResult] = await Promise.all([
        supabase.rpc('get_live_session_audience', { p_session_id: sessionId, p_limit: 24 }),
        supabase
          .from('live_comments')
          .select('user_id, created_at, profiles!live_comments_user_id_fkey(id, username, display_name, avatar_url, verified:is_verified)')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })
          .limit(120),
        supabase
          .from('gift_transactions')
          .select('sender_id, coin_cost, created_at, profiles!gift_transactions_sender_id_fkey(id, username, display_name, avatar_url, verified:is_verified)')
          .eq('live_session_id', sessionId)
          .order('created_at', { ascending: false })
          .limit(120),
        supabase
          .from('live_moderators')
          .select('user_id')
          .eq('session_id', sessionId),
      ]);

      if (cancelled) return;

      const byUser = new Map<string, AudienceRailRow>();
      const audienceRows = (audienceResult.data ?? []) as unknown as PresenceRow[];
      const moderatorIds = new Set(
        [
          ...((moderatorsResult.data ?? []) as Array<{ user_id: string }>).map((row) => row.user_id),
          ...audienceRows.filter((row) => row.is_moderator).map((row) => row.user_id),
        ],
      );

      const upsertUser = (
        id: string,
        profile: ProfileRef | null,
        patch: Partial<Pick<AudienceRailRow, 'commentsCount' | 'giftsCount' | 'totalCoins' | 'lastActiveAt' | 'joinedAt' | 'isPresent'>>,
      ) => {
        if (!profile) return;

        const prev = byUser.get(id);
        const username = prev?.username ?? profile.username ?? 'user';
        const lastActiveAt = latestIso(prev?.lastActiveAt ?? null, patch.lastActiveAt ?? null);

        byUser.set(id, {
          id,
          username,
          displayName: prev?.displayName ?? (profile.display_name?.trim() || profile.username || 'User'),
          avatarUrl: prev?.avatarUrl ?? profile.avatar_url,
          verified: prev?.verified ?? !!profile.verified,
          rank: null,
          commentsCount: (prev?.commentsCount ?? 0) + (patch.commentsCount ?? 0),
          giftsCount: (prev?.giftsCount ?? 0) + (patch.giftsCount ?? 0),
          totalCoins: (prev?.totalCoins ?? 0) + (patch.totalCoins ?? 0),
          lastActiveAt,
          joinedAt: prev?.joinedAt ?? patch.joinedAt ?? null,
          isPresent: prev?.isPresent || patch.isPresent || false,
          isModerator: moderatorIds.has(id),
        });
      };

      for (const audience of audienceRows) {
        upsertUser(audience.user_id, {
          id: audience.user_id,
          username: audience.username,
          display_name: audience.display_name,
          avatar_url: audience.avatar_url,
          verified: audience.is_verified,
        }, {
          joinedAt: audience.joined_at,
          isPresent: true,
        });
      }

      for (const gift of (giftsResult.data ?? []) as unknown as GiftRow[]) {
        upsertUser(gift.sender_id, normalizeProfile(gift.profiles), {
          giftsCount: 1,
          totalCoins: gift.coin_cost ?? 0,
          lastActiveAt: gift.created_at,
        });
      }

      for (const comment of (commentsResult.data ?? []) as unknown as CommentRow[]) {
        upsertUser(comment.user_id, normalizeProfile(comment.profiles), {
          commentsCount: 1,
          lastActiveAt: comment.created_at,
        });
      }

      const hasPresenceSnapshot = audienceRows.length > 0;
      const sorted = Array.from(byUser.values())
        .filter((row) => !hasPresenceSnapshot || row.isPresent)
        .sort((a, b) => {
          if (b.isPresent !== a.isPresent) return Number(b.isPresent) - Number(a.isPresent);
          if (b.totalCoins !== a.totalCoins) return b.totalCoins - a.totalCoins;
          if (b.commentsCount !== a.commentsCount) return b.commentsCount - a.commentsCount;
          return Date.parse(b.lastActiveAt ?? b.joinedAt ?? '') - Date.parse(a.lastActiveAt ?? a.joinedAt ?? '');
        })
        .slice(0, 8)
        .map((row, index) => ({ ...row, rank: index + 1 }));

      setRows(sorted);
      setSelectedRow((current) => {
        if (!current) return null;
        return sorted.find((row) => row.id === current.id) ?? null;
      });
      setLoading(false);
    }

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void loadRows();
      }, 450);
    };

    void loadRows();

    const channel = supabase
      .channel(createLiveRealtimeTopic('live-audience-rail', sessionId))
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_comments', filter: `session_id=eq.${sessionId}` },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gift_transactions', filter: `live_session_id=eq.${sessionId}` },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_moderators', filter: `session_id=eq.${sessionId}` },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [sessionId, supabase]);

  return (
    <section className={cn('relative rounded-2xl bg-muted/40 p-3', className)} aria-label="Top Zuschauer">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
          <Users2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Aktiv im Raum
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {initialCount.toLocaleString('de-DE')} live
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl bg-background/65 px-3 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Zuschauer werden geladen.
        </div>
      ) : rows.length > 0 ? (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <AudienceRailItem
              key={row.id}
              row={row}
              selected={selectedRow?.id === row.id}
              onSelect={() => setSelectedRow((current) => (current?.id === row.id ? null : row))}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-background/65 px-3 py-3 text-xs text-muted-foreground">
          Noch keine sichtbare Chat- oder Gift-Aktivität.
        </div>
      )}

      {selectedRow && (
        <AudienceProfileCard
          row={selectedRow}
          viewerId={viewerId}
          hostId={hostId}
          sessionId={sessionId}
          canModerate={(isHost || isModerator) && selectedRow.id !== hostId}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </section>
  );
}

function AudienceRailItem({
  row,
  selected,
  onSelect,
}: {
  row: AudienceRailRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors',
        selected ? 'bg-background shadow-elevation-1' : 'hover:bg-background/70',
      )}
    >
      <span className="w-4 text-center text-xs font-bold tabular-nums text-rose-500">
        {row.rank ? row.rank : '-'}
      </span>
      <Avatar username={row.username} avatarUrl={row.avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1 text-xs font-semibold text-foreground">
          <span className="truncate">{row.displayName}</span>
          {row.verified && (
            <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-sky-500 text-[9px] font-bold text-white">
              ✓
            </span>
          )}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {row.isModerator ? 'Mod' : `@${row.username}`}
          {row.isPresent ? ' · im Raum' : ''}
          {row.lastActiveAt ? ` · aktiv ${formatRelativeLiveTime(row.lastActiveAt)}` : row.joinedAt ? ` · seit ${formatRelativeLiveTime(row.joinedAt)}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {row.isPresent && row.totalCoins === 0 && row.commentsCount === 0 && (
          <span className="inline-flex items-center rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
            live
          </span>
        )}
        {row.totalCoins > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-600">
            <Gift className="h-3 w-3" aria-hidden="true" />
            {formatCompact(row.totalCoins)}
          </span>
        )}
        {row.commentsCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            <MessageCircle className="h-3 w-3" aria-hidden="true" />
            {formatCompact(row.commentsCount)}
          </span>
        )}
      </div>
      {row.rank === 1 && (
        <span className="shrink-0 text-xs font-bold text-amber-500" aria-hidden="true">
          #1
        </span>
      )}
    </button>
  );
}

function AudienceProfileCard({
  row,
  viewerId,
  hostId,
  sessionId,
  canModerate,
  onClose,
}: {
  row: AudienceRailRow;
  viewerId: string | null;
  hostId: string;
  sessionId: string;
  canModerate: boolean;
  onClose: () => void;
}) {
  const [following, setFollowing] = useState(false);
  const [loadedFollowState, setLoadedFollowState] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [timeoutPending, startTimeoutTransition] = useTransition();
  const [timeoutSent, setTimeoutSent] = useState(false);
  const isSelf = viewerId === row.id;

  useEffect(() => {
    if (!viewerId || isSelf) {
      setFollowing(false);
      setLoadedFollowState(true);
      return;
    }

    let cancelled = false;
    setFollowing(false);
    setLoadedFollowState(false);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', viewerId)
      .eq('following_id', row.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setFollowing(!!data);
        setLoadedFollowState(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isSelf, row.id, viewerId]);

  const handleFollow = () => {
    if (!viewerId || isSelf || isPending) return;
    const previous = following;
    setFollowing(!previous);
    startTransition(async () => {
      const result = await toggleFollow(row.id, previous, false);
      if (!result.ok) {
        setFollowing(previous);
        return;
      }
      setFollowing(result.data.following);
    });
  };

  const handleTimeout = (seconds: number) => {
    if (!canModerate || timeoutPending) return;
    startTimeoutTransition(async () => {
      const result = await timeoutChatUser(sessionId, row.id, seconds);
      if (result.ok) setTimeoutSent(true);
    });
  };

  return (
    <div className="absolute inset-x-3 top-full z-20 mt-2 overflow-hidden rounded-2xl bg-background shadow-elevation-3 ring-1 ring-border">
      <div className="flex items-start gap-3 p-3">
        <Avatar username={row.username} avatarUrl={row.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1 text-sm font-bold text-foreground">
            <span className="truncate">{row.displayName}</span>
            {row.verified && (
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-sky-500 text-[10px] font-bold text-white">
                ✓
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">@{row.username}</p>
          {row.isPresent && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-1 text-[11px] font-semibold text-emerald-600">
              <Users2 className="h-3 w-3" aria-hidden="true" />
              Gerade im Raum
            </p>
          )}
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
            <MessageCircle className="h-3 w-3" aria-hidden="true" />
            {row.commentsCount.toLocaleString('de-DE')} Chat-Beiträge
          </p>
          {row.totalCoins > 0 && (
            <p className="ml-1 mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-1 text-[11px] font-semibold text-amber-600">
              <Gift className="h-3 w-3" aria-hidden="true" />
              {row.totalCoins.toLocaleString('de-DE')} Coins · {row.giftsCount.toLocaleString('de-DE')} Gifts
            </p>
          )}
          {row.isModerator && (
            <p className="ml-1 mt-2 inline-flex items-center gap-1 rounded-full bg-violet-500/12 px-2 py-1 text-[11px] font-semibold text-violet-600">
              <ShieldAlert className="h-3 w-3" aria-hidden="true" />
              Moderator
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Profilkarte schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t p-3">
        {viewerId && !isSelf ? (
          <button
            type="button"
            onClick={handleFollow}
            disabled={!loadedFollowState || isPending}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-colors disabled:opacity-50',
              following
                ? 'bg-muted text-foreground hover:bg-muted/80'
                : 'bg-rose-500 text-white hover:bg-rose-600',
            )}
          >
            {following ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {following ? 'Gefolgt' : 'Folgen'}
          </button>
        ) : (
          <span className="inline-flex items-center justify-center rounded-xl bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground">
            {viewerId ? 'Du' : 'Anmelden'}
          </span>
        )}

        <Link
          href={`/u/${row.username}` as Route}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border bg-background px-3 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted"
          onClick={onClose}
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Profil
        </Link>
      </div>

      {canModerate && !isSelf && row.id !== hostId && (
        <div className="border-t px-3 pb-3 pt-2">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Moderation
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[60, 300, 600].map((seconds) => (
              <button
                key={seconds}
                type="button"
                onClick={() => handleTimeout(seconds)}
                disabled={timeoutPending || timeoutSent}
                className="rounded-lg border bg-background px-2 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-55"
              >
                {seconds / 60} Min
              </button>
            ))}
          </div>
          {timeoutSent && (
            <p className="mt-2 text-[11px] font-medium text-emerald-600">
              Timeout gesetzt.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Avatar({ username, avatarUrl }: { username: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  }

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-xs font-bold text-muted-foreground">
      {username.charAt(0).toUpperCase()}
    </span>
  );
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('de-DE');
}

function latestIso(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

function normalizeProfile(profile: ProfileRef | ProfileRef[] | null): ProfileRef | null {
  if (Array.isArray(profile)) return profile[0] ?? null;
  return profile;
}

function formatRelativeLiveTime(value: string) {
  const diff = Math.max(0, Date.now() - Date.parse(value));
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'gerade';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}
