'use client';

// -----------------------------------------------------------------------------
// WebPushCard — UI-Karte für Web-Push-Opt-In / Opt-Out.
//
// Status-Zustände vom `useWebPush`-Hook werden zu 5 UI-Varianten:
//
//   unsupported → Text-Hinweis, kein CTA
//   denied      → Hinweis auf Browser-Settings (Permission ist nur vom
//                 User im UA-UI reversibel, wir können nichts tun)
//   default     → Grüner „Aktivieren"-Button
//   pending     → Button disabled + Spinner-Wording
//   subscribed  → Roter Text + „Deaktivieren"-Button
//
// Absichtlich keine Tailwind-Anim (Spinner etc.) — die State-Transitions
// sind sub-500ms, ein echter Spinner wäre Overkill und würde eher Motion-
// Sickness auslösen.
// -----------------------------------------------------------------------------

import { AlertTriangle, Bell, BellOff, CheckCircle2, Info } from 'lucide-react';

import { useWebPush } from '@/hooks/use-web-push';

export function WebPushCard() {
  const { status, error, subscribe, unsubscribe, isLoading } = useWebPush();

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          <h2 className="text-base font-semibold">Browser-Push</h2>
        </div>
        <StatusBadge status={status} isLoading={isLoading} />
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Nachrichten, Go-Live-Hinweise und Geschenke landen direkt im Browser —
        auch wenn Serlo nicht offen ist. Jederzeit deaktivierbar.
      </p>

      {status === 'unsupported' && (
        <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p>
            Dein Browser unterstützt keine Web-Push-Benachrichtigungen. Auf
            iPhone geht es nur wenn du Serlo als Web-App zum Home-Bildschirm
            hinzufügst (iOS 16.4+).
          </p>
        </div>
      )}

      {status === 'denied' && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Blockiert im Browser</p>
            <p className="mt-1 text-muted-foreground">
              Du hast Benachrichtigungen abgelehnt. Wir können das nicht
              rückgängig machen — öffne die Seiten-Einstellungen in deinem
              Browser (Schloss-Symbol neben der URL) und erlaube
              &bdquo;Benachrichtigungen&quot;.
            </p>
          </div>
        </div>
      )}

      {(status === 'default' || status === 'pending') && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void subscribe()}
            disabled={status === 'pending' || isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Bell className="h-4 w-4" />
            {status === 'pending' ? 'Wird aktiviert…' : 'Aktivieren'}
          </button>
          <span className="text-xs text-muted-foreground">
            Du wirst einmalig nach der Browser-Erlaubnis gefragt.
          </span>
        </div>
      )}

      {status === 'subscribed' && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void unsubscribe()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <BellOff className="h-4 w-4" />
            Deaktivieren
          </button>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Aktiv auf diesem Gerät
          </span>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-destructive/5 p-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

function StatusBadge({
  status,
  isLoading,
}: {
  status: ReturnType<typeof useWebPush>['status'];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Prüfe…
      </span>
    );
  }

  const label: Record<typeof status, string> = {
    unsupported: 'Nicht verfügbar',
    denied: 'Blockiert',
    default: 'Aus',
    pending: '…',
    subscribed: 'An',
  };

  const tone: Record<typeof status, string> = {
    unsupported: 'bg-muted text-muted-foreground',
    denied: 'bg-destructive/10 text-destructive',
    default: 'bg-muted text-muted-foreground',
    pending: 'bg-muted text-muted-foreground',
    subscribed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone[status]}`}
    >
      {label[status]}
    </span>
  );
}
