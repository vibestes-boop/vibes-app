/**
 * Glass-Pill Design-Utility — v1.w.UI.13.
 *
 * Einheitliches Klassen-Set für alle schwebenden Glass-Morphism-Pills im App-
 * Shell: Coins-Link, Avatar-Dropdown-Trigger, Login/Signup-Buttons im
 * `TopRightActions`-Cluster oben rechts. Vorher waren diese drei Trigger mit
 * jeweils eigenen Copy-&-Paste-Strings aus `bg-black/40 ring-1 ring-white/10
 * backdrop-blur-md hover:bg-black/60 ...` ausgestattet — Drift garantiert.
 *
 * Verhaltens-Spezifikation:
 *   - Ruhezustand: halb-transparentes Schwarz, minimaler weißer Ring,
 *     `backdrop-blur-md` damit der Pill auf jedem Canvas (Feed-Video,
 *     Shop-Weiß, Profile-Gradient) ohne harte Kante liest
 *   - Hover: Bg + Ring brighter (Opacity-Step von /10 → /20)
 *   - Radix-Open-State (`data-state="open"`): dieselbe Hervorhebung wie
 *     Hover — Dropdown-Trigger bleiben dadurch klar als „aktiv" lesbar
 *     nachdem der Pointer weggezogen wurde, und Touch-Nutzer sehen Feedback
 *     ohne `hover`-Fallback
 *   - Keyboard-Focus: weißer Ring (50% Opacity) ohne Offset. Die globale
 *     Baseline in `globals.css` rendert `ring-offset-2 ring-offset-background`,
 *     was auf einem schwebenden Pill mit transparentem Umfeld optisch den
 *     Pill „spaltet" — hier `ring-offset-0` als bewusstes Override
 *   - Transition: 200ms (`duration-base`) mit `ease-out-expo` — dieselbe
 *     Motion-Kurve die TikTok/iOS für snappy Micro-Interactions verwendet
 *
 * Anwendung: `className={cn(glassPillBase, 'h-9 px-3 text-xs font-semibold')}`.
 * Der Konsument liefert Größe, Padding und Typo — diese Utility liefert nur
 * Surface (Bg/Ring/Blur/Motion/States).
 *
 * Warum kein CSS-`@apply` in globals.css: als TS-Konstante ist die Utility
 * grep-bar (`glassPillBase` taucht eindeutig im Graph auf), einfach zu testen
 * (import + assertion), und tree-shakeable. CSS-Klassen sind in großen
 * Codebases schwerer zu refactoren weil sie als Magic-Strings leben.
 */
export const glassPillBase = [
  // Surface
  'bg-black/40 ring-1 ring-white/10 backdrop-blur-md',
  // Text-Default
  'text-white',
  // Motion
  'transition-colors duration-base ease-out-expo',
  // Hover
  'hover:bg-black/60 hover:ring-white/20',
  // Radix data-state=open — gleiche visuelle Hervorhebung wie Hover
  'data-[state=open]:bg-black/60 data-[state=open]:ring-white/20',
  // Keyboard-Focus (override für schwebende Elemente — kein ring-offset)
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-0',
].join(' ');

/**
 * Glass-sympathische Avatar-Fallback-Klassen — wird nur dann verwendet wenn
 * ein Avatar innerhalb einer Glass-Pill sitzt (aktuell nur TopRightActions).
 *
 * Der globale `AvatarFallback`-Default ist `bg-muted` (HSL-Token, opaque).
 * Auf weißem Canvas (Shop/Settings) sieht das gut aus — auf dem dunklen
 * Glass-Pill-Hintergrund wirkt es aber wie ein Button-Stamp: harte Kante
 * zur halb-transparenten Umgebung. `bg-white/10` übernimmt stattdessen die
 * Transparenz-Ästhetik und liest auf allen Theme-Varianten konsistent.
 *
 * Wichtig: Avatar selbst bleibt in `components/ui/avatar.tsx` generisch —
 * diese Klassen werden inline übergeben wo nötig, damit Feed-Card-Avatare,
 * Chat-Row-Avatare etc. nicht versehentlich den Glass-Look erben.
 */
export const glassAvatarFallback =
  'bg-white/10 text-sm font-medium text-white/90';

/**
 * Dichtere Interactive-Variante — v1.w.UI.14.
 *
 * Für schwebende Pills, die direkt über dem Video-Canvas sitzen (Live-Viewer:
 * Back-Link, Melden, Replay-Link). Der Standard-`glassPillBase` mit /40 ist
 * für den App-Shell gedacht, wo der Canvas im Schnitt heller ist. Über einem
 * 9:16-Video mit potenziell hellen Daylight-Frames liest /40 zu schwach —
 * der Pill verschwindet. Stärkere /55-Basis mit /75-Hover passt das an, ohne
 * den Rest des Glass-Patterns (Ring, Blur, Motion, Focus) zu ändern.
 *
 * Gleiche Konsumenten-Ergonomie wie `glassPillBase`: Konsument liefert Größe,
 * Padding, Text-Weight. Utility liefert Surface + States.
 */
export const glassPillStrong = [
  // Surface (denser — /55 over video canvas)
  'bg-black/55 ring-1 ring-white/10 backdrop-blur-md',
  // Text-Default
  'text-white',
  // Motion
  'transition-colors duration-base ease-out-expo',
  // Hover (denser — /75 for clearer feedback against video)
  'hover:bg-black/75 hover:ring-white/20',
  // Radix data-state=open — gleiche Hervorhebung wie Hover
  'data-[state=open]:bg-black/75 data-[state=open]:ring-white/20',
  // Keyboard-Focus (override — kein ring-offset auf schwebendem Element)
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-0',
].join(' ');

/**
 * Non-interaktive Glass-Surface — v1.w.UI.14.
 *
 * Für Wrapper-Container um bereits-stylisierte Kinder: Live-Poll-Panel und
 * Live-Action-Bar rendern intern ihre eigenen Cards/Items — die äußere
 * Hülle übernimmt nur den Glass-Look. Deshalb kein Transition, kein Hover,
 * kein Focus-Ring (keine direkte Interaktion), kein Text-Color-Default
 * (Kinder bestimmen ihre eigene Typo).
 *
 * Dichte /55 — etwas kräftiger als `glassPillBase`/40, weil der Wrapper
 * Content umschließt und optisch als Insel lesen muss. Ohne Ring wäre der
 * Rand auf weißen Video-Frames unsichtbar; mit /40 wäre der Background-
 * Content zu sichtbar und würde die Karten-Illusion brechen.
 */
export const glassSurface = [
  'bg-black/55 ring-1 ring-white/10 backdrop-blur-md',
].join(' ');

/**
 * Dichte non-interaktive Glass-Surface — v1.w.UI.14.
 *
 * Für content-dense Islands im Live-Viewer: Viewer-Count-Pill (Icon + Zahl)
 * und LiveHostPill-Wrapper (Avatar + Name + Follow-Button). Diese Pills
 * tragen mehr Information auf engem Raum und brauchen den stärkeren /70-
 * Background, damit kleine Texte (11px) und Icons (3×3) gegen komplexe
 * Video-Frames lesbar bleiben.
 *
 * Wird INNEN um Interactive-Elements kombiniert (z.B. der Follow-Button
 * in LiveHostPill ist selbst ein eigener Button mit eigenem Styling —
 * der Wrapper trägt nur den Surface-Look).
 */
export const glassSurfaceDense = [
  'bg-black/70 ring-1 ring-white/10 backdrop-blur-md',
].join(' ');
