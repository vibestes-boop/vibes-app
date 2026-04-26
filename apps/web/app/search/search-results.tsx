// -----------------------------------------------------------------------------
// DIESE DATEI IST VERALTET UND KANN GELÖSCHT WERDEN.
//
// Sie wurde versehentlich erstellt — die Search-Page existiert bereits
// vollständig in apps/web/app/search/page.tsx (Server-Component mit
// URL-Param-Navigation). Diese Client-Komponente ist nirgends importiert.
//
// Aktion: `git rm apps/web/app/search/search-results.tsx`
// -----------------------------------------------------------------------------
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { Hash, Play, Heart, Eye, BadgeCheck, Users, Video, UserRound } from 'lucide-react';
import { FollowButton } from '@/components/profile/follow-button';
import type { SearchUser, SearchPost, SearchHashtag } from '@/lib/data/search';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// SearchResults — Client Component für Tab-Switching ohne Page-Reload.
// Daten sind alle bereits server-seitig geladen und werden als Props übergeben.
// -----------------------------------------------------------------------------

type Tab = 'accounts' | 'videos' | 'hashtags';

interface Props {
  q: string;
  initialTab: Tab;
  users: (SearchUser & { isFollowing: boolean; isSelf: boolean })[];
  posts: SearchPost[];
  hashtags: SearchHashtag[];
  isAuthenticated: boolean;
}

export function SearchResults({ q, initialTab, users, posts, hashtags, isAuthenticated }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'accounts', label: 'Accounts', icon: <Users className="h-4 w-4" />, count: users.length },
    { id: 'videos', label: 'Videos', icon: <Video className="h-4 w-4" />, count: posts.length },
    { id: 'hashtags', label: 'Hashtags', icon: <Hash className="h-4 w-4" />, count: hashtags.length },
  ];

  return (
    <div>
      {/* ── Tab-Bar ────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span
                className={cn(
                  'ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                  activeTab === tab.id
                    ? 'bg-foreground/10 text-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Accounts ──────────────────────────────────────────────────────── */}
      {activeTab === 'accounts' && (
        <section>
          {users.length === 0 ? (
            <EmptyState
              icon={<UserRound className="h-10 w-10 text-muted-foreground/40" />}
              title="Keine Accounts gefunden"
              description={`Keine Nutzer passend zu „${q}".`}
            />
          ) : (
            <ul className="divide-y divide-border">
              {users.map((user) => (
                <li key={user.id} className="flex items-center gap-3 py-3">
                  {/* Avatar */}
                  <Link href={`/u/${user.username}` as Route} className="shrink-0">
                    {user.avatar_url ? (
                      <Image
                        src={user.avatar_url}
                        alt=""
                        width={44}
                        height={44}
                        className="h-11 w-11 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                        {(user.display_name ?? user.username).slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </Link>

                  {/* Name + Username */}
                  <Link href={`/u/${user.username}` as Route} className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 truncate text-sm font-semibold">
                      <span className="truncate">{user.display_name ?? user.username}</span>
                      {user.verified && (
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-brand-gold text-background" />
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">@{user.username}</div>
                  </Link>

                  {/* Follow Button */}
                  {!user.isSelf && (
                    <FollowButton
                      isAuthenticated={isAuthenticated}
                      isFollowing={user.isFollowing}
                      isSelf={false}
                      username={user.username}
                      targetUserId={user.id}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Videos ────────────────────────────────────────────────────────── */}
      {activeTab === 'videos' && (
        <section>
          {posts.length === 0 ? (
            <EmptyState
              icon={<Video className="h-10 w-10 text-muted-foreground/40" />}
              title="Keine Videos gefunden"
              description={`Keine Posts mit „${q}" in der Beschreibung.`}
            />
          ) : (
            <ul className="grid grid-cols-3 gap-2">
              {posts.map((post) => (
                <li key={post.id}>
                  <Link href={`/p/${post.id}` as Route} className="group relative block">
                    {/* Thumbnail */}
                    <div className="relative aspect-[9/16] overflow-hidden rounded-lg bg-muted">
                      {post.thumbnail_url ? (
                        <Image
                          src={post.thumbnail_url}
                          alt={post.caption ?? ''}
                          fill
                          sizes="(max-width: 640px) 30vw, 200px"
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Play className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                      )}

                      {/* Stats Overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-white">
                          <span className="flex items-center gap-0.5">
                            <Eye className="h-3 w-3" />
                            {formatK(post.view_count)}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Heart className="h-3 w-3" />
                            {formatK(post.like_count)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Caption */}
                    {post.caption && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                        {post.caption}
                      </p>
                    )}

                    {/* Author */}
                    <p className="mt-0.5 truncate text-[11px] font-medium">
                      @{post.author.username}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Hashtags ──────────────────────────────────────────────────────── */}
      {activeTab === 'hashtags' && (
        <section>
          {hashtags.length === 0 ? (
            <EmptyState
              icon={<Hash className="h-10 w-10 text-muted-foreground/40" />}
              title="Keine Hashtags gefunden"
              description={`Kein Hashtag passend zu „${q}" in den letzten 30 Tagen.`}
            />
          ) : (
            <ul className="divide-y divide-border">
              {hashtags.map((h) => (
                <li key={h.tag}>
                  <Link
                    href={`/t/${encodeURIComponent(h.tag)}` as Route}
                    className="flex items-center gap-3 py-3 transition-colors hover:text-foreground"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Hash className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">#{h.tag}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.post_count.toLocaleString('de-DE')} {h.post_count === 1 ? 'Video' : 'Videos'}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      {icon}
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function formatK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return String(n);
}
