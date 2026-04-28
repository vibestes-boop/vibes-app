import { NextResponse } from 'next/server';
import { getForYouFeed, getExploreTrendingFeed, getExploreNewestFeed } from '@/lib/data/feed';

// -----------------------------------------------------------------------------
// GET /api/feed/explore — offset-based paginator for /explore Popular Posts.
//
// ?sort=forYou   (default) — sorted by created_at DESC  (getForYouFeed over-fetch)
// ?sort=trending           — sorted by view_count DESC   (getExploreTrendingFeed)
// ?sort=newest             — sorted by created_at DESC   (getExploreNewestFeed)
//
// forYou keeps the existing over-fetch+slice approach (getForYouFeed has cursor
// pagination, not native offset). trending+newest use native .range() pagination.
//
// v1.w.UI.124 — Explore infinite scroll.
// v1.w.UI.219 — Sort tabs.
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE = 12;

type SortMode = 'forYou' | 'trending' | 'newest';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));
  const limit  = Math.min(48, Math.max(1, Number(url.searchParams.get('limit') ?? PAGE)));
  const rawSort = url.searchParams.get('sort') ?? 'forYou';
  const sort: SortMode = rawSort === 'trending' ? 'trending' : rawSort === 'newest' ? 'newest' : 'forYou';

  try {
    if (sort === 'trending') {
      const { posts, hasMore } = await getExploreTrendingFeed(limit, offset);
      return NextResponse.json(
        { posts, hasMore },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    if (sort === 'newest') {
      const { posts, hasMore } = await getExploreNewestFeed(limit, offset);
      return NextResponse.json(
        { posts, hasMore },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    // forYou — keep original over-fetch+slice logic (getForYouFeed is cursor-based)
    const all  = await getForYouFeed({ limit: offset + limit });
    const page = all.slice(offset, offset + limit);
    return NextResponse.json(
      { posts: page, hasMore: page.length >= limit },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json({ posts: [], hasMore: false }, { status: 200 });
  }
}
