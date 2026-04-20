'use server';

import { revalidateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// Engagement-Server-Actions — Like / Save / Follow / Comment.
// Spiegeln Native-Pattern (direkte Table-Ops, keine RPC), damit RLS greift.
// Clients rufen via TanStack Query useMutation mit Optimistic-Update.
// -----------------------------------------------------------------------------

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function getViewerId(): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id } : null;
}

// -----------------------------------------------------------------------------
// togglePostLike — client sendet aktuellen State, Server flippt entsprechend.
// -----------------------------------------------------------------------------

export async function togglePostLike(
  postId: string,
  currentlyLiked: boolean,
): Promise<ActionResult<{ liked: boolean }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Nicht eingeloggt.' };

  const supabase = await createClient();

  if (currentlyLiked) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('user_id', viewer.id)
      .eq('post_id', postId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { liked: false } };
  }

  const { error } = await supabase.from('likes').upsert(
    { user_id: viewer.id, post_id: postId },
    { onConflict: 'user_id,post_id', ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { liked: true } };
}

// -----------------------------------------------------------------------------
// togglePostBookmark — gleiche Semantik wie Like, aber auf `bookmarks`.
// -----------------------------------------------------------------------------

export async function togglePostBookmark(
  postId: string,
  currentlySaved: boolean,
): Promise<ActionResult<{ saved: boolean }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Nicht eingeloggt.' };

  const supabase = await createClient();

  if (currentlySaved) {
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('user_id', viewer.id)
      .eq('post_id', postId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { saved: false } };
  }

  const { error } = await supabase.from('bookmarks').upsert(
    { user_id: viewer.id, post_id: postId },
    { onConflict: 'user_id,post_id', ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { saved: true } };
}

// -----------------------------------------------------------------------------
// toggleFollow — user folgt / entfolgt anderem Profil.
// -----------------------------------------------------------------------------

export async function toggleFollow(
  targetUserId: string,
  currentlyFollowing: boolean,
): Promise<ActionResult<{ following: boolean }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Nicht eingeloggt.' };
  if (viewer.id === targetUserId) return { ok: false, error: 'Dir selbst folgen geht nicht.' };

  const supabase = await createClient();

  if (currentlyFollowing) {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', viewer.id)
      .eq('followed_id', targetUserId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { following: false } };
  }

  const { error } = await supabase.from('follows').upsert(
    { follower_id: viewer.id, followed_id: targetUserId },
    { onConflict: 'follower_id,followed_id', ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { following: true } };
}

// -----------------------------------------------------------------------------
// createComment — wir bewusst ohne Parent-Replies (Native hat, Web kommt später).
// -----------------------------------------------------------------------------

const COMMENT_MAX = 500;

export async function createComment(
  postId: string,
  rawBody: string,
): Promise<ActionResult<{ id: string }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Nicht eingeloggt.' };

  const body = rawBody.trim();
  if (body.length === 0) return { ok: false, error: 'Kommentar darf nicht leer sein.' };
  if (body.length > COMMENT_MAX)
    return { ok: false, error: `Maximal ${COMMENT_MAX} Zeichen.` };

  const supabase = await createClient();

  // Post-Check: existiert + allow_comments true?
  const { data: post, error: postErr } = await supabase
    .from('posts')
    .select('id, allow_comments')
    .eq('id', postId)
    .maybeSingle();
  if (postErr || !post) return { ok: false, error: 'Post nicht gefunden.' };
  if (post.allow_comments === false) return { ok: false, error: 'Kommentare sind hier deaktiviert.' };

  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, user_id: viewer.id, body })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler beim Senden.' };

  // Wir invalidieren Post-Caches (getPostComments ist pro-request gecached, aber
  // ISR-Renders von /p/[postId] dürfen vom neuen Count profitieren).
  revalidateTag(`post:${postId}`);

  return { ok: true, data: { id: data.id as string } };
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Nicht eingeloggt.' };

  const supabase = await createClient();
  // Soft-Delete via `deleted_at` — Native macht das gleich, damit Threads nicht brechen
  const { error } = await supabase
    .from('comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId)
    .eq('user_id', viewer.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
