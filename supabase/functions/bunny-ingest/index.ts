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
 *   • Caller-JWT (sub) muss Autor des Posts sein.
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

function getUserId(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1];
  if (!token) return null;
  try {
    const p = token.split('.')[1];
    if (!p) return null;
    const b64 = p.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
    const claims = JSON.parse(atob(padded)) as { sub?: unknown };
    return typeof claims.sub === 'string' && claims.sub ? claims.sub : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const userId = getUserId(req);
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
      body: JSON.stringify({ url: videoUrl, title: `serlo:${postId}` }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return json({ error: `Bunny fetch failed (${res.status})`, detail: detail.slice(0, 300) }, 502);
  }

  await admin.from('posts').update({ bunny_status: 'pending' }).eq('id', postId);
  return json({ ok: true, status: 'pending' });
});
