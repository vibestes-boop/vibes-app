import { NextResponse } from 'next/server';
import { getSuggestedFollowsPage, PEOPLE_PAGE_LIMIT } from '@/lib/data/feed';

// -----------------------------------------------------------------------------
// GET /api/people?offset=N&limit=N
//
// Paginated people-discovery endpoint. Auth-aware: excludes self + already-
// followed accounts when a session cookie is present (Supabase picks it up
// automatically via createClient).
//
// v1.w.UI.120 — /people discovery page infinite scroll.
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LIMIT = PEOPLE_PAGE_LIMIT;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));
  const limit  = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') ?? String(MAX_LIMIT), 10)));

  const result = await getSuggestedFollowsPage(offset, limit);

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
