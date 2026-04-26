'use server';

import { revalidateTag, revalidatePath } from 'next/cache';
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
      .eq('following_id', targetUserId);
    if (error) return { ok: false, error: error.message };
    // Profil-Cache invalidieren damit Follower-Count sofort aktuell ist.
    revalidatePath(`/u/`);
    return { ok: true, data: { following: false } };
  }

  const { error } = await supabase.from('follows').upsert(
    { follower_id: viewer.id, following_id: targetUserId },
    { onConflict: 'follower_id,following_id', ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/u/`);
  return { ok: true, data: { following: true } };
}

// -----------------------------------------------------------------------------
// createComment — Top-Level und Replies.
// parentId optional — wenn gesetzt, wird parent_id in die DB geschrieben
// (max. 1 Ebene tief, entsprechend der Migration 20260331020000_comment_replies.sql).
// -----------------------------------------------------------------------------

const COMMENT_MAX = 500;

export async function createComment(
  postId: string,
  rawBody: string,
  parentId?: string | null,
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

  // Mobile-DB-`comments`-Spalte heißt `text`, nicht `body`.
  const insertRow: Record<string, unknown> = { post_id: postId, user_id: viewer.id, text: body };
  if (parentId) insertRow.parent_id = parentId;

  const { data, error } = await supabase
    .from('comments')
    .insert(insertRow)
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Fehler beim Senden.' };

  revalidateTag(`post:${postId}`);

  return { ok: true, data: { id: data.id as string } };
}

// fetchCommentReplies — Server Action Wrapper für getCommentReplies.
// Wird von CommentThread (Client-Component) aufgerufen.
// Holt Viewer-ID aus der Session damit liked_by_me korrekt befüllt wird.
export async function fetchCommentReplies(
  parentId: string,
): Promise<import('@/lib/data/public').CommentWithAuthor[]> {
  const viewer = await getViewerId();
  const { getCommentReplies } = await import('@/lib/data/public');
  return getCommentReplies(parentId, 20, viewer?.id ?? null);
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Nicht eingeloggt.' };

  const supabase = await createClient();
  // Mobile-DB-`comments` hat KEINE `deleted_at`-Spalte — Native macht HARD-DELETE
  // via RLS-Policy `for delete using (auth.uid() = user_id)`. Der Web-Client muss
  // dasselbe tun, sonst feuert PostgREST 42703 auf `deleted_at`.
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', viewer.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// toggleCommentLike — v1.w.UI.57: Kommentar liken / entliken.
//
// Nutzt die `comment_likes`-Tabelle (PK: comment_id + user_id).
// Toggle-Logik: INSERT → wenn 23505 (unique violation) → DELETE (unlike).
// Kein RPC nötig — direktes INSERT/DELETE reicht, RLS prüft user_id.
// -----------------------------------------------------------------------------

export async function toggleCommentLike(
  commentId: string,
): Promise<ActionResult<{ liked: boolean }>> {
  if (!commentId) return { ok: false, error: 'Ungültige Kommentar-ID.' };

  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();

  // Versuche zu liken.
  const { error: insertError } = await supabase
    .from('comment_likes')
    .insert({ comment_id: commentId, user_id: viewer.id });

  if (!insertError) {
    return { ok: true, data: { liked: true } };
  }

  // 23505 = unique_violation → bereits geliked → entliken.
  if (insertError.code === '23505') {
    const { error: deleteError } = await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', viewer.id);

    if (deleteError) return { ok: false, error: deleteError.message };
    return { ok: true, data: { liked: false } };
  }

  return { ok: false, error: insertError.message };
}

// -----------------------------------------------------------------------------
// recordDwell — v1.w.UI.53: Ruft update_dwell_time RPC auf.
//
// Feuert im FeedCard nach ≥3s Playback und im Post-Detail on-mount.
// Gaming-Guard lebt serverseitig (60min Cooldown + max 5/User/Post).
// Keine ActionResult-Rückgabe nötig — fire-and-forget, kein UI-Feedback.
// Nur für eingeloggte User (Anon-Views zählen nicht zum dwell_time_score).
// -----------------------------------------------------------------------------

export async function recordDwell(postId: string, dwellMs: number): Promise<void> {
  const viewer = await getViewerId();
  if (!viewer) return; // Anon-Views nicht tracken

  const supabase = await createClient();
  await supabase.rpc('update_dwell_time', { post_id: postId, dwell_ms: dwellMs });
  // Fehler ignorieren — fire-and-forget. RPC hat eigene Guards.
}
