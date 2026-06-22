/**
 * timeAgo — kompakte Relativ-Zeit für Listen (Messages, Notifications).
 * Format: "5min" · "3h" · "2d" · "Jetzt".
 *
 * Hinweis: Andere Screens nutzen bewusst andere Formate (z.B. „vor 5 Min."
 * in Story-Sheets, „vor 3h" in Replays) — die bleiben eigenständig.
 */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d >= 1) return `${d}d`;
  if (h >= 1) return `${h}h`;
  if (m >= 1) return `${m}min`;
  return 'Jetzt';
}
