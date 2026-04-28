import { NextResponse } from 'next/server';
import { getActiveLiveSessions } from '@/lib/data/live';

// -----------------------------------------------------------------------------
// GET /api/feed/live — gibt aktive Live-Sessions für Feed-Injection zurück.
// Client-seitig gerufen von FeedList beim Mount; keine Pagination notwendig
// (max. 6 Sessions — 1 pro 6-Post-Block, wird gecycled wenn zu wenige).
// Runs on Node runtime so Supabase-Cookies über `createClient` greifen.
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sessions = await getActiveLiveSessions(6);
    return NextResponse.json(sessions, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
