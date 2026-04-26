import { NextResponse } from 'next/server';
import { getForYouFeed } from '@/lib/data/feed';

// -----------------------------------------------------------------------------
// GET /api/feed/foryou — client-seitiger Nachlader für den For-You-Tab.
// Cursor-Pagination via `before` (ISO-Timestamp des letzten Posts).
// Runs on Node runtime so Supabase-Cookies über `createClient` greifen.
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') ?? 10);
  const before = url.searchParams.get('before') ?? undefined;

  try {
    const posts = await getForYouFeed({ limit, before });
    return NextResponse.json(posts, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
