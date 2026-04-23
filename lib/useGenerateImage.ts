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

import { useCallback, useState } from 'react';
import { supabase } from './supabase';

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
