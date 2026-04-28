import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// Guilds-Data-Layer — SSR-Reads für /guilds Discovery und /g/[id] Detail.
//
// Schema-Realität (Stand v1.w.11):
//   - `guilds(id, name, description, vibe_tags)` — 5 fixed Pods (Alpha..Omega),
//     keine user-erstellten Guilds. Kein `slug`-Feld → wir routen via UUID.
//   - `profiles.guild_id` → jeder User ist in GENAU EINEM Pod. Keine
//     Junction-Table, Multi-Membership existiert nicht.
//   - RPC `get_guild_leaderboard(p_guild_id)` → Top-10 Posts + Top-10 Mitglieder
//     der letzten 30 Tage nach dwell_time_score.
//   - Kein `guild_events`, kein `guild_chat`. Diese Roadmap-Punkte wandern nach
//     v1.w.11b wenn wir Schema erweitern wollen.
//
// Design-Parität zu studio.ts / shop.ts / payments.ts:
//   1. React `cache()` für Request-Memo.
//   2. Graceful-Degradation — null/empty bei Fehler statt throw.
//   3. Keine Writes hier — Writes in `app/actions/guilds.ts`.
// -----------------------------------------------------------------------------

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Guild {
  id: string;
  name: string;
  description: string | null;
  vibe_tags: string[];
}

export interface GuildWithMeta extends Guild {
  member_count: number;
}

export interface GuildMember {
  id: string;
  username: string | null;
  avatar_url: string | null;
  display_name: string | null;
}

export interface GuildLeaderboardPost {
  id: string;
  caption: string | null;
  media_url: string;
  media_type: string;
  thumbnail_url: string | null;
  dwell_time_score: number;
  avg_seconds: number;
  completion_pct: number;
  created_at: string;
  author_id: string;
  author_username: string | null;
  author_avatar: string | null;
}

export interface GuildLeaderboardMember {
  id: string;
  username: string | null;
  avatar_url: string | null;
  post_count: number;
  avg_dwell_score: number;
  avg_completion_pct: number;
  best_score: number;
}

export interface GuildLeaderboard {
  top_posts: GuildLeaderboardPost[];
  top_members: GuildLeaderboardMember[];
}

// ─── Guild-Listing (Discovery) ──────────────────────────────────────────────

/**
 * Alle aktiven Pods. Derzeit einfach alle Rows in `guilds` — da fix 5 Pods,
 * kein Pagination-Bedarf. Wir joinen Member-Count aggregiert weil das auf der
 * Discovery-Card sichtbar ist.
 *
 * NB: PostgREST hat kein Direct-GROUP-BY in der Rest-API; wir machen zwei
 * Queries und mergen client-seitig. Für 5 Rows ist das belanglos.
 */
export const getAllGuilds = cache(async (): Promise<GuildWithMeta[]> => {
  const supabase = await createClient();

  const [{ data: guilds }, { data: counts }] = await Promise.all([
    supabase.from('guilds').select('id, name, description, vibe_tags').order('name'),
    supabase.from('profiles').select('guild_id'),
  ]);

  if (!guilds) return [];

  // Count in Memory — 5 Guilds × N Profile = O(N), aber 'guild_id' ist indexiert
  // und PostgREST liefert das als flat array. Ein anderer Ansatz wäre eine View.
  const memberCounts = new Map<string, number>();
  for (const row of counts ?? []) {
    const gid = (row as { guild_id: string | null }).guild_id;
    if (gid) memberCounts.set(gid, (memberCounts.get(gid) ?? 0) + 1);
  }

  return guilds.map((g) => ({
    ...(g as Guild),
    member_count: memberCounts.get((g as Guild).id) ?? 0,
  }));
});

// ─── Guild-Detail ───────────────────────────────────────────────────────────

export const getGuildById = cache(async (id: string): Promise<Guild | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('guilds')
    .select('id, name, description, vibe_tags')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return data as Guild;
});

export const getGuildMemberCount = cache(async (id: string): Promise<number> => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { head: true, count: 'exact' })
    .eq('guild_id', id);
  if (error) return 0;
  return count ?? 0;
});

// ─── Mitglieder-Liste (erste 100) ───────────────────────────────────────────

export const getGuildMembers = cache(
  async (id: string, limit = 100): Promise<GuildMember[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, display_name')
      .eq('guild_id', id)
      .order('username', { ascending: true })
      .limit(limit);
    if (error || !data) return [];
    return data as GuildMember[];
  },
);

// ─── Leaderboard (Top-Posts + Top-Members) ──────────────────────────────────

export const getGuildLeaderboard = cache(
  async (id: string): Promise<GuildLeaderboard> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_guild_leaderboard', {
      p_guild_id: id,
    });
    if (error || !data) {
      return { top_posts: [], top_members: [] };
    }
    // RPC returnt JSONB — strukturell {top_posts: [], top_members: []}
    const parsed = data as {
      top_posts: GuildLeaderboardPost[] | null;
      top_members: GuildLeaderboardMember[] | null;
    };
    return {
      top_posts: parsed.top_posts ?? [],
      top_members: parsed.top_members ?? [],
    };
  },
);

// ─── Guild-Feed (neueste Posts von Mitgliedern) ─────────────────────────────

export interface GuildFeedPost {
  id: string;
  author_id: string;
  caption: string | null;
  media_url: string;
  media_type: 'video' | 'image' | null;
  thumbnail_url: string | null;
  view_count: number;
  like_count: number;
  created_at: string;
  author: {
    id: string;
    username: string | null;
    avatar_url: string | null;
    display_name: string | null;
  };
}

/**
 * Paginierter Feed aller Posts von Mitgliedern einer Guild.
 * Cursor-basiert via `created_at` für Infinite-Scroll.
 * Kein React cache() — jede Seite hat anderen Cursor.
 */
export async function getGuildFeedPage(
  guildId: string,
  cursor: string | null = null,
  pageSize = 12,
): Promise<{ posts: GuildFeedPost[]; nextCursor: string | null }> {
  const supabase = await createClient();

  // PostgREST !inner filter: nur Rows wo der Author zur Guild gehört.
  // `.eq('profiles.guild_id', guildId)` nutzt den echten Tabellennamen
  // (nicht den Alias) — das ist die korrekte PostgREST-Syntax für
  // Embedded-Resource-Filter.
  let query = supabase
    .from('posts')
    .select(
      `id, author_id, caption, media_url, media_type, thumbnail_url,
       view_count, like_count, created_at,
       author:profiles!posts_author_id_fkey!inner ( id, username, avatar_url, display_name, guild_id )`,
    )
    .eq('profiles.guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(pageSize);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;
  if (error || !data) return { posts: [], nextCursor: null };

  const posts = (data as Record<string, unknown>[]).map((row) => {
    const a = row.author as Record<string, unknown> | null;
    return {
      id: row.id as string,
      author_id: row.author_id as string,
      caption: (row.caption as string | null) ?? null,
      media_url: row.media_url as string,
      media_type: (row.media_type as 'video' | 'image' | null) ?? null,
      thumbnail_url: (row.thumbnail_url as string | null) ?? null,
      view_count: (row.view_count as number) ?? 0,
      like_count: (row.like_count as number) ?? 0,
      created_at: row.created_at as string,
      author: {
        id: (a?.id as string) ?? '',
        username: (a?.username as string | null) ?? null,
        avatar_url: (a?.avatar_url as string | null) ?? null,
        display_name: (a?.display_name as string | null) ?? null,
      },
    } satisfies GuildFeedPost;
  });

  const nextCursor =
    posts.length === pageSize ? (posts[posts.length - 1]?.created_at ?? null) : null;
  return { posts, nextCursor };
}

// ─── Meine eigene Guild ─────────────────────────────────────────────────────

export const getMyGuildId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('guild_id')
    .eq('id', user.id)
    .maybeSingle();
  return (data as { guild_id: string | null } | null)?.guild_id ?? null;
});
