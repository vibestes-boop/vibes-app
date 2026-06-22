/**
 * fmtNum — kompakte Zahl-Formatierung für Zähler (Likes, Viewer, Analytics).
 * Format: 1_500 → "1.5K", 2_300_000 → "2.3M", sonst die Zahl.
 *
 * Hinweis: Manche Stellen nutzen bewusst Abweichungen (Replay: klein „k";
 * LiveGoalBar: nur K-Stufe ohne M) — die bleiben eigenständig.
 */
export function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
