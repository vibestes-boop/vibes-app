import { NextResponse } from 'next/server';
import {
  getForYouFeed,
  getPublicForYouFeed,
  getExploreTrendingFeed,
  getExploreNewestFeed,
  getPublicExploreTrendingFeed,
  getPublicExploreNewestFeed,
} from '@/lib/data/feed';

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
const ANON_BROWSER_CACHE = 'public, max-age=0, must-revalidate';
const ANON_CDN_CACHE = 'public, max-age=30, stale-while-revalidate=120';
const PRIVATE_CACHE = 'private, no-store';

type SortMode = 'forYou' | 'trending' | 'newest';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));
  const limit  = Math.min(48, Math.max(1, Number(url.searchParams.get('limit') ?? PAGE)));
  const rawSort = url.searchParams.get('sort') ?? 'forYou';
  const sort: SortMode = rawSort === 'trending' ? 'trending' : rawSort === 'newest' ? 'newest' : 'forYou';
  const isAuthed = hasSupabaseAuthCookie(request);
  const headers = isAuthed ? privateHeaders() : publicFeedHeaders();

  try {
    if (sort === 'trending') {
      const { posts, hasMore } = isAuthed
        ? await getExploreTrendingFeed(limit, offset)
        : await getPublicExploreTrendingFeed(limit, offset);
      return NextResponse.json({ posts, hasMore }, { headers });
    }

    if (sort === 'newest') {
      const { posts, hasMore } = isAuthed
        ? await getExploreNewestFeed(limit, offset)
        : await getPublicExploreNewestFeed(limit, offset);
      return NextResponse.json({ posts, hasMore }, { headers });
    }

    if (offset > 0) {
      const { posts, hasMore } = isAuthed
        ? await getExploreNewestFeed(limit, offset)
        : await getPublicExploreNewestFeed(limit, offset);
      return NextResponse.json({ posts, hasMore }, { headers });
    }

    const page = isAuthed ? await getForYouFeed({ limit }) : await getPublicForYouFeed({ limit });
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

function publicFeedHeaders(): Record<string, string> {
  return {
    // Browser gets a revalidation-friendly header; CDN TTL is controlled below.
    'Cache-Control': ANON_BROWSER_CACHE,
    // Visible to downstream CDNs and our production guardrail.
    'CDN-Cache-Control': ANON_CDN_CACHE,
    // Vercel-specific, consumed by Vercel and not forwarded to the browser.
    'Vercel-CDN-Cache-Control': ANON_CDN_CACHE,
  };
}

function privateHeaders(): Record<string, string> {
  return { 'Cache-Control': PRIVATE_CACHE };
}
