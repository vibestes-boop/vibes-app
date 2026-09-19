import type { BerkatNotification } from './useNotifications';

type EventKind = 'won' | 'payment' | 'shipping' | 'live' | 'order' | 'review' | 'reminder' | 'search' | 'problem' | 'message' | 'notice';
const copy: Record<string, { title: string; body: string; action: string; kind: EventKind }> = {
  auction_won: { title: 'Auktion gewonnen', body: 'Dein Zuschlag ist bestätigt. Die nächsten Schritte findest du bei deinen Käufen.', action: 'Meine Käufe', kind: 'won' },
  order_payment_reminder: { title: 'Zahlung offen', body: 'In deinen Käufen findest du deinen Sammelkorb und die nächsten Schritte zur Zahlung.', action: 'Meine Käufe', kind: 'payment' },
  order_shipped: { title: 'Paket versendet', body: 'Deine Bestellung wurde versendet. Den Versandstatus findest du bei deinen Käufen.', action: 'Sendung ansehen', kind: 'shipping' },
  auction_up: { title: 'Artikel aufgerufen', body: 'Dein vorgemerkter Artikel wurde in der Show aufgerufen.', action: 'Show öffnen', kind: 'live' },
  order_paid: { title: 'Zahlung erhalten', body: 'Eine Bestellung wurde bezahlt. In den Bestellungen kannst du den Versand vorbereiten.', action: 'Bestellungen öffnen', kind: 'order' },
  new_order: { title: 'Neue Bestellung', body: 'Eine neue Bestellung ist eingegangen. Prüfe die Details und den aktuellen Status.', action: 'Bestellungen öffnen', kind: 'order' },
  order_review: { title: 'Neue Bewertung', body: 'Du hast eine neue Bewertung zu einer Bestellung erhalten.', action: 'Zum Konto', kind: 'review' },
  scheduled_live_reminder: { title: 'Show-Erinnerung', body: 'Eine vorgemerkte Show steht an. Die aktuellen Termine findest du beim Verkäufer.', action: 'Zum Verkäufer', kind: 'reminder' },
  live: { title: 'Live-Show', body: 'Eine neue Show wurde gestartet. Öffne sie, um den aktuellen Stand zu sehen.', action: 'Show öffnen', kind: 'live' },
  saved_search_hit: { title: 'Neuer Suchtreffer', body: 'Ein neues Angebot passt zu deiner gespeicherten Suche.', action: 'Treffer ansehen', kind: 'search' },
  order_dispute: { title: 'Rückmeldung zur Bestellung', body: 'Zu einer Bestellung gibt es eine Rückmeldung. Prüfe den Vorgang in deinen Bestellungen.', action: 'Bestellungen öffnen', kind: 'problem' },
  dm: { title: 'Neue Nachricht', body: 'Öffne die Unterhaltung, um die Nachricht zu lesen und zu antworten.', action: 'Nachricht öffnen', kind: 'message' },
};
const clean = (value: string | null | undefined) => value?.trim() || null;

export function presentNotification(item: BerkatNotification) {
  const base = copy[item.type] ?? { title: 'Neue Mitteilung', body: 'Es gibt eine neue Mitteilung zu deinem Konto.', action: 'Zum Konto', kind: 'notice' as EventKind };
  const subject = clean(item.subject_title) ?? (item.type === 'saved_search_hit'
    ? (clean(item.product_name) ? `Suche: „${item.product_name!.trim()}“` : null) : clean(item.product_name));
  let body = clean(item.comment_text);
  // Remove only an exact leading subject; preserve amounts, tracking and message text.
  if (subject && body === subject) body = null;
  else if (subject && body?.startsWith(`${subject} · `)) body = clean(body.slice(subject.length + 3));
  const ended = ['live', 'auction_up'].includes(item.type) && item.live_status === 'ended';
  return { ...base, subject, body: ended
    ? item.sender_id ? 'Diese Show ist beendet. Weitere Shows und Angebote findest du beim Verkäufer.' : 'Diese Show ist beendet. Entdecke aktuelle Shows auf der Startseite.'
    : body ?? base.body,
    title: ended ? 'Show beendet' : item.type === 'live' && item.live_status === 'active' ? 'Jetzt live' : base.title,
    action: ended ? (item.sender_id ? 'Zum Verkäufer' : 'Startseite öffnen')
      : item.type === 'auction_won' && item.auction_id ? 'Artikel ansehen'
      : ['live', 'auction_up'].includes(item.type) && !item.session_id ? 'Startseite öffnen'
      : item.type === 'scheduled_live_reminder' && !item.sender_id ? 'Startseite öffnen' : base.action,
  };
}

export function notificationWhen(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'Datum unbekannt';
  const minutes = Math.floor(Math.max(0, now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'Gerade eben';
  if (minutes < 60) return `Vor ${minutes} Min.`;
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}) });
}

export function notificationSections(items: BerkatNotification[], now = new Date()) {
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const groups = new Map<string, BerkatNotification[]>();
  for (const item of items) {
    const day = new Date(item.created_at).toDateString();
    const title = day === now.toDateString() ? 'Heute' : day === yesterday.toDateString() ? 'Gestern' : 'Früher';
    groups.set(title, [...(groups.get(title) ?? []), item]);
  }
  return ['Heute', 'Gestern', 'Früher'].filter(title => groups.has(title)).map(title => ({ title, data: groups.get(title)! }));
}
