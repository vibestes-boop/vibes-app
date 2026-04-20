import { NextResponse } from 'next/server';
import { getFollowingFeed } from '@/lib/data/feed';

// -----------------------------------------------------------------------------
// GET /api/feed/following — client-seitiger Nachlader für den Following-Tab.
// Runs on Node runtime so die Supabase-Cookies über `createClient` greifen.
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') ?? 10);
  const before = url.searchParams.get('before') ?? undefined;

  try {
    const posts = await getFollowingFeed({ limit, before });
    return NextResponse.json(posts, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
