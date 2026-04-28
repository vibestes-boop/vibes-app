'use client';

// -----------------------------------------------------------------------------
// LiveChatUserPanel — v1.w.UI.196/197
// Shared user-profile mini-sheet for live-chat-overlay.tsx and live-chat.tsx.
//
// Mobile parity: LiveUserSheet in watch/[id].tsx — shows follow/unfollow,
// view profile, @mention, and moderator actions when a username is tapped
// in the chat.
//
// Positioning is controlled by the caller via the `className` prop:
//   • overlay variant: "pointer-events-auto absolute bottom-full left-0 mb-2 w-64"
//   • sidebar variant: "absolute inset-x-2 bottom-[4.5rem] z-10"
// -----------------------------------------------------------------------------

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { createBrowserClient } from '@supabase/ssr';
import { X, UserPlus, UserCheck, ExternalLink, AtSign, Clock, ShieldAlert } from 'lucide-react';
import { toggleFollow } from '@/app/actions/engagement';
import { cn } from '@/lib/utils';

export interface ChatUserInfo {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
}

export interface LiveChatUserPanelProps {
  user: ChatUserInfo;
  viewerId: string | null;
  sessionId: string;
  canModerate: boolean;
  isHost: boolean;
  hostId: string;
  onClose: () => void;
  onMention: (username: string) => void;
  onTimeout: (seconds: number) => void;
  /** Controls container positioning — supplied by the caller. */
  className?: string;
}

const TIMEOUT_OPTS = [
  { label: '1 Min', secs: 60 },
  { label: '5 Min', secs: 300 },
  { label: '10 Min', secs: 600 },
  { label: '1 Std', secs: 3600 },
] as const;

export function LiveChatUserPanel({
  user,
  viewerId,
  sessionId,
  canModerate,
  isHost,
  hostId,
  onClose,
  onMention,
  onTimeout,
  className,
}: LiveChatUserPanelProps) {
  const router = useRouter();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [isMod, setIsMod] = useState<boolean | null>(null);
  const [isPending, startTransition] = useTransition();
  const [modPending, startModTransition] = useTransition();
  const [timeoutOpen, setTimeoutOpen] = useState(false);

  const displayName = user.display_name ?? user.username;
  const initials = displayName.slice(0, 2).toUpperCase();

  // Fetch follow + mod status on mount
  useEffect(() => {
    if (!viewerId) return;
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', viewerId)
      .eq('following_id', user.id)
      .maybeSingle()
      .then(({ data }) => setFollowing(!!data));

    if (isHost) {
      supabase
        .from('live_moderators')
        .select('user_id')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => setIsMod(!!data));
    }
  }, [viewerId, user.id, sessionId, isHost]);

  const handleFollow = () => {
    if (!viewerId) return;
    const was = following ?? false;
    setFollowing(!was);
    startTransition(async () => {
      const result = await toggleFollow(user.id, was, false);
      if (!result.ok) setFollowing(was);
      else setFollowing(result.data.following);
    });
  };

  const handleToggleMod = () => {
    startModTransition(async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      if (isMod) {
        await supabase.rpc('revoke_moderator', { p_session_id: sessionId, p_user_id: user.id });
        setIsMod(false);
      } else {
        await supabase.rpc('grant_moderator', { p_session_id: sessionId, p_user_id: user.id });
        setIsMod(true);
      }
    });
  };

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl bg-black/80 shadow-elevation-3 ring-1 ring-white/15 backdrop-blur-xl',
        className,
      )}
    >
      {/* Header: avatar + name + close */}
      <div className="flex items-center gap-3 px-3 pb-2 pt-3">
        <div className="relative h-10 w-10 shrink-0">
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar_url}
              alt={displayName}
              className="h-10 w-10 rounded-full object-cover ring-1 ring-white/20"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white ring-1 ring-white/20">
              {initials}
            </div>
          )}
          {user.verified && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white ring-1 ring-black/60">
              ✓
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{displayName}</p>
          <p className="truncate text-[11px] text-white/55">@{user.username}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="h-px bg-white/10" />

      <div className="flex flex-col py-1">
        {/* Follow / Unfollow */}
        {viewerId && viewerId !== user.id && (
          <button
            type="button"
            onClick={handleFollow}
            disabled={isPending || following === null}
            className="flex w-full items-center gap-3 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            {following ? (
              <UserCheck className="h-4 w-4 shrink-0 text-green-400" />
            ) : (
              <UserPlus className="h-4 w-4 shrink-0 text-white/70" />
            )}
            {following ? 'Gefolgt' : 'Folgen'}
          </button>
        )}

        {/* @Mention */}
        <button
          type="button"
          onClick={() => onMention(user.username)}
          className="flex w-full items-center gap-3 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10"
        >
          <AtSign className="h-4 w-4 shrink-0 text-white/70" />
          Erwähnen
        </button>

        {/* View profile */}
        <button
          type="button"
          onClick={() => {
            onClose();
            router.push(`/u/${user.username}` as Route);
          }}
          className="flex w-full items-center gap-3 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10"
        >
          <ExternalLink className="h-4 w-4 shrink-0 text-white/70" />
          Profil öffnen
        </button>

        {/* Host: grant/revoke mod + timeout */}
        {isHost && user.id !== hostId && (
          <>
            <div className="mx-3 my-1 h-px bg-white/10" />
            <button
              type="button"
              onClick={handleToggleMod}
              disabled={modPending || isMod === null}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              <ShieldAlert className={cn('h-4 w-4 shrink-0', isMod ? 'text-violet-400' : 'text-white/70')} />
              {isMod ? 'Mod entfernen' : 'Zum Mod machen'}
            </button>
            <button
              type="button"
              onClick={() => setTimeoutOpen((v) => !v)}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10"
            >
              <Clock className="h-4 w-4 shrink-0 text-white/70" />
              Timeout…
            </button>
            {timeoutOpen && (
              <div className="flex flex-wrap gap-1.5 px-4 pb-2">
                {TIMEOUT_OPTS.map((opt) => (
                  <button
                    key={opt.secs}
                    type="button"
                    onClick={() => onTimeout(opt.secs)}
                    className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white hover:bg-red-500/70"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Non-host moderators: timeout only */}
        {canModerate && !isHost && user.id !== hostId && (
          <>
            <div className="mx-3 my-1 h-px bg-white/10" />
            <button
              type="button"
              onClick={() => setTimeoutOpen((v) => !v)}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10"
            >
              <Clock className="h-4 w-4 shrink-0 text-white/70" />
              Timeout…
            </button>
            {timeoutOpen && (
              <div className="flex flex-wrap gap-1.5 px-4 pb-2">
                {TIMEOUT_OPTS.map((opt) => (
                  <button
                    key={opt.secs}
                    type="button"
                    onClick={() => onTimeout(opt.secs)}
                    className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white hover:bg-red-500/70"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
