// -----------------------------------------------------------------------------
// DIESE DATEI IST VERALTET UND KANN GELÖSCHT WERDEN.
//
// Die Search-Funktionen existieren bereits in lib/data/feed.ts (searchAll)
// und werden von app/search/page.tsx direkt genutzt. Diese separaten
// searchUsers / searchPosts / searchHashtags Funktionen sind nirgends
// importiert und doppeln die bestehende Implementierung.
//
// Aktion: `git rm apps/web/lib/data/search.ts`
// -----------------------------------------------------------------------------
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// Daten-Layer für die Suche — v1.w.UI.69
//
// Drei unabhängige Funktionen, alle ohne React.cache() weil sie via Route
// Handler (quick-API) und Server Component (search page) aufgerufen werden —
// beide haben separate Request-Kontexte und würden vom Cache ohnehin nicht
// profitieren.
//
// Schema-Drift-Adapter (Mobile-DB → Web-Contract) gleich wie in public.ts:
//   is_verified → verified, author_id → user_id, media_url → video_url, tags → hashtags
// -----------------------------------------------------------------------------

export interface SearchUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
}

export interface SearchPost {
  id: string;
  user_id: string;
  caption: string | null;
  video_url: string;
  thumbnail_url: string | null;
  view_count: number;
  like_count: number;
  created_at: string;
  author: SearchUser;
}

export interface SearchHashtag {
  tag: string;
  post_count: number;
}

// -----------------------------------------------------------------------------
// searchUsers — ilike auf username + display_name, nach is_verified sortiert
// (verifizierte Accounts erscheinen zuerst, dann alphabetisch).
// -----------------------------------------------------------------------------

export async function searchUsers(query: string, limit = 12): Promise<SearchUser[]> {
  if (query.trim().length < 2) return [];
  const supabase = await createClient();
  const q = query.trim();
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, verified:is_verified')
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .order('is_verified', { ascending: false })
    .limit(limit);

  return (data ?? []).map((p) => ({
    id: p.id as string,
    username: p.username as string,
    display_name: p.display_name as string | null,
    avatar_url: p.avatar_url as string | null,
    verified: (p.verified as boolean | null) ?? false,
  }));
}

// -----------------------------------------------------------------------------
// searchPosts — ilike auf caption, nach view_count absteigend.
// Joined mit Author-Profile für die Karten-Darstellung.
// -----------------------------------------------------------------------------

type PostSearchRow = {
  id: string;
  author_id: string;
  caption: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  view_count: number | null;
  created_at: string;
  like_count: { count: number }[] | number | null;
  author:
    | {
        id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        verified: boolean | null;
      }
    | {
        id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        verified: boolean | null;
      }[]
    | null;
};

function extractLikeCount(v: PostSearchRow['like_count']): number {
  if (typeof v === 'number') return v;
  if (Array.isArray(v) && v.length > 0) return (v[0] as { count: number }).count ?? 0;
  return 0;
}

function normalizePostAuthor(raw: PostSearchRow['author']): SearchUser | null {
  const a = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
  if (!a) return null;
  return {
    id: a.id,
    username: a.username,
    display_name: a.display_name,
    avatar_url: a.avatar_url,
    verified: a.verified ?? false,
  };
}

export async function searchPosts(query: string, limit = 20): Promise<SearchPost[]> {
  if (query.trim().length < 2) return [];
  const supabase = await createClient();
  const q = query.trim();

  const { data } = await supabase
    .from('posts')
    .select(
      `id, author_id, caption, media_url, thumbnail_url, view_count, created_at,
       like_count:likes(count),
       author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url, verified:is_verified)`,
    )
    .ilike('caption', `%${q}%`)
    .order('view_count', { ascending: false })
    .limit(limit);

  if (!data) return [];

  const results: SearchPost[] = [];
  for (const row of data as unknown as PostSearchRow[]) {
    const author = normalizePostAuthor(row.author);
    if (!author) continue;
    results.push({
      id: row.id,
      user_id: row.author_id,
      caption: row.caption,
      video_url: row.media_url ?? '',
      thumbnail_url: row.thumbnail_url,
      view_count: row.view_count ?? 0,
      like_count: extractLikeCount(row.like_count),
      created_at: row.created_at,
      author,
    });
  }
  return results;
}

// -----------------------------------------------------------------------------
// searchHashtags — scannt posts.tags (letzten 30 Tage), filtert client-seitig
// auf Übereinstimmung mit query. Kein Partial-Index auf tags-Spalte vorhanden,
// daher in-process-Aggregation wie in getTrendingHashtags.
// -----------------------------------------------------------------------------

export async function searchHashtags(query: string, limit = 12): Promise<SearchHashtag[]> {
  if (query.trim().length < 2) return [];
  const supabase = await createClient();
  const q = query.trim().toLowerCase().replace(/^#/, '').trim();
  if (!q) return [];

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('posts')
    .select('tags')
    .gte('created_at', since)
    .not('tags', 'is', null)
    .limit(1_000);

  if (!data) return [];

  const tagMap = new Map<string, number>();
  for (const row of data as { tags: string[] | null }[]) {
    if (!row.tags) continue;
    for (const raw of row.tags) {
      const tag = raw.toLowerCase().replace(/^#/, '').trim();
      if (tag && tag.includes(q)) {
        tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
      }
    }
  }

  return Array.from(tagMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, post_count]) => ({ tag, post_count }));
}
