'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Trash2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { deletePost } from '@/app/actions/posts';

// -----------------------------------------------------------------------------
// PostAuthorMenu — drei-Punkte-Dropdown für Post-Autoren auf /p/[postId].
//
// v1.w.UI.46: Nur für `isSelf` gerendert (Server-Component entscheidet,
// Client bekommt keine Viewer-ID — die Render-Entscheidung liegt beim Server).
// Bietet: Post löschen + Link kopieren.
// Nach erfolgreichem Löschen: Redirect zum Profil des Autors.
// -----------------------------------------------------------------------------

export function PostAuthorMenu({
  postId,
  authorUsername,
}: {
  postId: string;
  authorUsername: string;
}) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Außerhalb-Klick schließt das Menü.
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
