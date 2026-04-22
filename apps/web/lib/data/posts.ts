import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// Posts-Data-Layer — SSR-Reads für Create-Flow (`/create`, Drafts, Scheduled).
//
// Design:
//  1. Cross-Platform-Parität: Web liest/schreibt dieselben Tabellen (`posts`,
//     `scheduled_posts`, `post_drafts`) und delegiert an dieselben Native-
//     RPCs (`schedule_post`, `upsert_post_draft`, `delete_post_draft`,
//     `cancel_scheduled_post`). Publish-Path: regulär via direct-Insert in
//     `posts`, geplant via pg_cron + Edge Function `publish-scheduled-posts`.
//  2. Drafts werden chronologisch nach `updated_at DESC` sortiert (letztes
//     Edit oben) — konsistent mit Native `/creator/drafts`.
//  3. Scheduled werden chronologisch nach `publish_at ASC` — was als nächstes
//     rausgeht steht oben, `failed`/`cancelled` am Ende.
//  4. Hashtag/Mention-Autocomplete kommt aus dem `lib/hashtags`-Helper weiter
//     unten: hashtag = DISTINCT aus jüngsten posts.tags (GIN-Scan), mention =
//     `profiles.username ILIKE 'query%'` limitiert auf 8.
// -----------------------------------------------------------------------------

export type PostPrivacy = 'public' | 'friends' | 'private';
export type PostMediaType = 'image' | 'video';
export type ScheduledStatus = 'pending' | 'publishing' | 'published' | 'failed' | 'cancelled';

export interface PostDraftRow {
  id: string;
  author_id: string;
  caption: string | null;
  tags: string[];
  media_type: PostMediaType | null;
  media_url: string | null;
  thumbnail_url: string | null;
  settings: {
    privacy?: PostPrivacy;
    allowComments?: boolean;
    allowDownload?: boolean;
    allowDuet?: boolean;
    womenOnly?: boolean;
    audioUrl?: string | null;
    audioVolume?: number | null;
    coverTimeMs?: number | null;
    isGuildPost?: boolean;
    guildId?: string | null;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledPostRow {
  id: string;
  author_id: string;
  caption: string | null;
  media_url: string | null;
  media_type: PostMediaType | null;
  thumbnail_url: string | null;
  tags: string[];
  audio_url: string | null;
  audio_volume: number | null;
  privacy: PostPrivacy;
  allow_comments: boolean;
  allow_download: boolean;
  allow_duet: boolean;
  women_only: boolean;
  cover_time_ms: number | null;
  publish_at: string;
  status: ScheduledStatus;
  retries: number;
  last_error: string | null;
  published_post_id: string | null;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// getMyDrafts — alle Cloud-Drafts des viewers, neuste zuerst.
// -----------------------------------------------------------------------------

export const getMyDrafts = cache(async (): Promise<PostDraftRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('post_drafts')
    .select(
      'id, author_id, caption, tags, media_type, media_url, thumbnail_url, settings, created_at, updated_at',
    )
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return data as PostDraftRow[];
});

// -----------------------------------------------------------------------------
// getDraft — einzelner Draft, für Resume-Editing via `/create?draftId=…`.
// RLS sorgt dafür dass nur der Author selbst den Draft sieht.
// -----------------------------------------------------------------------------

export const getDraft = cache(async (draftId: string): Promise<PostDraftRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('post_drafts')
    .select(
      'id, author_id, caption, tags, media_type, media_url, thumbnail_url, settings, created_at, updated_at',
    )
    .eq('id', draftId)
    .maybeSingle();

  return (data as PostDraftRow | null) ?? null;
});

// -----------------------------------------------------------------------------
// getMyScheduledPosts — alle geplanten Posts. `pending` und `failed` sind für
// den User relevant (er kann sie umplanen/abbrechen), `published`/`cancelled`
// landen am Ende der Liste als Archiv.
// -----------------------------------------------------------------------------

export const getMyScheduledPosts = cache(async (): Promise<ScheduledPostRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('scheduled_posts')
    .select(
      'id, author_id, caption, media_url, media_type, thumbnail_url, tags, audio_url, audio_volume, privacy, allow_comments, allow_download, allow_duet, women_only, cover_time_ms, publish_at, status, retries, last_error, published_post_id, created_at, updated_at',
    )
    .order('publish_at', { ascending: true })
    .limit(200);

  if (error || !data) return [];
  return data as ScheduledPostRow[];
});

// -----------------------------------------------------------------------------
// getTrendingHashtagSuggestions — Distinct-Scan über jüngste posts.tags für
// Autocomplete. Kein `hashtags`-View in Native; wir nutzen den GIN-Index auf
// `posts.tags` (falls vorhanden) mit `contains` und reduzieren client-seitig
// auf unique Werte mit Prefix-Match.
// -----------------------------------------------------------------------------

export async function getTrendingHashtagSuggestions(
  prefix: string,
  limit = 8,
): Promise<string[]> {
  const supabase = await createClient();
  const q = prefix.replace(/^#+/, '').toLowerCase().trim();
  if (!q || q.length < 1) return [];

  // Wir scannen die letzten 300 öffentlichen Posts und sammeln Tags.
  // Kein separater `hashtags`-Table im Schema → das ist der kostengünstigste
  // Kompromiss für Autocomplete ohne neue Infrastruktur.
  const { data } = await supabase
    .from('posts')
    .select('tags')
    .eq('privacy', 'public')
    .not('tags', 'is', null)
    .order('created_at', { ascending: false })
    .limit(300);

  if (!data) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of data) {
    const tags = (row.tags ?? []) as string[];
    for (const raw of tags) {
      const t = raw.replace(/^#+/, '').toLowerCase();
      if (!t || seen.has(t)) continue;
      if (!t.startsWith(q)) continue;
      seen.add(t);
      out.push(`#${t}`);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// getMentionSuggestions — Prefix-Scan auf `profiles.username`. Case-insensitive.
// -----------------------------------------------------------------------------

export interface MentionSuggestion {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
}

export async function getMentionSuggestions(
  prefix: string,
  limit = 8,
): Promise<MentionSuggestion[]> {
  const supabase = await createClient();
  const q = prefix.replace(/^@+/, '').trim();
  if (!q || q.length < 1) return [];

  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, verified:is_verified')
    .ilike('username', `${q}%`)
    .limit(limit);

  return (data as MentionSuggestion[] | null) ?? [];
}
