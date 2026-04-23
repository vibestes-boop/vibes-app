import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { Grid3x3, Play } from 'lucide-react';
import type { Post } from '@shared/types';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';

// -----------------------------------------------------------------------------
// PostGrid — server-rendered 3-Spalten-Grid, 9:16, klickbar zu /p/[id].
// Zeigt Thumbnail mit View-Count-Overlay. Wenn kein Thumbnail vorhanden ist,
// gibt's einen neutralen Dark-Placeholder (verhindert leere weiße Kacheln).
//
// Empty-State nutzt die kanonische `<EmptyState>`-Komponente (D5-Fix).
// Caller gibt Title + Description strukturiert rein, damit die Empty-View
// konsistent mit dem Rest der App aussieht (Icon-Circle + Headline + Sub).
// -----------------------------------------------------------------------------

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return n.toLocaleString('de-DE');
}

export function PostGrid({
  posts,
  className,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyCta,
}: {
  posts: Post[];
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyCta?: ReactNode;
}) {
  if (posts.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon ?? <Grid3x3 className="h-7 w-7" strokeWidth={1.75} />}
        title={emptyTitle ?? 'Noch keine Videos'}
        description={emptyDescription}
        cta={emptyCta}
        size="md"
        bordered
      />
    );
  }

  return (
    <ul className={cn('grid grid-cols-3 gap-1 sm:gap-1.5', className)}>
      {posts.map((post) => (
        <li key={post.id} className="group relative overflow-hidden rounded-md bg-muted">
          <Link
            href={`/p/${post.id}`}
            className="relative block aspect-[9/16] w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={
              post.caption ? `Video ansehen: ${post.caption.slice(0, 80)}` : 'Video ansehen'
            }
          >
            {post.thumbnail_url ? (
              <Image
                src={post.thumbnail_url}
                alt=""
                fill
                sizes="(min-width: 1024px) 300px, 33vw"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                // Thumbnails sind nicht above-the-fold — priority explizit weggelassen.
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black" />
            )}

            {/* View-Count unten links, leichter Gradient-Boden für Lesbarkeit */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-2">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-white drop-shadow">
                <Play className="h-3 w-3 fill-current" />
                {formatCount(post.view_count)}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
