'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Heart, ChevronDown, ChevronUp, Send, CornerDownRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useCreateComment } from '@/hooks/use-engagement';
import { fetchCommentReplies } from '@/app/actions/engagement';
import type { CommentWithAuthor } from '@/lib/data/public';

// -----------------------------------------------------------------------------
// CommentThread — Client-Component für einen Top-Level-Kommentar mit Replies.
//
// v1.w.UI.47: einstufiges Threading (max 1 Ebene, wie native App + DB-Schema).
// - "X Antworten" Button lädt Replies lazy via TanStack-Query + Server Action.
// - Inline-Reply-Form öffnet sich beim Klick auf "Antworten".
// - Replies werden oldest-first gezeigt (konsistent mit Top-Level).
// -----------------------------------------------------------------------------

// ── Relative Zeitanzeige ──────────────────────────────────────────────────────
function formatRelative(iso: string): string {
  const delta = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (delta < 60) return 'gerade eben';
  if (delta < 3600) return `vor ${Math.floor(delta / 60)} Min`;
  if (delta < 86400) return `vor ${Math.floor(delta / 3600)} Std`;
  if (delta < 172800) return 'gestern';
  if (delta < 604800) return `vor ${Math.floor(delta / 86400)} Tagen`;
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

// ── Single CommentRow (wiederverwendet für Top-Level und Reply) ───────────────
function CommentRow({
  comment,
  isReply = false,
  onReply,
}: {
  comment: CommentWithAuthor;
  isReply?: boolean;
  onReply?: (username: string) => void;
}) {
  const authorName = comment.author.display_name ?? `@${comment.author.username}`;
  return (
    <div className={cn('flex gap-3', isReply && 'pl-10')}>
      <Link
        href={`/u/${comment.author.username}`}
        className="shrink-0"
        aria-label={`Profil von @${comment.author.username}`}
      >
        <Avatar className={cn(isReply ? 'h-7 w-7' : 'h-9 w-9')}>
          <AvatarImage src={comment.author.avatar_url ?? undefined} alt="" />
          <AvatarFallback className="text-xs">
            {(comment.author.display_name ?? comment.author.username).slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
          <Link
            href={`/u/${comment.author.username}`}
            className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline"
          >
            {authorName}
            {comment.author.verified && (
              <BadgeCheck
                className="h-3.5 w-3.5 fill-brand-gold text-background"
                aria-label="Verifiziert"
              />
            )}
          </Link>
          <span className="text-muted-foreground">{formatRelative(comment.created_at)}</span>
        </div>

        <p className="mt-0.5 whitespace-pre-line break-words text-sm leading-relaxed">
          {comment.body}
        </p>

        <div className="mt-1.5 flex items-center gap-3">
          {comment.like_count > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Heart className="h-3 w-3" />
              {comment.like_count.toLocaleString('de-DE')}
            </span>
          )}
          {onReply && (
            <button
              type="button"
              onClick={() => onReply(comment.author.username ?? '')}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Antworten
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inline Reply Form ─────────────────────────────────────────────────────────
const MAX = 500;

function ReplyForm({
  postId,
  parentId,
  targetUsername,
  isAuthenticated,
  postPath,
  onCancel,
  onSuccess,
}: {
  postId: string;
  parentId: string;
  targetUsername: string;
  isAuthenticated: boolean;
  postPath: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [body, setBody] = useState(`@${targetUsername} `);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const mutation = useCreateComment(postId, parentId);

  if (!isAuthenticated) {
    return (
      <div className="pl-10 pt-2 text-xs text-muted-foreground">
        <Link
          href={`/login?next=${encodeURIComponent(postPath)}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Einloggen
        </Link>{' '}
        um zu antworten.
      </div>
    );
  }

  const trimmed = body.trim();
  const remaining = MAX - body.length;
  const canSubmit = trimmed.length > 0 && body.length <= MAX && !mutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate(trimmed, {
      onSuccess: () => {
        setBody('');
        router.refresh();
        onSuccess();
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
    if (e.key === 'Escape') onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="pl-10 pt-2">
      <div className="relative rounded-lg border border-border bg-card ring-0 transition-shadow focus-within:ring-2 focus-within:ring-ring">
        <textarea
          ref={textareaRef}
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Antwort schreiben…"
          rows={2}
          maxLength={MAX + 1}
          disabled={mutation.isPending}
          className="w-full resize-none rounded-lg bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
        <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
          <span className={cn('text-xs tabular-nums text-muted-foreground', remaining < 50 && 'text-amber-500', remaining < 0 && 'font-semibold text-destructive')}>
            {remaining < 100 ? `${remaining} Zeichen` : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              <Send className="h-3 w-3" />
              {mutation.isPending ? 'Senden…' : 'Senden'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export function CommentThread({
  comment,
  postId,
  isAuthenticated,
  postPath,
}: {
  comment: CommentWithAuthor;
  postId: string;
  isAuthenticated: boolean;
  postPath: string;
}) {
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<string | null>(null);

  // Lazy-fetch Replies via TanStack Query (enabled sobald repliesOpen=true).
  const repliesQuery = useQuery<CommentWithAuthor[]>({
    queryKey: ['replies', comment.id],
    queryFn: () => fetchCommentReplies(comment.id),
    enabled: repliesOpen,
    staleTime: 30_000,
  });

  const replyCount = comment.reply_count;

  const handleReply = (username: string) => {
    setReplyTarget(username);
    if (!repliesOpen) setRepliesOpen(true);
  };

  return (
    <li className="flex flex-col gap-1.5">
      {/* Top-Level Kommentar */}
      <CommentRow
        comment={comment}
        onReply={handleReply}
      />

      {/* "X Antworten" Toggle */}
      {(replyCount > 0 || repliesOpen) && !replyTarget && (
        <button
          type="button"
          onClick={() => setRepliesOpen((v) => !v)}
          className="ml-12 flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          <CornerDownRight className="h-3.5 w-3.5" />
          {repliesOpen ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Antworten ausblenden
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              {replyCount} {replyCount === 1 ? 'Antwort' : 'Antworten'} anzeigen
            </>
          )}
        </button>
      )}

      {/* Reply-Liste */}
      {repliesOpen && (
        <div className="flex flex-col gap-3 pt-1">
          {repliesQuery.isLoading && (
            <div className="pl-10 text-xs text-muted-foreground">Lade Antworten…</div>
          )}
          {repliesQuery.data?.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              isReply
              onReply={handleReply}
            />
          ))}
        </div>
      )}

      {/* Inline Reply Form */}
      {replyTarget !== null && (
        <ReplyForm
          postId={postId}
          parentId={comment.id}
          targetUsername={replyTarget}
          isAuthenticated={isAuthenticated}
          postPath={postPath}
          onCancel={() => setReplyTarget(null)}
          onSuccess={() => {
            setReplyTarget(null);
            setRepliesOpen(true);
          }}
        />
      )}
    </li>
  );
}
