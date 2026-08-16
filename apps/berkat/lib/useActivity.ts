// Aktivität — was um mich herum passiert ist.
//
// Whatnots vierter Reiter. Er ist NICHT dasselbe wie die Meldungsliste: Dort
// steht, was Berkat mir geschickt hat (drei Käufer-Ereignisse, serverseitig
// erzeugt). Hier steht, was passiert ist — auch das, wofür niemand einen Push
// verschickt, weil es keinen Anlass zum Klingeln gibt.
//
// Genau deshalb ist das hier auch der Ort für die Belohnungen: Eine
// Versand-Gutschrift ist eine gute Nachricht, aber keine, die jemanden nachts
// wecken darf. Sie bekommt bewusst keinen Meldungstyp (die Begründung steht in
// Migration 20260816130000).
//
// SECHS QUELLEN, EIN AUFRUF. Sie laufen parallel und werden zu einer Liste nach
// Zeit sortiert. Ein Reiter, der sechs Ladebalken zeigt, ist kein Reiter.

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type ActivityKind =
  /** Eigener Zuschlag */
  | 'won'
  /** Auf etwas geboten, das gerade läuft — und nicht mehr vorn */
  | 'outbid'
  /** Verkäufer, dem ich folge, sendet jetzt */
  | 'seller_live'
  /** Verkäufer, dem ich folge, hat etwas ins Regal gelegt */
  | 'new_listing'
  /** Versand-Gutschrift aus einer Einladung */
  | 'reward_credit'
  /** Provisionsfreie Tage aus einer Einladung */
  | 'reward_perk';

export type ActivityItem = {
  key: string;
  kind: ActivityKind;
  /** Sortierschlüssel. ISO, immer gesetzt. */
  at: string;
  title: string;
  body: string | null;
  /** Wessen Gesicht daneben steht — null bei Belohnungen (da ist es meins). */
  userId: string | null;
  /**
   * Das Artikelbild, wenn es eines gibt.
   *
   * Steht bei Gebot, Zuschlag und neuem Regal-Artikel VOR dem Avatar: Bei
   * einem Kauf erkennt man die Sache, nicht den Menschen. Bei „sendet gerade"
   * bleibt es der Avatar — dort IST der Mensch das Ereignis.
   */
  imageUrl: string | null;
  /** Wohin ein Antippen führt. */
  target: string;
};

function euro(cents: number | null | undefined): string {
  const value = Math.max(0, Math.round(cents ?? 0));
  return `${Math.floor(value / 100)},${String(value % 100).padStart(2, '0')} €`;
}

export function useActivity(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'activity', userId],
    enabled: Boolean(userId),
    staleTime: 20_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<ActivityItem[]> => {
      const me = userId!;
      const since14d = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();

      // Wem ich folge — der Empfängerkreis für zwei der sechs Quellen. Steht
      // vorn, weil beide darauf warten müssen.
      const { data: followRows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', me)
        .limit(200);
      const following = ((followRows ?? []) as { following_id: string }[]).map(
        (r) => r.following_id,
      );

      const [wins, myBids, live, listings, credits, perks] = await Promise.all([
        supabase
          .from('live_auctions')
          .select('id, title, image_url, current_bid_cents, seller_id, session_id, settled_at')
          .eq('winner_id', me)
          .eq('status', 'sold')
          .order('settled_at', { ascending: false })
          .limit(20),

        supabase
          .from('live_bids')
          .select('auction_id, created_at')
          .eq('bidder_id', me)
          .order('created_at', { ascending: false })
          .limit(50),

        following.length
          ? supabase
              .from('live_sessions')
              .select('id, host_id, title, started_at')
              .eq('status', 'active')
              .eq('app', 'berkat')
              .in('host_id', following)
              .limit(20)
          : Promise.resolve({ data: [], error: null } as const),

        following.length
          ? supabase
              .from('live_auctions')
              .select('id, seller_id, title, image_url, buy_now_cents, created_at')
              .is('session_id', null)
              .eq('status', 'listed')
              .in('seller_id', following)
              .gte('created_at', since14d)
              .order('created_at', { ascending: false })
              .limit(30)
          : Promise.resolve({ data: [], error: null } as const),

        supabase
          .from('berkat_shipping_credits')
          .select('id, reason, granted_at, consumed_at')
          .eq('user_id', me)
          .order('granted_at', { ascending: false })
          .limit(20),

        supabase
          .from('berkat_seller_perks')
          .select('id, days, reason, granted_at')
          .eq('user_id', me)
          .order('granted_at', { ascending: false })
          .limit(20),
      ]);

      const items: ActivityItem[] = [];

      // ── 1. Gewonnen ────────────────────────────────────────────────────────
      for (const a of (wins.data ?? []) as {
        id: string;
        title: string | null;
        image_url: string | null;
        current_bid_cents: number | null;
        seller_id: string;
        session_id: string | null;
        settled_at: string | null;
      }[]) {
        if (!a.settled_at) continue;
        items.push({
          key: `won-${a.id}`,
          kind: 'won',
          at: a.settled_at,
          title: 'Zuschlag — du hast gewonnen',
          body: `${a.title ?? 'Artikel'} · ${euro(a.current_bid_cents)}`,
          userId: a.seller_id,
          imageUrl: a.image_url,
          // Ins Konto, nicht in die Show: Dort liegt das Paket, und dort wird
          // bezahlt. Die Show ist womöglich längst vorbei.
          target: '/(tabs)/account',
        });
      }

      // ── 2. Überboten, und es läuft noch ───────────────────────────────────
      // Nur LAUFENDE Auktionen. Ein „du hast nicht gewonnen" zu verlorenen
      // Artikeln wäre eine Liste von Niederlagen ohne Handlung daneben.
      const bidAuctionIds = [
        ...new Set(((myBids.data ?? []) as { auction_id: string }[]).map((b) => b.auction_id)),
      ];
      if (bidAuctionIds.length > 0) {
        const { data: running } = await supabase
          .from('live_auctions')
          .select('id, title, image_url, current_bid_cents, current_bidder_id, seller_id, session_id, ends_at')
          .in('id', bidAuctionIds)
          .eq('status', 'running')
          .limit(20);

        for (const a of (running ?? []) as {
          id: string;
          title: string | null;
          image_url: string | null;
          current_bid_cents: number | null;
          current_bidder_id: string | null;
          seller_id: string;
          session_id: string | null;
          ends_at: string | null;
        }[]) {
          if (a.current_bidder_id === me || !a.session_id) continue;
          items.push({
            key: `outbid-${a.id}`,
            kind: 'outbid',
            // `ends_at` als Zeit: So rutscht das, was gleich zu Ende geht, nach
            // oben — die Sortierung wird zur Dringlichkeit.
            at: a.ends_at ?? new Date().toISOString(),
            title: 'Du wurdest überboten',
            body: `${a.title ?? 'Artikel'} · steht bei ${euro(a.current_bid_cents)}`,
            userId: a.seller_id,
            imageUrl: a.image_url,
            target: `/live/${a.session_id}`,
          });
        }
      }

      // ── 3. Verkäufer sendet ────────────────────────────────────────────────
      for (const s of (live.data ?? []) as {
        id: string;
        host_id: string;
        title: string | null;
        started_at: string | null;
      }[]) {
        items.push({
          key: `live-${s.id}`,
          kind: 'seller_live',
          at: s.started_at ?? new Date().toISOString(),
          title: 'Sendet gerade',
          body: s.title ?? 'Live-Show',
          userId: s.host_id,
          imageUrl: null,
          target: `/live/${s.id}`,
        });
      }

      // ── 4. Neu im Regal ────────────────────────────────────────────────────
      for (const a of (listings.data ?? []) as {
        id: string;
        seller_id: string;
        title: string;
        image_url: string | null;
        buy_now_cents: number;
        created_at: string;
      }[]) {
        items.push({
          key: `listing-${a.id}`,
          kind: 'new_listing',
          at: a.created_at,
          title: 'Neu im Angebot',
          body: `${a.title} · ${euro(a.buy_now_cents)}`,
          userId: a.seller_id,
          imageUrl: a.image_url,
          target: `/seller/${a.seller_id}`,
        });
      }

      // ── 5. Versand-Gutschriften ────────────────────────────────────────────
      for (const c of (credits.data ?? []) as {
        id: string;
        reason: string;
        granted_at: string;
        consumed_at: string | null;
      }[]) {
        items.push({
          key: `credit-${c.id}`,
          kind: 'reward_credit',
          at: c.granted_at,
          title: c.consumed_at ? 'Gratis-Versand eingelöst' : 'Gratis-Versand für dich',
          body:
            c.reason === 'invited'
              ? 'Weil du über eine Einladung gekommen bist'
              : 'Weil jemand, den du eingeladen hast, zum ersten Mal gekauft hat',
          userId: null,
          imageUrl: null,
          target: '/rewards',
        });
      }

      // ── 6. Provisionsfreie Tage ────────────────────────────────────────────
      for (const p of (perks.data ?? []) as {
        id: string;
        days: number;
        reason: string | null;
        granted_at: string;
      }[]) {
        items.push({
          key: `perk-${p.id}`,
          kind: 'reward_perk',
          at: p.granted_at,
          title: `${p.days} Tage provisionsfrei`,
          body: p.reason,
          userId: null,
          imageUrl: null,
          target: '/rewards',
        });
      }

      items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      return items.slice(0, 60);
    },
  });
}
