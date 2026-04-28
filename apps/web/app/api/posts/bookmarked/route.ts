import { NextResponse } from 'next/server';
import { getBookmarkedPostsPage } from '@/lib/data/public';

// -----------------------------------------------------------------------------
// GET /api/posts/bookmarked?offset=N&limit=N
//
// Offset-based paginator for the profile Saved tab PostGrid infinite scroll.
// Auth-scoped: only returns posts bookmarked by the currently authenticated user.
// Returns { posts: Post[]; hasMore: boolean }.
//
// v1.w.UI.203 — profile saved tab.
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE = 48;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));
  const limit  = Math.min(48, Math.max(1, Number(url.searchParams.get('limit') ?? PAGE)));

  try {
    const posts = await getBookmarkedPostsPage(offset, limit);
    return NextResponse.json(
      { posts, hasMore: posts.length >= limit },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json({ posts: [], hasMore: false }, { status: 200 });
  }
}
