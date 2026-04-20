'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Lock, Send, Loader2, Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createComment } from '@/app/actions/engagement';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// CommentSheet — Bottom-Sheet auf Mobile, Right-Sheet auf Desktop.
// Lädt Kommentare client-seitig via TanStack Query (RLS greift direkt im Browser),
// ergänzt lokal neue Kommentare vor dem Refetch.
// -----------------------------------------------------------------------------

const COMMENT_MAX = 500;
const PAGE_SIZE = 30;

export interface CommentSheetProps {
  postId: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  allowComments: boolean;
  viewerId: string | null;
}

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  like_count: number;
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
      const { data, error } = await supabase
        .from('comments')
        .select(
          `id, post_id, user_id, body, like_count, created_at,
           author:profiles!comments_user_id_fkey ( id, username, display_name, avatar_url, verified )`,
        )
        .eq('post_id', postId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => {
        const author = Array.isArray(row.author) ? row.author[0] : row.author;
        return { ...(row as unknown as CommentRow), author };
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

export function CommentSheet({ postId, open, onOpenChange, allowComments, viewerId }: CommentSheetProps) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');

  const { data: comments, isLoading, isError, refetch } = useComments(postId, open);

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-md"
        onInteractOutside={(e) => {
          // Auf Mobile will man den Sheet ggf. nur über den X-Button schließen, aber wir lassen ihn offen.
          e.preventDefault();
        }}
      >
        <SheetHeader className="px-5 py-4">
          <SheetTitle className="text-base font-semibold">
            {comments ? `${comments.length} Kommentare` : 'Kommentare'}
          </SheetTitle>
        </SheetHeader>

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
                <CommentRow key={c.id} comment={c} />
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
      </SheetContent>
    </Sheet>
  );
}

// -----------------------------------------------------------------------------
// CommentRow — ein Kommentar mit Avatar, Body, Timestamp, Like-Button (Stub).
// Like-Mutation folgt in Phase 4 (Comment-Likes sind sekundär).
// -----------------------------------------------------------------------------

function CommentRow({ comment }: { comment: CommentRow }) {
  const initials = (comment.author.display_name ?? comment.author.username)
    .slice(0, 2)
    .toUpperCase();

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
      <button
        type="button"
        className="self-start text-muted-foreground hover:text-foreground"
        aria-label="Kommentar liken"
        disabled
        title="Kommentar-Likes folgen in Phase 4"
      >
        <Heart className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}
