/**
 * useScheduledLives.ts
 *
 * v1.26.0 — Scheduled Lives.
 *
 * DB-gestütztes Scheduling für Live-Streams: User kündigt einen Live-Stream
 * im Voraus an, `scheduled_lives` persistiert das Event, Edge Function
 * "scheduled-lives-cron" läuft alle 5 min und schickt 15 min vor go-live
 * einen Push-Reminder an alle Follower.
 *
 *   useScheduledLives(hostId?)
 *      → Liste (eigene oder fremde) + Create/Edit/Cancel. Realtime-
 *        Invalidation wenn der Cron einen Eintrag von 'scheduled' →
 *        'reminded' oder der Host von 'reminded' → 'live' dreht.
 *
 *   useUpcomingLives(limit)
 *      → Public Discovery: alle scheduled/reminded lives unabhängig von
 *        Host. Wird in Feed / Explore als "Coming up" Karten benutzt.
 */

import { useEffect, useMemo, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ScheduledLiveStatus =
  | 'scheduled'
  | 'reminded'
  | 'live'
  | 'expired'
  | 'cancelled';

export interface ScheduledLive {
  id:              string;
  hostId:          string;
  hostUsername:    string | null;
  hostAvatarUrl:   string | null;

  title:           string;
  description:     string | null;
  scheduledAt:     string; // ISO
  status:          ScheduledLiveStatus;

  allowComments:   boolean;
  allowGifts:      boolean;
  womenOnly:       boolean;

  sessionId:       string | null;  // gesetzt sobald Host live ist
  remindedAt:      string | null;  // gesetzt sobald Cron Fanout gemacht hat

  createdAt:       string;
  updatedAt:       string;
}

interface RawScheduledLive {
  id:             string;
  host_id:        string;
  title:          string;
  description:    string | null;
  scheduled_at:   string;
  status:         ScheduledLiveStatus;
  allow_comments: boolean;
  allow_gifts:    boolean;
  women_only:     boolean;
  session_id:     string | null;
  reminded_at:    string | null;
  created_at:     string;
  updated_at:     string;
  // PostgREST joins profiles!host_id (FK-Disambig wichtig!)
  profiles?: {
    username:   string | null;
    avatar_url: string | null;
  } | null;
}

function mapRow(r: RawScheduledLive): ScheduledLive {
  return {
    id:            r.id,
    hostId:        r.host_id,
    hostUsername:  r.profiles?.username   ?? null,
    hostAvatarUrl: r.profiles?.avatar_url ?? null,
    title:         r.title,
    description:   r.description,
    scheduledAt:   r.scheduled_at,
    status:        r.status,
    allowComments: r.allow_comments,
    allowGifts:    r.allow_gifts,
    womenOnly:     r.women_only,
    sessionId:     r.session_id,
    remindedAt:    r.reminded_at,
    createdAt:     r.created_at,
    updatedAt:     r.updated_at,
  };
}

// ─── Schedule-Args ──────────────────────────────────────────────────────────

export interface ScheduleLiveArgs {
  scheduledAt:    Date;
  title:          string;
  description?:   string | null;
  allowComments?: boolean;
  allowGifts?:    boolean;
  womenOnly?:     boolean;
}

// ─── Hook: eigene Scheduled-Lives ───────────────────────────────────────────

export function useScheduledLives(hostId?: string | null) {
  const profileId = useAuthStore((s) => s.profile?.id) ?? null;
  const qc = useQueryClient();

  const targetId = hostId ?? profileId;
  const isOwn    = targetId === profileId;

  // Liste: wenn eigene → alle Statuses (inkl. expired/cancelled für History);
  //        wenn fremde → nur sichtbare (scheduled/reminded/live — matches RLS)
  const listQuery = useQuery<ScheduledLive[]>({
    queryKey:  ['scheduled-lives', targetId, isOwn ? 'own' : 'public'],
    enabled:   !!targetId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!targetId) return [];

      // FK-Disambig: profiles!host_id explizit (es gibt keinen zweiten FK,
      // aber Konvention für Konsistenz mit live_sessions-Pattern)
      let query = supabase
        .from('scheduled_lives')
        .select('*, profiles!host_id(username, avatar_url)')
        .eq('host_id', targetId)
        .order('scheduled_at', { ascending: true })
        .limit(50);

      if (!isOwn) {
        query = query.in('status', ['scheduled', 'reminded', 'live']);
      }

      const { data, error } = await query;
      if (error) {
        __DEV__ && console.warn('[useScheduledLives] fetch:', error.message);
        return [];
      }
      return ((data ?? []) as RawScheduledLive[]).map(mapRow);
    },
  });

  // Realtime: reagiere auf Cron-Umschaltungen (scheduled → reminded, …)
  useEffect(() => {
    if (!targetId) return;
    const ch = supabase
      .channel(`scheduled-lives-${targetId}`)
      .on(
        'postgres_changes' as never,
        {
          event:  '*',
          schema: 'public',
          table:  'scheduled_lives',
          filter: `host_id=eq.${targetId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['scheduled-lives', targetId] });
          qc.invalidateQueries({ queryKey: ['upcoming-lives'] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [targetId, qc]);

  // ── Mutation: Live planen ───────────────────────────────────────────
  const scheduleMutation = useMutation({
    mutationFn: async (args: ScheduleLiveArgs) => {
      const { data, error } = await supabase.rpc('schedule_live', {
        p_scheduled_at:   args.scheduledAt.toISOString(),
        p_title:          args.title,
        p_description:    args.description    ?? null,
        p_allow_comments: args.allowComments  ?? true,
        p_allow_gifts:    args.allowGifts     ?? true,
        p_women_only:     args.womenOnly      ?? false,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-lives', profileId] });
      qc.invalidateQueries({ queryKey: ['upcoming-lives'] });
    },
  });

  // ── Mutation: Umplanen ──────────────────────────────────────────────
  const rescheduleMutation = useMutation({
    mutationFn: async (args: { id: string; newTime: Date }) => {
      const { error } = await supabase.rpc('reschedule_live', {
        p_id:       args.id,
        p_new_time: args.newTime.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-lives', profileId] });
      qc.invalidateQueries({ queryKey: ['upcoming-lives'] });
    },
  });

  // ── Mutation: Abbrechen ─────────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('cancel_scheduled_live', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-lives', profileId] });
      qc.invalidateQueries({ queryKey: ['upcoming-lives'] });
    },
  });

  // ── Derived ─────────────────────────────────────────────────────────
  const upcoming = useMemo(
    () => (listQuery.data ?? []).filter(
      (l) => l.status === 'scheduled' || l.status === 'reminded',
    ),
    [listQuery.data],
  );
  const liveNow = useMemo(
    () => (listQuery.data ?? []).filter((l) => l.status === 'live'),
    [listQuery.data],
  );
  const past = useMemo(
    () => (listQuery.data ?? []).filter(
      (l) => l.status === 'expired' || l.status === 'cancelled',
    ),
    [listQuery.data],
  );

  const nextUp = upcoming[0] ?? null;

  const scheduleLive = useCallback(
    (args: ScheduleLiveArgs) => scheduleMutation.mutateAsync(args),
    [scheduleMutation],
  );
  const rescheduleLive = useCallback(
    (id: string, newTime: Date) => rescheduleMutation.mutateAsync({ id, newTime }),
    [rescheduleMutation],
  );
  const cancelScheduledLive = useCallback(
    (id: string) => cancelMutation.mutateAsync(id),
    [cancelMutation],
  );

  return {
    list:      listQuery.data ?? [],
    upcoming,
    liveNow,
    past,
    nextUp,
    isLoading: listQuery.isLoading,
    refetch:   listQuery.refetch,

    scheduleLive,
    isScheduling:  scheduleMutation.isPending,
    scheduleError: scheduleMutation.error,

    rescheduleLive,
    isRescheduling: rescheduleMutation.isPending,

    cancelScheduledLive,
    isCancelling: cancelMutation.isPending,
  };
}

// ─── Hook: public Discovery — alle kommenden Lives ──────────────────────────

export function useUpcomingLives(limit = 20) {
  return useQuery<ScheduledLive[]>({
    queryKey:  ['upcoming-lives', limit],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_lives')
        .select('*, profiles!host_id(username, avatar_url)')
        .in('status', ['scheduled', 'reminded'])
        .gt('scheduled_at', new Date(Date.now() - 10 * 60_000).toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(limit);

      if (error) {
        __DEV__ && console.warn('[useUpcomingLives] fetch:', error.message);
        return [];
      }
      return ((data ?? []) as RawScheduledLive[]).map(mapRow);
    },
  });
}

// ─── Helper: Link beim Go-Live mit Scheduled-Eintrag ────────────────────────

/**
 * Wird von useLiveHost().startSession() aufgerufen wenn User aus einem
 * Scheduled-Live Deep-Link kommt — markiert den scheduled_live-Eintrag als
 * 'live' und speichert die live_session.id. Dadurch bekommen Follower bei
 * Tap auf Push-Reminder den richtigen Stream.
 */
export async function linkLiveSessionToScheduled(
  scheduledLiveId: string,
  sessionId: string,
): Promise<void> {
  const { error } = await supabase.rpc('link_live_session_to_scheduled', {
    p_scheduled_live_id: scheduledLiveId,
    p_session_id:        sessionId,
  });
  if (error) throw error;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** "in 2h 13min" / "Morgen 14:30" / "Mo 09:00" */
export function scheduledLiveLabel(isoScheduledAt: string): string {
  const now   = Date.now();
  const then  = new Date(isoScheduledAt).getTime();
  const diff  = Math.max(0, then - now);
  const mins  = Math.floor(diff / 60_000);

  if (mins < 1)                 return 'jetzt';
  if (mins < 60)                return `in ${mins} min`;
  if (mins < 24 * 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `in ${h}h` : `in ${h}h ${m}min`;
  }

  const d = new Date(isoScheduledAt);
  const weekday = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()];
  const hh      = String(d.getHours()).padStart(2, '0');
  const mm      = String(d.getMinutes()).padStart(2, '0');

  const sameDay = new Date().toDateString() === d.toDateString();
  const tomorrow = (() => {
    const t = new Date(); t.setDate(t.getDate() + 1);
    return t.toDateString() === d.toDateString();
  })();

  if (sameDay)  return `Heute ${hh}:${mm}`;
  if (tomorrow) return `Morgen ${hh}:${mm}`;
  return `${weekday} ${hh}:${mm}`;
}
