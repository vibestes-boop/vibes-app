/**
 * lib/useGifts.ts — Virtuelle Geschenke: Senden + Empfangen
 *
 * useSendGift:    Sendet ein Geschenk via Supabase RPC (atomic)
 * useGiftStream:  Empfängt Geschenke via Supabase Realtime
 * useCoinsWallet: Liest das Coin-Guthaben des Users
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions } from 'react-native';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';
import { GIFT_BY_ID, type GiftItem, type GiftRealtimePayload } from './gifts';

const SCREEN_W = Dimensions.get('window').width;

// ─── Wallet Hook ─────────────────────────────────────────────────────────────

export function useCoinsWallet() {
  const user = useAuthStore((s) => s.user);
  const [coins, setCoins] = useState<number>(0);
  const [diamonds, setDiamonds] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchWallet = useCallback(async () => {
    if (!user?.id) {
      setLoading(false); // Bug-Fix: loading blieb true wenn kein User eingeloggt
      return;
    }
    const { data } = await supabase
      .from('coins_wallets')
      .select('coins, diamonds')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setCoins(data.coins ?? 0);
      setDiamonds(data.diamonds ?? 0);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  return { coins, diamonds, loading, refetch: fetchWallet };
}

// ─── Gift Senden ──────────────────────────────────────────────────────────────

export type SendGiftResult =
  | { success: true;  newBalance: number }
  | { success: false; error: 'insufficient_coins' | 'no_wallet' | 'cannot_gift_yourself' | 'gift_not_found' | 'network_error' };

export function useSendGift() {
  const [isSending, setIsSending] = useState(false);
  const user = useAuthStore((s) => s.user);

  const sendGift = useCallback(async (
    recipientId:   string,
    liveSessionId: string,
    giftId:        string,
  ): Promise<SendGiftResult> => {
    if (!user?.id) return { success: false, error: 'no_wallet' };
    setIsSending(true);
    try {
      const { data, error } = await supabase.rpc('send_gift', {
        p_recipient_id:    recipientId,
        p_live_session_id: liveSessionId,
        p_gift_id:         giftId,
      });

      if (error || !data) {
        console.error('[Gift] RPC Fehler:', error);
        return { success: false, error: 'network_error' };
      }

      if (data.error) {
        type ErrorCode = Extract<SendGiftResult, { success: false }>['error'];
        return { success: false, error: (data.error as ErrorCode) };
      }

      // Realtime-Broadcast damit alle Zuschauer die Animation sehen
      await supabase.channel(`live:${liveSessionId}`).send({
        type: 'broadcast',
        event: 'gift',
        payload: {
          senderId:    user.id,
          senderName:  user.user_metadata?.username ?? user.email ?? 'Jemand',
          senderAvatar: user.user_metadata?.avatar_url,
          giftId,
          sessionId:  liveSessionId,
        } satisfies GiftRealtimePayload,
      });

      return { success: true, newBalance: data.new_balance };
    } catch (err) {
      console.error('[Gift] Unerwarteter Fehler:', err);
      return { success: false, error: 'network_error' };
    } finally {
      setIsSending(false);
    }
  }, [user]);

  return { sendGift, isSending };
}

// ─── Gift Empfangen (Realtime) ────────────────────────────────────────────────

export interface IncomingGift {
  id:              string;  // uuid für React key
  senderName:      string;
  senderAvatar?:   string;
  gift:            GiftItem;
  burstPositions:  number[]; // stabile x-Koordinaten (pre-calculated, nicht im Render)
  receivedAt:      number;   // Date.now()
}

/** Abonniert Geschenke auf einem Live-Kanal und gibt sie als State zurück */
export function useGiftStream(liveSessionId: string | null) {
  const [gifts, setGifts] = useState<IncomingGift[]>([]);
  // Alle aktiven Timers tracken für sauberes Cleanup (kein setState auf unmounted Component)
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!liveSessionId) return;

    const channel = supabase.channel(`live:${liveSessionId}`, {
      config: { broadcast: { ack: false } },
    });

    channel.on('broadcast', { event: 'gift' }, ({ payload }: { payload: GiftRealtimePayload }) => {
      const gift = GIFT_BY_ID[payload.giftId];
      if (!gift) return;

      // BurstEmoji-Positionen HIER berechnen, nicht im Render (verhindert Position-Jump bei Re-render)
      const burstPositions = gift.burstEmojis.map(() =>
        Math.random() * (SCREEN_W - 60) + 20
      );

      const incoming: IncomingGift = {
        id:            `${Date.now()}-${Math.random()}`,
        senderName:    payload.senderName,
        senderAvatar:  payload.senderAvatar,
        gift,
        burstPositions, // stabile Positionen
        receivedAt:    Date.now(),
      };

      setGifts((prev) => [...prev, incoming]);

      // Auto-Remove nach 4s — Timer wird in ref gespeichert für Cleanup
      const timer = setTimeout(() => {
        setGifts((prev) => prev.filter((g) => g.id !== incoming.id));
        timerRefs.current = timerRefs.current.filter((t) => t !== timer);
      }, 4_000);
      timerRefs.current.push(timer);
    });

    channel.subscribe();

    return () => {
      // Alle ausstehenden Timers canceln (verhindert setState auf unmounted Component)
      timerRefs.current.forEach(clearTimeout);
      timerRefs.current = [];
      supabase.removeChannel(channel);
    };
  }, [liveSessionId]);

  return { gifts };
}

// ─── Top Gifter für einen Stream ─────────────────────────────────────────────

export interface TopGifter {
  userId: string;
  username: string;
  avatarUrl?: string;
  totalCoins: number;
}

export async function fetchTopGifters(liveSessionId: string): Promise<TopGifter[]> {
  const { data } = await supabase
    .from('gift_transactions')
    .select(`
      sender_id,
      coin_cost,
      sender:profiles!gift_transactions_sender_id_fkey(username, avatar_url)
    `)
    .eq('live_session_id', liveSessionId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!data) return [];

  // Aggregieren nach Sender
  const map = new Map<string, TopGifter>();
  for (const tx of data) {
    const existing = map.get(tx.sender_id);
    const sender = Array.isArray(tx.sender) ? tx.sender[0] : tx.sender;
    if (existing) {
      existing.totalCoins += tx.coin_cost;
    } else {
      map.set(tx.sender_id, {
        userId:     tx.sender_id,
        username:   sender?.username ?? 'Anonym',
        avatarUrl:  sender?.avatar_url,
        totalCoins: tx.coin_cost,
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.totalCoins - a.totalCoins)
    .slice(0, 10);
}
