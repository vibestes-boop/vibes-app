/**
 * lib/useStoryHighlights.ts — Highlight-System 2.0
 *
 * Nach SQL-Migration vollständig:
 *   • media_url direkt im Highlight gespeichert → überlebt Story-Ablauf
 *   • story_id ODER post_id (nullable)
 *   • archived-Flag in stories
 *
 * Vor Migration: Fallback auf 2-Query-Ansatz (rückwärtskompatibel)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

// Ein einzelnes Medium in einem Highlight (Story oder Post)
export type HighlightItem = {
  media_url: string;
  media_type: 'image' | 'video';
  thumbnail_url?: string | null;
};

export type StoryHighlight = {
  id: string;
  user_id: string;
  story_id: string | null;
  post_id: string | null;
  title: string;
  media_url: string;       // Cover (erstes Item)
  media_type: 'image' | 'video';
  thumbnail_url: string;   // Cover-Thumbnail
  items: HighlightItem[];  // Alle Items (inkl. Cover)
  created_at: string;
};

export type HighlightSource =
  | { type: 'story'; storyId: string | null; items: HighlightItem[]; title: string }
  | { type: 'post';  postId:  string;        items: HighlightItem[]; title: string };

// ── Alle Highlights eines Users ───────────────────────────────────────────────
export function useStoryHighlights(userId: string | null) {
  return useQuery<StoryHighlight[]>({
    queryKey: ['story-highlights', userId],
    queryFn: async () => {
      if (!userId) return [];

      // Schritt 1: Highlights laden (nur sichere Original-Spalten + neue wenn verfügbar)
      const { data: rows, error } = await supabase
        .from('story_highlights')
        .select('id, user_id, story_id, title, created_at, media_url, media_type, post_id, thumbnail_url, items')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        // Neue Spalten fehlen noch (Migration nicht ausgeführt) → Fallback
        if (
          error.code === 'PGRST204' ||
          error.message?.toLowerCase().includes('media_url') ||
          error.message?.toLowerCase().includes('post_id')
        ) {
          return fetchHighlightsLegacy(userId);
        }
        if (error.code === '42P01') return [];
        __DEV__ && console.warn('[useStoryHighlights]', error.message);
        return [];
      }

      const highlights = (rows ?? []) as any[];
      if (highlights.length === 0) return [];

      // Schritt 2: Für Highlights ohne direkte media_url → aus stories nachladen
      const missingMediaIds = highlights
        .filter((h) => !h.media_url && h.story_id)
        .map((h) => h.story_id) as string[];

      let fallbackMap: Record<string, { media_url: string; media_type: string }> = {};

      if (missingMediaIds.length > 0) {
        const { data: storiesData } = await supabase
          .from('stories')
          .select('id, media_url, media_type')
          .in('id', missingMediaIds);

        for (const s of storiesData ?? []) {
          if (s.id) fallbackMap[s.id] = { media_url: s.media_url ?? '', media_type: s.media_type ?? 'image' };
        }
      }

      return highlights.map((h) => {
        const fallback = h.story_id ? fallbackMap[h.story_id] : null;
        const coverUrl  = h.media_url  ?? fallback?.media_url  ?? '';
        const coverType = (h.media_type ?? fallback?.media_type ?? 'image') as 'image' | 'video';
        const coverThumb = h.thumbnail_url ?? '';
        // items: aus DB-JSONB oder Fallback-Cover als Single-Item
        const items: HighlightItem[] = Array.isArray(h.items) && h.items.length > 0
          ? h.items
          : [{ media_url: coverUrl, media_type: coverType, thumbnail_url: coverThumb }];
        return {
          id:            h.id,
          user_id:       h.user_id,
          story_id:      h.story_id ?? null,
          post_id:       h.post_id  ?? null,
          title:         h.title,
          media_url:     coverUrl,
          media_type:    coverType,
          thumbnail_url: coverThumb,
          items,
          created_at:    h.created_at,
        };
      });
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

// Fallback ohne neue Spalten (vor Migration)
async function fetchHighlightsLegacy(userId: string): Promise<StoryHighlight[]> {
  const { data: rows, error } = await supabase
    .from('story_highlights')
    .select('id, user_id, story_id, title, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !rows?.length) return [];

  const storyIds = rows.map((h: any) => h.story_id).filter(Boolean) as string[];
  let mediaMap: Record<string, { media_url: string; media_type: string }> = {};

  if (storyIds.length > 0) {
    const { data } = await supabase
      .from('stories')
      .select('id, media_url, media_type')
      .in('id', storyIds);
    for (const s of data ?? []) {
      if (s.id) mediaMap[s.id] = { media_url: s.media_url ?? '', media_type: s.media_type ?? 'image' };
    }
  }

  return rows.map((h: any) => ({
    id:            h.id,
    user_id:       h.user_id,
    story_id:      h.story_id ?? null,
    post_id:       null,
    title:         h.title,
    media_url:     mediaMap[h.story_id]?.media_url  ?? '',
    media_type:    (mediaMap[h.story_id]?.media_type ?? 'image') as 'image' | 'video',
    thumbnail_url: '',
    items:         [{ media_url: mediaMap[h.story_id]?.media_url ?? '', media_type: (mediaMap[h.story_id]?.media_type ?? 'image') as 'image' | 'video' }],
    created_at:    h.created_at,
  }));
}

// ── Eigene Stories für den Highlight-Picker (alle — aktive + archivierte) ─────
export function useMyStoryArchive() {
  const userId = useAuthStore((s) => s.profile?.id);

  return useQuery({
    queryKey: ['my-story-archive', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('stories')
        .select('id, media_url, media_type, thumbnail_url, created_at')
        .eq('user_id', userId)
        .not('media_url', 'is', null)
        .neq('media_url', '')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        if (error.code === '42P01') return [];
        __DEV__ && console.warn('[useMyStoryArchive]', error.message);
        return [];
      }
      return (data ?? []).filter((s: any) => !!s.media_url);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
}

// ── Eigene Posts für den Highlight-Picker ─────────────────────────────────────
export function useMyPostsForHighlight() {
  const userId = useAuthStore((s) => s.profile?.id);

  return useQuery({
    queryKey: ['my-posts-for-highlight', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('posts')
        .select('id, media_url, media_type, thumbnail_url, created_at')
        .eq('author_id', userId)
        .not('media_url', 'is', null)
        .neq('media_url', '')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        __DEV__ && console.warn('[useMyPostsForHighlight]', error.message);
        return [];
      }
      return (data ?? []).filter((p: any) => !!p.media_url);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
}

// ── Highlight hinzufügen (Story ODER Post) ────────────────────────────────────
export function useAddHighlight() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async (source: HighlightSource) => {
      if (!userId) throw new Error('Nicht eingeloggt');

      // Cover = erstes Item
      const cover = source.items[0];
      if (!cover) throw new Error('Mindestens ein Medium erforderlich');

      const baseRow = {
        user_id:       userId,
        story_id:      source.type === 'story' ? source.storyId : null,
        post_id:       source.type === 'post'  ? source.postId  : null,
        title:         source.title,
        // Cover-Felder (erstes Item)
        media_url:     cover.media_url,
        media_type:    cover.media_type,
        thumbnail_url: cover.thumbnail_url ?? null,
        // Alle Items als JSONB
        items: source.items.map(i => ({
          media_url:     i.media_url,
          media_type:    i.media_type,
          thumbnail_url: i.thumbnail_url ?? null,
        })),
      };

      const { error: errFull } = await supabase.from('story_highlights').insert(baseRow);

      if (!errFull) return;

      // Fallback: items-Spalte fehlt noch → ohne items speichern
      const isColumnMissing =
        errFull.code === 'PGRST204' ||
        errFull.code === '42703' ||
        errFull.message?.toLowerCase().includes('items');

      if (isColumnMissing) {
        const { error: errSimple } = await supabase.from('story_highlights').insert({
          ...baseRow,
          items: undefined,
        });
        if (errSimple && errSimple.code !== '23505') throw errSimple;
        return;
      }

      if (errFull.code !== '23505') throw errFull;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-highlights', userId] });
    },
  });
}

// ── Highlight entfernen ───────────────────────────────────────────────────────
export function useRemoveHighlight() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async (highlightId: string) => {
      const { error } = await supabase
        .from('story_highlights')
        .delete()
        .eq('id', highlightId)
        .eq('user_id', userId ?? '');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-highlights', userId] });
    },
  });
}
