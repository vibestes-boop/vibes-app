/**
 * useFeedAudio.ts — Robuste Musik-Wiedergabe für Feed-Posts
 *
 * Bugfixes gegenüber v1:
 *  - soundRef bleibt zwischen Cleanup-Runs erhalten (async race-condition behoben)
 *  - isMuted initial korrekt berücksichtigt
 *  - Explicit play() nach erfolgreichem Load (shouldPlay allein nicht zuverlässig)
 *  - Debug-Logging im Expo-Terminalfenster
 */

import { useEffect, useRef, useCallback } from 'react';

export function useFeedAudio({
  audioUrl,
  isActive,
  isMuted,
}: {
  audioUrl?: string | null;
  isActive: boolean;
  isMuted: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const soundRef   = useRef<any>(null);
  const mountedRef = useRef(true);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  // ── Aufräumen ──────────────────────────────────────────────────────────────
  const stopAndUnload = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    soundRef.current = null;
    try {
      await s.stopAsync?.();
      await s.unloadAsync?.();
    } catch { /* bereits entladen */ }
  }, []);

  // ── Laden & Abspielen ──────────────────────────────────────────────────────
  const loadAndPlay = useCallback(async (url: string) => {
    // Lade erst wenn kein Sound aktiv ist
    await stopAndUnload();
    if (!mountedRef.current) return;

    console.log('[FeedAudio] Lade Track:', url.slice(-30));

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
      const avMod = require('expo-av') as any;
      const { Audio } = avMod;

      // Audio-Session auf iOS konfigurieren
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        allowsRecordingIOS: false,
      });

      if (!mountedRef.current) return;

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        {
          shouldPlay: false,  // Wir starten manuell nach dem Load
          isLooping: true,
          volume: isMutedRef.current ? 0 : 0.8,
          progressUpdateIntervalMillis: 1000,
        },
      );

      if (!mountedRef.current) {
        // Bereits unmounted während dem Laden
        await sound.unloadAsync?.();
        return;
      }

      soundRef.current = sound;

      // Manuell starten (zuverlässiger als shouldPlay:true)
      if (!isMutedRef.current) {
        await sound.playAsync?.();
        console.log('[FeedAudio] ▶ Spielt jetzt:', url.slice(-30));
      } else {
        console.log('[FeedAudio] ⏸ Geladen aber gemuted');
      }
    } catch (e) {
      console.warn('[FeedAudio] ❌ Fehler:', e);
    }
  }, [stopAndUnload]);

  // ── Haupt-Effekt: isActive / audioUrl ─────────────────────────────────────
  useEffect(() => {
    if (!audioUrl || !audioUrl.startsWith('http')) return;

    if (isActive) {
      loadAndPlay(audioUrl);
    } else {
      stopAndUnload();
    }

    return () => {
      stopAndUnload();
    };
  // loadAndPlay / stopAndUnload sind stabile Callbacks (useCallback ohne deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, isActive]);

  // ── Mute-Toggle ───────────────────────────────────────────────────────────
  useEffect(() => {
    const s = soundRef.current;
    if (!s) return;
    if (isMuted) {
      s.setVolumeAsync?.(0).catch(() => {});
      s.pauseAsync?.().catch(() => {});
    } else {
      s.setVolumeAsync?.(0.8).catch(() => {});
      s.playAsync?.().catch(() => {});
    }
  }, [isMuted]);

  // ── Unmount Cleanup ───────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopAndUnload();
    };
  // Nur beim Mount/Unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
