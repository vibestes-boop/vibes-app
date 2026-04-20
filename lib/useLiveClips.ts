/**
 * lib/useLiveClips.ts
 *
 * v1.18.0 — Live-Clips: Marker-System.
 *
 * Während eines Live-Streams kann jeder authentifizierte User einen
 * „Clip-Marker" setzen — gespeichert wird Sekunden seit Stream-Start.
 * Nach dem Stream sieht der Host die Marker im Creator-Studio und kann
 * den Replay direkt an der Marker-Position öffnen.
 *
 * Hooks:
 *   useCreateClipMarker()                     → mutation: { sessionId, tsSecs, note? }
 *   useSessionClipMarkers(sessionId)          → Liste aller Marker (host-only via RLS)
 *   useSessionClipHotspots(sessionId)         → 15s-Aggregat für Hotness-Anzeige
 */

import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ClipMarker {
  id:        string;
  sessionId: string;
  userId:    string;
  tsSecs:    number;
  note:      string | null;
  createdAt: string;
}

export interface ClipHotspot {
  sessionId:    string;
  windowStart:  number;
  windowEnd:    number;
  markerCount:  number;
  userIds:      string[];
}

interface RawMarker {
  id:         string;
  session_id: string;
  user_id:    string;
  ts_secs:    number;
  note:       string | null;
  created_at: string;
}

interface RawHotspot {
  session_id:   string;
  window_start: number;
  window_end:   number;
  marker_count: number;
  user_ids:     string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Sekunden seit gegebenem Start-Timestamp (ISO String). Negativwerte → 0. */
export function secondsSinceStart(startedAtIso: string | null | undefined): number {
  if (!startedAtIso) return 0;
  const startMs = new Date(startedAtIso).getTime();
  if (Number.isNaN(startMs)) return 0;
  return Math.max(0, Math.floor((Date.now() - startMs) / 1000));
}

// ─── Marker erstellen ───────────────────────────────────────────────────────

/**
 * Marker-Setter mit eingebauter Rate-Limit-Behandlung (Unique-Index auf
 * session+user+ts_secs ⇒ doppelter Klick in derselben Sekunde wird stumm
 * geschluckt).
 */
export function useCreateClipMarker() {
  const userId = useAuthStore((s) => s.profile?.id);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ sessionId, tsSecs, note }: { sessionId: string; tsSecs: number; note?: string }) => {
      if (!userId) throw new Error('Nicht eingeloggt');
      const { error } = await supabase
        .from('live_clip_markers')
        .insert({
          session_id: sessionId,
          user_id:    userId,
          ts_secs:    Math.max(0, Math.floor(tsSecs)),
          note:       note?.trim() || null,
        });
      // Duplicate Key (gleicher User + gleiche Session + gleiche Sekunde) ignorieren
      if (error && !error.message.includes('duplicate')) throw error;
    },
    onSuccess: (_d, { sessionId }) => {
      qc.invalidateQueries({ queryKey: ['clip-markers', sessionId] });
      qc.invalidateQueries({ queryKey: ['clip-hotspots', sessionId] });
    },
  });

  return { createMarker: mutation.mutateAsync, isCreating: mutation.isPending };
}

// ─── Marker-Liste (host) ────────────────────────────────────────────────────

export function useSessionClipMarkers(sessionId: string | null | undefined, limit: number = 200) {
  return useQuery<ClipMarker[]>({
    queryKey:  ['clip-markers', sessionId, limit],
    enabled:   !!sessionId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!sessionId) return [];
      const { data, error } = await supabase
        .from('live_clip_markers')
        .select('*')
        .eq('session_id', sessionId)
        .order('ts_secs', { ascending: true })
        .limit(limit);
      if (error) {
        __DEV__ && console.warn('[useSessionClipMarkers] error:', error.message);
        return [];
      }
      return (data ?? []).map((r: RawMarker) => ({
        id:        r.id,
        sessionId: r.session_id,
        userId:    r.user_id,
        tsSecs:    r.ts_secs,
        note:      r.note,
        createdAt: r.created_at,
      }));
    },
  });
}

// ─── Hotspots (15s-Aggregat) ────────────────────────────────────────────────

export function useSessionClipHotspots(sessionId: string | null | undefined) {
  return useQuery<ClipHotspot[]>({
    queryKey:  ['clip-hotspots', sessionId],
    enabled:   !!sessionId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!sessionId) return [];
      const { data, error } = await supabase
        .from('live_clip_markers_hot')
        .select('*')
        .eq('session_id', sessionId)
        .order('marker_count', { ascending: false })
        .limit(20);
      if (error) {
        __DEV__ && console.warn('[useSessionClipHotspots] error:', error.message);
        return [];
      }
      return (data ?? []).map((r: RawHotspot) => ({
        sessionId:   r.session_id,
        windowStart: r.window_start,
        windowEnd:   r.window_end,
        markerCount: r.marker_count,
        userIds:     r.user_ids,
      }));
    },
  });
}

// ─── Convenience: Live-Clip-Setter mit auto-time ────────────────────────────

/**
 * Komfort-Hook: bekommt den Stream-Start als ISO und liefert eine
 * `clip()`-Funktion, die den aktuellen Stream-Offset selbst berechnet.
 */
export function useClipNow(sessionId: string | null | undefined, startedAtIso: string | null | undefined) {
  const { createMarker, isCreating } = useCreateClipMarker();

  const clip = useCallback(async () => {
    if (!sessionId) return;
    const tsSecs = secondsSinceStart(startedAtIso);
    await createMarker({ sessionId, tsSecs });
  }, [sessionId, startedAtIso, createMarker]);

  return { clip, isClipping: isCreating };
}

// ─── Aggregate für UI ───────────────────────────────────────────────────────

/** Top-3 Hotspots als kondensiertes Array für Replay-Timeline-Markierungen. */
export function useTopHotspots(sessionId: string | null | undefined, take: number = 3) {
  const { data: hotspots } = useSessionClipHotspots(sessionId);
  return useMemo(() => (hotspots ?? []).slice(0, take), [hotspots, take]);
}
