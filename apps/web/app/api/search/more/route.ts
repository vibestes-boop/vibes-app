import { NextRequest, NextResponse } from 'next/server';
import { searchPaginated, type SearchType } from '@/lib/data/feed';

// -----------------------------------------------------------------------------
// GET /api/search/more?q=TEXT&type=users|posts|hashtags&offset=N
//
// Paginierter Search-Feed für IntersectionObserver-Load-More in
// SearchResultsTabs (v1.w.UI.117).
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get('q') ?? '';
  const rawType = sp.get('type') ?? 'posts';
  const offset = Math.max(0, parseInt(sp.get('offset') ?? '0', 10) || 0);

  const type: SearchType =
    ['users', 'posts', 'hashtags'].includes(rawType)
      ? (rawType as SearchType)
      : 'posts';

  const result = await searchPaginated(q, type, offset);

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
