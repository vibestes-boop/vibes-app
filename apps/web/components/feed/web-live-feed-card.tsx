'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Radio, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// -----------------------------------------------------------------------------
// WebLiveFeedCard — wird im vertikalen Feed alle 6 Posts injiziert.
//
// Kein echtes LiveKit-Video (wie in der Native-App) — stattdessen Thumbnail
// mit Blur-Fill-Pattern, LIVE-Badge, Viewer-Count, Host-Avatar + Username +
// optionaler Titel. Klick → /live/[id].
//
// Design: full-viewport-height section wie FeedCard, dunkles overlay über
// Thumbnail, centered card mit glassmorphism-Panel unten.
//
// v1.w.UI.229 — Feed-Injection Parity mit Native LiveFeedCard.
// -----------------------------------------------------------------------------

export interface LiveFeedSession {
  id: string;
  title: string | null;
  viewer_count: number;
  thumbnail_url: string | null;
  host: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export function WebLiveFeedCard({ session }: { session: LiveFeedSession }) {
  const host = session.host;
  const username = host?.username ?? '…';
  const avatarUrl = host?.avatar_url ?? undefined;
  const initial = username.slice(0, 2).toUpperCase();

  return (
    <Link
      href={`/live/${session.id}` as Route}
      className="relative flex h-full w-full max-w-[420px] flex-col items-center justify-end overflow-hidden rounded-2xl bg-black"
      aria-label={`@${username} ist live${session.title ? `: ${session.title}` : ''}`}
    >
      {/* ── Thumbnail (Blur-Fill + Contain) ─────────────────────────────── */}
      {session.thumbnail_url ? (
        <>
          {/* Blur-Fill-Hintergrund */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={session.thumbnail_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-60 blur-2xl"
            aria-hidden
          />
          {/* Haupt-Bild */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={session.thumbnail_url}
            alt={`${username} live`}
            className="absolute inset-0 h-full w-full object-contain"
          />
        </>
      ) : (
        /* No-thumbnail: dunkler Gradient */
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-zinc-950" />
      )}

      {/* ── Dim-Overlay ───────────────────────────────────────────────────── */}
      <div className="absolute inset-0 bg-black/30" />

      {/* ── LIVE-Badge (top-left) ─────────────────────────────────────────── */}
      <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-md bg-red-500 px-2.5 py-1">
        <Radio className="h-3 w-3 animate-pulse text-white" strokeWidth={2.5} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-white">Live</span>
      </div>

      {/* ── Viewer-Count (top-right) ──────────────────────────────────────── */}
      <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur-sm">
        <Users className="h-3 w-3 text-white/80" />
        <span className="text-[11px] font-medium text-white">
          {session.viewer_count.toLocaleString()}
        </span>
      </div>

      {/* ── Host-Info-Panel (bottom) ──────────────────────────────────────── */}
      <div className="relative z-10 w-full rounded-b-2xl bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-6 pt-12">
        <div className="flex items-center gap-3">
          {/* Avatar mit rotem Puls-Ring */}
          <div className="relative shrink-0">
            <div className="animate-pulse rounded-full bg-red-500 p-[2px]">
              <div className="rounded-full bg-black p-[1.5px]">
                <Avatar className="h-11 w-11">
                  <AvatarImage src={avatarUrl} alt={username} />
                  <AvatarFallback className="bg-zinc-700 text-white text-xs">
                    {initial}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </div>

          {/* Username + Titel */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">@{username}</p>
            {session.title && (
              <p className="truncate text-xs text-white/75">{session.title}</p>
            )}
          </div>

          {/* CTA-Button */}
          <div className="shrink-0 rounded-full bg-red-500 px-4 py-1.5">
            <span className="text-xs font-bold text-white">Jetzt</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
