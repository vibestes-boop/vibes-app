import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { CartItem } from './useMyOrders';

export type OpenCart = {
  id: string;
  seller_id: string;
  closes_at: string;
  /** Höchste Versandstufe im Paket — bestimmt, was der Käufer an Versand zahlt. */
  shippingTier: number;
  /**
   * `open` sammelt weiter, `checkout_pending` ist eingefroren.
   *
   * ⚠️ Der Unterschied ist für den Käufer teuer, nicht kosmetisch: Ein
   * eingefrorener Korb nimmt NICHTS mehr auf (`checkout_auction_cart`,
   * HANDOFF 4). Was danach gewonnen wird, landet in einem neuen Paket — mit
   * eigenem Versand. Wer das nicht sieht, hält zwei Körbe für einen Fehler
   * und zahlt zweimal 4,90 €.
   */
  status: string;
  itemCount: number;
  totalCents: number;
  items: CartItem[];
};

/**
 * Welche dieser Verkäufer senden GERADE.
 *
 * ⚠️ Die Frage klingt nach Kosmetik und ist die teuerste auf diesem Bildschirm.
 * `checkout_auction_cart` friert den Korb ein (HANDOFF 4) — wer bezahlt,
 * während der Verkäufer noch sendet, bekommt jeden weiteren Zuschlag in ein
 * NEUES Paket und zahlt ein zweites Mal Versand. Genau das ist am 19.08.2026
 * im Zwei-Konten-Durchlauf passiert.
 *
 * HANDOFF 11 hat diese Regel längst aufgeschrieben — als Begründung dafür,
 * dass es im Live-Raum keinen Bezahlknopf gibt. Nur steht hier einer, einen
 * Reiter entfernt, und die Regel wurde nie mitgezogen.
 *
 * Eine Abfrage für alle Verkäufer auf einmal; ohne Körbe läuft sie nicht.
 */
export function useLiveSellers(sellerIds: string[], enabled = true) {
  const key = [...new Set(sellerIds)].sort().join(',');
  return useQuery({
    queryKey: ['berkat', 'carts-live-sellers', key],
    enabled: enabled && key.length > 0,
    staleTime: 20_000,
    // Eine Show kann während des Hinschauens enden — dann soll die Warnung weg.
    refetchInterval: 30_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('live_sessions')
        .select('host_id')
        .in('host_id', key.split(','))
        .eq('app', 'berkat')
        .eq('status', 'active');
      if (error) {
        // Fehlt die Auskunft, warnen wir lieber nicht, als falsch zu warnen.
        if (__DEV__) console.warn('[Berkat] Live-Verkäufer:', error.message);
        return new Set();
      }
      return new Set(((data ?? []) as { host_id: string }[]).map((r) => r.host_id));
    },
  });
}

/** Open packages and the latest closed packages, scoped to their buyer. */
export function useMyCarts(userId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['berkat', 'my-carts', userId],
    enabled: enabled && Boolean(userId),
    staleTime: 15_000,
    // Diese Abfrage läuft nicht im Takt — ohne das hier stünde nach der
    // Rückkehr aus dem Stripe-Browser weiterhin „noch offen" da, obwohl längst
    // bezahlt ist. Die App-weite Verkabelung dafür sitzt im Wurzel-Layout.
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }): Promise<OpenCart[]> => {
      // Keep every open package; bound historical reads separately so older
      // closed packages cannot crowd a payable package out of a shared limit.
      const [active, history] = await Promise.all([
        supabase.from('auction_carts').select('id, seller_id, closes_at, status')
          .eq('buyer_id', userId!).in('status', ['open', 'checkout_pending'])
          .order('closes_at', { ascending: true }).abortSignal(signal).retry(false),
        supabase.from('auction_carts').select('id, seller_id, closes_at, status')
          .eq('buyer_id', userId!).in('status', ['expired', 'cancelled'])
          .order('closes_at', { ascending: false }).limit(30).abortSignal(signal).retry(false),
      ]);
      if (active.error) throw active.error;
      if (history.error) throw history.error;
      const rows = [...new Map([...active.data ?? [], ...history.data ?? []].map(cart => [cart.id, cart])).values()];
      if (rows.length === 0) return [];

      const { data: won, error: wonError } = await supabase
        .from('live_auctions')
        // ⚠️ `shipping_tier` MUSS mit — aus demselben Grund wie `status` oben.
        // Ohne sie kennt der Bildschirm die Versandstufe des Pakets nicht und
        // zeigt den teuersten Satz („ab 4,90 €"), während die Kasse bei einem
        // Brief 1,19 € verlangt. Eine zu HOHE Angabe schreckt ab, und bei
        // 6-€-Ware entscheidet genau sie über den Kauf (`20260823140000`).
        .select('id, cart_id, current_bid_cents, title, image_url, shipping_tier')
        .in(
          'cart_id',
          rows.map((c) => c.id),
        )
        .eq('status', 'sold').eq('winner_id', userId!).abortSignal(signal).retry(false);
      if (wonError) throw wonError;

      const items = (won ?? []) as {
        id: string;
        cart_id: string;
        current_bid_cents: number | null;
        title: string;
        image_url: string | null;
        shipping_tier: number | null;
      }[];
      return rows.map((cart) => {
        const mine = items.filter((item) => item.cart_id === cart.id);
        return {
          ...cart,
          itemCount: mine.length,
          totalCents: mine.reduce((sum, item) => sum + (item.current_bid_cents ?? 0), 0),
          // Was drin liegt — vorher war ein offenes Paket nur eine Zahl.
          // ⚠️ `id` und Preis gehen MIT — ohne sie ist die Zeile im Paket
          // nicht antippbar und sagt nicht, was sie gekostet hat.
          items: mine.map((item) => ({
            id: item.id,
            title: item.title,
            image_url: item.image_url,
            price_cents: item.current_bid_cents,
          })),
          // Die Stufe eines PAKETS ist die höchste seiner Artikel — alles geht
          // in dieselbe Sendung. `?? 4` innen: Ein Artikel ohne Angabe muss die
          // teuerste Stufe erzwingen, sonst verbilligt eine Lücke den Satz.
          shippingTier: mine.length
            ? Math.max(...mine.map((item) => item.shipping_tier ?? 4))
            : 4,
        };
      });
    },
  });
}


/** Wins with direct seller settlement have no Berkat cart but remain visible. */
export function useUnassignedWins(userId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['berkat', 'unassigned-wins', userId],
    enabled: enabled && Boolean(userId), staleTime: 15_000, retry: 1,
    queryFn: async ({ signal }): Promise<{ id: string; title: string }[]> => {
      const { data, error } = await supabase.from('live_auctions').select('id, title')
        .eq('winner_id', userId!).eq('status', 'sold').is('cart_id', null)
        .order('settled_at', { ascending: false }).abortSignal(signal).retry(false);
      if (error) throw error;
      return data ?? [];
    },
  });
}
