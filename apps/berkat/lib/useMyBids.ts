// Wo biete ich gerade mit — und führe ich noch?
//
// WARUM ES DAS BRAUCHT
// Berkat hat Stellvertreter-Gebote seit `20260813220000`: Man setzt ein
// Höchstgebot, der Server bietet in Schritten für einen mit. Nur konnte man
// nirgends nachsehen, wie es steht. Wer sein Maximum setzt und die App
// schließt, hatte keinen Ort, an dem steht, ob er noch führt oder längst
// überboten ist — bei einer Auktion die einzige Frage, die zählt.
//
// Dasselbe Muster wie bei der Beschreibung (Übergabe, Abschnitt 3) und beim
// Impressum (36): Der Server kann es, die Oberfläche fragt nie danach.
// Whatnots Aktivitäts-Reiter führt genau diese Liste unter „Bids", mit
// „Winning" und „Outbid" (siebte Whatnot-Analyse).
//
// ⚠️ ZWEI QUELLEN, EINE LISTE.
// Ein Gebot kann von Hand kommen (`live_bids`) oder aus einem Höchstgebot
// (`live_auto_bids`). Wer nur die eine Tabelle abfragt, verliert die Hälfte:
// Wer sein Maximum gesetzt und noch nie selbst geboten hat, steht in
// `live_bids` gar nicht — und ausgerechnet der braucht die Liste am meisten,
// weil er nicht zuschaut.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { AuctionStatus } from './useAuction';

export type MyBid = {
  auctionId: string;
  title: string;
  imageUrl: string | null;
  sessionId: string | null;
  status: AuctionStatus;
  /** Was der Artikel gerade kostet. */
  currentCents: number;
  /** Mein hinterlegtes Maximum — `null`, wenn ich nur von Hand geboten habe. */
  maxCents: number | null;
  /** Führe ich? Der Server pflegt `current_bidder_id` bei jedem Gebot. */
  leading: boolean;
  endsAt: string | null;
};

/**
 * Alle noch offenen Auktionen, an denen ich beteiligt bin.
 *
 * `sold`/`unsold`/`cancelled` fallen raus: Was entschieden ist, gehört unter
 * „Deine Pakete" beziehungsweise ist vorbei. Diese Liste beantwortet
 * ausschließlich „wo läuft gerade etwas für mich?".
 */
export function useMyBids(userId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['berkat', 'my-bids', userId],
    enabled: Boolean(userId),
    // Eine laufende Auktion ändert sich im Sekundentakt; zwanzig Sekunden ist
    // der Takt, den auch die Startseite für Shows nimmt. Der Live-Raum selbst
    // hat Realtime — hier reicht es, beim Hinsehen richtig zu liegen.
    refetchInterval: 20_000,
    staleTime: 10_000,
    queryFn: async (): Promise<MyBid[]> => {
      // Beide Quellen parallel. `live_auto_bids` filtert die RLS bereits auf
      // die eigenen Zeilen (`auth.uid() = bidder_id`), der Filter hier ist
      // trotzdem gesetzt — er kostet nichts und sagt dem Leser, was gemeint ist.
      const [handRes, autoRes] = await Promise.all([
        supabase.from('live_bids').select('auction_id').eq('bidder_id', userId!),
        supabase.from('live_auto_bids').select('auction_id, max_cents').eq('bidder_id', userId!),
      ]);
      if (handRes.error) throw handRes.error;
      if (autoRes.error) throw autoRes.error;

      const maxByAuction = new Map<string, number>();
      for (const row of (autoRes.data ?? []) as { auction_id: string; max_cents: number }[]) {
        maxByAuction.set(row.auction_id, row.max_cents);
      }
      const ids = Array.from(
        new Set([
          ...((handRes.data ?? []) as { auction_id: string }[]).map((r) => r.auction_id),
          ...maxByAuction.keys(),
        ]),
      );
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from('live_auctions')
        .select(
          'id, title, image_url, session_id, status, current_bid_cents, current_bidder_id, ends_at',
        )
        .in('id', ids)
        .in('status', ['scheduled', 'running'])
        // Was am ehesten zuschlägt, steht oben. `nullsFirst: false` ist
        // wichtig: Ein geplanter Artikel hat noch kein `ends_at` und stünde
        // sonst vor der laufenden Auktion, bei der es um Sekunden geht.
        .order('ends_at', { ascending: true, nullsFirst: false })
        .limit(30);
      if (error) throw error;

      return ((data ?? []) as {
        id: string;
        title: string;
        image_url: string | null;
        session_id: string | null;
        status: AuctionStatus;
        current_bid_cents: number | null;
        current_bidder_id: string | null;
        ends_at: string | null;
      }[]).map((a) => ({
        auctionId: a.id,
        title: a.title,
        imageUrl: a.image_url,
        sessionId: a.session_id,
        status: a.status,
        currentCents: a.current_bid_cents ?? 0,
        maxCents: maxByAuction.get(a.id) ?? null,
        leading: a.current_bidder_id === userId,
        endsAt: a.ends_at,
      }));
    },
  });

  const bids = query.data ?? [];
  // Überboten zuerst: Das ist der Zustand, der eine Handlung verlangt. Wer
  // führt, muss nichts tun — er will es nur wissen.
  const sorted = useMemo(
    () => [...bids].sort((a, b) => Number(a.leading) - Number(b.leading)),
    [bids],
  );
  const outbid = sorted.filter((b) => !b.leading).length;

  return { ...query, bids: sorted, outbid };
}
