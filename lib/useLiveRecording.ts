/**
 * lib/useLiveRecording.ts
 *
 * v1.18.0 — Live-Replay / VOD.
 *
 * Drei Rollen, drei Hook-Familien:
 *   • Host:    useToggleRecording(sessionId, roomName)        → start/stop via Edge
 *   • Viewer:  useReplayForSession(sessionId)                 → bereit gewordene Aufnahme abspielen
 *   • Creator: useHostRecordings(hostId, limit)               → Creator-Studio Liste
 *
 * Dazu: useRecordingStatus(sessionId) — Realtime-Status während des Streams
 * (für Host-UI, um „● Rec" Badge anzuzeigen).
 */

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

// ─── Types ──────────────────────────────────────────────────────────────────

export type RecordingStatus =
  | 'pending'     // Zeile angelegt, Egress noch nicht gestartet
  | 'recording'   // Egress läuft
  | 'processing'  // Stream beendet, LiveKit verarbeitet noch
  | 'ready'       // Datei liegt in Storage, abspielbar
  | 'failed';

export interface LiveRecording {
  id:               string;
  sessionId:        string;
  hostId:           string;
  egressId:         string | null;
  status:           RecordingStatus;
  errorMessage:     string | null;
  fileUrl:          string | null;
  filePath:         string | null;
  fileSizeBytes:    number | null;
  durationSecs:     number | null;
  thumbnailUrl:     string | null;
  isPublic:         boolean;
  viewCount:        number;
  startedAt:        string;
  finishedAt:       string | null;
  createdAt:        string;
}

interface RawRecording {
  id:               string;
  session_id:       string;
  host_id:          string;
  egress_id:        string | null;
  status:           RecordingStatus;
  error_message:    string | null;
  file_url:         string | null;
  file_path:        string | null;
  file_size_bytes:  number | null;
  duration_secs:    number | null;
  thumbnail_url:    string | null;
  is_public:        boolean;
  view_count:       number;
  started_at:       string;
  finished_at:      string | null;
  created_at:       string;
}

function mapRecording(r: RawRecording): LiveRecording {
  return {
    id:            r.id,
    sessionId:     r.session_id,
    hostId:        r.host_id,
    egressId:      r.egress_id,
    status:        r.status,
    errorMessage:  r.error_message,
    fileUrl:       r.file_url,
    filePath:      r.file_path,
    fileSizeBytes: r.file_size_bytes,
    durationSecs:  r.duration_secs,
    thumbnailUrl:  r.thumbnail_url,
    isPublic:      r.is_public,
    viewCount:     r.view_count,
    startedAt:     r.started_at,
    finishedAt:    r.finished_at,
    createdAt:     r.created_at,
  };
}

// ─── Host: Recording toggeln ────────────────────────────────────────────────

/**
 * Host-Hook: Recording manuell starten/stoppen. Wird aus `app/live/host.tsx`
 * via Record-Button aufgerufen. Stop wird zusätzlich automatisch in
 * endSession() getriggert, aber das ist Aufgabe von useLiveHost.
 */
export function useToggleRecording() {
  const qc = useQueryClient();

  const startMutation = useMutation({
    mutationFn: async ({ sessionId, roomName }: { sessionId: string; roomName: string }) => {
      const { data, error } = await supabase.functions.invoke('livekit-egress', {
        body: { action: 'start', sessionId, roomName },
      });
      if (error) throw error;
      return data as { recording_id: string | null; egress_id: string | null; status: string };
    },
    onSuccess: (_d, { sessionId }) => {
      qc.invalidateQueries({ queryKey: ['live-recording', sessionId] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      const { data, error } = await supabase.functions.invoke('livekit-egress', {
        body: { action: 'stop', sessionId },
      });
      if (error) throw error;
      return data as { status: string };
    },
    onSuccess: (_d, { sessionId }) => {
      qc.invalidateQueries({ queryKey: ['live-recording', sessionId] });
    },
  });

  return {
    startRecording: startMutation.mutateAsync,
    stopRecording:  stopMutation.mutateAsync,
    isStarting:     startMutation.isPending,
    isStopping:     stopMutation.isPending,
    error:          startMutation.error ?? stopMutation.error,
  };
}

// ─── Host: Status während Live-Stream ───────────────────────────────────────

/**
 * Liest den aktuellen Recording-Status einer Session (nur für Host sinnvoll —
 * Viewer sehen das nicht). Polls via TanStack + Realtime.
 */
export function useRecordingStatus(sessionId: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery<LiveRecording | null>({
    queryKey:  ['live-recording', sessionId],
    enabled:   !!sessionId,
    staleTime: 5_000,
    queryFn: async () => {
      if (!sessionId) return null;
      const { data, error } = await supabase
        .from('live_recordings')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();
      if (error) {
        __DEV__ && console.warn('[useRecordingStatus] error:', error.message);
        return null;
      }
      return data ? mapRecording(data as RawRecording) : null;
    },
  });

  // Realtime: Status-Änderungen sofort übernehmen
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase
      .channel(`live-recording-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_recordings', filter: `session_id=eq.${sessionId}` },
        () => {
          qc.invalidateQueries({ queryKey: ['live-recording', sessionId] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, qc]);

  return { recording: query.data ?? null, isLoading: query.isLoading };
}

// ─── Viewer: Einzelnes Replay zu einer Session ──────────────────────────────

/**
 * Liefert das (öffentliche) Replay einer Session, falls `ready`.
 * Wird im Creator-Studio / Replay-Screen verwendet.
 */
export function useReplayForSession(sessionId: string | null | undefined) {
  return useQuery<LiveRecording | null>({
    queryKey:  ['live-replay-session', sessionId],
    enabled:   !!sessionId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!sessionId) return null;
      const { data, error } = await supabase
        .from('live_recordings')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();
      if (error) {
        __DEV__ && console.warn('[useReplayForSession] error:', error.message);
        return null;
      }
      return data ? mapRecording(data as RawRecording) : null;
    },
  });
}

/** Einzelnes Replay per Recording-ID — für den Replay-Screen. */
export function useReplay(recordingId: string | null | undefined) {
  return useQuery<LiveRecording | null>({
    queryKey:  ['live-replay', recordingId],
    enabled:   !!recordingId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!recordingId) return null;
      const { data, error } = await supabase
        .from('live_recordings')
        .select('*')
        .eq('id', recordingId)
        .maybeSingle();
      if (error) {
        __DEV__ && console.warn('[useReplay] error:', error.message);
        return null;
      }
      return data ? mapRecording(data as RawRecording) : null;
    },
  });
}

// ─── Creator: Liste eigener Replays ─────────────────────────────────────────

/**
 * Holt die letzten Recordings eines Hosts (default 30).
 * Host sieht auch processing/failed, andere nur ready+public via RLS.
 */
export function useHostRecordings(hostId: string | null | undefined, limit: number = 30) {
  return useQuery<LiveRecording[]>({
    queryKey:  ['host-recordings', hostId, limit],
    enabled:   !!hostId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!hostId) return [];
      const { data, error } = await supabase
        .from('live_recordings')
        .select('*')
        .eq('host_id', hostId)
        .order('started_at', { ascending: false })
        .limit(limit);
      if (error) {
        __DEV__ && console.warn('[useHostRecordings] error:', error.message);
        return [];
      }
      return (data ?? []).map((r) => mapRecording(r as RawRecording));
    },
  });
}

// ─── View-Count Increment ───────────────────────────────────────────────────

/** Beim Öffnen eines Replays einmalig aufrufen. Fehler werden geschluckt. */
export async function incrementReplayViews(recordingId: string) {
  const { error } = await supabase.rpc('increment_live_recording_views', {
    p_recording_id: recordingId,
  });
  if (error) __DEV__ && console.warn('[incrementReplayViews]', error.message);
}

// ─── Host: Replay löschen ───────────────────────────────────────────────────

export function useDeleteRecording() {
  const userId = useAuthStore((s) => s.profile?.id);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (recordingId: string) => {
      if (!userId) throw new Error('Nicht eingeloggt');
      // DB-Zeile löschen — RLS stellt Host-Only sicher
      const { error } = await supabase
        .from('live_recordings')
        .delete()
        .eq('id', recordingId)
        .eq('host_id', userId);
      if (error) throw error;
      // Anmerkung: Storage-Objekt bleibt zurück (Cleanup-Job empfohlen)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['host-recordings'] });
      qc.invalidateQueries({ queryKey: ['live-replay'] });
      qc.invalidateQueries({ queryKey: ['live-replay-session'] });
    },
  });

  return { deleteRecording: mutation.mutateAsync, isDeleting: mutation.isPending };
}

// ─── Host: Sichtbarkeit toggeln ─────────────────────────────────────────────

export function useToggleRecordingPublic() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ recordingId, isPublic }: { recordingId: string; isPublic: boolean }) => {
      const { error } = await supabase
        .from('live_recordings')
        .update({ is_public: isPublic })
        .eq('id', recordingId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['host-recordings'] });
      qc.invalidateQueries({ queryKey: ['live-replay'] });
    },
  });

  return { setPublic: mutation.mutateAsync, isUpdating: mutation.isPending };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Recording ist abspielbar? */
export function isReplayPlayable(rec: LiveRecording | null | undefined): boolean {
  return !!rec && rec.status === 'ready' && !!rec.fileUrl;
}

/** Human-readable Status für UI-Chips. */
export function recordingStatusLabel(status: RecordingStatus): string {
  switch (status) {
    case 'pending':    return 'Wartet…';
    case 'recording':  return 'Läuft';
    case 'processing': return 'Wird verarbeitet';
    case 'ready':      return 'Bereit';
    case 'failed':     return 'Fehlgeschlagen';
  }
}
