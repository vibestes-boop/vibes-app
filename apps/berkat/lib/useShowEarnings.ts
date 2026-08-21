// Was diese Sendung einbringt — nur für den Gastgeber, live während er sendet.
//
// WARUM ES DAS GIBT
// Bis hierher sah der Verkäufer während seiner eigenen Sendung NICHT, was sie
// einbringt. Er musste den Raum verlassen und unter „Bestellungen" nachsehen —
// mitten in der Show also gar nicht.
//
// Das ist die einzige Lücke aus der achten Whatnot-Analyse (21.08.2026), die
// direkt auf Phase 0 einzahlt. Die Frage dort lautet nicht „funktioniert die
// Auktion", sondern **„sendet jemand acht Wochen lang freiwillig weiter"** — und
// das entscheidet sich daran, ob er WÄHREND des Sendens sieht, dass es sich
// lohnt. Design-Gesetz 1 („Hochs lauter machen") galt in Berkat bisher nur für
// Käufer; der Mensch, der die Arbeit macht, bekam keinen einzigen Peak.
//
// Whatnot zeigt an derselben Stelle „Verkäufe 1310 € · Bestellungen 108" plus
// einen Ereignisstrom.
//
// ⚠️ NUR DER GASTGEBER, und zwar aus demselben Grund wie bei `useLiveViewers`:
// Was in einem Raum gekauft wird, geht keinen Zuschauer etwas an. Die Datenbank
// setzt das nicht durch — `live_auctions` ist für jeden lesbar, der die Session
// sehen darf, weil die Warteschlange öffentlich sein MUSS. Die Grenze liegt hier
// also im Client, und deshalb steht sie hier als Warnung: Wer `enabled` von
// `isHost` löst, veröffentlicht die Kaufhistorie eines fremden Abends.

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type ShowEvent = {
  /** Zusammengesetzt, weil Zuschlag und Trinkgeld aus zwei Tabellen kommen. */
  key: string;
  kind: 'sale' | 'tip';
  at: string;
  userId: string | null;
  username: string | null;
  avatarUrl: string | null;
  cents: number;
  /** Nur beim Zuschlag: was verkauft wurde. */
  title: string | null;
  imageUrl: string | null;
};

export type ShowEarnings = {
  /** Summe der Zuschläge dieser Sendung, in Cent. */
  grossCents: number;
  /** Wie viele Artikel weggegangen sind. */
  soldCount: number;
  /** Bezahltes Trinkgeld aus dieser Sendung, in Cent. */
  tipCents: number;
  /** Zuschläge und Trinkgelder, neueste zuerst. */
  events: ShowEvent[];
};

const EMPTY: ShowEarnings = { grossCents: 0, soldCount: 0, tipCents: 0, events: [] };

type SaleRow = {
  id: string;
  title: string | null;
  image_url: string | null;
  current_bid_cents: number | null;
  settled_at: string | null;
  winner_id: string | null;
};

type TipRow = {
  id: string;
  sender_id: string;
  amount_cents: number;
  paid_at: string | null;
  created_at: string;
};

type ProfileRow = { id: string; username: string | null; avatar_url: string | null };

/**
 * Zahlen und Ereignisse einer laufenden Sendung.
 *
 * ⚠️ **Drei Abfragen statt zwei Embeds — Absicht.** `live_auctions` hat DREI
 * Fremdschlüssel auf `profiles` (`seller_id`, `current_bidder_id`, `winner_id`).
 * Ein `profiles!winner_id(…)`-Embed muss dort richtig auflösen, und wenn er es
 * nicht tut, antwortet PostgREST mit einer **leeren Menge statt einem Fehler**
 * (die Falle aus Abschnitt 3, „Geerbte Serlo-Tabellen sind enger, als sie
 * aussehen"). Weil Zuschläge und Trinkgelder ohnehin zusammengeführt werden
 * müssen, holt eine einzige `.in()`-Abfrage die Namen für beide — das sind
 * zusammen drei Abfragen statt zwei Embeds plus einer Zusammenführung.
 *
 * ⚠️ **Kein Takt und KEIN eigenes Realtime-Abo.** Nachgeladen wird über das
 * bestehende Abo in `useLiveAuctions`, das denselben Filter schon hält und bei
 * `sold` ohnehin feuert — dort steht die Invalidierung, direkt neben der des
 * Sammelkorbs (Abschnitt 19).
 *
 * Der erste Entwurf hatte hier ein eigenes `supabase.channel()`. Das wäre ein
 * **zweiter Kanal auf dieselbe Tabelle mit demselben Filter** gewesen, also
 * doppelte Realtime-Last für ein Signal, das schon jemand hört — genau die
 * Kostenhygiene-Regel aus Abschnitt 4 („eine geteilte Subscription pro
 * Signal, nicht pro Komponente"). Und `supabase.channel(name)` gibt bei
 * gleichem Namen den bestehenden Kanal zurück; ein zweites `.on()` darauf
 * wirft. Dafür gibt es `lib/realtime.ts` — hier brauchte es beides nicht.
 *
 * Trinkgeld hat kein Realtime-Signal. Es aktualisiert deshalb nur, solange das
 * Blatt offen ist (`detailed`) — dort mit einem ruhigen 20-Sekunden-Takt. Die
 * Zahl in der Leiste ist der Umsatz, und der kommt über das geteilte Abo.
 */
export function useShowEarnings(
  sessionId: string | undefined,
  isHost: boolean,
  detailed = false,
) {
  return useQuery({
    queryKey: ['berkat', 'show-earnings', sessionId],
    enabled: Boolean(sessionId) && isHost,
    staleTime: 5_000,
    refetchInterval: detailed ? 20_000 : false,
    queryFn: async (): Promise<ShowEarnings> => {
      const [sales, tips] = await Promise.all([
        supabase
          .from('live_auctions')
          .select('id, title, image_url, current_bid_cents, settled_at, winner_id')
          .eq('session_id', sessionId!)
          .eq('status', 'sold')
          // `settled_at` ist der Zeitpunkt des Zuschlags. `nullsFirst: false`,
          // weil eine Zeile ohne ihn (Altbestand) unten gehört, nicht oben.
          .order('settled_at', { ascending: false, nullsFirst: false })
          .limit(200),
        supabase
          .from('berkat_tips')
          .select('id, sender_id, amount_cents, paid_at, created_at')
          .eq('session_id', sessionId!)
          // Nur bezahlte. Ein `pending` ist eine geöffnete Kasse, kein Geld —
          // es als Einnahme zu zeigen wäre dieselbe Unwahrheit wie „5,0 ★" ohne
          // eine einzige Bewertung (Abschnitt 10).
          .eq('status', 'paid')
          .order('paid_at', { ascending: false, nullsFirst: false })
          .limit(100),
      ]);

      if (sales.error) throw sales.error;
      if (tips.error) throw tips.error;

      const saleRows = (sales.data ?? []) as SaleRow[];
      const tipRows = (tips.data ?? []) as TipRow[];
      if (saleRows.length === 0 && tipRows.length === 0) return EMPTY;

      const ids = [
        ...new Set([
          ...saleRows.map((r) => r.winner_id).filter((v): v is string => Boolean(v)),
          ...tipRows.map((r) => r.sender_id),
        ]),
      ];

      const names = new Map<string, ProfileRow>();
      if (ids.length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', ids);
        // Ein fehlender Name macht die Zahlen nicht falsch — die Zeile heißt
        // dann „Jemand". Deshalb kein `throw`.
        if (!error) for (const p of (data ?? []) as ProfileRow[]) names.set(p.id, p);
      }

      const events: ShowEvent[] = [
        ...saleRows.map((r) => ({
          key: `sale:${r.id}`,
          kind: 'sale' as const,
          at: r.settled_at ?? '',
          userId: r.winner_id,
          username: r.winner_id ? (names.get(r.winner_id)?.username ?? null) : null,
          avatarUrl: r.winner_id ? (names.get(r.winner_id)?.avatar_url ?? null) : null,
          cents: r.current_bid_cents ?? 0,
          title: r.title,
          imageUrl: r.image_url,
        })),
        ...tipRows.map((r) => ({
          key: `tip:${r.id}`,
          kind: 'tip' as const,
          at: r.paid_at ?? r.created_at,
          userId: r.sender_id,
          username: names.get(r.sender_id)?.username ?? null,
          avatarUrl: names.get(r.sender_id)?.avatar_url ?? null,
          cents: r.amount_cents,
          title: null,
          imageUrl: null,
        })),
      ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

      return {
        grossCents: saleRows.reduce((sum, r) => sum + (r.current_bid_cents ?? 0), 0),
        soldCount: saleRows.length,
        tipCents: tipRows.reduce((sum, r) => sum + r.amount_cents, 0),
        events,
      };
    },
  });
}

/** „gerade eben", „vor 3 Min", „vor 1 Std" — wie lange ein Ereignis her ist. */
export function eventAgo(iso: string, now = Date.now()): string {
  if (!iso) return '';
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  return `vor ${hours} Std`;
}
