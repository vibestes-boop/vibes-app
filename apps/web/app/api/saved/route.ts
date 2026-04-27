import { NextResponse } from 'next/server';
import { getBookmarkedPostsPage } from '@/lib/data/public';

// -----------------------------------------------------------------------------
// GET /api/saved?offset=N&limit=N
//
// Paginated bookmarks endpoint for PostGrid infinite scroll on /saved.
// Auth-required — getBookmarkedPostsPage returns [] when not authenticated.
// v1.w.UI.121
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));
  const limit  = Math.min(PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') ?? String(PAGE_SIZE), 10)));

  const posts = await getBookmarkedPostsPage(offset, limit);

  return NextResponse.json(
    { posts, hasMore: posts.length >= limit },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
