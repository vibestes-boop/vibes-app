/**
 * bunny-ingest — Supabase Edge Function
 *
 * Lässt Bunny Stream ein bereits zu R2 hochgeladenes Video aus seiner
 * öffentlichen R2-URL fetchen und transkodieren (HLS/ABR). Rein additiv:
 * R2 bleibt unberührt und ist Sofort-Fallback bis Bunny 'ready' ist.
 *
 * POST { postId, videoUrl }  (videoUrl = öffentliche R2-URL des Posts)
 *
 * Sicherheit:
 *   • Caller-JWT muss Autor des Posts sein — die Identität wird GEPRÜFT,
 *     nicht aus dem Token gelesen (`_shared/auth.ts`, seit 23.08.2026).
 *   • videoUrl muss eine public *.r2.dev-URL sein (Bunny-Fetch braucht public;
 *     verhindert zugleich SSRF auf interne Ziele).
 *   • API-Key nur server-seitig (Supabase-Secret BUNNY_STREAM_API_KEY).
 *
 * Korrelation: Bunnys /videos/fetch liefert KEINE guid zurück. Wir setzen den
 * Bunny-Titel auf "serlo:{postId}" — der Webhook (bunny-webhook) liest den Titel
 * zurück und mappt VideoGuid → postId.
 */

// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { corsHeaders } from '../_shared/cors.ts';
import { getVerifiedUserId } from '../_shared/auth.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUNNY_API_KEY    = Deno.env.get('BUNNY_STREAM_API_KEY')!;
const BUNNY_LIBRARY_ID = Deno.env.get('BUNNY_LIBRARY_ID') ?? '685822';
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const userId = await getVerifiedUserId(req);
  if (!userId) return json({ error: 'Not authenticated' }, 401);

  let body: { postId?: unknown; videoUrl?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const postId   = typeof body.postId === 'string' ? body.postId.trim() : '';
  const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : '';
  if (!postId || !videoUrl) return json({ error: 'postId and videoUrl required' }, 400);
  // Nur öffentliche R2-URLs (Bunny-Fetch braucht public + SSRF-Schutz).
  if (!/^https:\/\/[a-z0-9-]+\.r2\.dev\/[^\s]+$/i.test(videoUrl)) {
    return json({ error: 'videoUrl must be a public *.r2.dev URL' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: post, error } = await admin
    .from('posts')
    .select('id, author_id, bunny_status, media_type')
    .eq('id', postId)
    .maybeSingle();
  if (error) return json({ error: 'DB error' }, 500);
  if (!post) return json({ error: 'Post not found' }, 404);
  if (post.author_id !== userId) return json({ error: 'Forbidden' }, 403);
  if (post.media_type !== 'video') return json({ error: 'Not a video post' }, 400);
  if (post.bunny_status) return json({ ok: true, already: true, status: post.bunny_status });

  // Bunny: Video aus R2-URL fetchen. Titel = Korrelations-Token für den Webhook.
  const res = await fetch(
    `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/fetch`,
    {
      method: 'POST',
      headers: { AccessKey: BUNNY_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ url: videoUrl, title: `serlo-${postId}` }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return json({ error: `Bunny fetch failed (${res.status})`, detail: detail.slice(0, 300) }, 502);
  }

  // guid via Titel-Suche holen — /videos/fetch liefert keine guid zurück. So
  // kann der Client die HLS-URL bauen, OHNE auf einen Webhook angewiesen zu sein
  // (der Player probiert HLS und fällt sonst auf R2 zurück).
  let guid: string | null = null;
  try {
    const list = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos?search=${encodeURIComponent(`serlo-${postId}`)}&itemsPerPage=1&orderBy=date`,
      { headers: { AccessKey: BUNNY_API_KEY, Accept: 'application/json' } },
    );
    if (list.ok) {
      const data = await list.json() as { items?: Array<{ guid?: string; title?: string }> };
      guid = data.items?.find((v) => v.title === `serlo-${postId}`)?.guid
          ?? data.items?.[0]?.guid ?? null;
    }
  } catch { /* guid bleibt null → Client nutzt R2-Fallback */ }

  await admin.from('posts').update({ bunny_video_id: guid, bunny_status: 'pending' }).eq('id', postId);
  return json({ ok: true, status: 'pending', guid });
});
