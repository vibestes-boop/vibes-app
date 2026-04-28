'use client';
// Per-route error boundary for /p/[postId] — post detail.
// Keeps the nav/layout visible; only the post content slot shows the error.
// v1.w.UI.135
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Film } from 'lucide-react';

export default function PostError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[PostError]', error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <Film className="h-10 w-10 text-muted-foreground/40" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Post konnte nicht geladen werden.</p>
        <p className="text-xs text-muted-foreground">
          Vielleicht wurde er gelöscht oder es gibt ein vorübergehendes Problem.
        </p>
        {error.digest && (
          <p className="pt-1 font-mono text-[10px] text-muted-foreground/50">
            digest: {error.digest}
          </p>
        )}
      </div>
      <Button size="sm" variant="outline" onClick={reset}>
        <RefreshCw className="mr-2 h-3.5 w-3.5" />
        Nochmal versuchen
      </Button>
    </div>
  );
}
