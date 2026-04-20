'use client';

import { useState, useTransition } from 'react';
import { Download, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { exportMyData } from '@/app/actions/gdpr';

// -----------------------------------------------------------------------------
// <DataExportButton /> — triggert `exportMyData` Server-Action, baut aus der
// Response einen JSON-Blob und startet den Browser-Download via <a download>.
//
// Die Server-Action liefert die komplette Payload zurück — wir serialisieren
// sie client-seitig zu `application/json` und simulieren einen Click auf ein
// unsichtbares `<a>` mit einem Object-URL. Nach 2s Timeout wird der URL
// wieder revoked (Leak-Schutz).
// -----------------------------------------------------------------------------

type Status = 'idle' | 'ok' | 'error';

export function DataExportButton() {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status>('idle');

  function handleClick() {
    setStatus('idle');
    start(async () => {
      const res = await exportMyData();
      if (!res.ok) {
        toast.error(`Export fehlgeschlagen: ${res.error}`);
        setStatus('error');
        return;
      }

      try {
        const json = JSON.stringify(res.data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        const filename = `serlo-export-${ts}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // URL erst spät revoken — Firefox/iOS-Safari browsen den Object-URL
        // manchmal asynchron auf. 2s Puffer reicht praktisch immer.
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        setStatus('ok');
        toast.success('Deine Datenkopie wurde heruntergeladen.');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Download fehlgeschlagen: ${msg}`);
        setStatus('error');
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {pending ? 'Sammle Daten…' : 'Datenkopie als JSON herunterladen'}
      </button>

      {status === 'ok' && (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Heruntergeladen
        </span>
      )}
      {status === 'error' && (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
          <XCircle className="h-3.5 w-3.5" />
          Fehlgeschlagen
        </span>
      )}
    </div>
  );
}
