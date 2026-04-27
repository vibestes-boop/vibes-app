'use client';
// Per-route error boundary for /g/[id] — guild (pod) detail.
// v1.w.UI.135
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Shield } from 'lucide-react';

export default function GuildError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[GuildError]', error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <Shield className="h-10 w-10 text-muted-foreground/40" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Pod konnte nicht geladen werden.</p>
        <p className="text-xs text-muted-foreground">
          Bitte versuche es gleich nochmal.
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
