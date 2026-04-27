import { NextRequest, NextResponse } from 'next/server';
import { getNotificationsPage } from '@/lib/data/notifications';

// -----------------------------------------------------------------------------
// GET /api/notifications?offset=N&limit=N
//
// Paginierter Notifications-Feed für das IntersectionObserver-Load-More in
// NotificationList. Initial-SSR lädt 40 — hier kommen weitere Seiten von.
//
// Auth: Supabase-Cookie (createClient() prüft Session).
// Cache: private, kein CDN-Caching da user-spezifisch.
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LIMIT = 40;
const DEFAULT_LIMIT = 20;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const offset = Math.max(0, parseInt(sp.get('offset') ?? '0', 10) || 0);
  const limit = Math.min(MAX_LIMIT, parseInt(sp.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT);

  const notifications = await getNotificationsPage(offset, limit);

  return NextResponse.json(notifications, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
