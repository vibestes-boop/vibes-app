'use client';

// -----------------------------------------------------------------------------
// <LiveAudienceModal /> — v1.w.UI.195
//
// TikTok-style audience viewer sheet. Opens when the viewer-count pill is
// tapped on the /live/[id] viewer page.
//
// Architecture (mirror of mobile ViewerListSheet.tsx):
//  • Top-Gifter rows first (ranked 1…N, sorted by coin total for this session)
//    fetched from `live_gifts` aggregated by sender_id.
//  • Non-gifting chatters below (deduped from last 100 live_comments).
//  • Each row: avatar, @username, rank badge, ❤️ host-follower badge, 🛡 mod badge.
//  • Tap a row → mini profile card with Follow + mod grant/revoke (host only).
//  • Sticky self-CTA at bottom: "Gift to become a Top Viewer" (hidden for host).
//  • Mod grant/revoke via supabase.rpc('grant_moderator') / rpc('revoke_moderator').
//  • Host-follower batch-query on audience IDs (like mobile v1.22.3).
//
// Props:
//  open         — controlled open state
//  onClose      — close callback
//  sessionId    — live session UUID
//  hostId       — host user ID (to suppress Follow on self + enable mod actions)
//  viewerId     — current viewer's user ID (null = anonymous)
//  isHost       — true when the current user is the session host
//  onOpenGiftPicker — optional: opens gift picker after modal closes
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Route } from 'next';
import Link from 'next/link';
import { X, Shield, ShieldOff, UserPlus, UserCheck, Gift, Tv2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toggleFollow } from '@/app/actions/engagement';
import { createDuetInvite, type DuetLayout } from '@/app/actions/live-host';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AudienceRow {
  id: string;
  username: string;
  avatarUrl: string | null;
  rank: number | null;       // 1-based position in top-gifter list, null = non-gifter
  totalCoins: number;
  giftsCount: number;
}

interface ProfileCard {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
}

export interface LiveAudienceModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  hostId: string;
  viewerId: string | null;
  isHost?: boolean;
  onOpenGiftPicker?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCoins(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function Avatar({
  url,
  username,
  size = 'md',
}: {
  url: string | null;
  username: string;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={username} className={cn('shrink-0 rounded-full object-cover', dim)} />;
  }
  return (
    <div
      className={cn(
        'shrink-0 flex items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground',
        dim,
      )}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Mini Profile Card ───────────────────────────────────────────────────────

// ─── Duet Layout labels ──────────────────────────────────────────────────────

const LAYOUT_LABELS: Record<DuetLayout, string> = {
  'top-bottom':   'Oben/Unten',
  'side-by-side': 'Nebeneinander',
  'pip':          'Bild-in-Bild',
  'battle':       '⚔️ Battle',
};
const BATTLE_DURATIONS: { secs: number; label: string }[] = [
  { secs: 60,  label: '1 Min' },
  { secs: 180, label: '3 Min' },
  { secs: 300, label: '5 Min' },
];

function ProfileSheet({
  user,
  hostId,
  viewerId,
  isHost,
  sessionId,
  modIds,
  onClose,
}: {
  user: ProfileCard;
  hostId: string;
  viewerId: string | null;
  isHost?: boolean;
  sessionId: string;
  modIds: Set<string>;
  onClose: () => void;
}) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const isSelf = user.id === viewerId;
  const isMod  = modIds.has(user.id);
  const [following, setFollowing]       = useState(false);
  const [followLoading, setFollowLoading] = useState(true);
  const [modBusy, setModBusy]           = useState(false);
  const [reported, setReported]         = useState(false);

  // v1.w.UI.222 — Duet-Invite state (host only)
  const [duetStep, setDuetStep]         = useState<'idle' | 'picking' | 'sent' | 'error'>('idle');
  const [duetLayout, setDuetLayout]     = useState<DuetLayout>('side-by-side');
  const [battleDuration, setBattleDuration] = useState(60);
  const [duetBusy, setDuetBusy]         = useState(false);

  // Fetch follow state
  useEffect(() => {
    if (!viewerId || isSelf) { setFollowLoading(false); return; }
    let cancelled = false;
    supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', viewerId)
      .eq('following_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setFollowing(!!data);
          setFollowLoading(false);
        }
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, viewerId, isSelf]);

  const handleFollow = async () => {
    if (!viewerId || followLoading) return;
    const prev = following;
    setFollowing(!prev);
    try {
      await toggleFollow(user.id, prev, false);
    } catch {
      setFollowing(prev);
    }
  };

  const handleToggleMod = async () => {
    if (!isHost || modBusy) return;
    setModBusy(true);
    try {
      if (isMod) {
        await supabase.rpc('revoke_moderator', { p_session_id: sessionId, p_user_id: user.id });
      } else {
        await supabase.rpc('grant_moderator', { p_session_id: sessionId, p_user_id: user.id });
      }
      onClose();
    } catch {
      // ignore
    } finally {
      setModBusy(false);
    }
  };

  const handleReport = async () => {
    if (!viewerId || reported) return;
    await supabase.from('reports').insert({ reporter_id: viewerId, reported_user_id: user.id, reason: 'other' });
    setReported(true);
  };

  // v1.w.UI.222 — Duet-Invite senden
  const handleSendDuetInvite = async () => {
    if (duetBusy) return;
    setDuetBusy(true);
    const result = await createDuetInvite(
      sessionId,
      user.id,
      duetLayout,
      duetLayout === 'battle' ? battleDuration : undefined,
    );
    setDuetBusy(false);
    if (result.ok) {
      setDuetStep('sent');
    } else {
      setDuetStep('error');
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Avatar url={user.avatarUrl} username={user.username} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/u/${user.username}` as Route}
            className="text-sm font-semibold hover:underline"
            onClick={onClose}
          >
            @{user.username}
          </Link>
          {user.bio && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{user.bio}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {!isSelf && viewerId && (
          <button
            type="button"
            onClick={handleFollow}
            disabled={followLoading}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
              following
                ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {following ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
            {following ? 'Gefolgt' : 'Folgen'}
          </button>
        )}
        {isHost && !isSelf && (
          <button
            type="button"
            onClick={handleToggleMod}
            disabled={modBusy}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
              isMod
                ? 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {isMod ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
            {isMod ? 'Mod entfernen' : 'Zum Mod'}
          </button>
        )}
        {/* v1.w.UI.222 — Host: Zum Duett einladen */}
        {isHost && !isSelf && duetStep === 'idle' && (
          <button
            type="button"
            onClick={() => setDuetStep('picking')}
            className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/80"
          >
            <Tv2 className="h-3.5 w-3.5" />
            Zum Duett einladen
          </button>
        )}
        {isHost && !isSelf && duetStep === 'sent' && (
          <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1.5 text-xs font-semibold text-green-400">
            ✓ Einladung gesendet
          </span>
        )}
        {isHost && !isSelf && duetStep === 'error' && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400">
            Fehler — erneut versuchen
          </span>
        )}
        {!isSelf && viewerId && (
          <button
            type="button"
            onClick={handleReport}
            disabled={reported}
            className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/80 disabled:opacity-50"
          >
            {reported ? 'Gemeldet ✓' : 'Melden'}
          </button>
        )}
      </div>

      {/* v1.w.UI.222 — Inline Layout Picker (step 2) */}
      {isHost && !isSelf && duetStep === 'picking' && (
        <div className="flex flex-col gap-3 border-t pt-3">
          <p className="text-xs font-semibold text-foreground">Layout wählen</p>
          <div className="flex flex-wrap gap-2">
            {(['top-bottom', 'side-by-side', 'pip', 'battle'] as DuetLayout[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setDuetLayout(l)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                  duetLayout === l
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:bg-muted',
                )}
              >
                {LAYOUT_LABELS[l]}
              </button>
            ))}
          </div>
          {duetLayout === 'battle' && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">Battle-Dauer</p>
              <div className="flex gap-2">
                {BATTLE_DURATIONS.map(({ secs, label }) => (
                  <button
                    key={secs}
                    type="button"
                    onClick={() => setBattleDuration(secs)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                      battleDuration === secs
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:bg-muted',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSendDuetInvite}
              disabled={duetBusy}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {duetBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tv2 className="h-3.5 w-3.5" />}
              {duetBusy ? 'Sende…' : 'Einladung senden'}
            </button>
            <button
              type="button"
              onClick={() => setDuetStep('idle')}
              className="rounded-full bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/80"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function LiveAudienceModal({
  open,
  onClose,
  sessionId,
  hostId,
  viewerId,
  isHost,
  onOpenGiftPicker,
}: LiveAudienceModalProps) {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  );

  const [rows, setRows]           = useState<AudienceRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [modIds, setModIds]       = useState<Set<string>>(new Set());
  const [hostFollowers, setHostFollowers] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<ProfileCard | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // ── Load audience data when modal opens ────────────────────────────────────
  useEffect(() => {
    if (!open) { setRows([]); setModIds(new Set()); setHostFollowers(new Set()); setSelectedUser(null); return; }

    let cancelled = false;
    setLoading(true);

    (async () => {
      // 1. Top gifters (aggregate coins per sender for this session)
      const { data: giftsData } = await supabase
        .from('live_gifts')
        .select('sender_id, coin_cost, profiles!live_gifts_sender_id_fkey(id, username, avatar_url)')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(200);

      // 2. Recent chatters (last 100 unique)
      const { data: commentData } = await supabase
        .from('live_comments')
        .select('user_id, profiles!live_comments_user_id_fkey(id, username, avatar_url)')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(100);

      // 3. Current moderators
      const { data: modsData } = await supabase
        .from('live_moderators')
        .select('user_id')
        .eq('session_id', sessionId);

      if (cancelled) return;

      // Build gifter map (sum coins per sender)
      type GiftRow = { sender_id: string; coin_cost: number; profiles: { id: string; username: string; avatar_url: string | null } | null };
      const gifterMap = new Map<string, { totalCoins: number; giftsCount: number; username: string; avatarUrl: string | null }>();
      for (const g of (giftsData ?? []) as unknown as GiftRow[]) {
        if (!g.profiles) continue;
        const prev = gifterMap.get(g.sender_id) ?? { totalCoins: 0, giftsCount: 0, username: g.profiles.username, avatarUrl: g.profiles.avatar_url };
        gifterMap.set(g.sender_id, {
          totalCoins: prev.totalCoins + (g.coin_cost ?? 0),
          giftsCount: prev.giftsCount + 1,
          username: g.profiles.username,
          avatarUrl: g.profiles.avatar_url,
        });
      }

      // Sort gifters by coins desc, assign rank
      const sortedGifters = Array.from(gifterMap.entries())
        .sort((a, b) => b[1].totalCoins - a[1].totalCoins)
        .map(([id, info], idx): AudienceRow => ({
          id,
          username: info.username,
          avatarUrl: info.avatarUrl,
          rank: idx + 1,
          totalCoins: info.totalCoins,
          giftsCount: info.giftsCount,
        }));

      // Build chatter rows (unique, non-gifter)
      const gifterIds = new Set(gifterMap.keys());
      type CommentRow = { user_id: string; profiles: { id: string; username: string; avatar_url: string | null } | null };
      const seenIds = new Set<string>(gifterIds);
      const chatters: AudienceRow[] = [];
      for (const c of (commentData ?? []) as unknown as CommentRow[]) {
        if (!c.profiles || seenIds.has(c.user_id)) continue;
        seenIds.add(c.user_id);
        chatters.push({
          id: c.user_id,
          username: c.profiles.username,
          avatarUrl: c.profiles.avatar_url,
          rank: null,
          totalCoins: 0,
          giftsCount: 0,
        });
      }

      const merged = [...sortedGifters, ...chatters];

      // Mod IDs
      const newModIds = new Set((modsData ?? []).map((r: { user_id: string }) => r.user_id));
      setModIds(newModIds);

      // Batch-query: which audience members follow the host?
      const audienceIds = merged.map((r) => r.id).filter((id) => id !== hostId);
      let followers = new Set<string>();
      if (hostId && audienceIds.length > 0) {
        const { data: followData } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', hostId)
          .in('follower_id', audienceIds);
        if (!cancelled) {
          followers = new Set((followData ?? []).map((r: { follower_id: string }) => r.follower_id));
        }
      }

      if (!cancelled) {
        setRows(merged);
        setHostFollowers(followers);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, sessionId, hostId, supabase]);

  // ── Keyboard close ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSelectedUser(null); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleRowClick = useCallback(async (row: AudienceRow) => {
    // Fetch bio on demand
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, bio')
      .eq('id', row.id)
      .maybeSingle();
    if (data) {
      setSelectedUser({
        id: data.id,
        username: data.username,
        avatarUrl: data.avatar_url ?? null,
        bio: (data as unknown as { bio?: string | null }).bio ?? null,
      });
    }
  }, [supabase]);

  const selfRow = viewerId ? rows.find((r) => r.id === viewerId) : null;
  const selfRank = selfRow?.rank ?? null;

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => { if (e.target === backdropRef.current) { setSelectedUser(null); onClose(); } }}
    >
      <div className="flex w-full max-w-md flex-col rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl max-h-[85dvh]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Zuschauer*innen</span>
          <button
            type="button"
            onClick={() => { setSelectedUser(null); onClose(); }}
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Profile card (slide in) */}
        {selectedUser && (
          <div className="shrink-0 border-b bg-muted/30">
            <ProfileSheet
              user={selectedUser}
              hostId={hostId}
              viewerId={viewerId}
              isHost={isHost}
              sessionId={sessionId}
              modIds={modIds}
              onClose={() => setSelectedUser(null)}
            />
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading && (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              Lade…
            </div>
          )}
          {!loading && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <span>Noch keine Zuschauer</span>
            </div>
          )}
          {!loading && rows.length > 0 && (
            <ul className="divide-y divide-border/40">
              {rows
                .filter((r) => r.id !== viewerId) // self shown in sticky bottom
                .map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => handleRowClick(row)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
                    >
                      {/* Rank badge or plain index */}
                      {row.rank !== null ? (
                        <span
                          className={cn(
                            'shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
                            row.rank === 1 ? 'bg-yellow-400/30 text-yellow-300' :
                            row.rank === 2 ? 'bg-zinc-300/20 text-zinc-300' :
                            row.rank === 3 ? 'bg-amber-700/30 text-amber-400' :
                            'bg-muted text-muted-foreground',
                          )}
                        >
                          {row.rank}
                        </span>
                      ) : (
                        <span className="shrink-0 h-6 w-6" />
                      )}

                      <Avatar url={row.avatarUrl} username={row.username} size="sm" />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="truncate text-sm font-medium">@{row.username}</span>
                          {hostFollowers.has(row.id) && (
                            <span className="shrink-0 rounded-full bg-pink-500/15 px-1 py-0 text-[9px] font-semibold text-pink-400">
                              ❤️ Follower
                            </span>
                          )}
                          {modIds.has(row.id) && (
                            <span className="shrink-0 rounded-sm bg-violet-500/20 px-1 py-0 text-[9px] uppercase tracking-wider text-violet-300">
                              🛡 Mod
                            </span>
                          )}
                        </div>
                        {row.totalCoins > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            🪙 {fmtCoins(row.totalCoins)} ({row.giftsCount}×)
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>

        {/* Sticky Self-CTA (viewer only, not host) */}
        {!isHost && viewerId && (
          <div className="shrink-0 border-t px-4 py-3">
            {selfRank !== null ? (
              <div className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
                    selfRank === 1 ? 'bg-yellow-400/30 text-yellow-300' :
                    selfRank === 2 ? 'bg-zinc-300/20 text-zinc-300' :
                    'bg-amber-700/30 text-amber-400',
                  )}
                >
                  {selfRank}
                </span>
                <span className="text-muted-foreground">
                  Dein Rang · 🪙 {fmtCoins(selfRow?.totalCoins ?? 0)}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { onClose(); onOpenGiftPicker?.(); }}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-gold/10 py-2 text-sm font-semibold text-brand-gold transition-colors hover:bg-brand-gold/20"
              >
                <Gift className="h-4 w-4" />
                Geschenk senden um Top-Zuschauer zu werden
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
