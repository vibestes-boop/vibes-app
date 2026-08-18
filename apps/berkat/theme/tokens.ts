// Berkat hat zwei Flächen, und jede hat eine feste Helligkeit.
//
//   ui    — hell, Sand. Stöbern, verkaufen, verwalten. Der Basar bei Tag.
//   stage — dunkel. Nur der Live-Raum, wo das Video die Fläche ist.
//
// Es gibt bewusst KEINEN Hell-Dunkel-Umschalter. Jede Komponente weiß, auf
// welcher Fläche sie sitzt, und nimmt genau deren Palette. Damit kann nie ein
// heller Text auf heller Fläche landen — der Fehler, der sich in Serlo immer
// wieder eingeschlichen hat, ist hier strukturell ausgeschlossen.
//
// Regel: NIE eine Farbe direkt in eine Komponente schreiben. Alles kommt hierher.

/** Helle Fläche — Startseite, Kategorien, Studio, Konto, Anmeldung. */
export const ui = {
  /** Sand. Der Grundton der App. */
  bg: '#FAF7F2',
  /** Karten und Sheets liegen als Weiß auf dem Sand. */
  card: '#FFFFFF',
  /** Chips, Bildplatzhalter, ruhige Flächen. */
  sunken: '#F0EAE0',
  /**
   * Milchige Auflage für Text auf einem FREMDEN Bild. Berkat tut das an genau
   * ZWEI Stellen, und diese Liste ist der Bestand:
   *
   *   1. die Live-Vorschau auf den Show-Karten (`components/LivePreview.tsx`)
   *   2. die Pillen auf der Angebots-Karte — „Deins", Merken-Herz, Bildzahl —
   *      und das „Titelbild"-Etikett im Composer (`ListingCard.tsx`,
   *      `StandingComposer.tsx`, seit 17.08.2026)
   *
   * Wer eine dritte anlegt, trägt sie hier ein — sonst misst der nächste Prüfer
   * eine Fläche nach und glaubt, alle geprüft zu haben.
   *
   * Bewusst fast deckend. Ein Vorschaubild ist mal hell, mal dunkel; zartes
   * Glas wäre auf dem einen lesbar und auf dem nächsten weg. Genau diesen Fall
   * schließen die zwei festen Flächen sonst aus — hier geht es nicht anders,
   * also deckt die Fläche.
   */
  overlay: 'rgba(255,255,255,0.94)',
  /**
   * Text AUF `overlay`. Nur dort — sonst gilt `textMuted` bzw. `live`.
   *
   * Am 15.08.2026 nachgemessen, über dem hellsten und dem dunkelsten Punkt
   * eines Fotos: Die Fläche hält, was sie verspricht (11 von 255 Unterschied,
   * genau die 94 %). Die Schrift hielt nicht — `textMuted` kam auf 3,84:1 und
   * `live` auf 3,92:1, WCAG verlangt für diese Schriftgrößen 4,5:1.
   *
   * Diese zwei Töne sind die abgedunkelten Fassungen und erreichen 4,98:1 und
   * 4,68:1. Sie stehen hier statt in der Komponente, damit sie beim nächsten
   * „ein bisschen heller wäre hübscher" auffallen.
   */
  overlayMuted: '#5C6B62',
  overlayUrgent: '#C43A25',

  text: '#14241E',
  textMuted: '#6E7D75',

  line: 'rgba(20,36,30,0.10)',
  lineStrong: 'rgba(20,36,30,0.18)',

  brand: '#0E2A22',
  /** Gold trägt auf hell KEINEN Text — nur Flächen mit dunkler Schrift darauf. */
  gold: '#E9A73C',
  goldInk: '#241703',
  /** Auf hell etwas dunkler als auf der Bühne, sonst reicht der Kontrast nicht. */
  live: '#D6452F',
  liveInk: '#FFFFFF',
  success: '#1E6E5C',
  successInk: '#FFFFFF',
} as const;

/** Dunkle Fläche — ausschließlich der Live-Raum. */
export const stage = {
  /** Tiefster Grund hinter dem Video */
  ink: '#0B1512',
  /** Leisten, Karten, Sheets auf der Bühne */
  surface: '#16241F',
  /** Platzhalter und gefüllte Kacheln */
  surfaceHigh: '#17332B',
  brand: '#0E2A22',

  /** Gold ist der Kauf. Nur Gebot, Preis, Zuschlag-Weg. */
  gold: '#E9A73C',
  goldInk: '#241703',

  /** Terrakotta ist Dringlichkeit. Nur live und überboten — nie Fläche. */
  live: '#E4573D',
  liveInk: '#2A0B05',

  /** Grün ist Bestätigung — gewonnen, verifiziert, Frauen-Only. */
  success: '#1E6E5C',
  successInk: '#EAF7F1',
  /** Heller Grünton für "du führst" — Kontur, nie Fläche. */
  lead: '#4FB78E',

  text: '#F5F1E8',
  textMuted: '#9CA9A2',
  textOnGlass: '#F5F1E8',

  line: 'rgba(245,241,232,0.12)',
  lineStrong: 'rgba(245,241,232,0.22)',
  /** Halbtransparente Unterlage für Text auf Video */
  scrim: 'rgba(0,0,0,0.40)',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  phone: 26,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/**
 * Zeiten für die Auktion. Müssen mit der Migration übereinstimmen —
 * der Server ist die Autorität, das hier ist nur die Anzeige.
 */
export const auction = {
  /** Ab hier zählt der Countdown rot */
  urgentSeconds: 10,
  /** Ein Gebot in den letzten `urgentSeconds` verlängert um so viel */
  extendSeconds: 10,
} as const;
