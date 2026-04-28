'use client';

// -----------------------------------------------------------------------------
// PostLikersDialog — v1.w.UI.236
//
// Tap the like count → see who liked this post.
// Parity mit native components/ui/LikersSheet.tsx.
//
// Lazy-loads likers via Supabase browser client only when dialog opens.
// Shows avatar + username + follow button for each liker.
// Self-row: no follow button.
// -----------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import Image from 'next/image';
import { X, Heart, Loader2, UserPlus, UserCheck } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'sonner';
import { toggleFollow } from '@/app/actions/engagement';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type LikerProfile = {
  user_id: string;
  liked_at: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

// ─── Client-side fetch ────────────────────────────────────────────────────────

async function fetchPostLikers(postId: string): Promise<LikerProfile[]> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data, error } = await supabase
    .from('likes')
    .select('user_id, created_at, profiles!likes_user_id_fkey(username, avatar_url, bio)')
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !data) return [];

  // Supabase FK-joins können als Array oder Single-Object ankommen je nach
  // Relation-Multiplicity. Wir normalisieren beides zu einem einzelnen Profil.
  return data.map((row: {
    user_id: string;
    created_at: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    profiles: any;
  }) => {
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      user_id: row.user_id,
      liked_at: row.created_at,
      username: p?.username ?? null,
      avatar_url: p?.avatar_url ?? null,
      bio: p?.bio ?? null,
    };
  });
}

// ─── LikerRow ─────────────────────────────────────────────────────────────────

function LikerRow({
  liker,
  viewerId,
  onClose,
}: {
  liker: LikerProfile;
  viewerId: string | null;
  onClose: () => void;
}) {
  const isSelf = liker.user_id === viewerId;
  const username = liker.username ?? 'nutzer';
  const initial = username[0]?.toUpperCase() ?? '?';
  const [following, setFollowing] = useState(false);
  const [pending, setPending] = useState(false);

  const handleFollow = async () => {
    if (pending) return;
    setPending(true);
    const next = !following;
    setFollowing(next);
    const res = await toggleFollow(liker.user_id, following);
    if (!res.ok) {
      setFollowing(!next);
      toast.error(res.error ?? 'Aktion fehlgeschlagen.');
    }
    setPending(false);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Link
        href={`/u/${username}` as Route}
        onClick={onClose}
        className="shrink-0"
      >
        <span className="relative block h-10 w-10 overflow-hidden rounded-full bg-muted">
          {liker.avatar_url ? (
            <Image src={liker.avatar_url} alt={username} fill className="object-cover" sizes="40px" />
          ) : (
            <span className="flex h-full items-center justify-center text-sm font-semibold text-muted-foreground">
              {initial}
            </span>
          )}
        </span>
      </Link>

      <Link
        href={`/u/${username}` as Route}
        onClick={onClose}
        className="min-w-0 flex-1 hover:opacity-80"
      >
        <p className="truncate text-sm font-semibold">@{username}</p>
        {liker.bio && (
          <p className="truncate text-xs text-muted-foreground">{liker.bio}</p>
        )}
      </Link>

      {!isSelf && (
        <button
          type="button"
          onClick={handleFollow}
          disabled={pending}
          className={cn(
            'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
            following
              ? 'border border-border bg-background text-foreground hover:bg-muted'
              : 'bg-primary text-primary-foreground hover:opacity-90',
            pending && 'opacity-60',
          )}
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : following ? (
            <span className="flex items-center gap-1">
              <UserCheck className="h-3 w-3" />
              Gefolgt
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <UserPlus className="h-3 w-3" />
              Folgen
            </span>
          )}
        </button>
      )}
    </div>
  );
}

// ─── PostLikersDialog ─────────────────────────────────────────────────────────

export function PostLikersDialog({
  postId,
  likeCount,
  viewerId,
  onClose,
}: {
  postId: string;
  likeCount: number;
  viewerId: string | null;
  onClose: () => void;
}) {
  const [likers, setLikers] = useState<LikerProfile[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lazy-load likers when dialog mounts
  useEffect(() => {
    fetchPostLikers(postId)
      .then(setLikers)
      .catch(() => setLikers([]))
      .finally(() => setLoading(false));
  }, [postId]);

  function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
    return n.toLocaleString('de-DE');
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Wer hat geliked"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-background shadow-2xl sm:rounded-2xl"
        style={{ maxHeight: '80dvh' }}
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
            <h2 className="text-sm font-semibold">
              {likeCount > 0 ? `${formatCount(likeCount)} Likes` : 'Likes'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !likers || likers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <Heart className="h-8 w-8 opacity-30" />
              <p className="text-sm">Noch keine Likes</p>
            </div>
          ) : (
            <ul>
              {likers.map((liker) => (
                <li key={liker.user_id}>
                  <LikerRow liker={liker} viewerId={viewerId} onClose={onClose} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
