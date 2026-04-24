import { NextResponse } from 'next/server';
import { getMyFollowedAccounts } from '@/lib/data/feed';

// -----------------------------------------------------------------------------
// GET /api/follows/me — Lazy-Loader für den „Alle anzeigen"-Sheet der
// Sidebar-Sektion „Konten, denen ich folge" (v1.w.UI.11 Phase B).
//
// SSR liefert nur die Top-5 mit. Der Sheet nachlädt bei Scroll/Open via diesen
// Endpoint — `limit` + `offset` Pagination. Hard-Cap auf 100 pro Call damit
// ein kaputter Client nicht unbeabsichtigt einen 10k-Fetch auslöst.
//
// Node-Runtime (nicht Edge) weil `getMyFollowedAccounts` via Supabase-Server-
// Client läuft, der Next-Cookies über `next/headers` liest — funktioniert nur
// im Node-Runtime.
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get('limit') ?? 50);
  const rawOffset = Number(url.searchParams.get('offset') ?? 0);

  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

  try {
    const accounts = await getMyFollowedAccounts({ limit, offset });
    return NextResponse.json(accounts, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
