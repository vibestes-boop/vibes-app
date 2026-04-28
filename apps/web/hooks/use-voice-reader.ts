'use client';

/**
 * useVoiceReader — v1.w.UI.218
 *
 * Web-Pendant zu `lib/useVoiceReader.ts` (Native).
 *
 * Strategie:
 *   • Mit voiceRefUrl → Chatterbox (Replicate via generate-voice Edge Function)
 *     → cached WAV via Supabase Storage → `new Audio(url).play()`
 *   • Ohne voiceRefUrl → window.speechSynthesis (Web Speech API)
 *     Lang-Detection via einfachem Heuristik (Cyrillisch → ru, sonst de/en)
 *
 * Cache: module-level Map (lebt solange der Tab offen ist).
 * Abort: AbortController verhindert doppelte API-Calls.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// ── Types ─────────────────────────────────────────────────────────────────────

type VoiceState = 'idle' | 'loading' | 'playing' | 'error';

export interface UseVoiceReaderReturn {
  state: VoiceState;
  isLoading: boolean;
  isPlaying: boolean;
  toggle: () => Promise<void>;
  stop: () => void;
}

// ── Module-level cache ────────────────────────────────────────────────────────

const audioUrlCache = new Map<string, string>();

// ── Lang detection (lightweight, no dep) ─────────────────────────────────────

function detectSpeechLang(text: string): string {
  // Cyrillisch → Russisch/Tschetschenisch
  if (/[Ѐ-ӿ]/.test(text)) return 'ru-RU';
  // Arabisch
  if (/[؀-ۿ]/.test(text)) return 'ar-SA';
  // Deutsch-Heuristik: häufige Umlaute / Wörter
  if (/[äöüÄÖÜß]/.test(text) || /\b(und|ich|nicht|das|die|der|ein|ist)\b/.test(text.toLowerCase())) return 'de-DE';
  return 'en-US';
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useVoiceReader(
  postId: string,
  text: string,
  exaggeration = 0.5,
  voiceRefUrl?: string | null,
): UseVoiceReaderReturn {
  const cacheKey = voiceRefUrl ? `${postId}_voiced` : postId;
  const useChatterbox = !!voiceRefUrl && !!SUPABASE_URL;

  const [state, setState] = useState<VoiceState>('idle');

  const isMountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const isFetchingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
      audioRef.current?.pause();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // ── speechSynthesis fallback ─────────────────────────────────────────────

  const playSpeech = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setState('error');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 1000));
    utterance.lang = detectSpeechLang(text);
    utterance.rate = 0.92;
    utterance.onend = () => { if (isMountedRef.current) setState('idle'); };
    utterance.onerror = () => { if (isMountedRef.current) setState('error'); };
    setState('playing');
    window.speechSynthesis.speak(utterance);
  }, [text]);

  // ── Chatterbox fetch ─────────────────────────────────────────────────────

  const fetchAudioUrl = useCallback(async (): Promise<string | null> => {
    const cached = audioUrlCache.get(cacheKey);
    if (cached) return cached;
    if (isFetchingRef.current) return null;

    isFetchingRef.current = true;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-voice`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON}`,
          apikey: SUPABASE_ANON,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: cacheKey,
          text: text.slice(0, 500),
          exaggeration,
          ...(voiceRefUrl ? { voice_ref_url: voiceRefUrl } : {}),
        }),
      });

      if (!res.ok) return null;
      const json = await res.json();
      const url: string | undefined = json?.audio_url;
      if (url) audioUrlCache.set(cacheKey, url);
      return url ?? null;
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return null;
      return null;
    } finally {
      isFetchingRef.current = false;
    }
  }, [cacheKey, text, exaggeration, voiceRefUrl]);

  // ── Chatterbox playback ──────────────────────────────────────────────────

  const playChatterbox = useCallback(async () => {
    if (!isMountedRef.current) return;
    setState('loading');

    const url = await fetchAudioUrl();
    if (!isMountedRef.current) return;

    if (!url) {
      // Chatterbox failed → graceful fallback
      playSpeech();
      return;
    }

    try {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { if (isMountedRef.current) setState('idle'); };
      audio.onerror = () => { if (isMountedRef.current) setState('error'); };
      await audio.play();
      setState('playing');
    } catch {
      if (isMountedRef.current) playSpeech();
    }
  }, [fetchAudioUrl, playSpeech]);

  // ── Stop ─────────────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    abortRef.current?.abort();
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (isMountedRef.current) setState('idle');
  }, []);

  // ── Toggle ────────────────────────────────────────────────────────────────

  const toggle = useCallback(async () => {
    if (state === 'playing' || state === 'loading') {
      stop();
    } else {
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
