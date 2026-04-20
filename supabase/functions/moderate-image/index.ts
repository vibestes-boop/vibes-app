/**
 * moderate-image — Supabase Edge Function
 *
 * Aufgerufen via DB-Trigger (pg_net) NACH Post-Insert — nicht vom Client.
 * Prüft Bild-URL via HuggingFace Falconsai/nsfw_image_detection.
 *
 * Ablauf:
 *   1. Post-Insert in DB
 *   2. DB-Trigger feuert pg_net.http_post() → diese Function
 *   3. Function lädt Bild, ruft HF auf
 *   4. Setzt is_visible = true (safe) oder is_flagged = true, is_visible = false (nsfw)
 *
 * ENV (Supabase Secrets):
 *   HUGGINGFACE_API_KEY       — HF API Token
 *   SUPABASE_URL              — automatisch gesetzt
 *   SUPABASE_SERVICE_ROLE_KEY — automatisch gesetzt
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const NSFW_THRESHOLD  = 0.75;   // ≥ 0.75 → flaggen
const HIDE_THRESHOLD  = 0.90;   // ≥ 0.90 → sofort aus Feed entfernen
const HF_MODEL        = 'https://api-inference.huggingface.co/models/Falconsai/nsfw_image_detection';
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;  // 6 MB HF-Limit

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── HF aufrufen mit einem Retry bei 503 (Modell lädt noch) ──────────────────
async function callHuggingFace(imgBytes: ArrayBuffer, hfKey: string): Promise<Array<{ label: string; score: number }>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(HF_MODEL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfKey}`,
        'Content-Type': 'application/octet-stream',
      },
      body: imgBytes,
    });

    // 503 = Modell kalt → 30s warten (real HF cold start ist 20-30s)
    if (res.status === 503 && attempt === 0) {
      console.warn('[moderate] HF model loading, waiting 30s...');
      await new Promise(r => setTimeout(r, 30_000));
      continue;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HuggingFace ${res.status}: ${errText.slice(0, 200)}`);
    }

    return res.json();
  }
  throw new Error('HuggingFace: max retries reached');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { post_id, image_url } = await req.json() as { post_id: string; image_url: string };

    if (!post_id || !image_url) {
      return new Response(JSON.stringify({ error: 'post_id + image_url required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hfKey = Deno.env.get('HUGGINGFACE_API_KEY');
    if (!hfKey) throw new Error('HUGGINGFACE_API_KEY not set');

    // 1. Idempotenz: wurde dieser Post bereits moderiert?
    const { data: existing } = await supabase
      .from('posts')
      .select('is_flagged, flag_reason')
      .eq('id', post_id)
      .single();
    if (existing?.flag_reason) {
      console.log(`[moderate] post=${post_id} already processed, skipping`);
      return new Response(JSON.stringify({ ok: true, result: 'already_processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Bild laden
    const imgRes = await fetch(image_url, {
      headers: { 'User-Agent': 'VibesApp-Moderator/1.0' },
    });
    if (!imgRes.ok) throw new Error(`Image fetch: ${imgRes.status}`);

    // Bytes laden DANN Größe prüfen
    // (content-length fehlt oft bei CDNs / ist unreliable)
    const imgBytes = await imgRes.arrayBuffer();
    if (imgBytes.byteLength > MAX_IMAGE_BYTES) {
      console.log(`[moderate] post=${post_id} image too large (${imgBytes.byteLength} bytes), skipping HF`);
      // Zu groß → als safe markieren, flag_reason setzen für Audit
      await supabase.from('posts')
        .update({ flag_reason: 'skipped:too_large' })
        .eq('id', post_id);
      return new Response(JSON.stringify({ ok: true, result: 'skipped', reason: 'too_large' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. HuggingFace Inference (mit Retry)
    const labels = await callHuggingFace(imgBytes, hfKey);
    const nsfwScore = labels.find(l => l.label === 'nsfw')?.score ?? 0;
    const isNsfw    = nsfwScore >= NSFW_THRESHOLD;

    // 4. Post-Status in DB aktualisieren
    if (isNsfw) {
      await supabase.from('posts').update({
        is_flagged:  true,
        flag_reason: `nsfw:${nsfwScore.toFixed(3)}`,
        is_visible:  nsfwScore < HIDE_THRESHOLD,  // schwer NSFW = sofort unsichtbar
      }).eq('id', post_id);
    } else {
      // Sicher → freischalten
      await supabase.from('posts').update({ is_visible: true }).eq('id', post_id);
    }

    const result = isNsfw ? 'nsfw' : 'safe';
    console.log(`[moderate] post=${post_id} ${result} score=${nsfwScore.toFixed(3)}`);

    return new Response(
      JSON.stringify({ ok: true, result, score: nsfwScore }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[moderate] error:', msg);
    // Post bleibt is_visible=true (default) — kein manuelles Freischalten nötig.
    // Lieber gelegentlich NSFW sichtbar als Posts dauerhaft versteckt.
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
