/**
 * lib/tokens.ts — Design System Foundation
 *
 * Zentrale Design-Tokens für die gesamte Serlo/Vibes App.
 * Verwendet werden diese Tokens in allen Screens und Komponenten
 * anstelle von hardcodierten Werten.
 *
 * Für Theme-abhängige Farben: useTheme() aus lib/useTheme.ts
 * Für Live-Screen-Farben: LC aus lib/liveColors.ts
 * Für Spacing/Typo/Radius: diese Datei
 *
 * Verwendung:
 *   import { SPACE, RADII, FONT_SIZE, FONT_WEIGHT } from '@/lib/tokens';
 *   paddingHorizontal: SPACE.base    // 16
 *   borderRadius: RADII.md           // 12
 *   fontSize: FONT_SIZE.md           // 15
 *   fontWeight: FONT_WEIGHT.semibold // '600'
 */

// ─── Spacing — 4px Grid (Apple HIG Standard) ──────────────────────────────────
/**
 * Einheitliches Spacing-System auf Basis eines 4px-Grids.
 * Alle Abstände sollten ein Vielfaches von 4 sein.
 *
 * xs   =  4 — Enge Abstände innerhalb von Elementen (Icon-zu-Text)
 * sm   =  8 — Standard Innen-Abstände (Chips, Tags, kleine Elemente)
 * md   = 12 — Mittlere Abstände (Card-Innenabstand)
 * base = 16 — Standard Screen-Horizontal-Padding (iOS default)
 * lg   = 20 — Größere Abstände (Card-Außenabstand, Section-Gap)
 * xl   = 24 — Abstand zwischen Sections
 * 2xl  = 32 — Großer vertikaler Abstand
 * 3xl  = 48 — Hero-Abstände, große vertikale Gaps
 */
export const SPACE = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  '2xl': 32,
  '3xl': 48,
} as const;

export type SpaceKey = keyof typeof SPACE;

// ─── Border Radius — 4 semantische Stufen ─────────────────────────────────────
/**
 * sm   =   6 — kleine Elemente: Status-Badges, Tags, kleine Chips
 * md   =  12 — Standard-Cards, Inputs, Sheets, Modals
 * lg   =  20 — Haupt-Buttons, große Cards, Bottom-Sheets
 * full = 999 — Pill-Form: Avatar, runde Buttons, Kreise
 */
export const RADII = {
  sm:   6,
  md:   12,
  lg:   20,
  full: 999,
} as const;

export type RadiusKey = keyof typeof RADII;

// ─── Font Sizes — 6 semantische Stufen ────────────────────────────────────────
/**
 * xs  = 11 — Timestamps, Meta-Daten, sehr kleine Labels (Badges)
 * sm  = 13 — Sekundärtext, Captions, Helper-Text
 * md  = 15 — Standard-Fließtext, Buttons, Inputs (iOS default body: 17 — hier 15 für dense UI)
 * lg  = 17 — Primäre Labels, Section-Titles, wichtige Infos
 * xl  = 22 — Screen-Titel, große Headlines
 * 2xl = 28 — Hero-Zahlen (Viewer-Count, Coin-Balance), große Displays
 */
export const FONT_SIZE = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   22,
  '2xl': 28,
} as const;

export type FontSizeKey = keyof typeof FONT_SIZE;

// ─── Font Weights ──────────────────────────────────────────────────────────────
/**
 * Bewusst auf 4 Stufen reduziert (war zuvor: 400/500/600/700/800/900).
 * 900 und 800 verbreiten visuellen "Heavy"-Eindruck — werden durch 700/600 ersetzt.
 *
 * regular  = '400' — Standard-Text, Fließtext
 * medium   = '500' — Sekundäre Labels, dezente Hervorhebungen
 * semibold = '600' — UI-Labels, Buttons, Standard-Hervorhebungen
 * bold     = '700' — Wichtige Preise, CTAs, Header, primäre Akzente
 */
export const FONT_WEIGHT = {
  regular:  '400' as const,
  medium:   '500' as const,
  semibold: '600' as const,
  bold:     '700' as const,
} as const;

export type FontWeightKey = keyof typeof FONT_WEIGHT;

// ─── Line Heights ──────────────────────────────────────────────────────────────
/**
 * Als Multiplikator für fontSize zu verwenden.
 * tight  = 1.2 — Headlines, kompakte Badges
 * normal = 1.4 — Standard-Text (iOS/Android default ~1.3–1.5)
 * loose  = 1.6 — Paragraphen, Beschreibungen
 */
export const LINE_HEIGHT = {
  tight:  1.2,
  normal: 1.4,
  loose:  1.6,
} as const;

// ─── Icon Sizes ────────────────────────────────────────────────────────────────
/**
 * Einheitliche Icon-Größen für lucide-react-native Icons.
 * sm  = 14 — sehr kleine kontextuelle Icons
 * md  = 18 — Standard Tab-Bar Icons, Inline-Icons
 * lg  = 22 — Header-Actions, prominente Icons
 * xl  = 28 — Feature-Icons in leerem Zustand / Onboarding
 * 2xl = 48 — Hero-Icons (Empty-States, Success-Screens)
 */
export const ICON_SIZE = {
  sm:   14,
  md:   18,
  lg:   22,
  xl:   28,
  '2xl': 48,
} as const;

// ─── Z-Index Layering ──────────────────────────────────────────────────────────
/**
 * Zentrale Z-Index Skala verhindert "z-index wars".
 * base     =   0 — normaler Document-Flow
 * raised   =  10 — leicht erhöhte Elemente (Sticky-Headers)
 * overlay  = 100 — Overlays die über Screen-Content liegen
 * modal    = 200 — Modale Dialoge
 * toast    = 300 — Toast-Notifications (über Modals)
 * max      = 999 — Systemkritische UI (Emergency-Banner)
 */
export const Z_INDEX = {
  base:    0,
  raised:  10,
  overlay: 100,
  modal:   200,
  toast:   300,
  max:     999,
} as const;

// ─── Hit Slop Presets ──────────────────────────────────────────────────────────
/**
 * Standardisierte hitSlop-Werte für Touch-Ziele.
 * Apple HIG: min. 44×44pt Touch-Ziel für Barrierefreiheit.
 */
export const HIT_SLOP = {
  sm:   { top: 4,  bottom: 4,  left: 4,  right: 4  },
  md:   { top: 8,  bottom: 8,  left: 8,  right: 8  },
  lg:   { top: 12, bottom: 12, left: 12, right: 12 },
} as const;

// ─── Animation Durations ───────────────────────────────────────────────────────
/**
 * Einheitliche Animations-Dauern (in Millisekunden).
 * instant = 80  — Press-Feedback, scale Animationen
 * fast    = 150 — Quick UI-Responses
 * normal  = 250 — Standard-Übergänge (iOS default ~300ms)
 * slow    = 400 — Komplexe Animationen, Page-Transitions
 */
export const DURATION = {
  instant: 80,
  fast:    150,
  normal:  250,
  slow:    400,
} as const;
