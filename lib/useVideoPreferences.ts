/**
 * useVideoMute — globaler, persistenter Mute-Zustand für alle Video-Komponenten.
 *
 * Alle Hook-Instanzen (GuildCard, Feed-Screen) teilen denselben Zustand via
 * einem Module-Level Subscriber-Pattern — toggled eine Instanz, aktualisieren
 * sich ALLE anderen sofort (wie ein Mini-EventBus, ohne Zustand/Context).
 * AsyncStorage persistiert den Wert über App-Neustarts.
 */
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MUTED_KEY = '@vibes:video_muted';

// ─── Module-level shared state ────────────────────────────────────────────────
let _globalMuted = false;
const _subscribers = new Set<(muted: boolean) => void>();

function _setGlobal(next: boolean) {
  _globalMuted = next;
  _subscribers.forEach((fn) => fn(next));
  AsyncStorage.setItem(MUTED_KEY, String(next)).catch(() => { /* ignore */ });
}

// Einmalig beim App-Start aus AsyncStorage laden
AsyncStorage.getItem(MUTED_KEY)
  .then((val) => {
    if (val === 'true') _setGlobal(true);
  })
  .catch(() => { /* ignore */ });

// ─────────────────────────────────────────────────────────────────────────────

export function useVideoMute() {
  const [isMuted, setIsMuted] = useState(_globalMuted);

  useEffect(() => {
    // Subscriber registrieren: wird aufgerufen wenn irgendeine Instanz toggled
    _subscribers.add(setIsMuted);
    // Beim Start aktuellen Wert übernehmen (falls AsyncStorage schon geladen hat)
    setIsMuted(_globalMuted);
    return () => {
      _subscribers.delete(setIsMuted);
    };
  }, []);

  const toggleMute = useCallback(() => {
    _setGlobal(!_globalMuted);
  }, []);

  return { isMuted, toggleMute };
}

