/**
 * lib/liveColors.ts — Design-Token für Live-Stream-Screens
 *
 * Live-Screens sind Camera-Overlay-UIs — sie haben ein eigenes permanentes
 * Dark-Theme unabhängig vom App-Theme (Dark/Light). Diese Datei zentralisiert
 * alle semantischen Farb-Tokens für host.tsx, watch/[id].tsx und start.tsx.
 *
 * Verwendung:
 *   import { LC } from '@/lib/liveColors';
 *   color: LC.text.primary        // '#FFFFFF'
 *   backgroundColor: LC.bg.card   // 'rgba(0,0,0,0.55)'
 *
 * Nie direkte Hex-Werte in Live-Komponenten — immer LC.xxx nutzen.
 * Für reguläre App-Screens gilt weiterhin useTheme() (lib/themeStore.ts).
 */

/** Live-Stream Color Tokens (immer Dark — Camera-Overlay) */
export const LC = {
  // ── Hintergründe ────────────────────────────────────────────────────────────
  bg: {
    /** Haupt-App-Hintergrund hinter der Kamera */
    deep:     '#050508',
    /** Karten, Sheets, Input-Areas — halbtransparent für Tiefe */
    card:     'rgba(0,0,0,0.55)',
    /** Stärkere Panels (Moderations-Sheet, User-Sheets) */
    panel:    'rgba(13,13,26,0.92)',
    /** Chat-Bubbles */
    chat:     'rgba(0,0,0,0.45)',
    /** Moderator-Badge-Hintergrund */
    mod:      'rgba(99,102,241,0.25)',
    /** Overlay für dimmen des Hintergrunds */
    dimOverlay: 'rgba(0,0,0,0.75)',
    /** Gradient-Start dunkel (Stream-Start-Screen) */
    gradStart:  '#0a0010',
    /** Gradient-Mitte (Stream-Start-Screen) */
    gradMid:    '#1a0040',
    /** Gradient-Ende (Stream-Start-Screen) */
    gradEnd:    '#0a0020',
    /** Primärer Hintergrund Stream-Start (dunkelblau) */
    startPrimary: '#0d0d1a',
    /** Sekundärer Hintergrund (sehr dunkle Variante) */
    startSecondary: '#0D0D18',
    /** Input-Hintergrund in Live */
    input:    'rgba(255,255,255,0.1)',
  },

  // ── Text ────────────────────────────────────────────────────────────────────
  text: {
    /** Haupttext auf dunklem Hintergrund */
    primary:   '#FFFFFF',
    /** Untertext, Labels */
    secondary: '#E5E7EB',
    /** Gedimmter Text (Platzhalter, Hints) */
    muted:     '#9CA3AF',
    /** Noch gedimmter — sehr dezente Labels */
    faint:     '#6B7280',
  },

  // ── Akzente / Brand ─────────────────────────────────────────────────────────
  accent: {
    /** Primär-Cyan — für aktive Buttons/Highlights */
    primary:   '#FFFFFF',
    /** Lila — CoHost, Moderator, Poll (=colors.accent.secondary) */
    purple:    '#A855F7',
    /** Lila hell — CoHost-Badge-Text */
    purpleLight: '#a5b4fc',
    /** Rose/WOZ — Women-Only, Like-Heart (=colors.accent.rose) */
    rose:      '#F43F5E',
    /** Rot — Danger, Kick, Block, Battle-Team */
    danger:    '#ef4444',
    /** Rot hell — Battle-Team-A-Text */
    redLight:  '#fca5a5',
    /** Grün — Erfolg, Online, Battle-Team-B */
    success:   '#22c55e',
    /** Gelb — Warnung, Gift-Goal */
    warning:   '#fbbf24',
    /** Orange — Warmth-Gifts */
    orange:    '#f97316',
    /** Gold — Coins, Premium, Geschenk-Highlights */
    gold:      '#f59e0b',
    /** Blau — Info, Link */
    blue:      '#3b82f6',
    /** Indigo — moderierter Status */
    indigo:    '#6366f1',
    /** Live-Badge-Rot (TikTok-Stil) */
    live:      '#FF2D55',
  },

  // ── Badges & Status ──────────────────────────────────────────────────────────
  badge: {
    /** Hintergrund für "LIVE"-Badge */
    liveBg:    '#FF2D55',
    /** Hintergrund für Viewer-Count */
    viewerBg:  'rgba(0,0,0,0.45)',
    /** Hintergrund Moderator-Badge */
    modBg:     'rgba(99,102,241,0.3)',
    /** Farbe Shadow-Ban (muted) */
    shadowBan: '#6B7280',
  },

  // ── Ränder / Trenner ─────────────────────────────────────────────────────────
  border: {
    /** Standard-Rand auf dunklem Hintergrund */
    default:  'rgba(255,255,255,0.15)',
    /** Dezenter Rand */
    subtle:   'rgba(255,255,255,0.08)',
    /** Starker Rand (aktive Elemente) */
    strong:   'rgba(255,255,255,0.30)',
    /** Fehler-Rand */
    danger:   'rgba(239,68,68,0.5)',
  },

  // ── Battlemode ───────────────────────────────────────────────────────────────
  battle: {
    /** Team A: Rot */
    teamA:     '#ef4444',
    teamALight: '#fca5a5',
    teamABg:   'rgba(239,68,68,0.15)',
    /** Team B: Blau/Indigo */
    teamB:     '#a5b4fc',
    teamBLight: '#a5b4fc',
    teamBBg:   'rgba(165,180,252,0.15)',
    /** Score-Bar Hintergrund */
    scoreBg:   'rgba(255,255,255,0.1)',
  },

  // ── Misc ──────────────────────────────────────────────────────────────────────
  transparent:      'transparent',
  black:            '#000000',
  white:            '#FFFFFF',
  /** Semi-transparentes Schwarz für Overlays */
  blackOverlay:     'rgba(0,0,0,0.6)',
  /** Semi-transparentes Weiß für Highlights */
  whiteSubtle:      'rgba(255,255,255,0.12)',
  /** Für deaktivierte/gedimmte UI-Elemente */
  disabled:         '#4B5563',
} as const;

export type LiveColorToken = typeof LC;
