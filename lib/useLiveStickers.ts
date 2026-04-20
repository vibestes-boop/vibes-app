/**
 * lib/useLiveStickers.ts
 *
 * v1.22.0 — Live-Stickers: Host platziert Emoji-Stickers frei im Stream.
 *
 * Hooks:
 *   useActiveStickers(sessionId) → { stickers, isLoading }
 *     • Listet alle aktiven (nicht-removed) Sticker der Session
 *     • Realtime: INSERT/UPDATE/DELETE auf live_stickers
 *
 *   useStickerActions(sessionId) → { addSticker, moveSticker, removeSticker }
 *     • Host-seitige Mutationen
 *
 * Positions-Pattern:
 *   • Live-Drag: Position wird via useLiveOverlayPosition broadcasted
 *     (EINE Message on-release, kein DB-Write pro Pixel)
 *   • Final-Commit: moveSticker() schreibt finale Position in DB
 *     (damit spät joining Viewer sie sehen und sie beim nächsten Reload
 *     dort wieder auftaucht)
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LiveSticker {
  id:         string;
  sessionId:  string;
  hostId:     string;
  emoji:      string;
  positionX:  number;
  positionY:  number;
  scale:      number;
  rotation:   number;
  createdAt:  string;
}

interface RawSticker {
  id:          string;
  session_id:  string;
  host_id:     string;
  emoji:       string;
  position_x:  number;
  position_y:  number;
  scale:       number;
  rotation:    number;
  created_at:  string;
  removed_at:  string | null;
}

function mapSticker(r: RawSticker): LiveSticker {
  return {
    id:        r.id,
    sessionId: r.session_id,
    hostId:    r.host_id,
    emoji:     r.emoji,
    positionX: r.position_x,
    positionY: r.position_y,
    scale:     r.scale,
    rotation:  r.rotation,
    createdAt: r.created_at,
  };
}

// ─── Active-Stickers Query + Realtime ───────────────────────────────────────

export function useActiveStickers(sessionId: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery<LiveSticker[]>({
    queryKey:  ['live-stickers', sessionId],
    enabled:   !!sessionId,
    staleTime: 10_000,
    queryFn: async () => {
      if (!sessionId) return [];
      const { data, error } = await supabase
        .from('live_stickers')
        .select('*')
        .eq('session_id', sessionId)
        .is('removed_at', null)
        .order('created_at', { ascending: true });
      if (error) {
        __DEV__ && console.warn('[useActiveStickers]', error.message);
        return [];
      }
      return (data ?? []).map((r) => mapSticker(r as RawSticker));
    },
  });

  // Realtime für Sticker-Events
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`live-stickers-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_stickers', filter: `session_id=eq.${sessionId}` },
        () => {
          qc.invalidateQueries({ queryKey: ['live-stickers', sessionId] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, qc]);

  return {
    stickers:  query.data ?? [],
    isLoading: query.isLoading,
  };
}

// ─── Host-seitige Mutationen ────────────────────────────────────────────────

export function useStickerActions(sessionId: string | null | undefined) {
  const userId = useAuthStore((s) => s.profile?.id);
  const qc = useQueryClient();

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['live-stickers', sessionId] });
  }, [qc, sessionId]);

  // ── addSticker ─────────────────────────────────────────────────────────
  const addMut = useMutation({
    mutationFn: async ({
      emoji, positionX, positionY,
    }: { emoji: string; positionX?: number; positionY?: number }) => {
      if (!userId || !sessionId) throw new Error('Nicht eingeloggt oder keine Session');
      const { data, error } = await supabase
        .from('live_stickers')
        .insert({
          session_id: sessionId,
          host_id:    userId,
          emoji,
          position_x: positionX ?? 40,
          position_y: positionY ?? 180,
        })
        .select('*')
        .single();
      if (error) throw error;
      return mapSticker(data as RawSticker);
    },
    onSuccess: invalidate,
  });

  // ── moveSticker ────────────────────────────────────────────────────────
  const moveMut = useMutation({
    mutationFn: async ({
      id, positionX, positionY,
    }: { id: string; positionX: number; positionY: number }) => {
      const { error } = await supabase
        .from('live_stickers')
        .update({ position_x: positionX, position_y: positionY })
        .eq('id', id);
      if (error) throw error;
    },
    // Optimistic: Position im Cache sofort ändern
    onMutate: async ({ id, positionX, positionY }) => {
      await qc.cancelQueries({ queryKey: ['live-stickers', sessionId] });
      const prev = qc.getQueryData<LiveSticker[]>(['live-stickers', sessionId]);
      if (prev) {
        qc.setQueryData<LiveSticker[]>(
          ['live-stickers', sessionId],
          prev.map((s) => (s.id === id ? { ...s, positionX, positionY } : s)),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['live-stickers', sessionId], ctx.prev);
    },
  });

  // ── removeSticker (Soft-Delete) ────────────────────────────────────────
  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('live_stickers')
        .update({ removed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['live-stickers', sessionId] });
      const prev = qc.getQueryData<LiveSticker[]>(['live-stickers', sessionId]);
      if (prev) {
        qc.setQueryData<LiveSticker[]>(
          ['live-stickers', sessionId],
          prev.filter((s) => s.id !== id),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['live-stickers', sessionId], ctx.prev);
    },
    onSettled: invalidate,
  });

  return useMemo(() => ({
    addSticker:    addMut.mutateAsync,
    moveSticker:   moveMut.mutateAsync,
    removeSticker: removeMut.mutateAsync,
    isAdding:      addMut.isPending,
    isMoving:      moveMut.isPending,
    isRemoving:    removeMut.isPending,
  }), [addMut, moveMut, removeMut]);
}

// ─── Curated Emoji-Katalog ──────────────────────────────────────────────────
// TikTok-typisch: Hearts, Fire, Reactions, Symbole.

export const STICKER_CATALOG: { category: string; emojis: string[] }[] = [
  {
    category: 'Emotion',
    emojis: ['❤️', '🔥', '💯', '🥰', '😍', '🤩', '😎', '😂', '🤣', '😭', '🥺', '😱'],
  },
  {
    category: 'Reaktion',
    emojis: ['👀', '👍', '👎', '🙌', '👏', '🙏', '💪', '🤝', '🤘', '✌️', '🤞', '👋'],
  },
  {
    category: 'Symbole',
    emojis: ['⭐', '✨', '💫', '🌟', '💎', '🎉', '🎊', '🏆', '👑', '💰', '💸', '🚀'],
  },
  {
    category: 'Spaß',
    emojis: ['🎵', '🎶', '🎧', '🎤', '🎬', '🎮', '🍕', '🍔', '☕', '🍻', '🌹', '🌈'],
  },
];
