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
