'use client';
// Per-route error boundary for /live/replay/[id] — VOD replay.
// v1.w.UI.135
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { Route } from 'next';
import { RefreshCw, Clapperboard } from 'lucide-react';

export default function ReplayError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[ReplayError]', error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <Clapperboard className="h-10 w-10 text-muted-foreground/40" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Replay konnte nicht geladen werden.</p>
        <p className="text-xs text-muted-foreground">
          Bitte versuche es nochmal oder geh zurück zu Live.
        </p>
        {error.digest && (
          <p className="pt-1 font-mono text-[10px] text-muted-foreground/50">
            digest: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={reset}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Nochmal
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href={'/live' as Route}>← Live</Link>
        </Button>
      </div>
    </div>
  );
}
