'use client';

import { useRef, useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Trash2, Link as LinkIcon, Pencil, Loader2, Globe, Users, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { deletePost, updatePost } from '@/app/actions/posts';
import type { UpdatePostInput } from '@/app/actions/posts';

// -----------------------------------------------------------------------------
// PostAuthorMenu — drei-Punkte-Dropdown für Post-Autoren auf /p/[postId].
//
// v1.w.UI.46: Post löschen + Link kopieren.
// v1.w.UI.79: Post bearbeiten — Caption, Privacy, Kommentare/Download/Duett.
// -----------------------------------------------------------------------------

export function PostAuthorMenu({
  postId,
  authorUsername,
  caption,
  privacy = 'public',
  allowComments = true,
  allowDownload = true,
  allowDuet = true,
}: {
  postId: string;
  authorUsername: string;
  caption?: string | null;
  privacy?: 'public' | 'friends' | 'private';
  allowComments?: boolean;
  allowDownload?: boolean;
  allowDuet?: boolean;
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

            {/* Post bearbeiten */}
            <MenuItem
              icon={<Pencil className="h-4 w-4" />}
              label="Post bearbeiten"
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

      {/* Post-Edit-Dialog — außerhalb des Menü-Refs damit Außerhalb-Klick
          ihn nicht schließt und er korrekt über allem liegt. */}
      {editOpen && (
        <PostEditDialog
          postId={postId}
          initialCaption={caption ?? ''}
          initialPrivacy={privacy}
          initialAllowComments={allowComments}
          initialAllowDownload={allowDownload}
          initialAllowDuet={allowDuet}
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

// ── PostEditDialog ────────────────────────────────────────────────────────────

type Privacy = 'public' | 'friends' | 'private';

const PRIVACY_OPTIONS: {
  value: Privacy;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  { value: 'public',  label: 'Öffentlich', icon: <Globe className="h-4 w-4" />,  description: 'Alle können diesen Post sehen' },
  { value: 'friends', label: 'Freunde',    icon: <Users className="h-4 w-4" />,  description: 'Nur deine Follower sehen diesen Post' },
  { value: 'private', label: 'Privat',     icon: <Lock  className="h-4 w-4" />,  description: 'Nur du siehst diesen Post' },
];

function PostEditDialog({
  postId,
  initialCaption,
  initialPrivacy,
  initialAllowComments,
  initialAllowDownload,
  initialAllowDuet,
  onClose,
  onSaved,
}: {
  postId: string;
  initialCaption: string;
  initialPrivacy: Privacy;
  initialAllowComments: boolean;
  initialAllowDownload: boolean;
  initialAllowDuet: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [caption, setCaption]               = useState(initialCaption);
  const [privacy, setPrivacy]               = useState<Privacy>(initialPrivacy);
  const [allowComments, setAllowComments]   = useState(initialAllowComments);
  const [allowDownload, setAllowDownload]   = useState(initialAllowDownload);
  const [allowDuet, setAllowDuet]           = useState(initialAllowDuet);
  const [isPending, startTransition]        = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Autofokus + ESC-Handler
  useEffect(() => {
    textareaRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const isDirty =
    caption.trim() !== initialCaption.trim() ||
    privacy !== initialPrivacy ||
    allowComments !== initialAllowComments ||
    allowDownload !== initialAllowDownload ||
    allowDuet !== initialAllowDuet;

  const handleSave = () => {
    startTransition(async () => {
      const input: UpdatePostInput = {
        caption,
        privacy,
        allowComments,
        allowDownload,
        allowDuet,
      };
      const res = await updatePost(postId, input);
      if (res.ok) {
        toast.success('Post gespeichert.');
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
      aria-label="Post bearbeiten"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-2xl"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">Post bearbeiten</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-muted"
          >
            <span aria-hidden="true" className="text-lg leading-none">×</span>
          </button>
        </header>

        <div className="max-h-[70dvh] overflow-y-auto p-4 space-y-5">

          {/* Caption */}
          <section>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Caption
            </label>
            <textarea
              ref={textareaRef}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Was möchtest du mitteilen? #hashtag @mention"
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">
              {caption.length} / 2000
            </div>
          </section>

          {/* Privacy */}
          <section>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Sichtbarkeit
            </label>
            <div className="space-y-1.5">
              {PRIVACY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPrivacy(opt.value)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                    privacy === opt.value
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted',
                  )}
                >
                  <span className={cn('shrink-0', privacy === opt.value ? 'text-primary' : '')}>
                    {opt.icon}
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium text-foreground">{opt.label}</span>
                    <span className="block text-xs text-muted-foreground">{opt.description}</span>
                  </span>
                  {privacy === opt.value && (
                    <span className="text-xs font-semibold text-primary">✓</span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Toggles */}
          <section>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Interaktionen
            </label>
            <div className="overflow-hidden rounded-xl border border-border divide-y divide-border">
              <ToggleRow label="Kommentare erlauben" checked={allowComments} onChange={setAllowComments} />
              <ToggleRow label="Download erlauben"   checked={allowDownload} onChange={setAllowDownload} />
              <ToggleRow label="Duett erlauben"      checked={allowDuet}    onChange={setAllowDuet} />
            </div>
          </section>
        </div>

        {/* Footer */}
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
            disabled={isPending || !isDirty}
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

// ── ToggleRow ─────────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between bg-background px-3 py-3">
      <span className="text-sm text-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          checked ? 'bg-primary' : 'bg-muted-foreground/30',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
          )}
        />
      </button>
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
