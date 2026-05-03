import { NextResponse } from 'next/server';
import { getForYouFeed, getExploreTrendingFeed, getExploreNewestFeed } from '@/lib/data/feed';

// -----------------------------------------------------------------------------
// GET /api/feed/explore — offset-based paginator for /explore Popular Posts.
//
// ?sort=forYou   (default) — first page uses getForYouFeed, later pages use native offset
// ?sort=trending           — sorted by view_count DESC   (getExploreTrendingFeed)
// ?sort=newest             — sorted by created_at DESC   (getExploreNewestFeed)
//
// Anonyme Responses sind kurz CDN-cachebar; eingeloggte Requests bleiben private,
// weil liked/saved/following Felder user-spezifisch sind.
//
// v1.w.UI.124 — Explore infinite scroll.
// v1.w.UI.219 — Sort tabs.
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE = 12;
const ANON_CACHE = 'public, s-maxage=30, stale-while-revalidate=120';
const PRIVATE_CACHE = 'private, no-store';

type SortMode = 'forYou' | 'trending' | 'newest';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));
  const limit  = Math.min(48, Math.max(1, Number(url.searchParams.get('limit') ?? PAGE)));
  const rawSort = url.searchParams.get('sort') ?? 'forYou';
  const sort: SortMode = rawSort === 'trending' ? 'trending' : rawSort === 'newest' ? 'newest' : 'forYou';
  const headers = { 'Cache-Control': hasSupabaseAuthCookie(request) ? PRIVATE_CACHE : ANON_CACHE };

  try {
    if (sort === 'trending') {
      const { posts, hasMore } = await getExploreTrendingFeed(limit, offset);
      return NextResponse.json({ posts, hasMore }, { headers });
    }

    if (sort === 'newest') {
      const { posts, hasMore } = await getExploreNewestFeed(limit, offset);
      return NextResponse.json({ posts, hasMore }, { headers });
    }

    if (offset > 0) {
      const { posts, hasMore } = await getExploreNewestFeed(limit, offset);
      return NextResponse.json({ posts, hasMore }, { headers });
    }

    const page = await getForYouFeed({ limit });
    return NextResponse.json({ posts: page, hasMore: page.length >= limit }, { headers });
  } catch {
    return NextResponse.json(
      { posts: [], hasMore: false },
      { status: 200, headers: { 'Cache-Control': PRIVATE_CACHE } },
    );
  }
}

function hasSupabaseAuthCookie(request: Request): boolean {
  const cookie = request.headers.get('cookie') ?? '';
  return /\bsb-[^=]+-auth-token=/.test(cookie) || cookie.includes('supabase-auth-token');
}
