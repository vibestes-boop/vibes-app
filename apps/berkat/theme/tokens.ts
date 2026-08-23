// Berkat hat zwei Flächen, und jede hat eine feste Helligkeit.
//
//   ui    — hell, kühles Neutral. Stöbern, verkaufen, verwalten.
//   stage — dunkel, Tinten-Indigo. Nur der Live-Raum, wo das Video die Fläche ist.
//
// ── DIE ZWEI MARKENFARBEN (23.08.2026) ──────────────────────────────────────
//
//   Aubergine      #2E1B33   Ton 288°   — der Anker
//   Bernstein      #FFB020   Ton  39°   — der Kauf
//
// Abstand 119°. Bewusst NICHT die maximale Trennung — Tinten-Indigo mit 172° stand
// am 23.08.2026 kurz im Code und wurde ersetzt.
//
// ⚠️ DER GRUND STEHT IM KATALOG, NICHT IM FARBKREIS. Berkat zeigt schwarze Abayas,
// Parfümflakons und Schmuck auf hellem Grund — die Ware bringt ihre eigene Farbe
// mit. Ein bunter Anker konkurriert damit. Auf einem Farbfeld gewinnt jedes laute
// Paar; auf einer Startseite mit zwölf Produktfotos gewinnt es gegen die Ware.
// Genau deshalb sind Whatnot, TikTok, Vinted und Depop in der Fläche schwarz oder
// weiss und legen die Farbe in genau EINEN Knopf.
//
// Aubergine ist dunkel wie ein Neutral und hat trotzdem einen Ton: Es tritt hinter
// die Ware zurück, ohne grau zu sein. Es ist ausserdem in dieser Kategorie frei
// (Whatnot Gelb, TikTok Schwarz/Pink, Vinted Türkis, Etsy Orange, Depop Rot) und
// schmeichelt genau diesen Fotos — Mode, Duft, Schmuck.
//
// ⚠️ WANN ES FALSCH WIRD: Wächst Berkat über Mode und Duft hinaus — Elektronik,
// Haushalt, allgemeiner Wiederverkauf —, ist Aubergine zu speziell. Dann ist
// Indigo #1B2340 der richtige Träger, weil es zu allem passt und zu nichts gehört.
//
// ⚠️ WAS VORHER HIER STAND UND WARUM ES WEG IST. Bis heute war es Flaschengrün
// #0E2A22 auf Sand #FAF7F2 mit Gold #E9A73C. Gemessen hatte das drei Probleme:
//
//   1. **Das Gold war nicht zu dunkel, es war zu WENIG BUNT.** Buntheit C* 64 —
//      Whatnots Gelb hat 88, TikToks Pink 82. Ein gedämpftes Senfgelb ist kein
//      Signal, und der Kaufknopf ist das Lauteste, was diese App zu sagen hat.
//   2. **Der Grund hatte DENSELBEN Ton wie der Akzent** (Sand 38°, Gold 37°).
//      Als System elegant — für einen Kaufknopf der falsche Ort. Farbabstand
//      Gold↔Sand: ΔE 66. Bei Whatnot sind es 89.
//   3. Sehr dunkles, sattes Grün auf warmem Sand liest sich erdig-rustikal.
//
// Bernstein hat jetzt C* 78 und steht bei ΔE 81 vom Grund. Der Grund selbst ist
// kühl-neutral (Buntheit 0,7), damit die warme Farbe überhaupt etwas hat,
// wovon sie sich abheben kann.
//
// ⚠️ WARUM DER AKZENT WARM BLEIBEN MUSSTE — und nicht Kupfer oder Jade wurde.
// Berkat hat zwei FUNKTIONALE Farben, die gesetzt sind: Rot bei 8° (laufende
// Uhr, überboten) und Grün bei 160° (bestätigt, gewonnen, Frauen-Only). Kupfer
// läge bei 23°, also 15 Grad neben dem Uhr-Rot — in einer Auktion sähen „Jetzt
// bieten" und „Du bist überboten" dann ähnlich aus. Jade bei 162° hätte
// dasselbe Problem mit Grün. Bernstein steht 31° vom Uhr-Rot UND 27
// Helligkeitsstufen darüber; beides zusammen macht die Verwechslung unmöglich.
//
// ⚠️ Grün ist damit KEINE Markenfarbe mehr, sondern nur noch ein Signal. Das
// war eine bewusste Entscheidung von Zaur, kein Nebeneffekt.
//
// Es gibt bewusst KEINEN Hell-Dunkel-Umschalter. Jede Komponente weiß, auf
// welcher Fläche sie sitzt, und nimmt genau deren Palette. Damit kann nie ein
// heller Text auf heller Fläche landen — der Fehler, der sich in Serlo immer
// wieder eingeschlichen hat, ist hier strukturell ausgeschlossen.
//
// Regel: NIE eine Farbe direkt in eine Komponente schreiben. Alles kommt hierher.

/** Helle Fläche — Startseite, Kategorien, Studio, Konto, Anmeldung. */
export const ui = {
  /**
   * Kühles Neutral. Der Grundton der App.
   *
   * ⚠️ Bewusst NICHT reines Weiß: Die aktuelle Empfehlung geht weg vom harten
   * Weiß hin zu „elevated neutrals", und auf einem Handy in der Sonne ist ein
   * leicht abgesenkter Grund angenehmer. Buntheit 0,7 — praktisch farblos,
   * damit der Bernstein alles an Farbe für sich hat.
   */
  bg: '#F7F4F8',
  /** Karten und Sheets liegen als Weiß auf dem Grund. */
  card: '#FFFFFF',
  /** Chips, Bildplatzhalter, ruhige Flächen. */
  sunken: '#EBE5EE',
  /**
   * ⚠️ `bg` mit Alpha 0 — für Verläufe, die im Grund verschwinden sollen.
   *
   * Das ist kein Luxus, sondern eine Falle, die schon einmal zugeschlagen hat:
   * Ein `'transparent'` interpoliert auf iOS über Schwarz und legt einen grauen
   * Schleier über das Bild. Der Endpunkt muss dieselbe Farbe wie `bg` tragen,
   * nur unsichtbar. Vor dem 23.08.2026 stand dieser Wert hartcodiert im
   * Verkäufer-Profil — und wäre beim Farbwechsel still falsch geworden.
   */
  bgClear: 'rgba(247,244,248,0)',
  /**
   * Verdunkelung hinter Blättern und Menüs. Aus dem Anker abgeleitet, nicht
   * Schwarz — sonst wirkt der Hintergrund tot statt zurückgetreten.
   * ⚠️ Stand bis zum 23.08.2026 an fünf Stellen hartcodiert (`rgba(20,36,30,…)`,
   * das ALTE Grün) und hätte den Grünstich in die neue Palette getragen.
   */
  scrim: 'rgba(46,27,51,0.38)',
  /**
   * Das dunkle Gegenstück zu `overlay`: eine Pille MIT heller Schrift auf einem
   * fremden Foto — „Titelbild ändern", der Schliessen-Kreis am Bild.
   *
   * ⚠️ Es gab dafür nie einen Token, obwohl direkt daneben eine Registratur für
   * den hellen Fall steht. Beide Stellen trugen `rgba(20,36,30,…)`, also das
   * ALTE Markengrün, hartcodiert — und hätten den Grünstich in diese Palette
   * getragen. Gefunden beim Farbwechsel am 23.08.2026, nicht bei einer Prüfung.
   */
  onImage: 'rgba(21,12,24,0.72)',
  /**
   * Milchige Auflage für Text auf einem FREMDEN Bild. Berkat tut das an genau
   * ZWEI Stellen, und diese Liste ist der Bestand:
   *
   *   1. die Live-Vorschau auf den Show-Karten (`components/LivePreview.tsx`)
   *   2. die Pillen auf der Angebots-Karte — „Deins", Merken-Herz, Bildzahl —
   *      und das „Titelbild"-Etikett im Composer (`ListingCard.tsx`,
   *      `StandingComposer.tsx`, seit 17.08.2026)
   *   3. Zurück, Teilen und Mehr auf dem Verkäufer-Profil (`app/seller/[id].tsx`,
   *      seit 23.08.2026). Seit dem randlosen Kopfbild liegen sie auf dem Foto
   *      des Verkäufers. Der Sand-Verlauf darüber deckt nur die Statusleiste —
   *      auf Höhe der Symbole wäre von ihm noch rund ein Viertel übrig, über
   *      einem dunklen Bannerfoto also 1,6:1. Nachgemessen, nicht geschätzt.
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
   * Diese zwei Töne sind die abgedunkelten Fassungen. Sie stehen hier statt in
   * der Komponente, damit sie beim nächsten „ein bisschen heller wäre hübscher"
   * auffallen.
   *
   * ⚠️ Am 23.08.2026 kam beim Durchmessen der ganzen Palette heraus, dass diese
   * zwei Töne das Problem lösen, das `textMuted` und `live` auf der hellen
   * Fläche HATTEN — sie waren mit 4,05 und 4,14:1 unter der Grenze, während
   * `overlayMuted` mit 5,26 überall bestand. Die Palette hatte die Lösung also
   * schon und hielt sie in einem Sonderfall eingesperrt. Beim Umbau sind
   * `textMuted` und `live` entsprechend nachgezogen worden.
   */
  overlayMuted: '#5F5464',
  overlayUrgent: '#C03A26',

  text: '#1F1522',
  /** Nachgezogen: hatte auf dem alten Grund 4,05:1, jetzt 5,56:1. */
  textMuted: '#665A6B',

  /**
   * Der Avatar-Rückfall — die Scheibe mit den Initialen, wenn jemand kein Bild
   * hat.
   *
   * ⚠️ Das war bis zum 23.08.2026 `success`, also GRÜN. Semantisch war das
   * schon immer falsch — Grün heisst in Berkat „bestätigt, gewonnen,
   * Frauen-Only", und ein fehlendes Profilbild ist nichts davon. In der alten
   * Palette fiel es nicht auf, weil ohnehin alles grünlich war. In der neuen
   * war es sofort der einzige grüne Fleck auf dem Bildschirm.
   *
   * Eine Stufe heller als der Anker: 8,4:1 für die Initialen, und 1,6:1 gegen
   * den Anker selbst — also deutlich zu wenig, um sich vom Banner abzuheben.
   * Deshalb trägt der Avatar auf dem Verkäufer-Profil zusätzlich einen hellen
   * Ring. Ohne den verschwände er im leeren Banner.
   */
  avatar: '#4A3352',

  line: 'rgba(31,21,34,0.10)',
  lineStrong: 'rgba(31,21,34,0.18)',

  /** Tinten-Indigo — der Anker. Begründung im Kopf der Datei. */
  brand: '#2E1B33',
  /**
   * ⚠️ HEISST WEITERHIN `gold`, IST ABER BERNSTEIN (#FFB020, seit 23.08.2026).
   * Kein Umbenennen: Der Name steht an über hundert Stellen, und `gold` ist im
   * Kopf aller Beteiligten die Kauf-Farbe. Umbenennen hiesse, den Begriff zu
   * ändern, ohne die Bedeutung zu ändern — dieselbe Entscheidung wie bei
   * `is_live_session_moderator` und `live_polls.host_id`.
   *
   * Bernstein trägt auf hell KEINEN Text — nur Flächen mit dunkler Schrift.
   *
   * ⚠️ UND: Er gehört an Bildschirme mit GENAU EINEM Kaufweg — Live-Raum,
   * Artikelseite, Kasse. Nicht in Raster.
   *
   * Am 18.08.2026 an Whatnot nachgemessen: Deren Kaufknopf im Regal ist
   * `rgba(0,0,0,0.05)`, also fast unsichtbares Grau; ihr Signalgelb ist für
   * „Folgen" reserviert. Der Grund ist Arithmetik, nicht Geschmack — bei
   * fünfundzwanzig Artikeln untereinander sind fünfundzwanzig goldene Knöpfe
   * keine Hervorhebung mehr, sondern eine Wand. Eine Signalfarbe wirkt nur,
   * solange sie selten ist.
   *
   * Berkat hält die Regel heute dadurch ein, dass `ListingCard` gar keinen
   * Kaufknopf hat (die Karte führt zum Artikel, gekauft wird dort). Wer das je
   * ändert, macht den Knopf im Raster GRAU — sonst ist Gold nach dem ersten
   * vollen Regal keine Auszeichnung mehr. Analyse: `WHATNOT-ANALYSE.md`,
   * vierter Teil, Abschnitt 2.
   */
  gold: '#FFB020',
  goldInk: '#2B1A00',
  /**
   * Auf hell etwas dunkler als auf der Bühne, sonst reicht der Kontrast nicht.
   * ⚠️ Am 23.08.2026 nachgezogen (war `#D6452F`): Als Text kam der alte Wert auf
   * 4,14:1 und lag damit unter der Grenze — an acht Stellen, unter anderem im
   * Lösch-Bildschirm und in den „Melden/Sperren"-Menüs.
   */
  live: '#C03A26',
  liveInk: '#FFFFFF',
  success: '#1E6E5C',
  successInk: '#FFFFFF',
} as const;

/** Dunkle Fläche — ausschließlich der Live-Raum. */
export const stage = {
  /**
   * Tiefster Grund hinter dem Video.
   * ⚠️ Kein reines Schwarz — die aktuelle Empfehlung geht zu tiefen Anthrazit-
   * bzw. Tinten-Tönen. Und dieser hier ist der Anker in dunkel: So trägt der
   * Live-Raum dieselbe Marke wie der Rest, statt ein zweites Farbsystem zu sein.
   */
  ink: '#150C18',
  /** Leisten, Karten, Sheets auf der Bühne */
  surface: '#241830',
  /** Platzhalter und gefüllte Kacheln */
  surfaceHigh: '#31213E',
  brand: '#2E1B33',


  /** Bernstein ist der Kauf. Nur Gebot, Preis, Zuschlag-Weg. */
  gold: '#FFB020',
  goldInk: '#2B1A00',

  /** Terrakotta ist Dringlichkeit. Nur live und überboten — nie Fläche. */
  live: '#E4573D',
  liveInk: '#2A0B05',

  /** Grün ist Bestätigung — gewonnen, verifiziert, Frauen-Only. */
  success: '#1E6E5C',
  successInk: '#EAF7F1',
  /** Heller Grünton für "du führst" — Kontur, nie Fläche. */
  lead: '#4FB78E',

  /** Kühles Off-Weiss statt des warmen — sonst hat die Schrift einen Gelbstich
      auf dem Indigo. */
  text: '#F3EEF5',
  textMuted: '#A99BAE',
  textOnGlass: '#F3EEF5',

  line: 'rgba(243,238,245,0.12)',
  lineStrong: 'rgba(243,238,245,0.22)',
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
 * Seitenverhältnisse der Bildflächen. `width / height` — wie `aspectRatio` in
 * React Native.
 *
 * ⚠️ Warum das ein Token ist und keine Zahl an sechs Stellen: Bis zum
 * 18.08.2026 stand überall `aspectRatio: 1`. Das war eine Entscheidung, die nie
 * jemand getroffen hat — sie war einfach der Vorgabewert des ersten Rasters und
 * wurde fünfmal abgeschrieben.
 *
 * Whatnots App zeigt Ware hochkant, und das ist kein Geschmack: Ein Kleid, eine
 * Abaya, ein Schuh, ein Mensch sind hochformatig. Bei gleicher Spaltenbreite
 * zeigt `card` rund ein Viertel mehr Ware als ein Quadrat — auf einem
 * Bildschirm, auf dem das Bild die eigentliche Auskunft ist.
 *
 * `tile` bleibt quadratisch: Arbeitsflächen (Bestellung, Zeilen-Vorschau)
 * beantworten „welches meine ich", nicht „was schaue ich mir an" (HANDOFF 18).
 */
export const ratio = {
  /** Stöber-Karten: Angebot, Show, Termin, Artikelseite. 4:5. */
  card: 4 / 5,
  /** Kleine Wiedererkennungsbilder in Listen und Bestellungen. */
  tile: 1,
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
