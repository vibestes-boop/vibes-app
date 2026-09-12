import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type PurchaseStatus = {
  auction: { id: string; seller_id: string; cart_id: string | null };
  cart: { id: string; status: string; closes_at: string } | null;
  order: { id: string; status: string } | null;
};

/** Resolve this buyer's exact auction → cart → order; never guess by seller. */
export function usePurchaseStatus(auctionId: string | undefined, userId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['berkat', 'purchase-status', userId, auctionId],
    enabled: enabled && Boolean(auctionId && userId),
    staleTime: 10_000,
    retry: 1,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }): Promise<PurchaseStatus | null> => {
      const { data: auction, error } = await supabase.from('live_auctions')
        .select('id, seller_id, cart_id').eq('id', auctionId!).eq('winner_id', userId!)
        .eq('status', 'sold').abortSignal(signal).retry(false).maybeSingle();
      if (error) throw error;
      if (!auction) return null;
      if (!auction.cart_id) return { auction, cart: null, order: null };
      const [cart, order] = await Promise.all([
        supabase.from('auction_carts').select('id, status, closes_at')
          .eq('id', auction.cart_id).eq('buyer_id', userId!).abortSignal(signal).retry(false).maybeSingle(),
        supabase.from('product_orders').select('id, status')
          .eq('cart_id', auction.cart_id).eq('buyer_id', userId!)
          .abortSignal(signal).retry(false).maybeSingle(),
      ]);
      if (cart.error) throw cart.error;
      if (order.error) throw order.error;
      return { auction, cart: cart.data, order: order.data };
    },
  });
}

export type PurchasePresentation = { title: string; body: string; action: string; target: string | null; tone: 'success' | 'neutral' };

/** Time is supplied by Berkat's server clock. Unknown states never imply unpaid. */
export function purchasePresentation(purchase: PurchaseStatus | null, now: number): PurchasePresentation {
  const neutral = { tone: 'neutral' as const };
  if (!purchase) return { ...neutral, title: 'Kauf nicht zugeordnet', body: 'Hier ist aktuell kein eigener Zuschlag hinterlegt.', action: 'Meine Käufe', target: '/purchases' };
  const { auction, order, cart } = purchase;
  const contact = `/messages/${auction.seller_id}?listing=${encodeURIComponent(auction.id)}`;
  const cartTarget = `/purchases?auctionId=${encodeURIComponent(auction.id)}`;
  if (order && ['paid', 'shipped', 'delivered'].includes(order.status)) {
    const copy = {
      paid: ['Bezahlt', 'Dein Verkäufer bereitet die Bestellung vor.'],
      shipped: ['Unterwegs zu dir', 'Versanddetails findest du in deiner Bestellung.'],
      delivered: ['Angekommen', 'Bestellung, Bewertung und Hilfe an einem Ort.'],
    }[order.status]!;
    return { title: copy[0], body: copy[1], action: 'Bestellung ansehen', target: `/order/${order.id}`, tone: 'success' };
  }
  if (order?.status === 'cancelled' || cart?.status === 'cancelled')
    return { ...neutral, title: 'Kauf abgebrochen', body: 'Fragen zu diesem Artikel klärst du mit dem Verkäufer.', action: 'Verkäufer kontaktieren', target: contact };
  if (cart?.status === 'expired' || (cart && ['open', 'checkout_pending'].includes(cart.status) && Date.parse(cart.closes_at) <= now))
    return { ...neutral, title: 'Zahlungsfenster abgelaufen', body: 'Dieses Paket kann nicht mehr über die offene Kasse bezahlt werden.', action: 'Verkäufer kontaktieren', target: contact };
  if (cart && ['open', 'checkout_pending'].includes(cart.status) && Number.isFinite(Date.parse(cart.closes_at)) && (!order || order.status === 'payment_requested'))
    return { ...neutral, title: 'Zahlung offen', body: cart.status === 'checkout_pending' ? 'Die Zahlung für dieses Paket wurde noch nicht bestätigt.' : 'Deine Artikel bei diesem Verkäufer werden gemeinsam bezahlt.', action: 'Paket ansehen', target: cartTarget };
  if (!auction.cart_id)
    return { ...neutral, title: 'Zuschlag bestätigt', body: 'Für diesen Artikel liegt keine Bestellung über Berkat vor.', action: 'Verkäufer kontaktieren', target: contact };
  return { ...neutral, title: 'Kaufstatus wird abgeglichen', body: 'Der aktuelle Zahlungsstand ist noch nicht eindeutig. Lade ihn erneut.', action: 'Status erneut laden', target: null };
}

/** Eligibility is checked again on tap; a stale visible button cannot pay an expired cart. */
export function canPayCart(cart: { status: string; closes_at: string } | undefined, now: number): boolean {
  return Boolean(cart && ['open', 'checkout_pending'].includes(cart.status) && Date.parse(cart.closes_at) > now);
}
