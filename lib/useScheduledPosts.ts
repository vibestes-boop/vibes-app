/**
 * useScheduledPosts.ts
 *
 * v1.20.0 — Creator-Studio Pro.
 *
 * DB-gestütztes Scheduling: Posts mit `publish_at` in der Zukunft werden
 * in `scheduled_posts` persistiert. Edge Function "publish-scheduled-posts"
 * läuft via pg_cron jede Minute und kopiert fällige Einträge in `posts`.
 *
 *   useScheduledPosts()
 *      → Liste + Create/Edit/Cancel. Realtime-Invalidation wenn der Cron
 *        einen Eintrag von 'pending' → 'published' umschaltet.
 */

import { useEffect, useMemo, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ScheduledPostStatus =
  | 'pending'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled';

export interface ScheduledPost {
  id:                string;
  authorId:          string;
  caption:           string | null;
  mediaUrl:          string | null;
  mediaType:         'image' | 'video' | null;
  thumbnailUrl:      string | null;
  tags:              string[];
  isGuildPost:       boolean;
  guildId:           string | null;
  audioUrl:          string | null;
  audioVolume:       number | null;
  privacy:           'public' | 'friends' | 'private';
  allowComments:     boolean;
  allowDownload:     boolean;
  allowDuet:         boolean;
  womenOnly:         boolean;
  coverTimeMs:       number | null;

  publishAt:         string; // ISO
  status:            ScheduledPostStatus;
  retries:           number;
  lastError:         string | null;
  publishedPostId:   string | null;

  createdAt:         string;
  updatedAt:         string;
}

interface RawScheduled {
  id:                 string;
  author_id:          string;
  caption:            string | null;
  media_url:          string | null;
  media_type:         'image' | 'video' | null;
  thumbnail_url:      string | null;
  tags:               string[] | null;
  is_guild_post:      boolean;
  guild_id:           string | null;
  audio_url:          string | null;
  audio_volume:       number | null;
  privacy:            'public' | 'friends' | 'private';
  allow_comments:     boolean;
  allow_download:     boolean;
  allow_duet:         boolean;
  women_only:         boolean;
  cover_time_ms:      number | null;
  publish_at:         string;
  status:             ScheduledPostStatus;
  retries:            number;
  last_error:         string | null;
  published_post_id:  string | null;
  created_at:         string;
  updated_at:         string;
}

function mapRow(r: RawScheduled): ScheduledPost {
  return {
    id:               r.id,
    authorId:         r.author_id,
    caption:          r.caption,
    mediaUrl:         r.media_url,
    mediaType:        r.media_type,
    thumbnailUrl:     r.thumbnail_url,
    tags:             r.tags ?? [],
    isGuildPost:      r.is_guild_post,
    guildId:          r.guild_id,
    audioUrl:         r.audio_url,
    audioVolume:      r.audio_volume,
    privacy:          r.privacy,
    allowComments:    r.allow_comments,
    allowDownload:    r.allow_download,
    allowDuet:        r.allow_duet,
    womenOnly:        r.women_only,
    coverTimeMs:      r.cover_time_ms,
    publishAt:        r.publish_at,
    status:           r.status,
    retries:          r.retries,
    lastError:        r.last_error,
    publishedPostId:  r.published_post_id,
    createdAt:        r.created_at,
    updatedAt:        r.updated_at,
  };
}

// ─── Schedule-Args (spiegelt den Insert-Payload aus app/create/index.tsx) ───

export interface SchedulePostArgs {
  publishAt:     Date;         // Lokales Date, wird als ISO gesendet
  caption?:      string | null;
  mediaUrl?:     string | null;
  mediaType?:    'image' | 'video' | null;
  thumbnailUrl?: string | null;
  tags?:         string[];
  isGuildPost?:  boolean;
  guildId?:      string | null;
  audioUrl?:     string | null;
  audioVolume?:  number | null;
  privacy?:      'public' | 'friends' | 'private';
  allowComments?: boolean;
  allowDownload?: boolean;
  allowDuet?:    boolean;
  womenOnly?:    boolean;
  coverTimeMs?:  number | null;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useScheduledPosts() {
  const profileId = useAuthStore((s) => s.profile?.id) ?? null;
  const qc = useQueryClient();

  // Eigene Liste: pending + failed (user muss failed sehen können!), max 50
  const listQuery = useQuery<ScheduledPost[]>({
    queryKey:  ['scheduled-posts', profileId],
    enabled:   !!profileId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from('scheduled_posts')
        .select('*')
        .eq('author_id', profileId)
        .in('status', ['pending', 'publishing', 'failed'])
        .order('publish_at', { ascending: true })
        .limit(50);
      if (error) {
        __DEV__ && console.warn('[useScheduledPosts] fetch:', error.message);
        return [];
      }
      return ((data ?? []) as RawScheduled[]).map(mapRow);
    },
  });

  // Realtime: wenn der Cron einen Eintrag auf 'published' dreht → Liste neu
  useEffect(() => {
    if (!profileId) return;
    const ch = supabase
      .channel(`scheduled-posts-${profileId}`)
      .on(
        'postgres_changes' as never,
        {
          event:  '*',
          schema: 'public',
          table:  'scheduled_posts',
          filter: `author_id=eq.${profileId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['scheduled-posts', profileId] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profileId, qc]);

  // ── Mutation: Post planen ────────────────────────────────────────────
  const scheduleMutation = useMutation({
    mutationFn: async (args: SchedulePostArgs) => {
      const { data, error } = await supabase.rpc('schedule_post', {
        p_publish_at:     args.publishAt.toISOString(),
        p_caption:        args.caption        ?? null,
        p_media_url:      args.mediaUrl       ?? null,
        p_media_type:     args.mediaType      ?? null,
        p_thumbnail_url:  args.thumbnailUrl   ?? null,
        p_tags:           args.tags           ?? [],
        p_is_guild_post:  args.isGuildPost    ?? false,
        p_guild_id:       args.guildId        ?? null,
        p_audio_url:      args.audioUrl       ?? null,
        p_audio_volume:   args.audioVolume    ?? null,
        p_privacy:        args.privacy        ?? 'public',
        p_allow_comments: args.allowComments  ?? true,
        p_allow_download: args.allowDownload  ?? false,
        p_allow_duet:     args.allowDuet      ?? true,
        p_women_only:     args.womenOnly      ?? false,
        p_cover_time_ms:  args.coverTimeMs    ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-posts', profileId] });
    },
  });

  // ── Mutation: Umplanen ───────────────────────────────────────────────
  const rescheduleMutation = useMutation({
    mutationFn: async (args: { id: string; newTime: Date }) => {
      const { error } = await supabase.rpc('reschedule_post', {
        p_id:       args.id,
        p_new_time: args.newTime.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-posts', profileId] });
    },
  });

  // ── Mutation: Abbrechen ──────────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('cancel_scheduled_post', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-posts', profileId] });
    },
  });

  // ── Derived ──────────────────────────────────────────────────────────
  const pending = useMemo(
    () => (listQuery.data ?? []).filter((p) => p.status === 'pending' || p.status === 'publishing'),
    [listQuery.data],
  );
  const failed = useMemo(
    () => (listQuery.data ?? []).filter((p) => p.status === 'failed'),
    [listQuery.data],
  );

  const nextUp = pending[0] ?? null;

  const schedulePost = useCallback(
    (args: SchedulePostArgs) => scheduleMutation.mutateAsync(args),
    [scheduleMutation],
  );
  const reschedulePost = useCallback(
    (id: string, newTime: Date) => rescheduleMutation.mutateAsync({ id, newTime }),
    [rescheduleMutation],
  );
  const cancelScheduledPost = useCallback(
    (id: string) => cancelMutation.mutateAsync(id),
    [cancelMutation],
  );

  return {
    list:       listQuery.data ?? [],
    pending,
    failed,
    nextUp,
    isLoading:  listQuery.isLoading,
    refetch:    listQuery.refetch,

    schedulePost,
    isScheduling:  scheduleMutation.isPending,
    scheduleError: scheduleMutation.error,

    reschedulePost,
    isRescheduling: rescheduleMutation.isPending,

    cancelScheduledPost,
    isCancelling: cancelMutation.isPending,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** "in 2h 13min" / "Morgen 14:30" / "Mo 09:00" */
export function scheduledPostLabel(isoPublishAt: string): string {
  const now   = Date.now();
  const then  = new Date(isoPublishAt).getTime();
  const diff  = Math.max(0, then - now);
  const mins  = Math.floor(diff / 60_000);

  if (mins < 60)                return `in ${mins} min`;
  if (mins < 24 * 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `in ${h}h` : `in ${h}h ${m}min`;
  }

  const d = new Date(isoPublishAt);
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
