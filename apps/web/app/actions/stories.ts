'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// Story-Server-Actions
//
//  `createStory({ mediaUrl, mediaType, thumbnailUrl?, interactive? })`
//    → Insert eine neue Story für den eingeloggten User. 24h TTL wird DB-seitig
//      via Cleanup-Cron gesetzt, wir geben hier nur den Insert.
//
//  `deleteStory(storyId)` → Eigene Story löschen (RLS greift zusätzlich).
//
//  `markStoryViewed(storyId)` → Upsert in story_views (UNIQUE story_id+user_id).
//    Idempotent — dupe-Clicks im Viewer sind ok.
//
// Schema:
//   stories(id, user_id, media_url, media_type, thumbnail_url, interactive,
//           archived, created_at)
//   story_views(story_id, user_id, viewed_at) UNIQUE(story_id, user_id)
// -----------------------------------------------------------------------------

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type StoryPollInput = {
  type: 'poll';
  question: string;
  options: [string, string];
};

export interface CreateStoryInput {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  thumbnailUrl?: string | null;
  interactive?: StoryPollInput | null;
}

export async function createStory(
  input: CreateStoryInput,
): Promise<ActionResult<{ storyId: string }>> {
  const { mediaUrl, mediaType, thumbnailUrl, interactive } = input;

  if (!mediaUrl || typeof mediaUrl !== 'string') {
    return { ok: false, error: 'Media-URL fehlt.' };
  }
  if (mediaType !== 'image' && mediaType !== 'video') {
    return { ok: false, error: 'Ungültiger Media-Typ.' };
  }

  // Poll-Input validieren (falls gesetzt)
  if (interactive) {
    if (interactive.type !== 'poll') {
      return { ok: false, error: 'Ungültiges interaktives Element.' };
    }
    const q = (interactive.question ?? '').trim();
    if (q.length < 3 || q.length > 120) {
      return { ok: false, error: 'Frage muss 3–120 Zeichen haben.' };
    }
    if (!Array.isArray(interactive.options) || interactive.options.length !== 2) {
      return { ok: false, error: 'Poll braucht genau 2 Optionen.' };
    }
    const [a, b] = interactive.options.map((o) => (o ?? '').trim());
    if (!a || !b || a.length > 40 || b.length > 40) {
      return { ok: false, error: 'Optionen: 1–40 Zeichen pro Option.' };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Bitte einloggen.' };

  const insertData: Record<string, unknown> = {
    user_id: user.id,
    media_url: mediaUrl,
    media_type: mediaType,
  };
  if (thumbnailUrl) insertData.thumbnail_url = thumbnailUrl;
  if (interactive) insertData.interactive = interactive;

  const { data, error } = await supabase
    .from('stories')
    .insert(insertData)
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Story konnte nicht erstellt werden.' };
  }

  revalidatePath('/');
  revalidatePath('/stories');
  return { ok: true, data: { storyId: (data as { id: string }).id } };
}

export async function deleteStory(storyId: string): Promise<ActionResult<null>> {
  if (!storyId || typeof storyId !== 'string') {
    return { ok: false, error: 'Story-ID fehlt.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Bitte einloggen.' };

  // RLS sollte das zusätzlich absichern, aber wir filtern explizit auf user_id
  // damit wir eine klare Fehlermeldung geben können falls die Story nicht
  // existiert oder nicht dem User gehört.
  const { data: story, error: fetchErr } = await supabase
    .from('stories')
    .select('id, user_id')
    .eq('id', storyId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!story) return { ok: false, error: 'Story nicht gefunden.' };
  if ((story as { user_id: string }).user_id !== user.id) {
    return { ok: false, error: 'Nur der Besitzer kann die Story löschen.' };
  }

  const { error } = await supabase.from('stories').delete().eq('id', storyId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/');
  revalidatePath('/stories');
  return { ok: true, data: null };
}

export async function markStoryViewed(storyId: string): Promise<ActionResult<null>> {
  if (!storyId || typeof storyId !== 'string') {
    return { ok: false, error: 'Story-ID fehlt.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Anon-User: kein Fehler, einfach no-op (Viewer sollte für Anons nicht
  // erreichbar sein, aber wir verhindern 500 bei Race-Conditions).
  if (!user) return { ok: true, data: null };

  const { error } = await supabase
    .from('story_views')
    .upsert(
      { story_id: storyId, user_id: user.id },
      { onConflict: 'story_id,user_id' },
    );

  if (error) return { ok: false, error: error.message };

  // Kein revalidatePath — Seen-State wird im Viewer-Client lokal optimistisch
  // geupdated und erst beim nächsten Feed-Fetch konsolidiert. Würden wir hier
  // den Home-Feed revalidieren, hätten wir pro View-Tick einen Full-Re-Render.
  return { ok: true, data: null };
}

// addStoryComment — Öffentlicher Kommentar auf eine Story.
// isEmoji=true: Emoji-Reaction (wird im UI anders dargestellt).
// Parität zu mobile useAddStoryComment (lib/useStoryComments.ts).
export async function addStoryComment(
  storyId: string,
  content: string,
  isEmoji = false,
): Promise<ActionResult<null>> {
  if (!storyId || typeof storyId !== 'string') {
    return { ok: false, error: 'Story-ID fehlt.' };
  }
  const trimmed = content.trim();
  if (!trimmed) return { ok: false, error: 'Inhalt fehlt.' };
  if (trimmed.length > 300) return { ok: false, error: 'Max 300 Zeichen.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Bitte einloggen.' };

  const { error } = await supabase.from('story_comments').insert({
    story_id: storyId,
    author_id: user.id,
    content: trimmed,
    is_emoji: isEmoji,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
