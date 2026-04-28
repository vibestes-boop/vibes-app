import { NextResponse } from 'next/server';
import { getForYouFeed } from '@/lib/data/feed';

// -----------------------------------------------------------------------------
// GET /api/feed/explore — offset-based paginator for /explore Popular Posts.
//
// getForYouFeed uses cursor (before=ISO), but ExplorePostGrid needs offset so
// the IntersectionObserver can append without timestamp gaps. We emulate offset
// by passing a limit and returning all, then slicing — not ideal at scale, but
// fine for Phase 1 (Supabase query is already sorted by created_at DESC).
//
// v1.w.UI.124 — Explore infinite scroll.
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE = 12;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));
  const limit = Math.min(48, Math.max(1, Number(url.searchParams.get('limit') ?? PAGE)));

  try {
    // Fetch offset+limit to get a window, then slice. getForYouFeed has no
    // native offset, so we over-fetch and slice client-style.
    // For offset 0..36 this stays cheap (<50 rows).
    const all = await getForYouFeed({ limit: offset + limit });
    const page = all.slice(offset, offset + limit);
    return NextResponse.json(
      { posts: page, hasMore: page.length >= limit },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json({ posts: [], hasMore: false }, { status: 200 });
  }
}
