import { NextResponse } from 'next/server';
import { getWOZFeedPage } from '@/lib/data/public';

// -----------------------------------------------------------------------------
// GET /api/posts/woz?offset=N&limit=N
//
// Offset-based paginator for the /woz PostGrid infinite scroll.
// Auth + RLS: only verified women (gender=female && women_only_verified=true)
// receive rows — non-verified users get an empty array, not a 403.
// Returns { posts: Post[]; hasMore: boolean }.
//
// v1.w.UI.213
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE = 48;

export async function GET(request: Request) {
  const url    = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));
  const limit  = Math.min(48, Math.max(1, Number(url.searchParams.get('limit') ?? PAGE)));

  try {
    const posts = await getWOZFeedPage(offset, limit);
    return NextResponse.json(
      { posts, hasMore: posts.length >= limit },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json({ posts: [], hasMore: false }, { status: 200 });
  }
}
