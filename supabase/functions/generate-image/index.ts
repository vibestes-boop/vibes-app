/**
 * generate-image — Supabase Edge Function
 *
 * AI-Image-Generation via OpenAI gpt-image-1 (upgradable auf gpt-image-2 per
 * ENV `IMAGE_MODEL` sobald API am 2026-05 öffnet).
 *
 * FLOW
 * ----
 *   1. CORS-Preflight
 *   2. Auth: Supabase-JWT aus Authorization-Header → viewerId
 *   3. Body-Validation (prompt/purpose/size)
 *   4. Rate-Limit via RPC `check_ai_image_rate_limit`
 *   5. Moderation-Blacklist (Client-seitig nicht vertrauenswürdig, also
 *      auch hier noch mal — Native hat eigene Liste in liveModerationWords.ts,
 *      für AI-Prompts nutzen wir eine reduzierte Variante + OpenAI's Filter)
 *   6. OpenAI `/v1/images/generations` mit `response_format=b64_json`
 *      (direkt Bytes statt externer URL → keine zweite Fetch-Roundtrip)
 *   7. Upload nach Supabase Storage `ai-generated/{userId}/{generationId}.png`
 *   8. Insert in `ai_image_generations` mit cost_cents
 *   9. Response { url, generationId, costCents }
 *
 * ENV (Supabase Secrets — mit `supabase secrets set` setzen)
 * -------------------------------------------------------------
 *   OPENAI_API_KEY            — OpenAI API Token (Platform-Billing)
 *   IMAGE_MODEL               — 'gpt-image-1' (default) | 'gpt-image-2'
 *   SUPABASE_URL              — automatisch gesetzt
 *   SUPABASE_SERVICE_ROLE_KEY — automatisch gesetzt
 *   SUPABASE_ANON_KEY         — für JWT-Verifikation (auth.getUser)
 *
 * COST-NOTIZ (gpt-image-1, Stand 2026-04)
 * ---------------------------------------
 *   1024×1024 standard  = ca. 4 cents
 *   1024×1024 HD        = ca. 8 cents
 *   1024×1536 / 1536×1024 HD = ca. 12 cents
 * Wir erstellen medium-Qualität und 1024×1024 als Default — kostet 4 cents
 * pro Request.
 *
 * PHASE-4-LIMITS (ab Migration 20260423200000_ai_image_safeguards.sql)
 * --------------------------------------------------------------------
 *   • Feature-Flag `ai_image_enabled` (DB-Toggle für Soforts-Kill ohne Redeploy)
 *   • Platform-Budget: $50 / 30 Tage global → `platform_budget_exhausted`
 *   • User-Daily:  3 Bilder / 24h            → `rate_limit_day`
 *   • User-Weekly: 10 Bilder / 7 Tage        → `rate_limit_week`
 * Die alten Limits (3/min Burst, 30/Tag, $10/User/30d) sind durch die
 * strikteren Phase-4-Grenzen ersetzt.
 *
 * WAS NICHT IN PHASE 1
 * --------------------
 *   • Image-to-Image (Edit/Variation) — kommt in Phase 2 wenn Avatar-Flow dran ist
 *   • Streaming-Progress — OpenAI-Endpoint unterstützt das nicht direkt
 *   • User-konfigurierbare Quality — immer 'medium' in Phase 1
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Konfig ──────────────────────────────────────────────────────────────────
const ALLOWED_SIZES = new Set(['1024x1024', '1024x1536', '1536x1024', '512x512']);
const ALLOWED_PURPOSES = new Set([
  'shop_mockup',
  'post_cover',
  'live_thumbnail',
  'avatar',
  'sticker',
  'icon',
]);

// Cost-Lookup in Cents, konservativ hoch geschätzt damit wir nicht unter-capen.
// Feineres Accounting kommt wenn OpenAI per-request cost in der Response returned.
const COST_CENTS: Record<string, number> = {
  '512x512': 2,
  '1024x1024': 4,
  '1024x1536': 6,
  '1536x1024': 6,
};

// Minimal-Blacklist für Prompts — nur die absoluten No-Gos, weil OpenAI
// selbst schon strict moderiert. Purpose: Shadow-Ban vor dem API-Call
// sparen Latenz + Kosten bei offensichtlich abgelehnten Prompts.
const PROMPT_BLACKLIST = [
  'nude', 'naked', 'porn', 'sex ', 'nsfw',
  'child', 'kid ', 'minor',
  'hitler', 'nazi', 'swastik',
  'gore', 'decapitat', 'suicide',
  // CE/RU-Spezifisch (Community-Kontext)
  'голая', 'голый', 'порно',
];

function containsBlockedTerm(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return PROMPT_BLACKLIST.some((term) => lower.includes(term));
}

// ── Response-Helpers ────────────────────────────────────────────────────────
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function err(code: string, message: string, status = 400): Response {
  return json({ error: { code, message } }, status);
}

// ── Base64 → Uint8Array (Deno-kompatibel, kein Node-Buffer) ─────────────────
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── Main Handler ────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return err('method_not_allowed', 'POST only', 405);
  }

  // ── Env-Sanity ────────────────────────────────────────────────────────────
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const IMAGE_MODEL = Deno.env.get('IMAGE_MODEL') ?? 'gpt-image-1';

  if (!OPENAI_API_KEY) return err('config_missing', 'OPENAI_API_KEY not set', 500);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return err('config_missing', 'Supabase env not set', 500);
  }

  // ── Auth: User aus JWT ────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return err('unauthenticated', 'Bitte einloggen.', 401);

  // Anon-Client nur für `auth.getUser()` — Service-Role für alles andere
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) return err('unauthenticated', 'Session ungültig.', 401);

  const userId = user.id;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Body ──────────────────────────────────────────────────────────────────
  let body: { prompt?: unknown; purpose?: unknown; size?: unknown };
  try {
    body = await req.json();
  } catch {
    return err('bad_body', 'JSON-Body erwartet', 400);
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const purpose = typeof body.purpose === 'string' ? body.purpose : '';
  const size = typeof body.size === 'string' ? body.size : '1024x1024';

  if (prompt.length < 3 || prompt.length > 2000) {
    return err('bad_prompt', 'Prompt muss 3-2000 Zeichen haben.');
  }
  if (!ALLOWED_PURPOSES.has(purpose)) {
    return err('bad_purpose', `purpose muss einer von: ${[...ALLOWED_PURPOSES].join(', ')}`);
  }
  if (!ALLOWED_SIZES.has(size)) {
    return err('bad_size', `size muss einer von: ${[...ALLOWED_SIZES].join(', ')}`);
  }

  // ── Prompt-Moderation (pre-OpenAI, Kosten + Latenz sparen) ────────────────
  if (containsBlockedTerm(prompt)) {
    return err('prompt_blocked', 'Dieser Prompt ist nicht erlaubt.', 422);
  }

  // ── Rate-Limit ────────────────────────────────────────────────────────────
  const { data: rateCheck, error: rateErr } = await supabase.rpc(
    'check_ai_image_rate_limit',
    { p_user_id: userId, p_purpose: purpose },
  );
  if (rateErr) {
    console.error('[generate-image] rate-limit RPC failed:', rateErr);
    return err('rate_limit_check_failed', 'Rate-Limit-Check fehlgeschlagen.', 500);
  }
  if (rateCheck && rateCheck !== 'ok') {
    // Phase-4: neue Limits (3/Tag + 10/Woche) + Platform-Cap + Feature-Flag.
    // Alte Codes (rate_limit_minute, cost_limit_month) bleiben im Map drin
    // als Safety-Net falls die Migration auf manchen Envs noch nicht gelaufen
    // ist und die alte RPC-Version antwortet.
    const humanMessages: Record<string, string> = {
      feature_disabled: 'AI-Bilder sind aktuell nicht verfügbar. Bitte später erneut versuchen.',
      platform_budget_exhausted: 'Das monatliche Budget für AI-Bilder ist aufgebraucht. Zurück Anfang nächsten Monats.',
      rate_limit_day: 'Tageslimit erreicht (3 Bilder/24h). Morgen wieder verfügbar.',
      rate_limit_week: 'Wochenlimit erreicht (10 Bilder/7 Tage).',
      // Legacy-Fallbacks:
      rate_limit_minute: 'Zu viele Anfragen. Bitte ca. 1 Minute warten.',
      cost_limit_month: 'Monatslimit erreicht. Zurück in 30 Tagen.',
    };
    // `feature_disabled` ist eher 503 (Service-Outage-Stil) als 429, damit
    // Clients es anders darstellen können als Quota-Fehler.
    const status = rateCheck === 'feature_disabled' ? 503 : 429;
    return err(rateCheck, humanMessages[rateCheck] ?? 'Limit erreicht.', status);
  }

  // ── OpenAI-Call ───────────────────────────────────────────────────────────
  // gpt-image-1 Response: `data: [{ b64_json: string, ... }]`
  // gpt-image-2 wird dasselbe Shape haben (Compatibility-Versprechen im Blog-
  // Post vom 2026-04-21 — „drop-in replacement").
  const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      size,
      // `quality: 'medium'` für Phase 1 — balanciert Kosten und Output.
      // Phase 2 kann User-konfigurierbar werden (low/medium/high).
      quality: 'medium',
      // Output format: PNG (default) — direkt in Storage ohne Re-Encoding.
    }),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text();
    console.error('[generate-image] OpenAI error:', openaiRes.status, errText.slice(0, 500));

    // OpenAI-Moderation-Rejection → spezifischer Error
    if (openaiRes.status === 400 && errText.includes('safety')) {
      return err('prompt_blocked', 'OpenAI hat den Prompt abgelehnt.', 422);
    }
    if (openaiRes.status === 429) {
      return err('upstream_rate_limit', 'OpenAI-Rate-Limit erreicht.', 429);
    }
    return err('upstream_failed', `OpenAI-Call fehlgeschlagen (${openaiRes.status}).`, 502);
  }

  const openaiJson = await openaiRes.json() as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const b64 = openaiJson.data?.[0]?.b64_json;
  if (!b64) {
    console.error('[generate-image] no b64_json in OpenAI response');
    return err('upstream_malformed', 'OpenAI-Response unerwartet.', 502);
  }

  // ── Upload nach Supabase Storage ──────────────────────────────────────────
  const generationId = crypto.randomUUID();
  const storagePath = `${userId}/${generationId}.png`;
  const bytes = base64ToBytes(b64);

  const { error: uploadErr } = await supabase.storage
    .from('ai-generated')
    .upload(storagePath, bytes, {
      contentType: 'image/png',
      // upsert:false — wenn der uuid-Path schon existiert (astronomisch
      // unwahrscheinlich), dann Fehler werfen statt überschreiben.
      upsert: false,
    });

  if (uploadErr) {
    console.error('[generate-image] storage upload failed:', uploadErr);
    // Wir loggen die Row trotzdem (mit error) damit das Cost-Accounting
    // den fehlgeschlagenen OpenAI-Call als bezahlt verbucht.
    await supabase.from('ai_image_generations').insert({
      id: generationId,
      user_id: userId,
      purpose,
      prompt,
      model: IMAGE_MODEL,
      size,
      cost_cents: COST_CENTS[size] ?? 4,
      error: `storage_upload_failed: ${uploadErr.message}`,
    });
    return err('storage_upload_failed', 'Bild-Upload fehlgeschlagen.', 500);
  }

  // Public URL aus Bucket-Path konstruieren
  const { data: publicUrlData } = supabase.storage
    .from('ai-generated')
    .getPublicUrl(storagePath);
  const imageUrl = publicUrlData.publicUrl;

  // ── DB-Log ────────────────────────────────────────────────────────────────
  const costCents = COST_CENTS[size] ?? 4;
  const { error: insertErr } = await supabase.from('ai_image_generations').insert({
    id: generationId,
    user_id: userId,
    purpose,
    prompt,
    model: IMAGE_MODEL,
    image_url: imageUrl,
    storage_path: storagePath,
    size,
    cost_cents: costCents,
  });

  if (insertErr) {
    // Upload war erfolgreich, aber Log-Insert failed. Das ist kein User-
    // facing Error — wir haben das Bild. Log serverseitig + return OK.
    console.error('[generate-image] insert log failed (non-fatal):', insertErr);
  }

  return json({
    url: imageUrl,
    generationId,
    costCents,
    model: IMAGE_MODEL,
  });
});
