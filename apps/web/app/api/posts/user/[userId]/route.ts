import { NextResponse } from 'next/server';
import { getProfilePostsPage, type ProfileSortKey } from '@/lib/data/public';

// -----------------------------------------------------------------------------
// GET /api/posts/user/[userId]?offset=N&limit=N&sort=newest|views|likes
//
// Paginated profile-posts endpoint for PostGrid infinite scroll.
// Public — same visibility as /u/[username] (RLS: posts.privacy = public).
// v1.w.UI.121 — initial; v1.w.UI.212 — sort param added.
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;

const VALID_SORTS = new Set<ProfileSortKey>(['newest', 'views', 'likes']);

function parseSort(raw: string | null): ProfileSortKey {
  if (raw && VALID_SORTS.has(raw as ProfileSortKey)) return raw as ProfileSortKey;
  return 'newest';
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const { searchParams } = new URL(request.url);
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));
  const limit  = Math.min(PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') ?? String(PAGE_SIZE), 10)));
  const sort   = parseSort(searchParams.get('sort'));

  const posts = await getProfilePostsPage(userId, offset, limit, sort);

  return NextResponse.json(
    { posts, hasMore: posts.length >= limit },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
