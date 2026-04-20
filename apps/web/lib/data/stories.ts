import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// Stories-Data-Layer — SSR-Reads für Story-Strip im Feed und Story-Viewer.
//
// Schema (matched gegen Native):
//   stories(id, user_id, media_url, media_type, thumbnail_url, interactive,
//           archived, created_at)
//   story_views(story_id, user_id, viewed_at)  UNIQUE(story_id,user_id)
//   story_votes(story_id, user_id, option_idx) — für Polls, später
//
// Sichtbarkeits-Regeln:
//   - Stories haben 24h TTL: `created_at >= now() - 24h`. Bezieht sich auf
//     Anzeige-Fenster. `archived=true` nach Ablauf, aber wir filtern streng
//     auf `archived=false` UND created_at >=24h, damit Clock-Skew keine stale
//     Stories durchlässt.
//   - Scope: Member der eigenen Guild. Fallback wenn kein Guild: followed users
//     + eigene Stories.
//
// Perf-Anmerkung: Statt zwei Queries + in-memory-grouping (wie Native) nutzen
// wir eine View/RPC wäre besser — aber wir bleiben parität mit Native-Pattern.
// -----------------------------------------------------------------------------

export type StoryPoll = {
  type: 'poll';
  question: string;
  options: [string, string];
};

export interface StoryRow {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  thumbnail_url: string | null;
  interactive: StoryPoll | null;
  created_at: string;
}

export interface StoryItem extends StoryRow {
  username: string | null;
  avatar_url: string | null;
  viewed: boolean;
}

export interface StoryGroup {
  userId: string;
  username: string | null;
  avatar_url: string | null;
  stories: StoryItem[];
  hasUnviewed: boolean;
}

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

// ─── Story-Groups (Strip im Feed) ───────────────────────────────────────────

/**
 * Gruppierte Stories pro User, sortiert: eigene zuerst → ungesehene → gesehene.
 * Scope: Guild-Mitglieder, Fallback Follows. Gibt `[]` zurück für Anon-User.
 */
export const getActiveStoryGroups = cache(async (): Promise<StoryGroup[]> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const sinceIso = new Date(Date.now() - STORY_TTL_MS).toISOString();

  // ── Scope ermitteln ──
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('guild_id')
    .eq('id', user.id)
    .maybeSingle();

  const guildId = (profileRow as { guild_id: string | null } | null)?.guild_id ?? null;

  let memberIds: string[] = [];
  let memberMap = new Map<
    string,
    { id: string; username: string | null; avatar_url: string | null }
  >();

  if (guildId) {
    const { data: members } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .eq('guild_id', guildId);
    const list = (members ?? []) as { id: string; username: string | null; avatar_url: string | null }[];
    memberIds = list.map((m) => m.id);
    memberMap = new Map(list.map((m) => [m.id, m]));
  } else {
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);
    const ids = Array.from(
      new Set([user.id, ...((follows ?? []) as { following_id: string }[]).map((f) => f.following_id)]),
    );
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', ids);
      const list = (profs ?? []) as { id: string; username: string | null; avatar_url: string | null }[];
      memberIds = list.map((m) => m.id);
      memberMap = new Map(list.map((m) => [m.id, m]));
    }
  }

  if (memberIds.length === 0) return [];

  // ── Stories ──
  const { data: stories } = await supabase
    .from('stories')
    .select('id, user_id, media_url, media_type, thumbnail_url, interactive, created_at, archived')
    .in('user_id', memberIds)
    .eq('archived', false)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true });

  const rows = (stories ?? []) as (StoryRow & { archived: boolean })[];
  if (rows.length === 0) return [];

  // ── Seen-Set ──
  const storyIds = rows.map((s) => s.id);
  const { data: views } = await supabase
    .from('story_views')
    .select('story_id')
    .eq('user_id', user.id)
    .in('story_id', storyIds);
  const viewedSet = new Set(((views ?? []) as { story_id: string }[]).map((v) => v.story_id));

  // ── Group ──
  const grouped = new Map<string, StoryGroup>();
  for (const s of rows) {
    const profile = memberMap.get(s.user_id);
    if (!grouped.has(s.user_id)) {
      grouped.set(s.user_id, {
        userId: s.user_id,
        username: profile?.username ?? null,
        avatar_url: profile?.avatar_url ?? null,
        stories: [],
        hasUnviewed: false,
      });
    }
    const group = grouped.get(s.user_id)!;
    const item: StoryItem = {
      id: s.id,
      user_id: s.user_id,
      media_url: s.media_url,
      media_type: s.media_type,
      thumbnail_url: s.thumbnail_url,
      interactive: s.interactive,
      created_at: s.created_at,
      username: profile?.username ?? null,
      avatar_url: profile?.avatar_url ?? null,
      viewed: viewedSet.has(s.id),
    };
    group.stories.push(item);
    if (!item.viewed) group.hasUnviewed = true;
  }

  // Sortieren: eigene → ungesehene → gesehene
  const arr = Array.from(grouped.values());
  arr.sort((a, b) => {
    if (a.userId === user.id) return -1;
    if (b.userId === user.id) return 1;
    if (a.hasUnviewed && !b.hasUnviewed) return -1;
    if (!a.hasUnviewed && b.hasUnviewed) return 1;
    return 0;
  });
  return arr;
});

// ─── Einzelner Story-Group-Fetch (für Viewer) ──────────────────────────────

export const getStoryGroupForUser = cache(
  async (targetUserId: string): Promise<StoryGroup | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const sinceIso = new Date(Date.now() - STORY_TTL_MS).toISOString();

    const [{ data: targetProfile }, { data: stories }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('id', targetUserId)
        .maybeSingle(),
      supabase
        .from('stories')
        .select('id, user_id, media_url, media_type, thumbnail_url, interactive, created_at, archived')
        .eq('user_id', targetUserId)
        .eq('archived', false)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: true }),
    ]);

    if (!targetProfile) return null;
    const rows = (stories ?? []) as (StoryRow & { archived: boolean })[];
    if (rows.length === 0) return null;

    const { data: views } = await supabase
      .from('story_views')
      .select('story_id')
      .eq('user_id', user.id)
      .in('story_id', rows.map((s) => s.id));
    const viewedSet = new Set(((views ?? []) as { story_id: string }[]).map((v) => v.story_id));

    const prof = targetProfile as { id: string; username: string | null; avatar_url: string | null };

    const items: StoryItem[] = rows.map((s) => ({
      id: s.id,
      user_id: s.user_id,
      media_url: s.media_url,
      media_type: s.media_type,
      thumbnail_url: s.thumbnail_url,
      interactive: s.interactive,
      created_at: s.created_at,
      username: prof.username,
      avatar_url: prof.avatar_url,
      viewed: viewedSet.has(s.id),
    }));

    return {
      userId: prof.id,
      username: prof.username,
      avatar_url: prof.avatar_url,
      stories: items,
      hasUnviewed: items.some((s) => !s.viewed),
    };
  },
);

// ─── Helpers ───────────────────────────────────────────────────────────────

export function storyExpiresAt(createdAt: string): Date {
  return new Date(new Date(createdAt).getTime() + STORY_TTL_MS);
}

export function storyRemainingMs(createdAt: string): number {
  return Math.max(0, storyExpiresAt(createdAt).getTime() - Date.now());
}
