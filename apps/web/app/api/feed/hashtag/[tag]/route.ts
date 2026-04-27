import { NextResponse } from 'next/server';
import { getPostsByTag } from '@/lib/data/feed';

// -----------------------------------------------------------------------------
// GET /api/feed/hashtag/[tag]?offset=24&limit=24
//
// Offset-basierte Pagination für die Hashtag-Detail-Seite (/t/[tag]).
// Nutzt view_count DESC + id DESC als stabilen Tie-Break — gleiche Sortierung
// wie der initiale SSR-Load, damit Seiten nahtlos aneinander passen.
// -----------------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tag: string }> },
) {
  const { tag: rawTag } = await params;
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 24), 48);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);

  const tag = decodeURIComponent(rawTag).toLowerCase().replace(/^#/, '').trim();
  if (!tag) return NextResponse.json([]);

  try {
    const posts = await getPostsByTag(tag, limit, offset);
    return NextResponse.json(posts, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
