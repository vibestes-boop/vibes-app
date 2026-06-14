import { NextResponse } from 'next/server';
import { getFriendsFeed } from '@/lib/data/feed';

// -----------------------------------------------------------------------------
// GET /api/feed/friends — client-seitiger Nachlader für den „Freunde"-Tab
// (gegenseitige Follows). Runs on Node runtime, damit die Supabase-Cookies
// über `createClient` greifen.
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') ?? 10);
  const before = url.searchParams.get('before') ?? undefined;

  try {
    const posts = await getFriendsFeed({ limit, before });
    return NextResponse.json(posts, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
