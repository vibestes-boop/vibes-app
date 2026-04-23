/**
 * lib/useGenerateImage.ts — Hook für AI-Image-Generation (Native)
 *
 * Ruft die Supabase-Edge-Function `generate-image` mit einem Prompt + Purpose +
 * optionaler Size auf. Rückgabe enthält die öffentliche Storage-URL und kann
 * direkt als `cover_url` / `thumbnail_url` / `avatar_url` gesetzt werden —
 * kein Upload-Roundtrip mehr client-seitig nötig.
 *
 * Purposes (siehe auch Migration 20260423100000_ai_image_generations.sql):
 *   • shop_mockup     — Shop-Produktbild ohne eigenes Foto
 *   • post_cover      — Cover für Video-/Bild-Post im create-Flow
 *   • live_thumbnail  — Thumbnail für Live-Stream (live/start.tsx)
 *   • avatar          — Profilbild-Generator (settings.tsx)
 *   • sticker / icon  — Admin-Tool-Purposes (Phase 2)
 *
 * Error-Handling:
 *   Die Edge-Function gibt `{ error: { code, message } }` zurück. Der Hook
 *   normalisiert das auf `{ ok: false, error, code }`. UI-Sites können auf
 *   `code === 'rate_limit_minute' | 'rate_limit_day' | 'cost_limit_month'`
 *   reagieren (z.B. dezenten Hinweis statt generischer Fehler-Alert).
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

export type AIImagePurpose =
  | 'shop_mockup'
  | 'post_cover'
  | 'live_thumbnail'
  | 'avatar'
  | 'sticker'
  | 'icon';

export type AIImageSize = '1024x1024' | '1024x1536' | '1536x1024' | '512x512';

export interface GenerateImageInput {
  prompt: string;
  purpose: AIImagePurpose;
  size?: AIImageSize;
}

export interface GenerateImageSuccess {
  ok: true;
  url: string;
  generationId: string;
  costCents: number;
  model: string;
}

export interface GenerateImageFailure {
  ok: false;
  code: string;
  error: string;
}

export type GenerateImageResult = GenerateImageSuccess | GenerateImageFailure;

export function useGenerateImage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const generate = useCallback(async (input: GenerateImageInput): Promise<GenerateImageResult> => {
    setIsGenerating(true);
    setLastError(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: input.prompt.trim(),
          purpose: input.purpose,
          size: input.size ?? '1024x1024',
        },
      });

      // Supabase-Client wirft nicht bei 4xx/5xx — der Fehler liegt in
      // `error.context.res`. Wir parsen das strukturiert damit die UI
      // code-spezifische Meldungen zeigen kann (Rate-Limit-Warnung etc.).
      if (error) {
        // Versuche, die strukturierte Edge-Function-Response zu extrahieren
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
          // Body war kein JSON — fällt auf default message zurück
        }
        setLastError(message);
        return { ok: false, code, error: message };
      }

      const row = data as {
        url?: string;
        generationId?: string;
        costCents?: number;
        model?: string;
      } | null;

      if (!row?.url || !row.generationId) {
        const msg = 'Unerwartete Antwort vom Server.';
        setLastError(msg);
        return { ok: false, code: 'malformed_response', error: msg };
      }

      return {
        ok: true,
        url: row.url,
        generationId: row.generationId,
        costCents: row.costCents ?? 0,
        model: row.model ?? 'gpt-image-1',
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Netzwerk-Fehler.';
      setLastError(msg);
      return { ok: false, code: 'network_error', error: msg };
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return {
    generate,
    isGenerating,
    lastError,
    clearError: () => setLastError(null),
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
 * Holt die aktuelle User-Quota vom Server. Wird beim Sheet-Open gerufen
 * und cached während die Sheet offen ist — nach jeder erfolgreichen
 * Generierung refresht `refetch()` den Counter.
 */
export function useAIImageQuota(enabled: boolean = true) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [quota, setQuota] = useState<AIImageQuota | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchQuota = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_ai_image_user_quota', {
        p_user_id: userId,
      });
      if (error) {
        if (__DEV__) console.warn('[useAIImageQuota] RPC failed:', error.message);
        return;
      }
      setQuota(data as AIImageQuota);
    } catch (e) {
      if (__DEV__) console.warn('[useAIImageQuota] throw:', e);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (enabled && userId) fetchQuota();
  }, [enabled, userId, fetchQuota]);

  return { quota, isLoading, refetch: fetchQuota };
}

/**
 * Markiert eine Generierung als „verwendet" — d.h. der User hat das Bild
 * aktiv in ein Produkt/Live/Post übernommen. Retention-Cron überspringt
 * markierte Rows und lässt die PNGs dauerhaft im Storage.
 *
 * Fehler werden geschluckt — ein fehlgeschlagener Mark-Call soll den
 * UI-Flow nicht blockieren. Im worst case wird das Bild nach 7 Tagen
 * vom Retention-Cron mitgelöscht, aber der User hat es ja schon gespeichert
 * (Shop-Product-Row, Live-Thumbnail-URL etc. haben eine Kopie der URL).
 */
export async function markAIImageConsumed(generationId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('mark_ai_image_consumed', {
      p_generation_id: generationId,
    });
    if (error && __DEV__) {
      console.warn('[markAIImageConsumed] RPC failed:', error.message);
    }
  } catch (e) {
    if (__DEV__) console.warn('[markAIImageConsumed] throw:', e);
  }
}
