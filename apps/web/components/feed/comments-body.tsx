'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Lock, Send, Loader2, Heart, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createComment, toggleCommentLike } from '@/app/actions/engagement';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// CommentsBody — reine Kommentar-Liste + Compose-Form, ohne Wrapper-Chrome.
// Wird von zwei Oberflächen konsumiert (v1.w.UI.11 Phase C):
//  - CommentSheet: Radix-Dialog-Bottom-Sheet auf < xl (Mobile-Fallback).
//  - CommentPanel: Inline-Spalte im HomeFeedShell-Grid auf xl+ (TikTok-Parity-
//    Push-Layout — Comments verdrängen die rechte Sidebar statt zu überlagern).
//
// Das ausgelagerte Modul kennt weder Sheet noch Grid, weder Desktop noch
// Mobile — es rendert Header (optional), Liste, Compose. Variant-Prop
// unterscheidet nur, ob der Close-Button als X rechts oben gerendert wird
// (Panel braucht ihn; Sheet bekommt den Close via Radix-SheetHeader).
// -----------------------------------------------------------------------------

const COMMENT_MAX = 500;
const PAGE_SIZE = 30;

export interface CommentsBodyProps {
  postId: string;
  allowComments: boolean;
  viewerId: string | null;
  /**
   * `sheet` = keine explizite Header-Bar, der umschließende Radix-Sheet
   * rendert Titel + Close. `panel` = inlinerer Kontext ohne Sheet, eigener
   * Titel + X-Button nötig.
   */
  variant: 'sheet' | 'panel';
  /**
   * Panel-Close-Callback. Bei variant='sheet' ignoriert (Radix-Sheet kümmert
   * sich selbst um Close via onOpenChange in der äußeren CommentSheet-Props).
   */
  onClose?: () => void;
}

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  // Web-Contract nutzt `body`, Mobile-DB-Spalte ist `text` — alias in der Query.
  body: string;
  like_count: number;
  liked_by_me: boolean;
  created_at: string;
  author: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    verified: boolean;
  };
}

function useComments(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['comments', postId],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<CommentRow[]> => {
      const supabase = createClient();

      // Mobile-DB-Drift: (1) `text` → aliasiert auf `body` für den Web-Contract.
      // (2) `comments` hat keine `like_count`-Spalte und keine `deleted_at`-Spalte
      // (hard-delete-Modell), also beide in der Projektion bzw. im Filter raus.
      // (3) Profiles-`is_verified` → aliasiert auf `verified`.
      const { data, error } = await supabase
        .from('comments')
        .select(
          `id, post_id, user_id, body:text, created_at,
           author:profiles!comments_user_id_fkey ( id, username, display_name, avatar_url, verified:is_verified )`,
        )
        .eq('post_id', postId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw new Error(error.message);

      const rows = data ?? [];
      if (rows.length === 0) return [];

      const ids = rows.map((r) => r.id as string);

      // v1.w.UI.57 — Likes aus `comment_likes`-Tabelle nachladen.
      // Zwei parallele Queries:
      //  (a) Alle Likes für diese Kommentare → client-side count per ID
      //  (b) Eigene Likes des eingeloggten Users → liked_by_me-Set
      // Fehler (z.B. Tabelle noch nicht deployed) werden silent behandelt
      // und fallen auf like_count=0 / liked_by_me=false zurück.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const [allLikesRes, myLikesRes] = await Promise.all([
        supabase
          .from('comment_likes')
          .select('comment_id')
          .in('comment_id', ids),
        user
          ? supabase
              .from('comment_likes')
              .select('comment_id')
              .eq('user_id', user.id)
              .in('comment_id', ids)
          : Promise.resolve({ data: [] as Array<{ comment_id: string }> }),
      ]);

      // Anzahl pro Kommentar aggregieren.
      const countMap = new Map<string, number>();
      for (const r of allLikesRes.data ?? []) {
        countMap.set(r.comment_id, (countMap.get(r.comment_id) ?? 0) + 1);
      }
      const likedSet = new Set(
        ((myLikesRes as { data: Array<{ comment_id: string }> | null }).data ?? []).map(
          (r) => r.comment_id,
        ),
      );

      return rows.map((row) => {
        const author = Array.isArray(row.author) ? row.author[0] : row.author;
        const id = row.id as string;
        return {
          ...(row as unknown as Omit<CommentRow, 'like_count' | 'liked_by_me'>),
          like_count: countMap.get(id) ?? 0,
          liked_by_me: likedSet.has(id),
          author,
        };
      }) as CommentRow[];
    },
  });
}

// Kompaktes Relativformat auf deutsch ohne zusätzliche lib.
// "vor wenigen s" → "3m" → "2h" → "4d" → "2w" → "3mo" → "1y"
function formatAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}mo`;
  return `${Math.floor(diffDay / 365)}y`;
}

export function CommentsBody({ postId, allowComments, viewerId, variant, onClose }: CommentsBodyProps) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');

  // Bei Panel-Variant ist der Body immer sichtbar sobald commentsOpenForPostId
  // gesetzt ist — wir wollen die Query also aktiv laden. Bei Sheet-Variant
  // steuert der äußere `open`-State die Mount-Logik: wenn die Sheet-Content
  // nicht gerendert wird, wird auch CommentsBody nicht gerendert → Query
  // lädt nur on-demand. Entspricht dem ursprünglichen Verhalten aus
  // CommentSheet v1 (enabled={open}).
  const { data: comments, isLoading, isError, refetch } = useComments(postId, true);

  const createMut = useMutation({
    mutationFn: async (rawBody: string) => {
      const res = await createComment(postId, rawBody);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      setBody('');
      void refetch();
      // Feed-Cache: comment_count +1 (Optimistic)
      qc.setQueryData<unknown[]>(
        ['feed'],
        (prev) =>
          (prev as Array<{ id: string; comment_count: number }> | undefined)?.map((p) =>
            p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p,
          ) ?? prev,
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Kommentar konnte nicht gesendet werden');
    },
  });

  const trimmed = body.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= COMMENT_MAX && !createMut.isPending && !!viewerId;

  const handleSend = () => {
    if (!canSend) return;
    createMut.mutate(trimmed);
  };

  return (
    <>
      {/* Panel-Header — bei Sheet-Variant rendert der äußere Wrapper (Radix-
          SheetHeader inkl. Title) das Äquivalent. Hier explizit gerendert
          damit CommentPanel standalone vollständig aussieht. */}
      {variant === 'panel' && (
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">
            {comments ? `${comments.length} Kommentare` : 'Kommentare'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kommentare schließen"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-fast ease-out-expo hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Liste */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Kommentare konnten nicht geladen werden.
            <button
              type="button"
              onClick={() => void refetch()}
              className="ml-2 underline"
            >
              Erneut versuchen
            </button>
          </div>
        )}

        {!isLoading && !isError && comments && comments.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Noch keine Kommentare. Sei die erste Person.
          </div>
        )}

        {comments && comments.length > 0 && (
          <ul className="flex flex-col gap-4">
            {comments.map((c) => (
              <CommentRow key={c.id} comment={c} postId={postId} viewerId={viewerId} />
            ))}
          </ul>
        )}
      </div>

      {/* Compose oder Lock-Hinweis */}
      <div className="border-t border-border bg-background px-4 py-3">
        {!allowComments ? (
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span>Kommentare sind für diesen Post deaktiviert.</span>
          </div>
        ) : !viewerId ? (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Melde dich an, um zu kommentieren.</span>
            <Button asChild size="sm" variant="secondary">
              <Link href={'/login' as Route}>Login</Link>
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2"
          >
            <label className="sr-only" htmlFor={`comment-${postId}`}>
              Kommentar schreiben
            </label>
            <textarea
              id={`comment-${postId}`}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, COMMENT_MAX))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Kommentar hinzufügen…"
              rows={1}
              className="min-h-[40px] max-h-24 flex-1 resize-none rounded-full border border-border bg-muted/50 px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:bg-background"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!canSend}
              className={cn(
                'h-10 w-10 shrink-0 rounded-full',
                !canSend && 'opacity-50',
              )}
              aria-label="Kommentar senden"
            >
              {createMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </form>
        )}
        {trimmed.length > COMMENT_MAX * 0.8 && (
          <div className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
            {trimmed.length} / {COMMENT_MAX}
          </div>
        )}
      </div>
    </>
  );
}

// -----------------------------------------------------------------------------
// CommentRow — ein Kommentar mit Avatar, Body, Timestamp + Like-Button.
// v1.w.UI.57: Like-Button ist jetzt aktiv mit Optimistic-Update.
// -----------------------------------------------------------------------------

function CommentRow({
  comment,
  postId,
  viewerId,
}: {
  comment: CommentRow;
  postId: string;
  viewerId: string | null;
}) {
  const qc = useQueryClient();
  const initials = (comment.author.display_name ?? comment.author.username)
    .slice(0, 2)
    .toUpperCase();

  const likeMut = useMutation({
    mutationFn: () => toggleCommentLike(comment.id),
    // Optimistic update — sofortige Reaktion im UI.
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['comments', postId] });
      const prev = qc.getQueryData<CommentRow[]>(['comments', postId]);
      qc.setQueryData<CommentRow[]>(['comments', postId], (old) =>
        (old ?? []).map((c) =>
          c.id !== comment.id
            ? c
            : {
                ...c,
                liked_by_me: !c.liked_by_me,
                like_count: c.liked_by_me
                  ? Math.max(0, c.like_count - 1)
                  : c.like_count + 1,
              },
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      // Rollback bei Fehler.
      if (ctx?.prev) qc.setQueryData(['comments', postId], ctx.prev);
      toast.error('Like konnte nicht gespeichert werden.');
    },
  });

  const handleLike = () => {
    if (!viewerId) {
      toast('Bitte zuerst anmelden.');
      return;
    }
    likeMut.mutate();
  };

  return (
    <li className="flex gap-3">
      <Link
        href={`/u/${comment.author.username}` as Route}
        className="shrink-0"
        aria-label={`Profil von @${comment.author.username}`}
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.author.avatar_url ?? undefined} />
          <AvatarFallback className="bg-muted text-xs">{initials}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/u/${comment.author.username}` as Route}
            className="flex items-center gap-1 text-sm font-semibold hover:underline"
          >
            @{comment.author.username}
            {comment.author.verified && <BadgeCheck className="h-3.5 w-3.5 text-brand-gold" />}
          </Link>
          <span className="text-xs text-muted-foreground">· {formatAgo(comment.created_at)}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-snug">{comment.body}</p>
      </div>
      {/* Like-Button — aktiv seit v1.w.UI.57 */}
      <button
        type="button"
        onClick={handleLike}
        disabled={likeMut.isPending}
        aria-label={comment.liked_by_me ? 'Kommentar-Like entfernen' : 'Kommentar liken'}
        className={cn(
          'flex shrink-0 flex-col items-center gap-0.5 self-start pt-0.5',
          'text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50',
          comment.liked_by_me && 'text-red-500 hover:text-red-400',
        )}
      >
        <Heart
          className={cn('h-4 w-4', comment.liked_by_me && 'fill-current')}
          aria-hidden="true"
        />
        {comment.like_count > 0 && (
          <span className="text-[10px] tabular-nums leading-none">
            {comment.like_count}
          </span>
        )}
      </button>
    </li>
  );
}
