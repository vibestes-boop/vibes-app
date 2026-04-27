'use client';
// Per-route error boundary for /live/[id] — live stream viewer.
// v1.w.UI.135
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { Route } from 'next';
import { RefreshCw, Radio } from 'lucide-react';

export default function LiveViewerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[LiveViewerError]', error);
    }
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0b0b10] px-6 text-center text-white">
      <Radio className="h-10 w-10 text-white/30" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-white/80">Stream konnte nicht geladen werden.</p>
        <p className="text-xs text-white/40">
          Bitte versuche es nochmal oder geh zurück zu Live.
        </p>
        {error.digest && (
          <p className="pt-1 font-mono text-[10px] text-white/25">
            digest: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={reset} className="border-white/20 bg-white/10 text-white hover:bg-white/20">
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Nochmal
        </Button>
        <Button size="sm" variant="ghost" asChild className="text-white/60 hover:text-white">
          <Link href={'/live' as Route}>← Live-Übersicht</Link>
        </Button>
      </div>
    </div>
  );
}
