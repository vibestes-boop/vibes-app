import { NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { getPublicTrendingHashtags } from '@/lib/data/feed';
import { publicApiCacheHeaders } from '@/lib/cache/headers';

// -----------------------------------------------------------------------------
// GET /api/search/quick?q=... — Lightweight Autocomplete-Endpoint.
//
// Gibt nur User ODER Hashtags zurück (keine Posts — zu schwer für Instant-UX).
// Normaler Text / @handle sucht Accounts; #tag sucht Hashtags.
// Limit: 5 User, 4 Hashtags.
//
// Caching: 30s public. The endpoint only returns public profiles and public
// hashtag aggregates, so it does not need the cookie-aware Supabase client.
//
// Verwendet Node-Runtime fuer konsistente Supabase-REST-Nutzung.
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLIC_QUICK_SEARCH_HEADERS = publicApiCacheHeaders({
  cdnMaxAge: 30,
  staleWhileRevalidate: 60,
});

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

type QuickSearchUserRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean | null;
};

function normalizeProfileQuery(q: string) {
  return q.replace(/^@+/, '').trim();
}

function normalizeTagQuery(q: string) {
  return q.toLowerCase().replace(/^#+/, '').trim();
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();

  if (q.length < 2) {
    return NextResponse.json(
      { users: [], hashtags: [] } satisfies QuickSearchResult,
      { headers: PUBLIC_QUICK_SEARCH_HEADERS },
    );
  }

  const wantsHashtags = q.startsWith('#');
  const profileQuery = normalizeProfileQuery(q);
  const tagLike = normalizeTagQuery(q);
  const like = `%${profileQuery.replace(/[%_]/g, '')}%`;

  const supabase = createPublicClient();

  const [usersRes, allHashtags] = await Promise.all([
    wantsHashtags || profileQuery.length < 2
      ? Promise.resolve({ data: [], error: null })
      : supabase.rpc('search_public_profiles_web', {
          search_query: profileQuery,
          result_limit: 5,
        }),
    wantsHashtags && tagLike.length > 0
      ? getPublicTrendingHashtags(80).then((tags) =>
          tags.filter((t) => t.tag.includes(tagLike)).slice(0, 4),
        )
      : Promise.resolve([]),
  ]);

  let userRows: QuickSearchUserRow[] = usersRes.error
    ? []
    : ((usersRes.data ?? []) as QuickSearchUserRow[]);
  if (usersRes.error && !wantsHashtags) {
    const fallback = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, verified:is_verified')
      .eq('is_private', false)
      .eq('is_banned', false)
      .eq('is_shadow_banned', false)
      .or(`username.ilike.${like},display_name.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(5);
    userRows = (fallback.data ?? []) as QuickSearchUserRow[];
  }

  const users = userRows.map((u) => ({
    id: u.id as string,
    username: u.username as string,
    display_name: (u.display_name as string | null) ?? null,
    avatar_url: (u.avatar_url as string | null) ?? null,
    verified: !!(u.verified as boolean | null),
  }));

  const hashtags = allHashtags.map((h) => ({ tag: h.tag, post_count: h.post_count }));

  const result: QuickSearchResult = { users, hashtags };

  return NextResponse.json(result, {
    headers: PUBLIC_QUICK_SEARCH_HEADERS,
  });
}
