/**
 * audio.ts — Audio-Utilities für Serlo Remotion-Compositions
 *
 * Zentralisiert alle Audio-Pfade und liefert typsichere Helpers
 * für das Einbinden von Sounds in Compositions.
 *
 * ─── SETUP ───────────────────────────────────────────────────────────────────
 *
 * Audio-Dateien unter public/audio/ ablegen:
 *
 *   public/audio/coin-tick.mp3       ← kurzes "pling" (~100ms), Coin-Counter-Tick
 *   public/audio/coin-collect.mp3    ← satter Coin-Sound (~500ms), Gift-Eingang
 *   public/audio/intro-jingle.mp3    ← Intro-Musik (~1s), LiveStreamIntro
 *   public/audio/leaderboard-bg.mp3  ← Ambient-Loop, WeeklyTopGifters BG
 *   public/audio/fanfare.mp3         ← Kurzfanfare (~1.5s), Rank-Reveal
 *
 * Empfohlene Quellen:
 *   - https://freesound.org (CC0 Lizenzen verfügbar)
 *   - https://pixabay.com/music/ (Royalty-free)
 *   - Eigene Produktion (Garageband / Logic)
 *
 * Format: MP3 (breite Remotion-Kompatibilität) oder WAV für beste Qualität.
 * Bitrate: 128kbps MP3 reicht für kurze Sounds; 320kbps für Musik/Loops.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────
 *
 * In einer Composition:
 *   import { Audio } from 'remotion';
 *   import { AUDIO, audioAvailable } from '../lib/audio';
 *
 *   // Coin-Tick bei Frame 30:
 *   {audioAvailable('coinTick') && (
 *     <Sequence from={30} durationInFrames={1}>
 *       <Audio src={AUDIO.coinTick} volume={0.6} />
 *     </Sequence>
 *   )}
 *
 *   // Hintergrundmusik mit Loop:
 *   <Audio src={AUDIO.leaderboardBg} volume={0.25} loop />
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { staticFile } from 'remotion';

// ─── Audio-Pfade ──────────────────────────────────────────────────────────────

/**
 * Typsichere Audio-Pfad-Sammlung.
 * Alle Pfade werden über `staticFile()` aufgelöst — Remotion verarbeitet sie
 * korrekt in Studio, Render und Lambda.
 */
export const AUDIO = {
  /** ~100ms Pling — für Coin-Counter-Ticks (z.B. ein Tick pro 1000 Coins) */
  coinTick: staticFile('audio/coin-tick.mp3'),

  /** ~500ms satter Coin-Sound — wenn ein Geschenk ankommt */
  coinCollect: staticFile('audio/coin-collect.mp3'),

  /** ~1s Intro-Jingle — LiveStreamIntro Opener */
  introJingle: staticFile('audio/intro-jingle.mp3'),

  /** Ambient-Loop — WeeklyTopGifters Hintergrundmusik */
  leaderboardBg: staticFile('audio/leaderboard-bg.mp3'),

  /** ~1.5s Fanfare — bei Rank-1-Reveal im Leaderboard */
  fanfare: staticFile('audio/fanfare.mp3'),
} as const;

export type AudioKey = keyof typeof AUDIO;

// ─── Verfügbarkeits-Check ─────────────────────────────────────────────────────

/**
 * Dateien die bereits unter public/audio/ vorliegen.
 * Hier eintragen wenn eine Datei hinzugefügt wurde — verhindert
 * Remotion-Fehler durch fehlende Dateien.
 *
 * TODO: Diese Liste erweitern wenn Audio-Dateien tatsächlich abgelegt werden.
 */
const AVAILABLE_AUDIO = new Set<AudioKey>([
  // 'coinTick',
  // 'coinCollect',
  // 'introJingle',
  // 'leaderboardBg',
  // 'fanfare',
]);

/**
 * Gibt `true` zurück wenn die Audio-Datei verfügbar ist.
 * Nutze das als Guard vor `<Audio src={...} />` um Render-Fehler zu vermeiden.
 *
 * @example
 * {audioAvailable('coinTick') && (
 *   <Sequence from={30}><Audio src={AUDIO.coinTick} volume={0.5} /></Sequence>
 * )}
 */
export function audioAvailable(key: AudioKey): boolean {
  return AVAILABLE_AUDIO.has(key);
}

/**
 * Markiert eine Audio-Datei als verfügbar.
 * Aufruf in index.ts nach dem Ablegen der Datei:
 *   markAudioAvailable('coinTick');
 */
export function markAudioAvailable(key: AudioKey): void {
  AVAILABLE_AUDIO.add(key);
}

// ─── Volume-Presets ───────────────────────────────────────────────────────────

/**
 * Konsistente Lautstärken — damit Coins nicht lauter sind als die Musik.
 */
export const VOLUME = {
  /** Hintergrundmusik — dezent im Hintergrund */
  bg: 0.20,
  /** Ambient-Effekte (leise Loops) */
  ambient: 0.35,
  /** UI-Sounds (Ticks, Clicks) */
  ui: 0.55,
  /** Einmalige Sounds (Coin-Collect, Fanfare) */
  effect: 0.75,
  /** Dominante Sounds (Intro-Jingle) */
  featured: 0.90,
} as const;

// ─── Coin-Tick Timing-Helper ──────────────────────────────────────────────────

/**
 * Berechnet die Frame-Zeitpunkte für Coin-Tick-Sounds.
 * Gibt ein Array von Frames zurück, an denen ein Tick-Sound gespielt wird.
 *
 * @param fromValue   Startwert des Coin-Counters
 * @param toValue     Endwert des Coin-Counters
 * @param startFrame  Frame an dem der Counter startet
 * @param endFrame    Frame an dem der Counter endet
 * @param tickEvery   Coin-Schritt pro Tick (default: 1000)
 *
 * @example
 * const tickFrames = coinTickFrames(0, 48200, 8, 58, 5000);
 * // → [8, 14, 20, 26, ...]
 */
export function coinTickFrames(
  fromValue: number,
  toValue: number,
  startFrame: number,
  endFrame: number,
  tickEvery = 1000,
): number[] {
  const totalFrames = endFrame - startFrame;
  const totalCoins = toValue - fromValue;
  const ticks: number[] = [];

  let nextTick = Math.ceil(fromValue / tickEvery) * tickEvery;
  while (nextTick <= toValue) {
    const progress = (nextTick - fromValue) / totalCoins;
    const frame = Math.round(startFrame + progress * totalFrames);
    ticks.push(frame);
    nextTick += tickEvery;
  }

  return ticks;
}
