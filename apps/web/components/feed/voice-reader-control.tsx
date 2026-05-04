'use client';

import { useEffect, useRef } from 'react';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { useCreatorVoiceSample } from '@/hooks/use-creator-voice-sample';
import { useVoiceReader } from '@/hooks/use-voice-reader';
import { cn } from '@/lib/utils';

interface VoiceReaderControlProps {
  postId: string;
  authorId: string;
  caption: string;
  autoStart?: boolean;
}

export function VoiceReaderControl({
  postId,
  authorId,
  caption,
  autoStart = false,
}: VoiceReaderControlProps) {
  const creatorVoiceUrl = useCreatorVoiceSample(authorId);
  const { isLoading, isPlaying, toggle } = useVoiceReader(
    postId,
    caption,
    0.5,
    creatorVoiceUrl,
  );
  const startedRef = useRef(false);

  useEffect(() => {
    if (!autoStart || startedRef.current) return;
    startedRef.current = true;
    void toggle();
  }, [autoStart, toggle]);

  const label = isPlaying ? 'Stop' : 'Vorlesen';
  const ariaLabel = isLoading
    ? 'Audio wird geladen...'
    : isPlaying
      ? 'Vorlesen stoppen'
      : creatorVoiceUrl
        ? 'Caption in Creator-Stimme vorlesen'
        : 'Caption vorlesen';

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-label={ariaLabel}
      className="group/action flex flex-col items-center gap-1 rounded-md outline-none transition-opacity duration-fast ease-out-expo focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
    >
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 transition-colors duration-base ease-out-expo group-hover/action:bg-foreground/20',
          isPlaying && 'bg-violet-500/20',
        )}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : isPlaying ? (
          <VolumeX className="h-5 w-5 text-violet-400" aria-hidden="true" />
        ) : (
          <Volume2
            className={cn(
              'h-5 w-5',
              creatorVoiceUrl ? 'text-violet-300' : 'text-foreground/70',
            )}
            aria-hidden="true"
          />
        )}
      </span>
      <span aria-hidden="true" className="text-xs font-semibold tabular-nums">
        {label}
      </span>
    </button>
  );
}
