/**
 * bunny-webhook — Supabase Edge Function
 *
 * Empfängt Bunny-Stream-Status-Webhooks und markiert den Post als 'ready'
 * (HLS fertig transkodiert) bzw. 'failed'. Bunny ruft das ohne Supabase-JWT
 * auf → MUSS mit `--no-verify-jwt` deployt werden; abgesichert via Shared-Secret
 * im Query-Param (?secret=…), da Bunny die Payload nicht signiert.
 *
 * Bunny-Payload: { VideoLibraryId, VideoGuid, Status }
 *   Status 4 = Finished (HLS ready) · 5/6 = Error.
 *
 * Mapping VideoGuid → postId:
 *   1) Falls guid schon am Post hängt (Re-Webhook) → direkt updaten.
 *   2) Sonst Bunny-Titel ("serlo:{postId}") via API lesen → postId mappen +
 *      guid persistieren.
 *
 * Antwortet IMMER 200 (außer Auth) — sonst retryt Bunny endlos.
 */

// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUNNY_API_KEY    = Deno.env.get('BUNNY_STREAM_API_KEY')!;
const BUNNY_LIBRARY_ID = Deno.env.get('BUNNY_LIBRARY_ID') ?? '685822';
const WEBHOOK_SECRET   = Deno.env.get('BUNNY_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Shared-Secret-Gate (Bunny signiert nicht).
  const url = new URL(req.url);
  if (!WEBHOOK_SECRET || url.searchParams.get('secret') !== WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }

  let body: { VideoGuid?: string; Status?: number };
  try { body = await req.json(); } catch { return new Response('bad request', { status: 400 }); }

  const guid = body.VideoGuid;
  const status = Number(body.Status);
  if (!guid) return new Response('no guid', { status: 200 });

  // 3 = Finished · 4 = Resolution finished (beide abspielbar) → ready · 5 = Error.
  let newStatus: 'ready' | 'failed' | null = null;
  if (status === 3 || status === 4) newStatus = 'ready';
  else if (status === 5) newStatus = 'failed';
  if (!newStatus) return new Response('ignored', { status: 200 });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1) guid bereits am Post → direkt updaten.
  const { data: updated } = await admin
    .from('posts')
    .update({ bunny_status: newStatus })
    .eq('bunny_video_id', guid)
    .select('id');
  if (updated && updated.length > 0) return new Response('ok', { status: 200 });

  // 2) Titel ("serlo:{postId}") via Bunny-API lesen → postId mappen + guid persistieren.
  try {
    const v = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${guid}`,
      { headers: { AccessKey: BUNNY_API_KEY, Accept: 'application/json' } },
    );
    if (v.ok) {
      const data = await v.json() as { title?: string };
      const m = (data.title ?? '').match(/^serlo-(.+)$/);
      if (m) {
        await admin
          .from('posts')
          .update({ bunny_video_id: guid, bunny_status: newStatus })
          .eq('id', m[1]);
      }
    }
  } catch { /* best-effort; Bunny retryt bei Bedarf */ }

  return new Response('ok', { status: 200 });
});
