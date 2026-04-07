// Supabase Edge Function: generate-voice
// Ruft Chatterbox via Replicate API auf → speichert WAV in Supabase Storage
// Cache: Wenn für diese post_id schon eine Datei existiert, direkt URL zurückgeben

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Korrektes Replicate API-Format für neuere Modelle (ohne Version-Hash)
const REPLICATE_MODEL_URL = 'https://api.replicate.com/v1/models/resemble-ai/chatterbox/predictions';

interface RequestBody {
  post_id: string;
  text: string;
  exaggeration?: number;
  voice_ref_url?: string;
}

Deno.serve(async (req: Request) => {
  // ── CORS ──────────────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const body: RequestBody = await req.json();
    const { post_id, text, exaggeration = 0.5, voice_ref_url } = body;

    if (!post_id || !text) {
      return errorResponse('post_id und text sind erforderlich', 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const fileName = `${post_id}.wav`;

    // ── 1. Cache prüfen: existiert Datei bereits? ──────────────────────────
    const { data: listData } = await supabase.storage
      .from('voice-posts')
      .list('', { search: fileName });

    const fileExists = (listData ?? []).some((f: { name: string }) => f.name === fileName);
    if (fileExists) {
      const { data: pub } = supabase.storage
        .from('voice-posts')
        .getPublicUrl(fileName);
      return jsonResponse({ audio_url: pub.publicUrl, cached: true });
    }

    // ── 2. Replicate API Token prüfen ─────────────────────────────────────
    const replicateKey = Deno.env.get('REPLICATE_API_TOKEN');
    if (!replicateKey) {
      return errorResponse('REPLICATE_API_TOKEN nicht konfiguriert', 500);
    }

    // ── 3. Prediction starten (neues Replicate API-Format) ─────────────────
    const input: Record<string, unknown> = {
      prompt: text.slice(0, 500),   // Replicate Chatterbox: "prompt" nicht "text"!
      exaggeration,
      cfg_weight: 0.5,
    };
    if (voice_ref_url) {
      input.audio_prompt = voice_ref_url;
    }

    const startRes = await fetch(REPLICATE_MODEL_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${replicateKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait',   // Replicate wartet bis fertig (max 60s) → kein Polling nötig!
      },
      body: JSON.stringify({ input }),
    });

    if (!startRes.ok) {
      const err = await startRes.text();
      console.error('Replicate Error:', err);
      return errorResponse(`Replicate-Fehler: ${startRes.status}`, 502);
    }

    const result = await startRes.json();

    // Bei 'Prefer: wait' ist das Ergebnis direkt in result.output
    let audioUrl: string | null = null;

    if (result.status === 'succeeded') {
      audioUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    } else if (result.status === 'processing' || result.status === 'starting') {
      // Fallback: Polling (wenn Prefer:wait nicht funktioniert)
      const predictionId = result.id;
      audioUrl = await pollForResult(predictionId, replicateKey);
    } else {
      // Status: failed / canceled / unknown
      const replicateError = result.error ?? result.logs ?? JSON.stringify(result);
      console.error('[generate-voice] Prediction fehlgeschlagen:', {
        status: result.status,
        error: result.error,
        logs: result.logs,
        input: input,    // Was haben wir gesendet?
        voice_ref_url,   // Welche URL wurde übergeben?
      });
      return errorResponse(`Replicate-Status: ${result.status} | ${replicateError}`, 502);
    }


    if (!audioUrl) {
      return errorResponse('Timeout: Audio-Generierung dauerte zu lang', 504);
    }

    // ── 4. Audio in Supabase Storage speichern ─────────────────────────────
    const audioRes = await fetch(audioUrl);
    const audioBuffer = await audioRes.arrayBuffer();

    await supabase.storage
      .from('voice-posts')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/wav',
        upsert: true,
      });

    // ── 5. Öffentliche URL zurückgeben ─────────────────────────────────────
    const { data: publicData } = supabase.storage
      .from('voice-posts')
      .getPublicUrl(fileName);

    return jsonResponse({ audio_url: publicData.publicUrl, cached: false });

  } catch (err) {
    console.error('generate-voice Fehler:', err);
    return errorResponse('Interner Serverfehler', 500);
  }
});

// ── Polling Fallback ─────────────────────────────────────────────────────────

async function pollForResult(
  predictionId: string,
  apiKey: string,
  maxAttempts = 30,
): Promise<string | null> {
  const pollUrl = `https://api.replicate.com/v1/predictions/${predictionId}`;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const res = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    const data = await res.json();

    if (data.status === 'succeeded') {
      return Array.isArray(data.output) ? data.output[0] : data.output;
    }
    if (data.status === 'failed' || data.status === 'canceled') {
      console.error('Polling: Prediction failed', data.error);
      return null;
    }
  }
  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}
