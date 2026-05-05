'use client';
// Per-route error boundary for /shop/[id] — product detail.
// v1.w.UI.135
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, ShoppingBag } from 'lucide-react';

export default function ProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {

      console.error('[ProductError]', error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Produkt konnte nicht geladen werden.</p>
        <p className="text-xs text-muted-foreground">
          Vielleicht wurde es entfernt oder es gibt ein vorübergehendes Problem.
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
