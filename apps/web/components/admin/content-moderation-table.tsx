'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import { toast } from 'sonner';
import { Trash2, ExternalLink, Heart, MessageCircle, Eye } from 'lucide-react';
import { adminRemovePost, type AdminContentPost } from '@/app/actions/admin';

export function ContentModerationTable({ posts }: { posts: AdminContentPost[] }) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  async function handleRemove(id: string) {
    if (!confirm('Diesen Beitrag als Admin entfernen? Wird protokolliert.')) return;
    setRemovingId(id);
    const res = await adminRemovePost(id);
    setRemovingId(null);
    if (res.ok) {
      setHidden((prev) => new Set(prev).add(id));
      toast('Beitrag entfernt.');
      router.refresh();
    } else {
      toast.error(res.error ?? 'Entfernen fehlgeschlagen.');
    }
  }

  const visible = posts.filter((p) => !hidden.has(p.id));
  if (visible.length === 0) {
    return (
      <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-border px-3 text-center text-[11px] text-muted-foreground">
        Keine Inhalte gefunden.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {visible.map((post) => (
        <div key={post.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
            {post.thumbnail_url ? (
              <NextImage src={post.thumbnail_url} alt="" fill sizes="48px" className="object-cover" unoptimized />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[9px] text-muted-foreground">kein Bild</div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-foreground">
              {post.caption?.trim() || `Post #${post.id.slice(0, 6)}`}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {post.author_username ? `@${post.author_username}` : 'Unbekannt'} · {new Date(post.created_at).toLocaleDateString('de-DE')}
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[10px] tabular-nums text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{post.view_count}</span>
              <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{post.like_count}</span>
              <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{post.comment_count}</span>
            </div>
          </div>

          <a
            href={`/p/${post.id}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Post öffnen"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={() => void handleRemove(post.id)}
            disabled={removingId === post.id}
            aria-label="Beitrag entfernen"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/5 px-2.5 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {removingId === post.id ? 'Entferne…' : 'Entfernen'}
          </button>
        </div>
      ))}
    </div>
  );
}
