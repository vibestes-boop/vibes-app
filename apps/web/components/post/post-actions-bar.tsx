'use client';

import { useState } from 'react';
import { Bookmark, BookmarkCheck, Download } from 'lucide-react';
import { toast } from 'sonner';
import { LikeButton } from '@/components/feed/like-button';
import { useTogglePostLike, useTogglePostSave } from '@/hooks/use-engagement';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// PostActionsBar — Like + Bookmark + Download als Client-Island im Post-Detail.
//
// Unterschied zum Feed-Rail-LikeButton: hier horizontal statt vertikal,
// und mit Label-Text statt Count unterhalb. Renutzt aber dieselbe
// LikeButton-Komponente (Burst-Animation etc.).
//
// isAuthenticated-Guard: Wenn nicht eingeloggt, zeigt Like-Button ein
// Toast statt die Mutation aufzurufen.
//
// v1.w.UI.119: Download-Button — sichtbar wenn `allowDownload && videoUrl`.
// Nutzt <a download> auf die öffentliche R2-URL.
// -----------------------------------------------------------------------------

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return n.toLocaleString('de-DE');
}

export function PostActionsBar({
  postId,
  initialLiked,
  initialSaved,
  likeCount: initialLikeCount,
  isAuthenticated,
  videoUrl,
  allowDownload,
}: {
  postId: string;
  initialLiked: boolean;
  initialSaved: boolean;
  likeCount: number;
  isAuthenticated: boolean;
  videoUrl?: string;
  allowDownload?: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [likeCount, setLikeCount] = useState(initialLikeCount);

  const likeMutation = useTogglePostLike();
  const saveMutation = useTogglePostSave();

  const handleLike = () => {
    if (!isAuthenticated) {
      toast.error('Bitte melde dich an, um Posts zu liken.');
      return;
    }
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    likeMutation.mutate(
      { postId, liked: wasLiked },
      {
        onError: () => {
          setLiked(wasLiked);
          setLikeCount((c) => c + (wasLiked ? 1 : -1));
        },
      },
    );
  };

  const handleSave = () => {
    if (!isAuthenticated) {
      toast.error('Bitte melde dich an, um Posts zu speichern.');
      return;
    }
    const wasSaved = saved;
    setSaved(!wasSaved);
    saveMutation.mutate(
      { postId, saved: wasSaved },
      {
        onError: () => setSaved(wasSaved),
      },
    );
  };

  return (
    <div className="flex items-center gap-2">
      {/* Like — renutzt LikeButton mit Burst-Animation */}
      <LikeButton
        liked={liked}
        countLabel={formatCount(likeCount)}
        rawCount={likeCount}
        disabled={likeMutation.isPending}
        onClick={handleLike}
        iconClassName="h-5 w-5"
        circleClassName="h-9 w-9"
      />

      {/* Bookmark */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saveMutation.isPending}
        aria-label={saved ? 'Gespeichert — entfernen' : 'Post speichern'}
        className={cn(
          'flex flex-col items-center gap-1 rounded-md outline-none transition-opacity',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:opacity-60',
        )}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 transition-colors hover:bg-foreground/20">
          {saved ? (
            <BookmarkCheck className="h-5 w-5 fill-brand-gold text-brand-gold" />
          ) : (
            <Bookmark className="h-5 w-5 text-foreground" />
          )}
        </span>
        <span className="text-xs font-semibold tabular-nums text-foreground/70">
          {saved ? 'Gespeichert' : 'Speichern'}
        </span>
      </button>

      {/* Download — nur wenn Autor es erlaubt hat und URL vorliegt */}
      {allowDownload && videoUrl && (
        <a
          href={videoUrl}
          download
          aria-label="Video herunterladen"
          className={cn(
            'flex flex-col items-center gap-1 rounded-md outline-none transition-opacity',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          )}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 transition-colors hover:bg-foreground/20">
            <Download className="h-5 w-5 text-foreground" />
          </span>
          <span className="text-xs font-semibold text-foreground/70">Download</span>
        </a>
      )}
    </div>
  );
}
