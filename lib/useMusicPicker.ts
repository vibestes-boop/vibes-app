/**
 * useMusicPicker.ts — Musik-Bibliothek + Favorites + Playback-Hook
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVS_KEY = '@vibes:music_favorites';

// ─── Track-Interface ──────────────────────────────────────────────────────────
export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  mood: string;
  duration: number;   // Sekunden
  bpm: number;        // Beats per Minute
  url: string;        // MP3-Link
  trending?: boolean; // Erscheint im Trending-Tab
}

// ─── Musik-Bibliothek (12 Tracks) ────────────────────────────────────────────
export const MUSIC_LIBRARY: MusicTrack[] = [
  {
    id: 'chill-beats-01',
    title: 'Chill Vibes',
    artist: 'Vibes Studio',
    genre: 'Lo-Fi',
    mood: '😌 Entspannt',
    duration: 180,
    bpm: 72,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    trending: true,
  },
  {
    id: 'energy-boost-02',
    title: 'Energy Boost',
    artist: 'Vibes Studio',
    genre: 'Electronic',
    mood: '⚡ Energetisch',
    duration: 150,
    bpm: 128,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    trending: true,
  },
  {
    id: 'deep-bass-03',
    title: 'Deep Bass',
    artist: 'Vibes Studio',
    genre: 'Hip-Hop',
    mood: '🔥 Hype',
    duration: 165,
    bpm: 95,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    trending: true,
  },
  {
    id: 'summer-pop-04',
    title: 'Summer Pop',
    artist: 'Vibes Studio',
    genre: 'Pop',
    mood: '☀️ Fröhlich',
    duration: 140,
    bpm: 116,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    trending: true,
  },
  {
    id: 'ambient-flow-05',
    title: 'Ambient Flow',
    artist: 'Vibes Studio',
    genre: 'Ambient',
    mood: '🌊 Ruhig',
    duration: 200,
    bpm: 60,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
  },
  {
    id: 'trap-king-06',
    title: 'Trap King',
    artist: 'Vibes Studio',
    genre: 'Trap',
    mood: '🎯 Fokus',
    duration: 175,
    bpm: 140,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    trending: true,
  },
  {
    id: 'future-bass-07',
    title: 'Future Bass',
    artist: 'Vibes Studio',
    genre: 'Future Bass',
    mood: '🚀 Euphorisch',
    duration: 155,
    bpm: 150,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    trending: true,
  },
  {
    id: 'acoustic-vibes-08',
    title: 'Acoustic Vibes',
    artist: 'Vibes Studio',
    genre: 'Acoustic',
    mood: '🎸 Authentisch',
    duration: 185,
    bpm: 85,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  },
  {
    id: 'midnight-lo-09',
    title: 'Midnight Study',
    artist: 'Vibes Studio',
    genre: 'Lo-Fi',
    mood: '🌙 Nacht',
    duration: 195,
    bpm: 68,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
  },
  {
    id: 'synthwave-10',
    title: 'Neon Drive',
    artist: 'Vibes Studio',
    genre: 'Electronic',
    mood: '🌆 Retro',
    duration: 170,
    bpm: 118,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
    trending: true,
  },
  {
    id: 'drill-11',
    title: 'Street Drill',
    artist: 'Vibes Studio',
    genre: 'Hip-Hop',
    mood: '🥶 Ice Cold',
    duration: 158,
    bpm: 142,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
  },
  {
    id: 'dance-pop-12',
    title: 'Dance Floor',
    artist: 'Vibes Studio',
    genre: 'Pop',
    mood: '💃 Party',
    duration: 162,
    bpm: 124,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3',
    trending: true,
  },
];

// ─── Genre-Filter ─────────────────────────────────────────────────────────────
export const GENRES = ['Alle', 'Lo-Fi', 'Electronic', 'Hip-Hop', 'Pop', 'Ambient', 'Trap', 'Future Bass', 'Acoustic'];

// ─── URL → Titel (für Feed-Badge) ────────────────────────────────────────────
export function getTitleFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return MUSIC_LIBRARY.find((t) => t.url === url)?.title ?? null;
}

// ─── Favorites Hook ───────────────────────────────────────────────────────────
export function useFavorites() {
  const [favIds, setFavIds] = useState<Set<string>>(new Set());

  // Beim Mount aus AsyncStorage laden
  useEffect(() => {
    AsyncStorage.getItem(FAVS_KEY)
      .then((raw) => {
        if (raw) setFavIds(new Set(JSON.parse(raw) as string[]));
      })
      .catch(() => {});
  }, []);

  const toggle = useCallback((id: string) => {
    setFavIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      AsyncStorage.setItem(FAVS_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  const isFav = useCallback((id: string) => favIds.has(id), [favIds]);

  return { favIds, toggle, isFav };
}

// ─── Audio Player Hook ────────────────────────────────────────────────────────
export interface AudioPlayerState {
  playingId: string | null;
  isLoading: boolean;
  progressSec: number;
  play: (track: MusicTrack) => Promise<void>;
  stop: () => Promise<void>;
  toggle: (track: MusicTrack) => Promise<void>;
  setVolume: (v: number) => void;  // Live-Lautstärke der Vorschau ändern
}

export function useAudioPlayer(): AudioPlayerState {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progressSec, setProgressSec] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const soundRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const stop = useCallback(async () => {
    clearTimer();
    setProgressSec(0);
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync?.();
        await soundRef.current.unloadAsync?.();
        soundRef.current = null;
      }
    } catch { /* ignorieren */ }
    setPlayingId(null);
  }, []);

  const play = useCallback(async (track: MusicTrack) => {
    setIsLoading(true);
    await stop();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
      const avMod = require('expo-av') as any;
      const { Audio } = avMod;

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: track.url },
        { shouldPlay: false, isLooping: false, volume: 1.0 },
      );
      soundRef.current = sound;

      await sound.playAsync();
      __DEV__ && console.log('[MusicPicker] ▶ Spielt:', track.title);

      setPlayingId(track.id);
      setProgressSec(0);

      // Progress-Timer: jede Sekunde aktualisieren
      timerRef.current = setInterval(() => {
        setProgressSec((s) => s + 1);
      }, 1000);

      // Auto-stop wenn fertig
      sound.setOnPlaybackStatusUpdate((status: { didJustFinish?: boolean }) => {
        if (status?.didJustFinish) {
          clearTimer();
          setPlayingId(null);
          setProgressSec(0);
          soundRef.current = null;
        }
      });
    } catch (e) {
      __DEV__ && console.warn('[MusicPicker] ❌ Fehler:', e);
      setPlayingId(null);
    }
    setIsLoading(false);
  }, [stop]);

  const toggle = useCallback(async (track: MusicTrack) => {
    if (playingId === track.id) {
      await stop();
    } else {
      await play(track);
    }
  }, [playingId, play, stop]);

  const setVolume = useCallback((v: number) => {
    soundRef.current?.setVolumeAsync?.(v).catch(() => {});
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { clearTimer(); stop(); }, [stop]);

  return { playingId, isLoading, progressSec, play, stop, toggle, setVolume };
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
