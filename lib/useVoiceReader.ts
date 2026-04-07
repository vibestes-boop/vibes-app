/**
 * useVoiceReader — Hybrid TTS für Chatterbox Vibes (v5)
 *
 * STRATEGIE:
 * • Mit voiceRefUrl (Creator-Voice-Clone) → Chatterbox (Replicate)
 *   Voice-Referenz setzt automatisch korrekte Sprach-Phonetik.
 * • Ohne voiceRefUrl → expo-speech mit tinyld Spracherkennung
 *   tinyld-light: 65 KB, >90% Genauigkeit, offline, 62+ Sprachen.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Speech from 'expo-speech';
import { detect } from 'tinyld/light';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

type VoiceState = 'idle' | 'loading' | 'playing' | 'error';

export interface UseVoiceReaderReturn {
  state: VoiceState;
  isLoading: boolean;
  isPlaying: boolean;
  toggle: () => Promise<void>;
  stop: () => void;
}

// ── Globaler URL-Cache ─────────────────────────────────────────────────────────
const audioUrlCache = new Map<string, string>();

// ── ISO 639-1 → BCP 47 Locale Mapping für expo-speech ────────────────────────
const LANG_LOCALE: Record<string, string> = {
  de: 'de-DE', en: 'en-US', fr: 'fr-FR', es: 'es-ES',
  it: 'it-IT', pt: 'pt-BR', nl: 'nl-NL', pl: 'pl-PL',
  ru: 'ru-RU', tr: 'tr-TR', ar: 'ar-SA', he: 'he-IL',
  ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN', sv: 'sv-SE',
  da: 'da-DK', fi: 'fi-FI', no: 'nb-NO', cs: 'cs-CZ',
  ro: 'ro-RO', hu: 'hu-HU', uk: 'uk-UA', el: 'el-GR',
};

/** tinyld-light: 65KB, >90% Genauigkeit, offline, 62 Sprachen */
function detectLocale(text: string): string {
  const lang = detect(text); // z.B. 'de', 'en', 'fr'
  return LANG_LOCALE[lang] ?? 'en-US';
}

export function useVoiceReader(
  postId: string,
  text: string,
  exaggeration = 0.5,
  voiceRefUrl?: string | null,
): UseVoiceReaderReturn {
  const cacheKey = voiceRefUrl ? `${postId}_voiced` : postId;
  const useChatterbox = !!voiceRefUrl;



  const [state, setState] = useState<VoiceState>('idle');

  // Lifecycle / Abort-Refs
  const isMountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null); // laufende Fetches abbrechen
  const isFetchingRef = useRef(false);                        // doppelte API-Calls verhindern

  // expo-audio Player (Chatterbox-Modus)
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);

  // Wenn Chatterbox-Audio endet → idle
  useEffect(() => {
    if (useChatterbox && playerStatus.didJustFinish) {
      if (isMountedRef.current) setState('idle');
    }
  }, [playerStatus.didJustFinish, useChatterbox]);

  // Cleanup beim Unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
      try { player.pause(); } catch (_) { /* ignore */ }
      Speech.stop(); // synchron, kein Promise
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Chatterbox: Audio-URL holen (mit AbortController) ────────────────────
  const fetchAudioUrl = useCallback(async (): Promise<string | null> => {
    const cached = audioUrlCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    if (isFetchingRef.current) return null;
    isFetchingRef.current = true;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const payload = {
      post_id: cacheKey,
      text: text.slice(0, 500),
      exaggeration,
      ...(voiceRefUrl ? { voice_ref_url: voiceRefUrl } : {}),
    };

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-voice`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON}`,
          'apikey': SUPABASE_ANON,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`[VoiceReader] ❌ HTTP ${res.status}:`, errBody);
        return null;
      }

      const json = await res.json();
      const url: string | undefined = json?.audio_url;
      if (url) audioUrlCache.set(cacheKey, url);
      return url ?? null;

    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return null;
      console.error('[VoiceReader] Fetch error:', err);
      return null;
    } finally {
      isFetchingRef.current = false;
    }
  }, [cacheKey, text, exaggeration, voiceRefUrl]);

  // ── Play: expo-speech (instant → kein loading-State) ─────────────────────
  const playSpeech = useCallback(() => {
    if (!isMountedRef.current) return;
    const language = detectLocale(text);

    try {
      Speech.stop(); // vorherige Wiedergabe stoppen
      setState('playing');
      Speech.speak(text.slice(0, 1000), {
        language,
        rate: 0.92,
        pitch: 1.0,
        onDone: () => { if (isMountedRef.current) setState('idle'); },
        onError: () => { if (isMountedRef.current) setState('error'); },
        onStopped: () => { if (isMountedRef.current) setState('idle'); },
      });
    } catch (err) {
      console.error('[useVoiceReader] Speech error:', err);
      if (isMountedRef.current) setState('error');
    }
  }, [text]);

  // ── Play: Chatterbox mit Voice-Clone ─────────────────────────────────────
  const playChatterbox = useCallback(async () => {
    if (!isMountedRef.current) return;
    setState('loading');

    const url = await fetchAudioUrl();
    if (!isMountedRef.current) return;

    if (!url) {
      playSpeech();
      return;
    }

    try {
      player.replace({ uri: url });
      player.play();
      setState('playing');
    } catch (err) {
      console.error('[VoiceReader] Playback error:', err);
      if (isMountedRef.current) playSpeech();
    }
  }, [fetchAudioUrl, player, playSpeech, voiceRefUrl]);

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    abortRef.current?.abort();
    try { player.pause(); } catch (_) { /* ignore */ }
    Speech.stop(); // synchron
    if (isMountedRef.current) setState('idle');
  }, [player]);

  // ── Toggle ────────────────────────────────────────────────────────────────
  const toggle = useCallback(async () => {
    if (state === 'playing' || state === 'loading') {
      stop();
    } else if (state === 'idle' || state === 'error') {
      if (useChatterbox) {
        await playChatterbox();
      } else {
        playSpeech();
      }
    }
  }, [state, stop, useChatterbox, playChatterbox, playSpeech]);

  return {
    state,
    isLoading: state === 'loading',
    isPlaying: state === 'playing',
    toggle,
    stop,
  };
}
