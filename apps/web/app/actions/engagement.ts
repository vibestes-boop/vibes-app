'use server';

import { revalidateTag, revalidatePath } from 'next/cache';
import { createActionTiming } from '@/lib/observability/action-timing';
import { createClient } from '@/lib/supabase/server';
import type { CommentWithAuthor } from '@/lib/data/public';

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
//
// v1.w.UI.149: Privates-Konto-Unterstützung.
//  • Öffentliches Konto:  direkter INSERT in `follows` (wie bisher).
//  • Privates Konto:      INSERT in `follow_requests`; returns pending=true.
//  • "Entfolgen" oder "Anfrage zurückziehen": entsprechende DELETE-Pfade.
//
// Rückgabe-Shape: { following, pending }
//   following = true  → sofort gefolgt (öffentliches Konto)
//   pending   = true  → Anfrage gesendet (privates Konto, noch nicht angenommen)
//   beide false       → entfolgt / Anfrage zurückgezogen
// -----------------------------------------------------------------------------

export async function toggleFollow(
  targetUserId: string,
  currentlyFollowing: boolean,
  currentlyPending = false,
): Promise<ActionResult<{ following: boolean; pending: boolean }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Nicht eingeloggt.' };
  if (viewer.id === targetUserId) return { ok: false, error: 'Dir selbst folgen geht nicht.' };

  const supabase = await createClient();

  // ── Unfollow / withdraw request ──────────────────────────────────────────
  if (currentlyFollowing) {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', viewer.id)
      .eq('following_id', targetUserId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/u/`);
    return { ok: true, data: { following: false, pending: false } };
  }

  if (currentlyPending) {
    // Zurückziehen der Anfrage
    const { error } = await supabase
      .from('follow_requests')
      .delete()
      .eq('sender_id', viewer.id)
      .eq('receiver_id', targetUserId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { following: false, pending: false } };
  }

  // ── Follow — prüfe ob Ziel-Konto privat ist ──────────────────────────────
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('is_private')
    .eq('id', targetUserId)
    .maybeSingle();

  const isPrivate = (targetProfile as { is_private?: boolean | null } | null)?.is_private ?? false;

  if (isPrivate) {
    // Follow-Request statt direktem Follow
    const { error } = await supabase
      .from('follow_requests')
      .upsert(
        { sender_id: viewer.id, receiver_id: targetUserId },
        { onConflict: 'sender_id,receiver_id', ignoreDuplicates: true },
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { following: false, pending: true } };
  }

  // Öffentliches Konto → direkter Follow
  const { error } = await supabase.from('follows').upsert(
    { follower_id: viewer.id, following_id: targetUserId },
    { onConflict: 'follower_id,following_id', ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/u/`);
  return { ok: true, data: { following: true, pending: false } };
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
): Promise<ActionResult<CommentWithAuthor>> {
  const timing = createActionTiming('comments.create', { hasParent: Boolean(parentId) });
  const finish = (
    result: ActionResult<CommentWithAuthor>,
    extra: Parameters<typeof timing.finish>[0],
  ) => {
    timing.finish(extra);
    return result;
  };

  try {
    const supabase = await timing.measure('supabase.createClient', createClient);
    const {
      data: { user },
    } = await timing.measure('auth.getUser', () => supabase.auth.getUser());

    if (!user) {
      return finish({ ok: false, error: 'Nicht eingeloggt.' }, { ok: false, reason: 'unauthenticated' });
    }

    const body = rawBody.trim();
    if (body.length === 0) {
      return finish(
        { ok: false, error: 'Kommentar darf nicht leer sein.' },
        { ok: false, reason: 'empty_body' },
      );
    }
    if (body.length > COMMENT_MAX) {
      return finish(
        { ok: false, error: `Maximal ${COMMENT_MAX} Zeichen.` },
        { ok: false, reason: 'body_too_long' },
      );
    }

    // Post-Check: existiert + allow_comments true?
    const { data: post, error: postErr } = await timing.measure('posts.check', () =>
      supabase.from('posts').select('id, allow_comments').eq('id', postId).maybeSingle(),
    );
    if (postErr || !post) {
      return finish(
        { ok: false, error: 'Post nicht gefunden.' },
        { ok: false, reason: postErr ? 'post_check_error' : 'post_not_found' },
      );
    }
    if (post.allow_comments === false) {
      return finish(
        { ok: false, error: 'Kommentare sind hier deaktiviert.' },
        { ok: false, reason: 'comments_disabled' },
      );
    }

    // Mobile-DB-`comments`-Spalte heißt `text`, nicht `body`.
    const insertRow: Record<string, unknown> = { post_id: postId, user_id: user.id, text: body };
    if (parentId) insertRow.parent_id = parentId;

    const { data, error } = await timing.measure('comments.insert', () =>
      supabase
        .from('comments')
        .insert(insertRow)
        .select(
          `id, post_id, user_id, parent_id, text, created_at,
         author:profiles!comments_user_id_fkey ( id, username, display_name, avatar_url, verified:is_verified )`,
        )
        .single(),
    );

    if (error || !data) {
      return finish(
        { ok: false, error: error?.message ?? 'Fehler beim Senden.' },
        { ok: false, reason: 'insert_error' },
      );
    }

    const row = data as unknown as {
      id: string;
      post_id: string;
      user_id: string;
      parent_id: string | null;
      text: string | null;
      created_at: string;
      author:
        | {
            id: string;
            username: string;
            display_name: string | null;
            avatar_url: string | null;
            verified: boolean | null;
          }
        | {
            id: string;
            username: string;
            display_name: string | null;
            avatar_url: string | null;
            verified: boolean | null;
          }[]
        | null;
    };
    const author = Array.isArray(row.author) ? (row.author[0] ?? null) : row.author;
    if (!author) {
      return finish(
        { ok: false, error: 'Kommentar gesendet, Profil konnte aber nicht geladen werden.' },
        { ok: false, reason: 'author_missing' },
      );
    }

    await timing.measure('cache.revalidatePost', () => {
      revalidateTag(`post:${postId}`);
    });

    return finish(
      {
        ok: true,
        data: {
          id: row.id,
          post_id: row.post_id,
          user_id: row.user_id,
          parent_id: row.parent_id ?? null,
          body: row.text ?? body,
          like_count: 0,
          liked_by_me: false,
          reply_count: 0,
          created_at: row.created_at,
          author: {
            id: author.id,
            username: author.username,
            display_name: author.display_name,
            avatar_url: author.avatar_url,
            verified: author.verified ?? false,
          },
        },
      },
      { ok: true },
    );
  } catch (error) {
    timing.finish({
      ok: false,
      reason: 'exception',
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    throw error;
  }
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

// -----------------------------------------------------------------------------
// fetchMoreComments — v1.w.UI.60: "Load more" Pagination für Post-Detail.
//
// Lädt Top-Level-Kommentare ab einem Offset (älteste-zuerst, konsistent mit
// dem ersten SSR-Batch). Viewer wird aus der Session geholt damit liked_by_me
// korrekt befüllt wird — gleiche Semantik wie fetchCommentReplies.
// -----------------------------------------------------------------------------

export async function fetchMoreComments(
  postId: string,
  offset: number,
  limit = 20,
): Promise<import('@/lib/data/public').CommentWithAuthor[]> {
  const viewer = await getViewerId();
  const { getMoreComments } = await import('@/lib/data/public');
  return getMoreComments(postId, offset, limit, viewer?.id ?? null);
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

// -----------------------------------------------------------------------------
// recordPostView — v1.w.UI.138 follow-up.
//
// Keep the Supabase browser client out of the feed's initial JS bundle. The RPC
// still runs with the authenticated user's session, but the heavy Supabase SDK
// stays on the server side instead of becoming an above-the-fold client chunk.
// -----------------------------------------------------------------------------

export async function recordPostView(postId: string): Promise<void> {
  const viewer = await getViewerId();
  if (!viewer) return;

  const supabase = await createClient();
  await supabase.rpc('increment_post_view', { p_post_id: postId });
}

// -----------------------------------------------------------------------------
// toggleRepost — v1.w.UI.151: In-App-Repost (Repeat2) ähnlich TikTok.
//
// Schreibt in die `reposts`-Tabelle (user_id, post_id). Eigene Posts dürfen
// nicht repostet werden (Guard auch auf DB-Ebene sinnvoll, wir prüfen
// zusätzlich client-seitig im FeedCard — hier als Defense-in-Depth).
// Toggle-Logik: INSERT → wenn unique_violation (23505) → DELETE.
// -----------------------------------------------------------------------------

export async function toggleRepost(
  postId: string,
  currentlyReposted: boolean,
): Promise<ActionResult<{ reposted: boolean }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Nicht eingeloggt.' };

  const supabase = await createClient();

  if (currentlyReposted) {
    const { error } = await supabase
      .from('reposts')
      .delete()
      .eq('user_id', viewer.id)
      .eq('post_id', postId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { reposted: false } };
  }

  const { error } = await supabase.from('reposts').upsert(
    { user_id: viewer.id, post_id: postId },
    { onConflict: 'user_id,post_id', ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { reposted: true } };
}
