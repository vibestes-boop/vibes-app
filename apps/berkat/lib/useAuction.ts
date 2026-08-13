// Auktions-Daten für den Live-Raum.
//
// Grundsatz: der Server entscheidet, der Client zeigt an. Jeder Wert hier ist
// eine Kopie von dem, was in live_auctions steht — Gebote laufen ausschließlich
// über place_live_bid, nie über einen direkten Insert.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { subscribeToTable } from './realtime';

export type AuctionStatus = 'scheduled' | 'running' | 'sold' | 'unsold' | 'cancelled';

export type Auction = {
  id: string;
  session_id: string;
  seller_id: string;
  title: string;
  image_url: string | null;
  start_price_cents: number;
  min_increment_cents: number;
  buy_now_cents: number | null;
  status: AuctionStatus;
  sort_index: number;
  current_bid_cents: number | null;
  current_bidder_id: string | null;
  bid_count: number;
  ends_at: string | null;
  winner_id: string | null;
};

const AUCTION_COLUMNS =
  'id, session_id, seller_id, title, image_url, start_price_cents, min_increment_cents, ' +
  'buy_now_cents, status, sort_index, current_bid_cents, current_bidder_id, bid_count, ' +
  'ends_at, winner_id';

/** Nächstes gültiges Gebot in Cent. */
export function nextMinBid(a: Auction | null | undefined): number {
  if (!a) return 0;
  if (a.current_bid_cents == null) return a.start_price_cents;
  return a.current_bid_cents + a.min_increment_cents;
}

export function formatEuro(cents: number | null | undefined): string {
  if (cents == null) return '—';
  const euro = cents / 100;
  // Ganze Beträge ohne Nachkommastellen: "14 €" liest sich schneller als "14,00 €".
  return Number.isInteger(euro)
    ? `${euro} €`
    : euro.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/** Sekunden als mm:ss — die Form, die man auf einer Uhr erwartet. */
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

// ─── Serveruhr ───────────────────────────────────────────────────────────────
/**
 * Differenz zwischen Server- und Gerätezeit in Millisekunden.
 * Einmal beim Mount geholt; danach ist `serverNow()` verlässlich, auch wenn
 * die Uhr des Handys falsch geht.
 */
export function useServerClock(): { serverNow: () => number; synced: boolean } {
  const offsetRef = useRef(0);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const sentAt = Date.now();
    supabase
      .rpc('berkat_server_time')
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        // Halbe Laufzeit als Korrektur — grob, aber besser als gar nichts.
        const roundTrip = Date.now() - sentAt;
        const serverMs = new Date(data as string).getTime() + roundTrip / 2;
        offsetRef.current = serverMs - Date.now();
        setSynced(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);
  return { serverNow, synced };
}

/**
 * Sekunden bis `endsAt`, auf Serverzeit gerechnet. Aktualisiert 4× pro Sekunde,
 * damit der Balken im Gebots-Button flüssig läuft.
 */
export function useCountdown(endsAt: string | null, serverNow: () => number): number {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    endsAt ? Math.max(0, (new Date(endsAt).getTime() - serverNow()) / 1000) : 0,
  );

  useEffect(() => {
    if (!endsAt) {
      setSecondsLeft(0);
      return;
    }
    const target = new Date(endsAt).getTime();
    const tick = () => setSecondsLeft(Math.max(0, (target - serverNow()) / 1000));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [endsAt, serverNow]);

  return secondsLeft;
}

// ─── Auktionen einer Show ────────────────────────────────────────────────────
export function useLiveAuctions(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['berkat', 'auctions', sessionId], [sessionId]);

  const query = useQuery({
    queryKey,
    enabled: Boolean(sessionId),
    queryFn: async (): Promise<Auction[]> => {
      const { data, error } = await supabase
        .from('live_auctions')
        .select(AUCTION_COLUMNS)
        .eq('session_id', sessionId!)
        // 'unsold' gehört dazu: ein Artikel ohne Gebot ist nicht verschwunden,
        // er ist durchgelaufen. Wer das sieht, weiß, wie die Show läuft.
        .in('status', ['scheduled', 'running', 'sold', 'unsold'])
        .order('sort_index', { ascending: true });
      if (error) throw error;
      // Doppelte Umleitung über unknown: supabase-js kann die lange
      // Spaltenliste nicht mehr auf einen Zeilentyp abbilden und fällt auf
      // GenericStringError zurück. Auction oben ist die verbindliche Form.
      return (data ?? []) as unknown as Auction[];
    },
    staleTime: 5_000,
  });

  // Realtime — GEFILTERT auf diese Session und geteilt über subscribeToTable.
  // Studio und Raum beobachten dieselbe Show; ohne das geteilte Abo wirft der
  // zweite Aufruf beim Abonnieren.
  useEffect(() => {
    if (!sessionId) return;
    return subscribeToTable(
      `berkat-auctions-${sessionId}`,
      { event: '*', table: 'live_auctions', filter: `session_id=eq.${sessionId}` },
      () => queryClient.invalidateQueries({ queryKey }),
    );
  }, [sessionId, queryClient, queryKey]);

  const auctions = query.data ?? [];
  const active = auctions.find((a) => a.status === 'running') ?? null;
  const upcoming = auctions.filter((a) => a.status === 'scheduled');

  return { auctions, active, upcoming, isLoading: query.isLoading, error: query.error };
}

// ─── Namen der Bieter ────────────────────────────────────────────────────────
/**
 * Usernamen getrennt laden statt per PostgREST-Embed. Der Embed
 * `profiles(...)` läuft in diesem Projekt in PGRST200, sobald eine Tabelle auf
 * auth.users statt public.profiles zeigt — und scheitert dann still mit einer
 * leeren Liste. Ein eigener .in()-Query kann das nicht.
 */
export type MiniProfile = { username: string; avatarUrl: string | null };

export function useProfiles(
  userIds: (string | null | undefined)[],
): Record<string, MiniProfile> {
  const ids = useMemo(
    () => Array.from(new Set(userIds.filter((id): id is string => Boolean(id)))).sort(),
    [userIds],
  );

  const query = useQuery({
    queryKey: ['berkat', 'profiles', ids.join(',')],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, MiniProfile>> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', ids);
      if (error) throw error;
      const map: Record<string, MiniProfile> = {};
      for (const row of data ?? []) {
        const profile = row as { id: string; username: string | null; avatar_url: string | null };
        map[profile.id] = {
          username: profile.username ?? 'jemand',
          avatarUrl: profile.avatar_url,
        };
      }
      return map;
    },
  });

  return query.data ?? {};
}

/** Schmale Sicht auf useProfiles für Stellen, die nur den Namen brauchen. */
export function useUsernames(userIds: (string | null | undefined)[]): Record<string, string> {
  const profiles = useProfiles(userIds);
  return useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, profile] of Object.entries(profiles)) map[id] = profile.username;
    return map;
  }, [profiles]);
}

// ─── Aktionen ────────────────────────────────────────────────────────────────
export type BidOutcome =
  | { ok: true; currentBidCents: number; nextMinCents: number; endsAt: string; extended: boolean }
  | { ok: false; reason: BidError };

export type BidError =
  | 'already_leading'
  | 'auction_ended'
  | 'auction_not_running'
  | 'bid_too_low'
  | 'bid_too_high'
  | 'seller_cannot_bid'
  | 'not_authenticated'
  | 'unknown';

function toBidError(message: string): BidError {
  const known: BidError[] = [
    'already_leading',
    'auction_ended',
    'auction_not_running',
    'bid_too_low',
    'bid_too_high',
    'seller_cannot_bid',
    'not_authenticated',
  ];
  return known.find((k) => message.includes(k)) ?? 'unknown';
}

/** Menschliche Fassung der Server-Fehler. Warm, aber eindeutig. */
export function bidErrorText(reason: BidError): string {
  switch (reason) {
    case 'already_leading':
      return 'Du führst schon — spar dein Geld.';
    case 'auction_ended':
    case 'auction_not_running':
      return 'Zu spät, der Artikel ist durch. Der nächste kommt gleich.';
    case 'bid_too_low':
      return 'Da war jemand schneller. Der Preis ist schon höher.';
    case 'bid_too_high':
      return 'Das ist mehr als erlaubt. Bitte prüf den Betrag.';
    case 'seller_cannot_bid':
      return 'Auf die eigene Ware kann man nicht bieten.';
    case 'not_authenticated':
      return 'Melde dich an, dann kannst du mitbieten.';
    default:
      return 'Das Gebot kam nicht durch. Versuch es gleich noch einmal.';
  }
}

export function usePlaceBid() {
  return useCallback(async (auctionId: string, amountCents: number): Promise<BidOutcome> => {
    const { data, error } = await supabase.rpc('place_live_bid', {
      p_auction_id: auctionId,
      p_amount_cents: amountCents,
    });

    if (error) return { ok: false, reason: toBidError(error.message) };

    const result = data as {
      current_bid_cents: number;
      next_min_cents: number;
      ends_at: string;
      extended: boolean;
    };
    return {
      ok: true,
      currentBidCents: result.current_bid_cents,
      nextMinCents: result.next_min_cents,
      endsAt: result.ends_at,
      extended: result.extended,
    };
  }, []);
}

/**
 * Mein hinterlegtes Maximum für diese Auktion. Fremde Maxima sind per RLS
 * unsichtbar — sonst könnte man sie exakt überbieten und das Verfahren wäre
 * wertlos.
 */
export function useMyMaxBid(auctionId: string | undefined, userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'my-max', auctionId, userId],
    enabled: Boolean(auctionId && userId),
    staleTime: 5_000,
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase
        .from('live_auto_bids')
        .select('max_cents')
        .eq('auction_id', auctionId!)
        .eq('bidder_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as { max_cents: number } | null)?.max_cents ?? null;
    },
  });
}

export function useSetMaxBid() {
  const queryClient = useQueryClient();
  return useCallback(
    async (auctionId: string, maxCents: number): Promise<BidOutcome> => {
      const { data, error } = await supabase.rpc('set_max_bid', {
        p_auction_id: auctionId,
        p_max_cents: maxCents,
      });
      if (error) return { ok: false, reason: toBidError(error.message) };

      const result = data as {
        current_bid_cents: number;
        ends_at: string;
        leading: boolean;
      };
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'my-max', auctionId] });
      return {
        ok: true,
        currentBidCents: result.current_bid_cents,
        nextMinCents: result.current_bid_cents,
        endsAt: result.ends_at,
        extended: false,
      };
    },
    [queryClient],
  );
}

/**
 * Zuschlag anstoßen, sobald der eigene Countdown auf null läuft.
 * Absichtlich von jedem Zuschauer aufrufbar: wer zuerst kommt, rechnet ab,
 * alle weiteren Aufrufe sind wirkungslos. Der Cron-Job ist nur das Netz
 * darunter — eine Minute Auflösung wäre für 30-Sekunden-Auktionen zu grob.
 */
export function useSettleOnZero(auction: Auction | null, secondsLeft: number) {
  const triedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!auction || auction.status !== 'running') return;
    if (secondsLeft > 0) return;
    if (triedRef.current === auction.id) return;
    triedRef.current = auction.id;
    supabase.rpc('settle_live_auction', { p_auction_id: auction.id }).then(({ error }) => {
      // Fehlschlag zurücknehmen, damit der nächste Tick es erneut versucht.
      // Sonst hinge der Artikel bis zum Cron-Lauf eine Minute später.
      if (error) triedRef.current = null;
    });
  }, [auction, secondsLeft]);
}

// ─── Sammelkorb ──────────────────────────────────────────────────────────────
export type Cart = {
  id: string;
  seller_id: string;
  closes_at: string;
  itemCount: number;
  totalCents: number;
};

/** Offener Sammelkorb des Nutzers bei diesem Verkäufer. */
export function useCart(userId: string | null, sellerId: string | undefined) {
  return useQuery({
    queryKey: ['berkat', 'cart', userId, sellerId],
    enabled: Boolean(userId && sellerId),
    staleTime: 10_000,
    queryFn: async (): Promise<Cart | null> => {
      const { data: carts, error } = await supabase
        .from('auction_carts')
        .select('id, seller_id, closes_at')
        .eq('buyer_id', userId!)
        .eq('seller_id', sellerId!)
        .eq('status', 'open')
        .limit(1);
      if (error) throw error;

      const cart = carts?.[0] as { id: string; seller_id: string; closes_at: string } | undefined;
      if (!cart) return null;

      const { data: won, error: wonError } = await supabase
        .from('live_auctions')
        .select('current_bid_cents')
        .eq('cart_id', cart.id)
        .eq('status', 'sold');
      if (wonError) throw wonError;

      const rows = (won ?? []) as { current_bid_cents: number | null }[];
      return {
        id: cart.id,
        seller_id: cart.seller_id,
        closes_at: cart.closes_at,
        itemCount: rows.length,
        totalCents: rows.reduce((sum, r) => sum + (r.current_bid_cents ?? 0), 0),
      };
    },
  });
}

/** "noch 22 h" — grob genug, dass es nicht wie ein Countdown wirkt. */
export function formatCartWindow(closesAt: string, serverNow: () => number): string {
  const msLeft = new Date(closesAt).getTime() - serverNow();
  if (msLeft <= 0) return 'Fenster zu';
  const hours = Math.floor(msLeft / 3_600_000);
  if (hours >= 1) return `noch ${hours} h`;
  const minutes = Math.max(1, Math.floor(msLeft / 60_000));
  return `noch ${minutes} min`;
}
