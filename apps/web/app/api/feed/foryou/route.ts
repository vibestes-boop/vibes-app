import { NextResponse } from 'next/server';
import {
  getFeedDataSource,
  getForYouFeed,
  getPublicForYouFeed,
  getPublicForYouFeedDiagnostics,
} from '@/lib/data/feed';
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
  const diagnostics = url.searchParams.get('diagnostics') === '1';
  const isAuthed = hasSupabaseAuthCookie(request);
  const headers = isAuthed
    ? privateNoStoreHeaders()
    : publicApiCacheHeaders({ cdnMaxAge: 30, staleWhileRevalidate: 120 });

  try {
    const posts = isAuthed
      ? await getForYouFeed({ limit, before })
      : diagnostics
        ? await getPublicForYouFeedDiagnostics({ limit, before })
        : await getPublicForYouFeed({ limit, before });
    return NextResponse.json(posts, {
      headers: {
        ...headers,
        ...(diagnostics ? { 'X-Feed-Data-Source': getFeedDataSource(posts) ?? 'unknown' } : {}),
      },
    });
  } catch {
    return NextResponse.json([], { status: 200, headers });
  }
}
