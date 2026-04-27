'use client';

import { useRef, useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Trash2, Link as LinkIcon, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { deletePost, updatePostCaption } from '@/app/actions/posts';

// -----------------------------------------------------------------------------
// PostAuthorMenu — drei-Punkte-Dropdown für Post-Autoren auf /p/[postId].
//
// v1.w.UI.46: Post löschen + Link kopieren.
// v1.w.UI.79: Caption bearbeiten — öffnet Edit-Dialog mit Textarea.
// -----------------------------------------------------------------------------

export function PostAuthorMenu({
  postId,
  authorUsername,
  caption,
}: {
  postId: string;
  authorUsername: string;
  /** Aktuelle Caption — für Edit-Dialog Prefill. */
  caption?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Außerhalb-Klick schließt das Dropdown-Menü.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Post-Optionen"
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-popover shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Link kopieren */}
            <MenuItem
              icon={<LinkIcon className="h-4 w-4" />}
              label="Link kopieren"
              onClick={async () => {
                setOpen(false);
                try {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/p/${postId}`,
                  );
                  toast('Link kopiert.');
                } catch {
                  toast.error('Kopieren fehlgeschlagen.');
                }
              }}
            />

            {/* Caption bearbeiten */}
            <MenuItem
              icon={<Pencil className="h-4 w-4" />}
              label="Caption bearbeiten"
              onClick={() => {
                setOpen(false);
                setEditOpen(true);
              }}
            />

            {/* Trennlinie */}
            <div className="mx-3 border-t border-border/60" />

            {/* Post löschen */}
            <MenuItem
              icon={<Trash2 className="h-4 w-4" />}
              label={isDeleting ? 'Wird gelöscht…' : 'Post löschen'}
              destructive
              disabled={isDeleting}
              onClick={async () => {
                setOpen(false);
                if (
                  !confirm(
                    'Post wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
                  )
                )
                  return;
                setIsDeleting(true);
                const res = await deletePost(postId);
                if (res.ok) {
                  toast('Post gelöscht.');
                  router.push(`/u/${authorUsername}`);
                } else {
                  setIsDeleting(false);
                  toast.error(res.error ?? 'Löschen fehlgeschlagen.');
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Caption-Edit-Dialog — außerhalb des Menü-Refs damit Außerhalb-Klick
          ihn nicht schließt und er korrekt über allem liegt. */}
      {editOpen && (
        <CaptionEditDialog
          postId={postId}
          initialCaption={caption ?? ''}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

// ── CaptionEditDialog ─────────────────────────────────────────────────────────

function CaptionEditDialog({
  postId,
  initialCaption,
  onClose,
  onSaved,
}: {
  postId: string;
  initialCaption: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(initialCaption);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Autofokus + ESC-Handler
  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = () => {
    startTransition(async () => {
      const res = await updatePostCaption(postId, value);
      if (res.ok) {
        toast.success('Caption gespeichert.');
        onSaved();
      } else {
        toast.error(res.error ?? 'Speichern fehlgeschlagen.');
      }
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Caption bearbeiten"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-2xl"
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">Caption bearbeiten</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-muted"
          >
            <span aria-hidden="true" className="text-lg leading-none">×</span>
          </button>
        </header>

        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="Was möchtest du mitteilen? #hashtag @mention"
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
          <div className="mt-1 text-right text-xs text-muted-foreground">
            {value.length} / 2000
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || value.trim() === initialCaption.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Speichern
          </button>
        </footer>
      </div>
    </div>
  );
}

// ── internes MenuItem ─────────────────────────────────────────────────────────

function MenuItem({
  icon,
  label,
  destructive,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors focus:outline-none',
        destructive
          ? 'text-destructive hover:bg-destructive/10 focus:bg-destructive/10'
          : 'text-foreground hover:bg-muted focus:bg-muted',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center', destructive ? 'text-destructive' : 'text-muted-foreground')}>
        {icon}
      </span>
      <span className="flex-1 truncate font-medium">{label}</span>
    </button>
  );
}
