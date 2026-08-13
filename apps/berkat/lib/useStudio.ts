// Verkäufer-Seite: eigene Show aufmachen, Artikel auflegen, Auktion starten.
//
// Alles Schreibende läuft über die RPCs aus 20260813150000_berkat_live_auctions.
// Einzige Ausnahme ist live_sessions selbst — dort gilt die bestehende
// Serlo-Policy (auth.uid() = host_id), die Berkat unverändert nutzt.

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export type MyShow = {
  id: string;
  title: string | null;
  viewer_count: number | null;
  status: string;
  started_at: string;
  thumbnail_url: string | null;
};

/** Gegenstück für Eingabefelder: 1250 → "12,50", 100 → "1". */
export function centsToEuroInput(cents: number): string {
  if (cents % 100 === 0) return String(Math.round(cents / 100));
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** "12,50" oder "12.50" → 1250. Leere Eingabe → null. */
export function euroToCents(input: string): number | null {
  const cleaned = input.replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function useMyActiveShow(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'my-show', userId],
    enabled: Boolean(userId),
    refetchInterval: 15_000,
    queryFn: async (): Promise<MyShow | null> => {
      const { data, error } = await supabase
        .from('live_sessions')
        .select('id, title, viewer_count, status, started_at, thumbnail_url')
        .eq('host_id', userId!)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data?.[0] as MyShow | undefined) ?? null) satisfies MyShow | null;
    },
  });
}

export function useCreateShow(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; thumbnailUrl: string | null }): Promise<string> => {
      if (!userId) throw new Error('not_authenticated');
      // room_name wird später von LiveKit gebraucht; er muss stabil und
      // eindeutig sein, deshalb schon jetzt vergeben statt nachzurüsten.
      const roomName = `berkat-${userId.slice(0, 8)}-${Date.now().toString(36)}`;
      const { data, error } = await supabase
        .from('live_sessions')
        .insert({
          host_id: userId,
          title: input.title.trim() || 'Berkat-Show',
          status: 'active',
          category: 'shopping',
          room_name: roomName,
          thumbnail_url: input.thumbnailUrl,
        })
        .select('id')
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['berkat', 'my-show', userId] });
      queryClient.invalidateQueries({ queryKey: ['berkat', 'shows'] });
    },
  });
}

/** Cover einer laufenden Show austauschen. */
export function useSetShowCover(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; url: string }): Promise<void> => {
      const { error } = await supabase
        .from('live_sessions')
        .update({ thumbnail_url: input.url })
        .eq('id', input.sessionId)
        .eq('host_id', userId!);
      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['berkat', 'my-show', userId] });
      queryClient.invalidateQueries({ queryKey: ['berkat', 'shows'] });
      queryClient.invalidateQueries({ queryKey: ['berkat', 'session', input.sessionId] });
    },
  });
}

export function useEndShow(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string): Promise<void> => {
      const { error } = await supabase
        .from('live_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('host_id', userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['berkat', 'my-show', userId] });
      queryClient.invalidateQueries({ queryKey: ['berkat', 'shows'] });
    },
  });
}

export type NewAuction = {
  sessionId: string;
  title: string;
  startPriceCents: number;
  minIncrementCents: number;
  buyNowCents: number | null;
  imageUrl: string | null;
};

export function useCreateAuction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewAuction): Promise<string> => {
      const { data, error } = await supabase.rpc('create_live_auction', {
        p_session_id: input.sessionId,
        p_title: input.title,
        p_start_price_cents: input.startPriceCents,
        p_min_increment_cents: input.minIncrementCents,
        p_buy_now_cents: input.buyNowCents,
        p_image_url: input.imageUrl,
        p_product_id: null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, input) => {
      queryClient.invalidateQueries({ queryKey: ['berkat', 'auctions', input.sessionId] });
    },
  });
}

export type EditedAuction = {
  auctionId: string;
  title: string;
  startPriceCents: number;
  minIncrementCents: number;
  buyNowCents: number | null;
  imageUrl: string | null;
};

/**
 * Aufgelegten Artikel korrigieren. Schickt immer den vollständigen Zustand —
 * die RPC ersetzt, sie flickt nicht, damit „leer" nie zwischen „unverändert"
 * und „entfernt" schwebt.
 */
export function useUpdateAuction(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EditedAuction): Promise<void> => {
      const { error } = await supabase.rpc('update_live_auction', {
        p_auction_id: input.auctionId,
        p_title: input.title,
        p_start_price_cents: input.startPriceCents,
        p_min_increment_cents: input.minIncrementCents,
        p_buy_now_cents: input.buyNowCents,
        p_image_url: input.imageUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['berkat', 'auctions', sessionId] });
    },
  });
}

export function useStartAuction(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      auctionId,
      seconds,
    }: {
      auctionId: string;
      seconds: number;
    }): Promise<void> => {
      const { error } = await supabase.rpc('start_live_auction', {
        p_auction_id: auctionId,
        p_duration_seconds: seconds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['berkat', 'auctions', sessionId] });
    },
  });
}

export function useCancelAuction(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (auctionId: string): Promise<void> => {
      const { error } = await supabase.rpc('cancel_live_auction', { p_auction_id: auctionId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['berkat', 'auctions', sessionId] });
    },
  });
}

/** Server-Fehler der Studio-RPCs in verständliche Sätze. */
export function studioErrorText(message: string): string {
  if (message.includes('another_auction_running'))
    return 'Es läuft noch ein Artikel. Warte, bis der Zuschlag durch ist.';
  if (message.includes('auction_not_scheduled')) return 'Dieser Artikel läuft schon.';
  if (message.includes('auction_not_editable'))
    return 'Ändern geht nur, solange der Artikel wartet — läuft er schon, bleibt der Preis stehen.';
  if (message.includes('has_bids'))
    return 'Darauf wurde schon geboten — das nimmst du nicht mehr vom Tisch.';
  if (message.includes('invalid_title') || message.includes('title_check'))
    return 'Der Name braucht mindestens zwei Zeichen.';
  if (message.includes('buy_now_below_start'))
    return 'Der Sofortkaufpreis muss über dem Startpreis liegen.';
  if (message.includes('invalid_price')) return 'Startpreis und Schritt müssen über null liegen.';
  if (message.includes('forbidden')) return 'Das darf nur der Gastgeber der Show.';
  if (message.includes('PGRST202') || message.includes('does not exist'))
    return 'Die Auktions-Tabellen fehlen noch in der Datenbank. Migration einspielen.';
  return 'Hat nicht geklappt. Versuch es noch einmal.';
}

export function useStudioActions(sessionId: string | undefined) {
  const start = useStartAuction(sessionId);
  const cancel = useCancelAuction(sessionId);
  const create = useCreateAuction();
  const update = useUpdateAuction(sessionId);

  const startAuction = useCallback(
    (auctionId: string, seconds: number) => start.mutateAsync({ auctionId, seconds }),
    [start],
  );

  return {
    startAuction,
    cancelAuction: cancel.mutateAsync,
    createAuction: create.mutateAsync,
    updateAuction: update.mutateAsync,
  };
}
