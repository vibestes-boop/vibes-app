'use server';

import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// AI-Image-Server-Actions — Web-Pendant zu `lib/useGenerateImage.ts` (Native).
// Beide Plattformen rufen dieselbe Supabase-Edge-Function `generate-image`;
// der Web-Wrapper übernimmt Auth-Check, strukturiertes Error-Mapping und
// eine In-Memory-Rate-Limit-Vor-Hürde.
//
// Design-Parität:
//   - Identische Purpose-Liste und Size-Whitelist wie Native
//   - Gleiche Error-Codes (rate_limit_minute, prompt_blocked, etc.)
//   - Gleicher Response-Shape ({ url, generationId, costCents, model })
// -----------------------------------------------------------------------------

export type AIImagePurpose =
  | 'shop_mockup'
  | 'post_cover'
  | 'live_thumbnail'
  | 'avatar'
  | 'sticker'
  | 'icon';

export type AIImageSize = '1024x1024' | '1024x1536' | '1536x1024' | '512x512';

export type GenerateImageResult =
  | { ok: true; url: string; generationId: string; costCents: number; model: string }
  | { ok: false; code: string; error: string };

// Client-side Floor vor dem Edge-Function-Call: max 3 generations / 5s pro Server-Instanz
// pro User-ID. Die Edge-Function hat eigene DB-basierte Limits (3/min, 30/d, $10/30d) —
// diese Hürde fängt nur UI-Doppel-Klicks und parallele Tabs ab.
const CLIENT_COOLDOWN_MS = 1500;
const recentGen = new Map<string, number>();

function hitCooldown(userId: string): boolean {
  const now = Date.now();
  const last = recentGen.get(userId) ?? 0;
  if (now - last < CLIENT_COOLDOWN_MS) return true;
  recentGen.set(userId, now);
  if (recentGen.size > 5000) {
    const firstKey = recentGen.keys().next().value;
    if (firstKey !== undefined) recentGen.delete(firstKey);
  }
  return false;
}

export async function generateAIImage(input: {
  prompt: string;
  purpose: AIImagePurpose;
  size?: AIImageSize;
}): Promise<GenerateImageResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, code: 'unauthorized', error: 'Nicht eingeloggt.' };
  }

  const trimmed = input.prompt.trim();
  if (trimmed.length < 3) {
    return { ok: false, code: 'prompt_too_short', error: 'Prompt zu kurz.' };
  }
  if (trimmed.length > 2000) {
    return { ok: false, code: 'prompt_too_long', error: 'Prompt zu lang (max 2000 Zeichen).' };
  }

  if (hitCooldown(user.id)) {
    return {
      ok: false,
      code: 'rate_limit_minute',
      error: 'Kurz durchatmen — bitte einen Moment warten.',
    };
  }

  // Edge-Function-Call über den Supabase-JS-Client; der Client hängt den
  // Auth-JWT automatisch an, die Function prüft dann serverseitig.
  const { data, error } = await supabase.functions.invoke('generate-image', {
    body: {
      prompt: trimmed,
      purpose: input.purpose,
      size: input.size ?? '1024x1024',
    },
  });

  if (error) {
    // Strukturierte Edge-Function-Response aus error.context.body extrahieren
    let code = 'upstream_failed';
    let message = error.message ?? 'Bild-Generierung fehlgeschlagen.';
    try {
      const ctx = (error as { context?: { body?: string } }).context;
      if (ctx?.body) {
        const parsed = JSON.parse(ctx.body) as { error?: { code?: string; message?: string } };
        if (parsed.error?.code) code = parsed.error.code;
        if (parsed.error?.message) message = parsed.error.message;
      }
    } catch {
      // Body war kein JSON — fällt auf default-message
    }
    return { ok: false, code, error: message };
  }

  const row = data as {
    url?: string;
    generationId?: string;
    costCents?: number;
    model?: string;
  } | null;

  if (!row?.url || !row.generationId) {
    return { ok: false, code: 'malformed_response', error: 'Unerwartete Antwort vom Server.' };
  }

  return {
    ok: true,
    url: row.url,
    generationId: row.generationId,
    costCents: row.costCents ?? 0,
    model: row.model ?? 'gpt-image-1',
  };
}

// ── Phase-4: Quota + Mark-Consumed ──────────────────────────────────────────

export interface AIImageQuota {
  used_today: number;
  limit_day: number;
  remaining_today: number;
  used_week: number;
  limit_week: number;
  remaining_week: number;
  platform_cap_reached: boolean;
  feature_enabled: boolean;
}

/**
 * Holt die aktuelle AI-Image-Quota für den eingeloggten User.
 * Null wird zurückgegeben wenn nicht eingeloggt oder RPC-Fehler.
 */
export async function getAIImageQuota(): Promise<AIImageQuota | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc('get_ai_image_user_quota', {
    p_user_id: user.id,
  });
  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[getAIImageQuota] RPC failed:', error.message);
    }
    return null;
  }
  return data as AIImageQuota;
}

/**
 * Markiert eine Generierung als „verwendet" — bewahrt das Bild vor der
 * Retention-Löschung nach 7 Tagen. Fire-and-forget: Fehler werden
 * geschluckt, Aufrufer bekommen keine Exception.
 */
export async function markAIImageConsumed(generationId: string): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.rpc('mark_ai_image_consumed', {
      p_generation_id: generationId,
    });
    if (error && process.env.NODE_ENV !== 'production') {
      console.warn('[markAIImageConsumed] RPC failed:', error.message);
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[markAIImageConsumed] throw:', e);
    }
  }
}
