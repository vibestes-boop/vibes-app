/**
 * usePostDraftsCloud.ts
 *
 * v1.20.0 — Creator-Studio Pro.
 *
 * Cloud-synchronisierte Post-Entwürfe (ergänzt das bestehende lokale
 * `useDrafts.ts` auf AsyncStorage).
 *
 *   • Media wird via uploadPostMedia() direkt nach R2 geladen — dieselbe
 *     URL kann beim späteren Publish wiederverwendet werden (kein Re-Upload).
 *   • Metadaten (caption, tags, settings) liegen in `post_drafts` in Postgres
 *     mit RLS-Isolation pro User.
 *   • Cross-Device: User kann auf Phone anfangen, auf Tablet weiterschreiben.
 */

import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CloudDraftSettings {
  privacy?:        'public' | 'friends' | 'private';
  allowComments?:  boolean;
  allowDownload?:  boolean;
  allowDuet?:      boolean;
  womenOnly?:      boolean;
  audioUrl?:       string | null;
  audioVolume?:    number | null;
  coverTimeMs?:    number | null;
  isGuildPost?:    boolean;
  guildId?:        string | null;
}

export interface CloudDraft {
  id:           string;
  authorId:     string;
  caption:      string | null;
  tags:         string[];
  mediaType:    'image' | 'video' | null;
  mediaUrl:     string | null;
  thumbnailUrl: string | null;
  settings:     CloudDraftSettings;
  createdAt:    string;
  updatedAt:    string;
}

interface RawDraft {
  id:             string;
  author_id:      string;
  caption:        string | null;
  tags:           string[] | null;
  media_type:     'image' | 'video' | null;
  media_url:      string | null;
  thumbnail_url:  string | null;
  settings:       CloudDraftSettings | null;
  created_at:     string;
  updated_at:     string;
}

function mapDraft(r: RawDraft): CloudDraft {
  return {
    id:           r.id,
    authorId:     r.author_id,
    caption:      r.caption,
    tags:         r.tags ?? [],
    mediaType:    r.media_type,
    mediaUrl:     r.media_url,
    thumbnailUrl: r.thumbnail_url,
    settings:     r.settings ?? {},
    createdAt:    r.created_at,
    updatedAt:    r.updated_at,
  };
}

// ─── Save-Args ──────────────────────────────────────────────────────────────

export interface SaveDraftArgs {
  /** Wenn gesetzt → Update. Sonst Neu-Anlage. */
  id?:           string;
  caption?:      string | null;
  tags?:         string[];
  mediaType?:    'image' | 'video' | null;
  mediaUrl?:     string | null;
  thumbnailUrl?: string | null;
  settings?:     CloudDraftSettings;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function usePostDraftsCloud() {
  const profileId = useAuthStore((s) => s.profile?.id) ?? null;
  const qc = useQueryClient();

  const listQuery = useQuery<CloudDraft[]>({
    queryKey:  ['post-drafts', profileId],
    enabled:   !!profileId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from('post_drafts')
        .select('*')
        .eq('author_id', profileId)
        .order('updated_at', { ascending: false })
        .limit(50);
      if (error) {
        __DEV__ && console.warn('[usePostDraftsCloud] fetch:', error.message);
        return [];
      }
      return ((data ?? []) as RawDraft[]).map(mapDraft);
    },
  });

  // Realtime: wenn ein anderes Device einen Draft anlegt/updated
  useEffect(() => {
    if (!profileId) return;
    const ch = supabase
      .channel(`post-drafts-${profileId}`)
      .on(
        'postgres_changes' as never,
        {
          event:  '*',
          schema: 'public',
          table:  'post_drafts',
          filter: `author_id=eq.${profileId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['post-drafts', profileId] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profileId, qc]);

  // ── Mutation: Draft speichern (insert oder update) ───────────────────
  const saveMutation = useMutation({
    mutationFn: async (args: SaveDraftArgs) => {
      const { data, error } = await supabase.rpc('upsert_post_draft', {
        p_id:            args.id              ?? null,
        p_caption:       args.caption         ?? null,
        p_tags:          args.tags            ?? [],
        p_media_type:    args.mediaType       ?? null,
        p_media_url:     args.mediaUrl        ?? null,
        p_thumbnail_url: args.thumbnailUrl    ?? null,
        p_settings:      args.settings        ?? {},
      });
      if (error) throw error;
      return data as string; // draft id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post-drafts', profileId] });
    },
  });

  // ── Mutation: Draft löschen ──────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_post_draft', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post-drafts', profileId] });
    },
  });

  const saveDraft = useCallback(
    (args: SaveDraftArgs) => saveMutation.mutateAsync(args),
    [saveMutation],
  );
  const deleteDraft = useCallback(
    (id: string) => deleteMutation.mutateAsync(id),
    [deleteMutation],
  );

  /** Draft einzeln laden (für Resume-Editing via ?draftId=…) */
  const fetchDraft = useCallback(
    async (id: string): Promise<CloudDraft | null> => {
      const { data, error } = await supabase
        .from('post_drafts')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) return null;
      return mapDraft(data as RawDraft);
    },
    [],
  );

  return {
    drafts:      listQuery.data ?? [],
    isLoading:   listQuery.isLoading,
    refetch:     listQuery.refetch,

    saveDraft,
    isSaving:    saveMutation.isPending,
    saveError:   saveMutation.error,

    deleteDraft,
    isDeleting:  deleteMutation.isPending,

    fetchDraft,
  };
}
