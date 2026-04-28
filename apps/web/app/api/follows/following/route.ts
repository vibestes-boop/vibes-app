import { NextResponse } from 'next/server';
import { getPublicProfile } from '@/lib/data/public';
import { getProfileFollowing } from '@/lib/data/public';

// -----------------------------------------------------------------------------
// GET /api/follows/following?username=X&offset=N&limit=N
//
// Offset-based paginator for /u/[username]/following infinite scroll.
// Public — no auth required.
// Returns { users: FollowUser[]; hasMore: boolean }.
//
// v1.w.UI.128 — followers/following infinite scroll.
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE = 50;

export async function GET(request: Request) {
  const url      = new URL(request.url);
  const username = url.searchParams.get('username') ?? '';
  const offset   = Math.max(0, Number(url.searchParams.get('offset') ?? 0));
  const limit    = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? PAGE)));

  if (!username) {
    return NextResponse.json({ users: [], hasMore: false }, { status: 400 });
  }

  try {
    const profile = await getPublicProfile(username);
    if (!profile) return NextResponse.json({ users: [], hasMore: false });

    const users = await getProfileFollowing(profile.id, limit, offset);
    return NextResponse.json(
      { users, hasMore: users.length >= limit },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } },
    );
  } catch {
    return NextResponse.json({ users: [], hasMore: false }, { status: 200 });
  }
}
