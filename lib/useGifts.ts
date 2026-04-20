/**
 * lib/useGifts.ts — Virtuelle Geschenke: Senden + Empfangen
 *
 * useSendGift:    Sendet ein Geschenk via Supabase RPC (atomic)
 * useGiftStream:  Empfängt Geschenke via Supabase Realtime
 * useCoinsWallet: Liest das Coin-Guthaben des Users
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';
import type { RealtimeChannel } from '@supabase/supabase-js';
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
  | {
      success: false;
      error: 'insufficient_coins' | 'no_wallet' | 'cannot_gift_yourself' | 'gift_not_found' | 'gifts_disabled' | 'network_error';
      /** Nur bei network_error gesetzt — echte Supabase-Fehlermeldung (Code/Message/Details) für DEV-Debug + Sentry. */
      detail?: string;
    };

export function useSendGift() {
  const [isSending, setIsSending] = useState(false);
  const user = useAuthStore((s) => s.user);

  // ── Combo-Tracking (Sender-seitig) ───────────────────────────────────────
  // Map<comboKey, { count, resetTimer }>
  // Nach COMBO_WINDOW_MS Inaktivität wird der Counter resettet.
  // MAX_COMBO_ENTRIES cappt die Map gegen Edge-Cases in langen Streams
  // (Audit Phase 2 #10 — belt-and-suspenders; regulär Bounded durch giftId-Anzahl).
  const comboRef = useRef<Map<string, { count: number; timer: ReturnType<typeof setTimeout> }>>(new Map());
  const COMBO_WINDOW_MS   = 4500; // 4.5s — etwas mehr als die Pill-Anzeige
  const MAX_COMBO_ENTRIES = 256;

  const sendGift = useCallback(async (
    recipientId:   string,
    liveSessionId: string,
    giftId:        string,
    channelRef:    React.MutableRefObject<RealtimeChannel | null>,
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
        // Echte Fehler-Details für Debug sammeln — Postgres-Code, Message, Hint
        const detail = error
          ? [error.code, error.message, error.details, error.hint]
              .filter(Boolean)
              .join(' | ')
          : 'rpc returned null data';
        __DEV__ && console.error('[Gift] RPC Fehler:', detail, error);
        // Sentry-Capture mit Kontext, damit wir Prod-Ursache sehen können
        try {
          Sentry.captureException(
            error instanceof Error ? error : new Error(`send_gift failed: ${detail}`),
            {
              tags: { feature: 'gift-send', rpc: 'send_gift' },
              extra: {
                errorCode:    (error as { code?: string } | null)?.code ?? null,
                errorMessage: error?.message ?? null,
                errorDetails: (error as { details?: string } | null)?.details ?? null,
                errorHint:    (error as { hint?: string } | null)?.hint ?? null,
                recipientId,
                liveSessionId,
                giftId,
              },
            }
          );
        } catch { /* Sentry optional in Expo Go */ }
        return { success: false, error: 'network_error', detail };
      }

      if (data.error) {
        type ErrorCode = Extract<SendGiftResult, { success: false }>['error'];
        return { success: false, error: (data.error as ErrorCode) };
      }

      // ── Combo-Zähler berechnen ────────────────────────────────────────────
      const comboKey = `${user.id}-${giftId}`;
      const existing = comboRef.current.get(comboKey);

      if (existing) {
        clearTimeout(existing.timer);
      }

      const comboCount = (existing?.count ?? 0) + 1;

      const resetTimer = setTimeout(() => {
        comboRef.current.delete(comboKey);
      }, COMBO_WINDOW_MS);

      // LRU-Cap: Wenn Map voll ist, ältesten Eintrag (FIFO = Insertion-Order) evicten
      if (!existing && comboRef.current.size >= MAX_COMBO_ENTRIES) {
        const firstKey = comboRef.current.keys().next().value;
        if (firstKey !== undefined) {
          const evicted = comboRef.current.get(firstKey);
          if (evicted) clearTimeout(evicted.timer);
          comboRef.current.delete(firstKey);
        }
      }

      comboRef.current.set(comboKey, { count: comboCount, timer: resetTimer });

      // ── Broadcast über den subscribed Channel ─────────────────────────────
      const payload: GiftRealtimePayload = {
        senderId:    user.id,
        senderName:  user.user_metadata?.username ?? user.email ?? 'Jemand',
        senderAvatar: user.user_metadata?.avatar_url,
        giftId,
        sessionId:   liveSessionId,
        comboCount,
        comboKey,
      };

      if (channelRef.current) {
        await channelRef.current.send({
          type:    'broadcast',
          event:   'gift',
          payload,
        });
      } else {
        __DEV__ && console.warn('[Gift] channelRef ist null — kein Broadcast möglich!');
      }

      return { success: true, newBalance: data.new_balance };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      __DEV__ && console.error('[Gift] Unerwarteter Fehler:', err);
      try {
        Sentry.captureException(err instanceof Error ? err : new Error(`send_gift threw: ${detail}`), {
          tags: { feature: 'gift-send', rpc: 'send_gift' },
          extra: { recipientId, liveSessionId, giftId },
        });
      } catch { /* ignore */ }
      return { success: false, error: 'network_error', detail };
    } finally {
      setIsSending(false);
    }
  }, [user]);

  return { sendGift, isSending };
}

// ─── Gift Empfangen (Realtime) ────────────────────────────────────────────────

export interface IncomingGift {
  id:              string;   // Gleich wie comboKey für normale Gifts → erlaubt Updates
  senderName:      string;
  senderAvatar?:   string;
  gift:            GiftItem;
  burstPositions:  number[];
  receivedAt:      number;
  /**
   * Combo-Zähler: wie oft dieses Gift vom gleichen Sender kurz hintereinander kam.
   * Wird bei jedem weiteren Broadcast inkrementiert → Pill updated sich, kein neues Pill.
   */
  comboCount:      number;
  /** comboKey = `${senderId}-${giftId}` — wird als React key + Update-Schlüssel verwendet */
  comboKey:        string;
}

/** Abonniert Geschenke auf einem Live-Kanal und gibt sie als State zurück.
 *  Gibt auch channelRef zurück — wird von useSendGift für Broadcasts benötigt!
 */
export function useGiftStream(liveSessionId: string | null) {
  const [gifts, setGifts] = useState<IncomingGift[]>([]);
  // Alle aktiven Timers tracken für sauberes Cleanup (kein setState auf unmounted Component)
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Kanalreferenz: wird von useSendGift.sendGift für Broadcasts verwendet!
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ── Combo-Aggregation (Receiver-seitig) ──────────────────────────────────
  // Beim Empfang: wenn comboKey bereits in aktuellen gifts vorhanden
  // (= gleicher Sender, gleiches Gift, noch sichtbar) → nur comboCount updaten
  // statt ein neues Pill zu erstellen. Burst-Emojis werden trotzdem erneut getriggert.
  //
  // MAX_COMBO_KEY_ENTRIES cappt die Map gegen Long-Running-Streams mit
  // vielen unterschiedlichen Gift-Sender-Kombinationen (Audit Phase 2 #10).
  const comboKeyToId = useRef<Map<string, string>>(new Map()); // comboKey → gift.id
  const MAX_COMBO_KEY_ENTRIES = 512;

  const addGift = useCallback((payload: GiftRealtimePayload) => {
    const gift = GIFT_BY_ID[payload.giftId];
    if (!gift) return;

    const { comboKey, comboCount } = payload;
    const existingId = comboKeyToId.current.get(comboKey);

    if (existingId && comboCount > 1) {
      // ── Combo Update: bestehendes Pill aktualisieren ─────────────────────
      // Setzt nur comboCount, kein neues Pill — Bounce-Animation wird in GiftPill getriggert
      setGifts((prev) =>
        prev.map((g) =>
          g.id === existingId ? { ...g, comboCount } : g
        )
      );
      return; // kein neues Pill
    }

    // ── Neues Pill / neue Combo-Sequenz ──────────────────────────────────────
    const burstPositions = gift.burstEmojis.map(() =>
      Math.random() * (SCREEN_W - 60) + 20
    );

    // ⚠️ FIX: displayId MIT Timestamp — verhindert Duplicate-Key wenn COMBO_WINDOW
    //         abläuft (4.5s) aber Pill noch sichtbar ist (6.5s) und comboCount=1
    //         nochmal kommt. Ohne Timestamp: zwei Gifts mit id='uid-rose' → React crash.
    const displayId = `${comboKey}-${Date.now()}`;

    // LRU-Cap: Bei Long-Running-Streams mit vielen Sender-Gift-Kombis evicten wir
    // FIFO-Einträge. Regulär Bounded durch sichtbare Pills (~6.5s TTL), aber
    // bei pathologischem Pill-Churn ohne Timer-Fire greift der Cap.
    if (!existingId && comboKeyToId.current.size >= MAX_COMBO_KEY_ENTRIES) {
      const firstKey = comboKeyToId.current.keys().next().value;
      if (firstKey !== undefined) comboKeyToId.current.delete(firstKey);
    }

    comboKeyToId.current.set(comboKey, displayId);

    const incoming: IncomingGift = {
      id:           displayId,
      senderName:   payload.senderName,
      senderAvatar: payload.senderAvatar,
      gift,
      burstPositions,
      receivedAt:   Date.now(),
      comboCount:   1,
      comboKey,
    };

    setGifts((prev) => [...prev, incoming]);

    // Auto-Remove — muss länger als COMBO_WINDOW_MS (4.5s) + RPC-Latenz (~1.5s) sein
    const isPremium = gift.coinCost >= 750;
    const removeMs  = isPremium ? 17_000 : 6_500;
    const timer = setTimeout(() => {
      setGifts((prev) => prev.filter((g) => g.id !== displayId));
      // ⚠️ FIX: Nur löschen wenn dieser Timer noch der aktuelle für diesen comboKey ist.
      //         Sonst wird das Mapping eines NEUEREN Pills vorzeitig gelöscht.
      if (comboKeyToId.current.get(comboKey) === displayId) {
        comboKeyToId.current.delete(comboKey);
      }
      timerRefs.current = timerRefs.current.filter((t) => t !== timer);
    }, removeMs);
    timerRefs.current.push(timer);
  }, []);

  useEffect(() => {
    if (!liveSessionId) return;

    const channel = supabase.channel(`live:${liveSessionId}`, {
      config: { broadcast: { ack: false, self: true } }, // self: true → Sender sieht eigene Broadcasts
    });

    channel.on('broadcast', { event: 'gift' }, ({ payload }: { payload: GiftRealtimePayload }) => {
      addGift(payload);
    });

    // channelRef erst setzen wenn wirklich SUBSCRIBED — verhindert dass sendGift
    // auf einem noch nicht verbundenen Channel broadcastet (Gifts gehen verloren).
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channelRef.current = channel;
      }
    });

    return () => {
      // Alle ausstehenden Timers canceln (verhindert setState auf unmounted Component)
      timerRefs.current.forEach(clearTimeout);
      timerRefs.current = [];
      // ⚠️ FIX (Audit Phase 2 #10): Channel ZUERST entfernen, DANN ref nullen.
      // Umgekehrte Reihenfolge kann bei schnellem Remount dazu führen, dass
      // sendGift einen null-ref sieht während der alte Listener noch aktiv ist,
      // und parallel ein neuer Channel (gleicher Name `live:${liveSessionId}`)
      // subscriben will → Doppel-Broadcast am Receiver.
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [liveSessionId, addGift]);

  return { gifts, channelRef, addGift };
}

// ─── Top Gifter für einen Stream ─────────────────────────────────────────────

export interface TopGifter {
  userId: string;
  username: string;
  avatarUrl?: string;
  /** Coin-Summe, die dieser Sender in der aktuellen Session verschenkt hat */
  totalCoins: number;
  /** Anzahl einzelner Gift-Transaktionen (für "10+" / "5" / "1" Badge rechts) */
  giftsCount: number;
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

  // Aggregieren nach Sender (Coin-Summe + Anzahl Transaktionen)
  const map = new Map<string, TopGifter>();
  for (const tx of data) {
    const existing = map.get(tx.sender_id);
    const sender = Array.isArray(tx.sender) ? tx.sender[0] : tx.sender;
    if (existing) {
      existing.totalCoins += tx.coin_cost;
      existing.giftsCount += 1;
    } else {
      map.set(tx.sender_id, {
        userId:     tx.sender_id,
        username:   sender?.username ?? 'Anonym',
        avatarUrl:  sender?.avatar_url,
        totalCoins: tx.coin_cost,
        giftsCount: 1,
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.totalCoins - a.totalCoins)
    .slice(0, 10);
}

// ─── Top Gifter Realtime Hook ─────────────────────────────────────────────────

/**
 * Lädt und aktualisiert die Top-Gifter einer Session in Echtzeit.
 * Wird jedes Mal neu berechnet wenn ein neues Geschenk eintrifft.
 *
 * @param liveSessionId  ID der Session
 * @param limit          Wie viele Top-Gifter anzeigen (default 5)
 */
export function useTopGifters(liveSessionId: string | null, limit = 5) {
  const [topGifters, setTopGifters] = useState<TopGifter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!liveSessionId) return;

    // reload ist HIER definiert → kein Stale-Closure-Problem mit limit/liveSessionId
    const reload = async () => {
      const list = await fetchTopGifters(liveSessionId);
      setTopGifters(list.slice(0, limit));
      setLoading(false);
    };

    reload();

    // Leaderboard-Update via postgres_changes auf gift_transactions.
    // WICHTIG: Kein eigener Broadcast-Channel → kein Konflikt mit useGiftStream!
    // postgres_changes erkennt neue DB-Rows direkt (nach send_gift RPC Insert).
    const channel = supabase
      .channel(`top-gifters-db-${liveSessionId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'gift_transactions',
          filter: `live_session_id=eq.${liveSessionId}`,
        },
        () => {
          // Kurzes Delay damit der Insert committed ist
          setTimeout(reload, 300);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [liveSessionId, limit]);

  return { topGifters, loading };
}
