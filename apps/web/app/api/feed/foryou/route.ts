import { NextResponse } from 'next/server';
import { getForYouFeed, getPublicForYouFeed } from '@/lib/data/feed';
import {
  hasSupabaseAuthCookie,
  privateNoStoreHeaders,
  publicApiCacheHeaders,
} from '@/lib/cache/headers';

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
  const isAuthed = hasSupabaseAuthCookie(request);
  const headers = isAuthed
    ? privateNoStoreHeaders()
    : publicApiCacheHeaders({ cdnMaxAge: 30, staleWhileRevalidate: 120 });

  try {
    const posts = isAuthed
      ? await getForYouFeed({ limit, before })
      : await getPublicForYouFeed({ limit, before });
    return NextResponse.json(posts, { headers });
  } catch {
    return NextResponse.json([], { status: 200, headers });
  }
}
