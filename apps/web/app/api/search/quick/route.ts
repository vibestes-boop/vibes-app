import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTrendingHashtags } from '@/lib/data/feed';

// -----------------------------------------------------------------------------
// GET /api/search/quick?q=... — Lightweight Autocomplete-Endpoint.
//
// Gibt nur User + Hashtags zurück (keine Posts — zu schwer für Instant-UX).
// Limit: 5 User, 4 Hashtags.
//
// Caching: 30s public für Nicht-Auth-Anfragen, private/no-store wenn eingeloggt
// (damit eigene Profil-Daten nicht aus einem gemeinsamen Cache kommen).
//
// Verwendet Node-Runtime damit Supabase-Cookie-Auth greift.
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface QuickSearchResult {
  users: Array<{
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    verified: boolean;
  }>;
  hashtags: Array<{ tag: string; post_count: number }>;
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();

  if (q.length < 2) {
    return NextResponse.json({ users: [], hashtags: [] } satisfies QuickSearchResult);
  }

  const like = `%${q.replace(/[%_]/g, '')}%`;
  const tagLike = q.toLowerCase().replace(/^#/, '');

  const supabase = await createClient();

  const [usersRes, allHashtags] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, verified:is_verified')
      .or(`username.ilike.${like},display_name.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(5),
    // Hashtag-Liste aus dem Trending-Cache (kein Extra-DB-Hit).
    getTrendingHashtags(80).then((tags) =>
      tags.filter((t) => t.tag.includes(tagLike)).slice(0, 4),
    ),
  ]);

  const users = (usersRes.data ?? []).map((u) => ({
    id: u.id as string,
    username: u.username as string,
    display_name: (u.display_name as string | null) ?? null,
    avatar_url: (u.avatar_url as string | null) ?? null,
    verified: !!(u.verified as boolean | null),
  }));

  const hashtags = allHashtags.map((h) => ({ tag: h.tag, post_count: h.post_count }));

  const result: QuickSearchResult = { users, hashtags };

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': authUser
        ? 'private, no-store'
        : 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
