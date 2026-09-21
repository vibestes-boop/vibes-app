// Die Startseite teilt EINEN Bestand auf ZWEI Formen — Wischreihe und Raster.
//
// ⚠️ WARUM DAS EINE EIGENE DATEI IST (21.09.2026)
// Zaur hat die „Galerie" aus der Kleinanzeigen-App gezeigt: eine waagerechte
// Reihe kleinerer Kärtchen über dem Raster. Am 21.09. habe ich sie zunächst
// NICHT gebaut, mit dieser Begründung:
//
//   „Berkats ‚Neu entdecken' zeigt heute alles, was da ist. Eine Wischreihe
//    darüber zöge dieselben Artikel ein zweites Mal ins Bild — der Bildschirm
//    sähe voller aus und enthielte weniger."
//
// Die Begründung gilt weiter. Sie ist der Grund für diese Datei, nicht ihr
// Gegenteil: Die Reihe zeigt nur Artikel, die das Raster NICHT zeigt. Ein
// Artikel steht auf der Startseite genau einmal — das ist keine Feinheit der
// Gestaltung, sondern die Bedingung, unter der die Reihe überhaupt etwas
// hinzufügt.
//
// Warum hier und nicht in `index.tsx`: Die Regel hat vier Fälle (zu wenig
// Bestand, knapp, normal, viel), und jeder davon ist ein Bildschirm, den
// jemand sieht. In einer 866-Zeilen-Bildschirmdatei prüft die niemand nach.

/** Nur, was zum Aufteilen nötig ist — jede Angebotszeile erfüllt das. */
type Splittable = { id: string; created_at: string };

/**
 * Wie viele Kärtchen die Reihe höchstens trägt. Acht, weil der Vorrat aus
 * `useDiscoveryListings` bei sechzehn Kandidaten je Quelle liegt: acht für die
 * Reihe, acht fürs Raster, und die Startseite zeigt genau das, was sie weiß.
 */
export const RAIL_PREVIEW = 8;

/**
 * ⚠️ Weniger als vier ist keine Reihe, sondern ein Rest.
 *
 * Ohne diese Untergrenze bekäme ein Bestand von neun Artikeln eine Wischreihe
 * mit EINEM Kärtchen — eine Fläche, die zum Wischen einlädt und nach dem
 * ersten Wischen leer ist. Das ist schlechter als keine Reihe.
 */
export const RAIL_MIN = 4;

export type ShelfSplit<T> = {
  /** Die Wischreihe: das Neueste zuerst. Leer heißt „nicht anzeigen". */
  rail: T[];
  /** Das Raster: die Rangfolge der Entdeckung, ohne die Artikel der Reihe. */
  grid: T[];
};

/**
 * Teilt den Vorrat auf Reihe und Raster auf.
 *
 * ⚠️ DAS RASTER VERLIERT NIE ETWAS. Die Reihe bekommt ausschließlich das, was
 * ohnehin nicht mehr ins Raster gepasst hätte (`pool.length - gridSize`). Wer
 * heute acht Karten sieht, sieht morgen acht Karten und darüber eine Reihe —
 * nie sechs Karten und darüber eine Reihe. Eine neue Fläche, die eine alte
 * leerräumt, ist ein Tausch und kein Gewinn.
 *
 * Die Reihe sortiert nach `created_at`, das Raster behält die Rangfolge aus
 * `selectDiscovery`. Das ist der Unterschied, der die zweite Fläche
 * rechtfertigt: „zuletzt eingestellt" gegen „passt zu dir". Zwei Fragen, zwei
 * Antworten — nicht zweimal dieselbe Antwort in zwei Größen.
 */
export function splitShelf<T extends Splittable>(
  pool: T[],
  gridSize: number,
  railSize: number = RAIL_PREVIEW,
  railMin: number = RAIL_MIN,
): ShelfSplit<T> {
  const overflow = pool.length - gridSize;
  if (overflow < railMin) return { rail: [], grid: pool.slice(0, gridSize) };

  const rail = [...pool].sort(newestFirst).slice(0, Math.min(railSize, overflow));
  const taken = new Set(rail.map((item) => item.id));
  return { rail, grid: pool.filter((item) => !taken.has(item.id)).slice(0, gridSize) };
}

/**
 * Neueste zuerst; bei gleicher Zeit die größere Kennung.
 *
 * ⚠️ Der zweite Vergleich ist nicht Kosmetik. `created_at` hat in Postgres
 * Mikrosekunden, aber zwei in derselben Sendung vorbereitete Artikel tragen
 * denselben Zeitstempel. Ohne festen zweiten Schlüssel entschiede die
 * Reihenfolge des Eingangs — und die Reihe ordnete sich bei jedem Nachladen
 * neu, ohne dass sich etwas geändert hätte. Dieselbe Regel wie im Server:
 * `.order('created_at', desc).order('id', desc)`.
 */
function newestFirst(a: Splittable, b: Splittable): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}
