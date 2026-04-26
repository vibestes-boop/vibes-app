'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useCreateComment } from '@/hooks/use-engagement';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// CommentForm — Kommentar-Eingabe für /p/[postId].
//
// Nicht eingeloggte User: zeigen Login-CTA statt Formular.
// Max 500 Zeichen (gespiegelt aus createComment Server Action).
// Optimistic-Update läuft im Hook (invalidateQueries auf ['comments', postId]).
// -----------------------------------------------------------------------------

const MAX = 500;

export function CommentForm({
  postId,
  isAuthenticated,
  postPath,
}: {
  postId: string;
  isAuthenticated: boolean;
  /** Aktueller Pfad für den Login-Redirect (z.B. '/p/abc123'). */
  postPath: string;
}) {
  const [body, setBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    mutation.mutate(trimmed, {
      onSuccess: () => {
        setBody('');
        textareaRef.current?.blur();
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
