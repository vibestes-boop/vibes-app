'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { useCreateComment } from '@/hooks/use-engagement';
import { cn } from '@/lib/utils';
import type { CommentWithAuthor } from '@/lib/data/public';

// -----------------------------------------------------------------------------
// CommentForm — Kommentar-Eingabe für /p/[postId].
//
// Nicht eingeloggte User: zeigen Login-CTA statt Formular.
// Max 500 Zeichen (gespiegelt aus createComment Server Action).
// Optionales Optimistic-Update läuft in der Kommentar-Sektion, damit ein neuer
// Kommentar sofort sichtbar ist und der RSC-Refresh nur noch nachzieht.
// -----------------------------------------------------------------------------

const MAX = 500;

export function CommentForm({
  postId,
  isAuthenticated,
  postPath,
  viewerAuthor,
  onOptimisticComment,
  onCommentConfirmed,
  onCommentFailed,
}: {
  postId: string;
  isAuthenticated: boolean;
  /** Aktueller Pfad für den Login-Redirect (z.B. '/p/abc123'). */
  postPath: string;
  viewerAuthor?: CommentWithAuthor['author'] | null;
  onOptimisticComment?: (comment: CommentWithAuthor) => void;
  onCommentConfirmed?: (temporaryId: string, comment: CommentWithAuthor) => void;
  onCommentFailed?: (temporaryId: string) => void;
}) {
  const [body, setBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const mutation = useCreateComment(postId);

  if (!isAuthenticated) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-border bg-card/40 px-4 py-5 text-center text-sm text-muted-foreground">
        <Link
          href={`/login?next=${encodeURIComponent(postPath)}` as Route}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Einloggen
        </Link>{' '}
        um zu kommentieren.
      </div>
    );
  }

  const trimmed = body.trim();
  const remaining = MAX - body.length;
  const canSubmit = trimmed.length > 0 && body.length <= MAX && !mutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const temporaryId = `optimistic-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;

    if (viewerAuthor && onOptimisticComment) {
      onOptimisticComment({
        id: temporaryId,
        post_id: postId,
        user_id: viewerAuthor.id,
        parent_id: null,
        body: trimmed,
        like_count: 0,
        liked_by_me: false,
        reply_count: 0,
        created_at: new Date().toISOString(),
        author: viewerAuthor,
      });
      setBody('');
      textareaRef.current?.blur();
    }

    mutation.mutate(trimmed, {
      onSuccess: (comment) => {
        if (!viewerAuthor || !onOptimisticComment) {
          setBody('');
          textareaRef.current?.blur();
        }
        onCommentConfirmed?.(temporaryId, comment);
        // RSC-Kommentarliste neu laden — force-dynamic Seite rendert sofort
        // mit dem neuen Kommentar ohne Full-Page-Reload (Next.js router.refresh
        // patcht nur den RSC-Tree, Client-State bleibt erhalten).
        router.refresh();
      },
      onError: () => {
        onCommentFailed?.(temporaryId);
        if (viewerAuthor && onOptimisticComment) setBody(trimmed);
      },
    });
  };

  // Auto-grow textarea: auf Enter-Taste submitten (Shift+Enter = Zeilenumbruch).
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <div className="relative rounded-lg border border-border bg-card ring-0 transition-shadow focus-within:ring-2 focus-within:ring-ring">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Kommentar schreiben… (Enter zum Senden)"
          rows={2}
          maxLength={MAX + 1} // +1 damit wir den Overflow sehen
          disabled={mutation.isPending}
          className={cn(
            'w-full resize-none rounded-lg bg-transparent px-4 py-3 text-sm outline-none',
            'placeholder:text-muted-foreground disabled:opacity-60',
          )}
        />
        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          <span
            className={cn(
              'text-xs tabular-nums text-muted-foreground',
              remaining < 50 && 'text-amber-500',
              remaining < 0 && 'font-semibold text-destructive',
            )}
          >
            {remaining < 100 ? `${remaining} Zeichen übrig` : ''}
          </span>
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            <Send className="h-3.5 w-3.5" />
            {mutation.isPending ? 'Senden…' : 'Senden'}
          </button>
        </div>
      </div>
    </form>
  );
}
